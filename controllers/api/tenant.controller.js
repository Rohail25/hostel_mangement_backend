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
    const tenant = await prisma.tenant.create({
      data: {
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
        address: address || null,
        permanentAddress: permanentAddress || null,
        emergencyContact: emergencyContact || null,
        occupation: occupation || null,
        companyName: companyName || null,
        designation: designation || null,
        monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : null,
        documents,
        profilePhoto,
        notes: notes || null
      }
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
      firstName: updates.firstName || existingTenant.firstName,
      lastName: updates.lastName || existingTenant.lastName,
      name: `${updates.firstName || existingTenant.firstName} ${updates.lastName || existingTenant.lastName || ""}`.trim(),
      email: updates.email || existingTenant.email,
      phone: updates.phone || existingTenant.phone,
      alternatePhone: updates.alternatePhone || existingTenant.alternatePhone,
      gender: updates.gender || existingTenant.gender,
      dateOfBirth: updates.dateOfBirth ? new Date(updates.dateOfBirth) : existingTenant.dateOfBirth,
      cnicNumber: updates.cnicNumber || existingTenant.cnicNumber,
      address: updates.address || existingTenant.address,
      permanentAddress: updates.permanentAddress || existingTenant.permanentAddress,
      emergencyContact: updates.emergencyContact || existingTenant.emergencyContact,
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

module.exports = {
  createTenant,
  updateTenant,
  getAllTenants,
  deleteTenant
};
