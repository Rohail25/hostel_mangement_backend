const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');
const path = require('path');

const buildHostelScopeFilter = (req) => {
  if (req.userRole === 'owner') {
    return { ownerId: req.userId };
  }
  if (req.userRole === 'manager') {
    return { managedBy: req.userId };
  }
  return {};
};

const buildTenantAccessFilter = (req) => {
  const hostelFilter = buildHostelScopeFilter(req);
  if (!Object.keys(hostelFilter).length) return {};
  return {
    allocations: {
      some: {
        hostel: hostelFilter,
      },
    },
  };
};

const ensureTenantAccess = async (req, tenantId) => {
  if (req.userRole === 'admin' || req.userRole === 'staff') {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
  }

  return prisma.tenant.findFirst({
    where: {
      id: tenantId,
      ...buildTenantAccessFilter(req),
    },
    select: { id: true },
  });
};

const parseJsonField = (value) => {
  if (value === undefined || value === null) return null;
  if (value === '') return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// ======================================================
// CREATE TENANT
// ======================================================
const createTenant = async (req, res) => {
  try {
    const {
      userId,
      firstName,
      lastName,
      email,
      phone,
      alternatePhone,
      gender,
      dateOfBirth,
      cnicNumber,
      address,
      permanentAddress,
      emergencyContact,
      occupation,
      companyName,
      designation,
      monthlyIncome,
      notes,
      leaseStartDate,
      leaseEndDate,
      monthlyRent,
      securityDeposit: securityDepositInput,
      deposit,
      depositAmount
    } = req.body;

    // Handle uploaded files
    const profilePhoto = req.files?.profilePhoto?.[0]
      ? `/uploads/tenants/${req.files.profilePhoto[0].filename}`
      : null;

    const documentFiles = req.files?.documents?.map(file => `/uploads/tenants/${file.filename}`) || [];
    const documents = documentFiles.length ? JSON.stringify(documentFiles) : null;

    // Parse lease and rent values
    let parsedLeaseStartDate = null;
    if (leaseStartDate) {
      parsedLeaseStartDate = new Date(leaseStartDate);
      if (Number.isNaN(parsedLeaseStartDate.getTime())) {
        return errorResponse(res, "Invalid lease start date", 400);
      }
    }

    let parsedLeaseEndDate = null;
    if (leaseEndDate) {
      parsedLeaseEndDate = new Date(leaseEndDate);
      if (Number.isNaN(parsedLeaseEndDate.getTime())) {
        return errorResponse(res, "Invalid lease end date", 400);
      }
    }

    if (parsedLeaseStartDate && parsedLeaseEndDate && parsedLeaseEndDate < parsedLeaseStartDate) {
      return errorResponse(res, "Lease end date cannot be before lease start date", 400);
    }

    let parsedMonthlyRent = null;
    if (monthlyRent !== undefined && monthlyRent !== null && monthlyRent !== "") {
      parsedMonthlyRent = parseFloat(monthlyRent);
      if (Number.isNaN(parsedMonthlyRent) || parsedMonthlyRent < 0) {
        return errorResponse(res, "Invalid monthly rent amount", 400);
      }
    }

    const rawDepositValue = deposit ?? depositAmount ?? securityDepositInput;
    let parsedSecurityDeposit = null;
    if (rawDepositValue !== undefined && rawDepositValue !== null && rawDepositValue !== "") {
      parsedSecurityDeposit = parseFloat(rawDepositValue);
      if (Number.isNaN(parsedSecurityDeposit) || parsedSecurityDeposit < 0) {
        return errorResponse(res, "Invalid deposit amount", 400);
      }
    }

    // Validation
    if (!firstName || !phone) {
      return errorResponse(res, "First name and phone number are required", 400);
    }

    // Check if email already exists
    if (email) {
      const existingTenant = await prisma.tenant.findUnique({ where: { email } });
      if (existingTenant) return errorResponse(res, "Email already registered", 400);
    }

    // Check if CNIC already exists
    if (cnicNumber) {
      const existingCNIC = await prisma.tenant.findUnique({ where: { cnicNumber } });
      if (existingCNIC) return errorResponse(res, "CNIC number already registered", 400);
    }

    // Check if linked user exists
    let userIdExist = userId ? parseInt(userId) : null;
    if (userIdExist) {
      const userExists = await prisma.user.findUnique({ where: { id: userIdExist } });
      if (!userExists) return errorResponse(res, "User not found", 404);

      const existingTenantProfile = await prisma.tenant.findFirst({ where: { userId: userIdExist } });
      if (existingTenantProfile) return errorResponse(res, "This user already has a tenant profile", 400);
    }

    // Create Tenant
    let parsedMonthlyIncome = null;
    if (monthlyIncome !== undefined && monthlyIncome !== null && monthlyIncome !== "") {
      const converted = parseFloat(monthlyIncome);
      if (Number.isNaN(converted)) {
        return errorResponse(res, "Invalid monthly income amount", 400);
      }
      parsedMonthlyIncome = converted;
    }

    const tenantData = {
      userId: userIdExist,
      firstName,
      lastName: lastName || null,
      name: `${firstName} ${lastName || ""}`.trim(),
      email: email || null,
      phone,
      alternatePhone: alternatePhone || null,
      gender: gender || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      cnicNumber: cnicNumber || null,
      address: parseJsonField(address),
      permanentAddress: parseJsonField(permanentAddress),
      emergencyContact: parseJsonField(emergencyContact),
      occupation: occupation || null,
      companyName: companyName || null,
      designation: designation || null,
      monthlyIncome: parsedMonthlyIncome,
      documents,
      profilePhoto,
      notes: notes || null,
      leaseStartDate: parsedLeaseStartDate,
      leaseEndDate: parsedLeaseEndDate,
      monthlyRent: parsedMonthlyRent,
      securityDeposit: parsedSecurityDeposit ?? 0
    };

    const tenant = await prisma.tenant.create({
      data: tenantData
    });

    return successResponse(res, tenant, "Tenant created successfully", 201);
  } catch (err) {
    console.error("Create Tenant Error:", err);
    return errorResponse(res, err.message, 400);
  }
};

// ======================================================
// UPDATE TENANT
// ======================================================
const updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = parseInt(id, 10);

    if (Number.isNaN(tenantId)) {
      return errorResponse(res, "Invalid tenant id", 400);
    }

    const updates = req.body;

    const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existingTenant) return errorResponse(res, "Tenant not found", 404);

    if (req.userRole !== 'admin' && req.userRole !== 'staff') {
      const canAccess = await ensureTenantAccess(req, tenantId);
      if (!canAccess) {
        return errorResponse(res, "Tenant not found", 404);
      }
    }

    // Handle uploaded files
    const profilePhoto = req.files?.profilePhoto?.[0]
      ? `/uploads/tenants/${req.files.profilePhoto[0].filename}`
      : undefined;

    const documentFiles = req.files?.documents?.map(file => `/uploads/tenants/${file.filename}`) || [];
    const documents = documentFiles.length ? JSON.stringify(documentFiles) : existingTenant.documents;

    // Check email duplication
    if (updates.email && updates.email !== existingTenant.email) {
      const emailExists = await prisma.tenant.findUnique({ where: { email: updates.email } });
      if (emailExists) return errorResponse(res, "Email already registered", 400);
    }

    // Check CNIC duplication
    if (updates.cnicNumber && updates.cnicNumber !== existingTenant.cnicNumber) {
      const cnicExists = await prisma.tenant.findUnique({ where: { cnicNumber: updates.cnicNumber } });
      if (cnicExists) return errorResponse(res, "CNIC number already registered", 400);
    }

    const updatedFirstName = hasOwn(updates, "firstName")
      ? (updates.firstName === null || updates.firstName === '' ? null : updates.firstName)
      : existingTenant.firstName;

    const updatedLastName = hasOwn(updates, "lastName")
      ? (updates.lastName === null || updates.lastName === '' ? null : updates.lastName)
      : existingTenant.lastName;

    let updateLeaseStartDate = existingTenant.leaseStartDate;
    if (hasOwn(updates, "leaseStartDate")) {
      if (!updates.leaseStartDate) {
        updateLeaseStartDate = null;
      } else {
        const parsed = new Date(updates.leaseStartDate);
        if (Number.isNaN(parsed.getTime())) {
          return errorResponse(res, "Invalid lease start date", 400);
        }
        updateLeaseStartDate = parsed;
      }
    }

    let updateLeaseEndDate = existingTenant.leaseEndDate;
    if (hasOwn(updates, "leaseEndDate")) {
      if (!updates.leaseEndDate) {
        updateLeaseEndDate = null;
      } else {
        const parsed = new Date(updates.leaseEndDate);
        if (Number.isNaN(parsed.getTime())) {
          return errorResponse(res, "Invalid lease end date", 400);
        }
        updateLeaseEndDate = parsed;
      }
    }

    if (updateLeaseStartDate && updateLeaseEndDate && updateLeaseEndDate < updateLeaseStartDate) {
      return errorResponse(res, "Lease end date cannot be before lease start date", 400);
    }

    let updateMonthlyRent = existingTenant.monthlyRent;
    if (hasOwn(updates, "monthlyRent")) {
      if (updates.monthlyRent === null || updates.monthlyRent === "") {
        updateMonthlyRent = null;
      } else {
        const parsed = parseFloat(updates.monthlyRent);
        if (Number.isNaN(parsed) || parsed < 0) {
          return errorResponse(res, "Invalid monthly rent amount", 400);
        }
        updateMonthlyRent = parsed;
      }
    }

    const rawUpdateDeposit = (updates.deposit ?? updates.depositAmount ?? updates.securityDeposit);
    let updateSecurityDeposit = existingTenant.securityDeposit;
    if (hasOwn(updates, "deposit") ||
        hasOwn(updates, "depositAmount") ||
        hasOwn(updates, "securityDeposit")) {
      if (rawUpdateDeposit === null || rawUpdateDeposit === "" || rawUpdateDeposit === undefined) {
        updateSecurityDeposit = 0;
      } else {
        const parsed = parseFloat(rawUpdateDeposit);
        if (Number.isNaN(parsed) || parsed < 0) {
          return errorResponse(res, "Invalid deposit amount", 400);
        }
        updateSecurityDeposit = parsed;
      }
    }

    let updateMonthlyIncome = existingTenant.monthlyIncome;
    if (hasOwn(updates, "monthlyIncome")) {
      if (updates.monthlyIncome === null || updates.monthlyIncome === "") {
        updateMonthlyIncome = null;
      } else {
        const parsedIncome = parseFloat(updates.monthlyIncome);
        if (Number.isNaN(parsedIncome)) {
          return errorResponse(res, "Invalid monthly income amount", 400);
        }
        updateMonthlyIncome = parsedIncome;
      }
    }

    // Update data
    const updateData = {
      firstName: updatedFirstName,
      lastName: updatedLastName,
      name: `${updatedFirstName || ""} ${updatedLastName || ""}`.trim(),
      email: updates.email || existingTenant.email,
      phone: updates.phone || existingTenant.phone,
      alternatePhone: updates.alternatePhone || existingTenant.alternatePhone,
      gender: updates.gender || existingTenant.gender,
      dateOfBirth: updates.dateOfBirth ? new Date(updates.dateOfBirth) : existingTenant.dateOfBirth,
      cnicNumber: updates.cnicNumber || existingTenant.cnicNumber,
      address: hasOwn(updates, "address") ? parseJsonField(updates.address) : existingTenant.address,
      permanentAddress: hasOwn(updates, "permanentAddress") ? parseJsonField(updates.permanentAddress) : existingTenant.permanentAddress,
      emergencyContact: hasOwn(updates, "emergencyContact") ? parseJsonField(updates.emergencyContact) : existingTenant.emergencyContact,
      occupation: updates.occupation || existingTenant.occupation,
      companyName: updates.companyName || existingTenant.companyName,
      designation: updates.designation || existingTenant.designation,
      monthlyIncome: updateMonthlyIncome,
      documents,
      profilePhoto: profilePhoto ?? existingTenant.profilePhoto,
      notes: updates.notes || existingTenant.notes,
      status: updates.status || existingTenant.status,
      rating: updates.rating ? parseInt(updates.rating) : existingTenant.rating,
      leaseStartDate: updateLeaseStartDate,
      leaseEndDate: updateLeaseEndDate,
      monthlyRent: updateMonthlyRent,
      securityDeposit: updateSecurityDeposit
    };

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData
    });

    return successResponse(res, tenant, "Tenant updated successfully", 200);
  } catch (err) {
    console.error("Update Tenant Error:", err);
    return errorResponse(res, err.message, 400);
  }
};

