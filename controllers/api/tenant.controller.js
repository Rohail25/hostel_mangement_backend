// ===============================
// Tenant Controller
// ===============================

const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');
const multer = require("multer");

// ===================================
// CREATE TENANT
// ===================================
const createTenant = async (req, res) => {
    try {
      const {
        userId,  // Optional: Link to User account (for online registration)
        name,
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
        documents,
        notes
      } = req.body;
  
      // ✅ Handle uploaded file
      const profilePhoto = req.file
        ? `/uploads/tenants/${req.file.filename}`
        : null;
  
      // ✅ Validation
      if (!name || !phone) {
        return errorResponse(res, "Name and phone are required", 400);
      }
  
      // ✅ Check if email already exists
      if (email) {
        const existingTenant = await prisma.tenant.findUnique({
          where: { email }
        });
        if (existingTenant) {
          return errorResponse(res, "Email already registered", 400);
        }
      }
  
      // ✅ Check if CNIC already exists
      if (cnicNumber) {
        const existingCNIC = await prisma.tenant.findUnique({
          where: { cnicNumber }
        });
        if (existingCNIC) {
          return errorResponse(res, "CNIC number already registered", 400);
        }
      }

      // ✅ If userId provided, check if user exists and doesn't already have a tenant profile
      let userIdExist = parseInt(userId);
      if (userId) {
        const userExists = await prisma.user.findUnique({
          where: { id: userIdExist }
        });
        if (!userExists) {
          return errorResponse(res, "User not found", 404);
        }

        const existingTenantProfile = await prisma.tenant.findFirst({
          where: { userId: userIdExist }
        });
        if (existingTenantProfile) {
          return errorResponse(res, "This user already has a tenant profile", 400);
        }
      }
  
      // ✅ Create tenant
      const tenant = await prisma.tenant.create({
        data: {
          userId: userId ? parseInt(userId) : null,  // Link to user if provided
          name,
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
          documents: documents || null,
          profilePhoto: profilePhoto,
          notes: notes || null
        }
      });
  
      return successResponse(res, tenant, "Tenant created successfully", 201);
    } catch (err) {
      console.error("Create Tenant Error:", err);
      return errorResponse(res, err.message, 400);
    }
  };
// ===================================
// GET ALL TENANTS
// ===================================
const getAllTenants = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;

        // Build filter
        const where = {};
        if (status) where.status = status;
        
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
                { cnicNumber: { contains: search } }
            ];
        }

        // Pagination
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
                    _count: {
                        select: { payments: true, allocations: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: skip
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
        }, "Tenants retrieved successfully", 200);
    } catch (err) {
        console.error("Get All Tenants Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET TENANT BY ID
// ===================================
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
                        floor: { select: { floorNumber: true } },
                        hostel: { select: { name: true } }
                    },
                    orderBy: { allocationDate: 'desc' }
                },
                payments: {
                    orderBy: { paymentDate: 'desc' },
                    take: 10,
                    include: {
                        hostel: { select: { name: true } },
                        collector: { select: { name: true } }
                    }
                },
                _count: {
                    select: { payments: true, allocations: true }
                }
            }
        });

        if (!tenant) {
            return errorResponse(res, "Tenant not found", 404);
        }

        return successResponse(res, tenant, "Tenant retrieved successfully", 200);
    } catch (err) {
        console.error("Get Tenant Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE TENANT
// ===================================
const updateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Handle uploaded file if present
        const profilePhoto = req.file
            ? `/uploads/tenants/${req.file.filename}`
            : undefined;

        // Check if tenant exists
        const existingTenant = await prisma.tenant.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingTenant) {
            return errorResponse(res, "Tenant not found", 404);
        }

        // Check if email is being updated and already exists
        if (updates.email && updates.email !== existingTenant.email) {
            const emailExists = await prisma.tenant.findUnique({
                where: { email: updates.email }
            });

            if (emailExists) {
                return errorResponse(res, "Email already registered", 400);
            }
        }

        // Check if CNIC is being updated and already exists
        if (updates.cnicNumber && updates.cnicNumber !== existingTenant.cnicNumber) {
            const cnicExists = await prisma.tenant.findUnique({
                where: { cnicNumber: updates.cnicNumber }
            });

            if (cnicExists) {
                return errorResponse(res, "CNIC number already registered", 400);
            }
        }

        // Prepare update data
        const updateData = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.email !== undefined) updateData.email = updates.email;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.alternatePhone !== undefined) updateData.alternatePhone = updates.alternatePhone;
        if (updates.gender !== undefined) updateData.gender = updates.gender;
        if (updates.dateOfBirth !== undefined) updateData.dateOfBirth = updates.dateOfBirth ? new Date(updates.dateOfBirth) : null;
        if (updates.cnicNumber !== undefined) updateData.cnicNumber = updates.cnicNumber;
        if (updates.address !== undefined) updateData.address = updates.address;
        if (updates.permanentAddress !== undefined) updateData.permanentAddress = updates.permanentAddress;
        if (updates.emergencyContact !== undefined) updateData.emergencyContact = updates.emergencyContact;
        if (updates.occupation !== undefined) updateData.occupation = updates.occupation;
        if (updates.companyName !== undefined) updateData.companyName = updates.companyName;
        if (updates.designation !== undefined) updateData.designation = updates.designation;
        if (updates.monthlyIncome !== undefined) updateData.monthlyIncome = parseFloat(updates.monthlyIncome);
        if (updates.documents !== undefined) updateData.documents = updates.documents;
        if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto; // Use uploaded file if present
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.rating !== undefined) updateData.rating = parseInt(updates.rating);

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

