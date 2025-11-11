const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');
const path = require('path');

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
      notes
    } = req.body;

    // ✅ Handle uploaded files
    const profilePhoto = req.files?.profilePhoto?.[0]
      ? `/uploads/tenants/${req.files.profilePhoto[0].filename}`
      : null;

    const documentFiles = req.files?.documents?.map(file => `/uploads/tenants/${file.filename}`) || [];
    const documents = documentFiles.length ? JSON.stringify(documentFiles) : null;

    // ✅ Validation
    if (!firstName || !phone) {
      return errorResponse(res, "First name and phone number are required", 400);
    }

    // ✅ Check if email already exists
    if (email) {
      const existingTenant = await prisma.tenant.findUnique({ where: { email } });
      if (existingTenant) return errorResponse(res, "Email already registered", 400);
    }

    // ✅ Check if CNIC already exists
    if (cnicNumber) {
      const existingCNIC = await prisma.tenant.findUnique({ where: { cnicNumber } });
      if (existingCNIC) return errorResponse(res, "CNIC number already registered", 400);
    }

    // ✅ Check if linked user exists
    let userIdExist = userId ? parseInt(userId) : null;
    if (userIdExist) {
      const userExists = await prisma.user.findUnique({ where: { id: userIdExist } });
      if (!userExists) return errorResponse(res, "User not found", 404);

      const existingTenantProfile = await prisma.tenant.findFirst({ where: { userId: userIdExist } });
      if (existingTenantProfile) return errorResponse(res, "This user already has a tenant profile", 400);
    }

    // ✅ Create Tenant
    // Helper function to parse JSON if string, otherwise return as is
    const parseJsonField = (field) => {
      if (!field) return null;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field; // If not valid JSON, return as string
        }
      }
      return field;
    };

    const tenantData = {
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
      monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : null,
      documents,
      profilePhoto,
      notes: notes || null
    };

    // If userId is provided, connect it using the relation
    if (userIdExist) {
      tenantData.user = { connect: { id: userIdExist } };
    }

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
    const updates = req.body;

    const existingTenant = await prisma.tenant.findUnique({ where: { id: parseInt(id) } });
    if (!existingTenant) return errorResponse(res, "Tenant not found", 404);

    // ✅ Handle uploaded files
    const profilePhoto = req.files?.profilePhoto?.[0]
      ? `/uploads/tenants/${req.files.profilePhoto[0].filename}`
      : undefined;

    const documentFiles = req.files?.documents?.map(file => `/uploads/tenants/${file.filename}`) || [];
    const documents = documentFiles.length ? JSON.stringify(documentFiles) : existingTenant.documents;

    // ✅ Check email duplication
    if (updates.email && updates.email !== existingTenant.email) {
      const emailExists = await prisma.tenant.findUnique({ where: { email: updates.email } });
      if (emailExists) return errorResponse(res, "Email already registered", 400);
    }

    // ✅ Check CNIC duplication
    if (updates.cnicNumber && updates.cnicNumber !== existingTenant.cnicNumber) {
      const cnicExists = await prisma.tenant.findUnique({ where: { cnicNumber: updates.cnicNumber } });
      if (cnicExists) return errorResponse(res, "CNIC number already registered", 400);
    }

    // ✅ Update data
    const updateData = {
      name: updates.name || existingTenant.name,
      email: updates.email || existingTenant.email,
      phone: updates.phone || existingTenant.phone,
      alternatePhone: updates.alternatePhone || existingTenant.alternatePhone,
      gender: updates.gender || existingTenant.gender,
      dateOfBirth: updates.dateOfBirth ? new Date(updates.dateOfBirth) : existingTenant.dateOfBirth,
      cnicNumber: updates.cnicNumber || existingTenant.cnicNumber,
      address: updates.address ? (typeof updates.address === 'string' ? JSON.parse(updates.address) : updates.address) : existingTenant.address,
      permanentAddress: updates.permanentAddress ? (typeof updates.permanentAddress === 'string' ? JSON.parse(updates.permanentAddress) : updates.permanentAddress) : existingTenant.permanentAddress,
      emergencyContact: updates.emergencyContact ? (typeof updates.emergencyContact === 'string' ? JSON.parse(updates.emergencyContact) : updates.emergencyContact) : existingTenant.emergencyContact,
      occupation: updates.occupation || existingTenant.occupation,
      companyName: updates.companyName || existingTenant.companyName,
      designation: updates.designation || existingTenant.designation,
      monthlyIncome: updates.monthlyIncome ? parseFloat(updates.monthlyIncome) : existingTenant.monthlyIncome,
      documents,
      profilePhoto: profilePhoto ?? existingTenant.profilePhoto,
      notes: updates.notes || existingTenant.notes,
      status: updates.status || existingTenant.status,
      rating: updates.rating ? parseInt(updates.rating) : existingTenant.rating
    };

    const tenant = await prisma.tenant.update({
      where: { id: parseInt(id) },
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

    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { cnicNumber: { contains: search } }
      ];
    }

    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          allocations: {
            where: { status: 'active' },
            include: {
              bed: { select: { bedNumber: true } },
              room: { select: { roomNumber: true } },
              hostel: { select: { name: true } }
            }
          },
          _count: { select: { payments: true, allocations: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip
      }),
      prisma.tenant.count({ where })
    ]);

    return successResponse(res, {
      tenants,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    }, "Tenants retrieved successfully");
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

    const activeAllocation = await prisma.allocation.findFirst({
      where: { tenantId: parseInt(id), status: 'active' }
    });

    if (activeAllocation)
      return errorResponse(res, "Cannot delete tenant with active allocations.", 400);

    await prisma.tenant.delete({ where: { id: parseInt(id) } });
    return successResponse(res, null, "Tenant deleted successfully");
  } catch (err) {
    console.error("Delete Tenant Error:", err);
    return errorResponse(res, err.message);
  }
};