// ======================================================
// GET ALL TENANTS
// ======================================================
const getAllTenants = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      ...buildTenantAccessFilter(req),
    };

    if (status) where.status = String(status);

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { cnicNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          allocations: {
            where: { status: 'active' },
            include: {
              bed: { select: { bedNumber: true } },
              room: { select: { roomNumber: true } },
              hostel: { select: { id: true, name: true } },
            },
          },
          _count: { select: { payments: true, allocations: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip,
      }),
      prisma.tenant.count({ where }),
    ]);

    return successResponse(
      res,
      {
        tenants,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
      "Tenants retrieved successfully"
    );
  } catch (err) {
    console.error("Get All Tenants Error:", err);
    return errorResponse(res, err.message);
  }
};

// ======================================================
// DELETE TENANT
// ======================================================
const deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = parseInt(id, 10);

    if (Number.isNaN(tenantId)) {
      return errorResponse(res, "Invalid tenant id", 400);
    }

    if (req.userRole !== 'admin' && req.userRole !== 'staff') {
      const canAccess = await ensureTenantAccess(req, tenantId);
      if (!canAccess) {
        return errorResponse(res, "Tenant not found", 404);
      }
    }

    const activeAllocation = await prisma.allocation.findFirst({
      where: { tenantId, status: 'active' }
    });

    if (activeAllocation)
      return errorResponse(res, "Cannot delete tenant with active allocations.", 400);

    await prisma.tenant.delete({ where: { id: tenantId } });
    return successResponse(res, null, "Tenant deleted successfully");
  } catch (err) {
    console.error("Delete Tenant Error:", err);
    return errorResponse(res, err.message);
  }
};