// ===================================
// DELETE TENANT
// ===================================
const deleteTenant = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if tenant has active allocations
        const activeAllocation = await prisma.allocation.findFirst({
            where: {
                tenantId: parseInt(id),
                status: 'active'
            }
        });

        if (activeAllocation) {
            return errorResponse(
                res,
                "Cannot delete tenant with active allocations. Please checkout first.",
                400
            );
        }

        await prisma.tenant.delete({
            where: { id: parseInt(id) }
        });

        return successResponse(res, null, "Tenant deleted successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Tenant not found", 404);
        }
        console.error("Delete Tenant Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET TENANT PAYMENT HISTORY
// ===================================
const getTenantPaymentHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const skip = (page - 1) * limit;

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where: { tenantId: parseInt(id) },
                include: {
                    hostel: { select: { name: true } },
                    allocation: {
                        select: {
                            bed: { select: { bedNumber: true } },
                            room: { select: { roomNumber: true } }
                        }
                    },
                    collector: { select: { name: true } }
                },
                orderBy: { paymentDate: 'desc' },
                take: parseInt(limit),
                skip: skip
            }),
            prisma.payment.count({ where: { tenantId: parseInt(id) } })
        ]);

        // Calculate totals
        const totals = await prisma.payment.aggregate({
            where: { tenantId: parseInt(id) },
            _sum: { amount: true }
        });

        return successResponse(res, {
            payments,
            totalPaid: totals._sum.amount || 0,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        }, "Payment history retrieved successfully", 200);
    } catch (err) {
        console.error("Get Payment History Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET TENANT FINANCIAL SUMMARY
// ===================================
const getTenantFinancialSummary = async (req, res) => {
    try {
        const { id } = req.params;

        const tenant = await prisma.tenant.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                name: true,
                totalPaid: true,
                totalDue: true,
                securityDeposit: true
            }
        });

        if (!tenant) {
            return errorResponse(res, "Tenant not found", 404);
        }

        // Get payment summary
        const paymentSummary = await prisma.payment.groupBy({
            by: ['paymentType'],
            where: { tenantId: parseInt(id) },
            _sum: { amount: true },
            _count: true
        });

        // Get active allocation
        const activeAllocation = await prisma.allocation.findFirst({
            where: {
                tenantId: parseInt(id),
                status: 'active'
            },
            include: {
                bed: { select: { bedNumber: true } },
                room: { select: { roomNumber: true } },
                hostel: { select: { name: true } }
            }
        });

        return successResponse(res, {
            tenant,
            paymentSummary,
            activeAllocation
        }, "Financial summary retrieved successfully", 200);
    } catch (err) {
        console.error("Get Financial Summary Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ACTIVE TENANTS
// ===================================
const getActiveTenants = async (req, res) => {
    try {
        const { hostelId } = req.query;

        const where = { status: 'active' };

        // Get tenants with active allocations
        const tenants = await prisma.tenant.findMany({
            where: {
                ...where,
                allocations: {
                    some: {
                        status: 'active',
                        ...(hostelId && { hostelId: parseInt(hostelId) })
                    }
                }
            },
            include: {
                allocations: {
                    where: { status: 'active' },
                    include: {
                        bed: { select: { bedNumber: true } },
                        room: { select: { roomNumber: true } },
                        hostel: { select: { name: true } }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        return successResponse(res, tenants, "Active tenants retrieved successfully", 200);
    } catch (err) {
        console.error("Get Active Tenants Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    createTenant,
    getAllTenants,
    getTenantById,
    updateTenant,
    deleteTenant,
    getTenantPaymentHistory,
    getTenantFinancialSummary,
    getActiveTenants
};