// ======================================================
// GET TENANT BY ID
// ======================================================
const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: parseInt(id) },
      include: {
        allocations: {
          include: {
            bed: { select: { bedNumber: true } },
            room: { select: { roomNumber: true } },
            hostel: { select: { name: true } }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: { select: { payments: true, allocations: true } }
      }
    });

    if (!tenant) return errorResponse(res, "Tenant not found", 404);

    return successResponse(res, tenant, "Tenant retrieved successfully");
  } catch (err) {
    console.error("Get Tenant By ID Error:", err);
    return errorResponse(res, err.message);
  }
};

// ======================================================
// GET ACTIVE TENANTS
// ======================================================
const getActiveTenants = async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { status: 'active' },
      include: {
        allocations: {
          where: { status: 'active' },
          include: {
            bed: { select: { bedNumber: true } },
            room: { select: { roomNumber: true } },
            hostel: { select: { name: true } }
          }
        },
        _count: { select: { payments: true, allocations: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(res, tenants, "Active tenants retrieved successfully");
  } catch (err) {
    console.error("Get Active Tenants Error:", err);
    return errorResponse(res, err.message);
  }
};

// ======================================================
// GET TENANT PAYMENT HISTORY
// ======================================================
const getTenantPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const tenant = await prisma.tenant.findUnique({
      where: { id: parseInt(id) }
    });

    if (!tenant) return errorResponse(res, "Tenant not found", 404);

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { tenantId: parseInt(id) },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip
      }),
      prisma.payment.count({ where: { tenantId: parseInt(id) } })
    ]);

    return successResponse(res, {
      payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    }, "Payment history retrieved successfully");
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

    const tenant = await prisma.tenant.findUnique({
      where: { id: parseInt(id) }
    });

    if (!tenant) return errorResponse(res, "Tenant not found", 404);

    const payments = await prisma.payment.findMany({
      where: { tenantId: parseInt(id) }
    });

    const totalPaid = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const totalPending = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const summary = {
      tenantId: parseInt(id),
      totalPayments: payments.length,
      totalPaid,
      totalPending,
      completedPayments: payments.filter(p => p.status === 'completed').length,
      pendingPayments: payments.filter(p => p.status === 'pending').length,
      failedPayments: payments.filter(p => p.status === 'failed').length
    };

    return successResponse(res, summary, "Financial summary retrieved successfully");
  } catch (err) {
    console.error("Get Tenant Financial Summary Error:", err);
    return errorResponse(res, err.message);
  }
};

module.exports = {
  createTenant,
  updateTenant,
  getAllTenants,
  deleteTenant,
  getTenantById,
  getActiveTenants,
  getTenantPaymentHistory,
  getTenantFinancialSummary
};