// ======================================================
// GET TENANT BY ID (Detailed Profile)
// ======================================================
const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = parseInt(id, 10);

    if (Number.isNaN(tenantId)) {
      return errorResponse(res, "Invalid tenant id", 400);
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        ...buildTenantAccessFilter(req),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true
          }
        },
        allocations: {
          orderBy: { createdAt: 'desc' },
          include: {
            hostel: { select: { id: true, name: true, address: true } },
            creator: { select: { id: true, name: true } }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            hostel: { select: { id: true, name: true } },
            collector: { select: { id: true, name: true } }
          }
        },
        alerts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (!tenant) {
      return errorResponse(res, "Tenant not found", 404);
    }

    return successResponse(res, tenant, "Tenant retrieved successfully");
  } catch (err) {
    console.error("Get Tenant By ID Error:", err);
    return errorResponse(res, err.message);
  }
};

// ======================================================
// GET TENANT PAYMENT HISTORY
// ======================================================
const getTenantPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const tenantId = parseInt(id, 10);
    if (Number.isNaN(tenantId)) {
      return errorResponse(res, "Invalid tenant id", 400);
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const tenantAccess = await ensureTenantAccess(req, tenantId);
    if (!tenantAccess) {
      return errorResponse(res, "Tenant not found", 404);
    }

    const hostelFilter = buildHostelScopeFilter(req);

    const where = {
      tenantId,
    };
    if (status) {
      where.status = String(status);
    }
    if (Object.keys(hostelFilter).length) {
      where.hostel = hostelFilter;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          hostel: { select: { id: true, name: true } },
          collector: { select: { id: true, name: true } }
        }
      }),
      prisma.payment.count({ where })
    ]);

    const paidAmount = await prisma.payment.aggregate({
      where: { ...where, status: 'paid' },
      _sum: { amount: true }
    });

    const outstandingAmount = await prisma.payment.aggregate({
      where: { ...where, status: { in: ['pending', 'partial', 'overdue'] } },
      _sum: { amount: true }
    });

    return successResponse(
      res,
      {
        payments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        },
        totals: {
          paid: paidAmount._sum.amount || 0,
          outstanding: outstandingAmount._sum.amount || 0
        }
      },
      "Tenant payment history retrieved successfully"
    );
  } catch (err) {
    console.error("Get Tenant Payment History Error:", err);
    return errorResponse(res, err.message);
  }
};

// ======================================================
// GET TENANT FINANCIAL SUMMARY
// ======================================================
const getTenantFinancialSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = parseInt(id, 10);

    if (Number.isNaN(tenantId)) {
      return errorResponse(res, "Invalid tenant id", 400);
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        ...buildTenantAccessFilter(req),
      },
      select: {
        id: true,
        name: true,
        status: true,
        totalPaid: true,
        totalDue: true,
        securityDeposit: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!tenant) {
      return errorResponse(res, "Tenant not found", 404);
    }

    const hostelFilter = buildHostelScopeFilter(req);
    const paymentWhere = Object.keys(hostelFilter).length
      ? { tenantId, hostel: hostelFilter }
      : { tenantId };

    const [paidAggregate, pendingAggregate, recentPayment] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...paymentWhere, status: 'paid' },
        _sum: { amount: true },
        _count: { _all: true }
      }),
      prisma.payment.aggregate({
        where: { ...paymentWhere, status: { in: ['pending', 'partial', 'overdue'] } },
        _sum: { amount: true },
        _count: { _all: true }
      }),
      prisma.payment.findFirst({
        where: paymentWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          hostel: { select: { id: true, name: true } }
        }
      })
    ]);

    const summary = {
      tenant,
      payments: {
        totalPaidAmount: paidAggregate._sum.amount || 0,
        totalPaidCount: paidAggregate._count._all,
        outstandingAmount: pendingAggregate._sum.amount || 0,
        outstandingCount: pendingAggregate._count._all,
        lastPayment: recentPayment || null
      }
    };

    return successResponse(res, summary, "Tenant financial summary retrieved successfully");
  } catch (err) {
    console.error("Get Tenant Financial Summary Error:", err);
    return errorResponse(res, err.message);
  }
};

// ======================================================
// GET ACTIVE TENANTS
// ======================================================
const getActiveTenants = async (req, res) => {
  try {
    const { search, limit = 20 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const where = {
      status: 'active',
      ...buildTenantAccessFilter(req),
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      include: {
        _count: { select: { allocations: true, payments: true } },
        allocations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            hostel: { select: { id: true, name: true } }
          }
        }
      }
    });

    return successResponse(res, tenants, "Active tenants retrieved successfully");
  } catch (err) {
    console.error("Get Active Tenants Error:", err);
    return errorResponse(res, err.message);
  }
};

module.exports = {
  createTenant,
  updateTenant,
  getAllTenants,
  deleteTenant,
  getTenantById,
  getTenantPaymentHistory,
  getTenantFinancialSummary,
  getActiveTenants
};
