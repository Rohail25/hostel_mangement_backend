const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');
const { writeLog } = require('../../Helper/audit.helper');

const OWNER_SELECT_FIELDS = {
  id: true,
  userId: true,
  ownerCode: true,
  name: true,
  alternatePhone: true,
  HostelName: true,
  taxId: true,
  registrationNumber: true,
  address: true,
  bankDetails: true,
  documents: true,
  profilePhoto: true,
  status: true,
  emergencyContact: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
    },
  },
};

const buildOwnerSnapshot = async (ownerId) => {
  const hostels = await prisma.hostel.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      totalFloors: true,
      totalRooms: true,
      totalBeds: true,
      occupiedBeds: true,
      createdAt: true,
      manager: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      _count: {
        select: {
          floors: true,
          rooms: true,
        },
      },
    },
  });

  const formattedHostels = hostels.map((hostel) => {
    const totalBeds = hostel.totalBeds ?? 0;
    const occupiedBeds = hostel.occupiedBeds ?? 0;
    const availableBeds = totalBeds - occupiedBeds;
    const totalRooms =
      hostel.totalRooms ?? hostel._count?.rooms ?? 0;
    const totalFloors =
      hostel.totalFloors ?? hostel._count?.floors ?? 0;

    return {
      id: hostel.id,
      name: hostel.name,
      status: hostel.status,
      manager: hostel.manager,
      totalFloors,
      totalRooms,
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancyRate:
        totalBeds > 0 ? Number(((occupiedBeds / totalBeds) * 100).toFixed(2)) : 0,
      createdAt: hostel.createdAt,
    };
  });

  const totals = formattedHostels.reduce(
    (acc, hostel) => {
      acc.totalFloors += hostel.totalFloors || 0;
      acc.totalRooms += hostel.totalRooms || 0;
      acc.totalBeds += hostel.totalBeds || 0;
      acc.occupiedBeds += hostel.occupiedBeds || 0;
      acc.availableBeds += hostel.availableBeds || 0;
      if (hostel.status === 'active') acc.activeHostels += 1;
      if (hostel.status === 'inactive') acc.inactiveHostels += 1;
      if (hostel.status === 'under_maintenance') acc.maintenanceHostels += 1;
      return acc;
    },
    {
      totalHostels: formattedHostels.length,
      activeHostels: 0,
      inactiveHostels: 0,
      maintenanceHostels: 0,
      totalFloors: 0,
      totalRooms: 0,
      totalBeds: 0,
      occupiedBeds: 0,
      availableBeds: 0,
    }
  );

  const hostelIds = formattedHostels.map((hostel) => hostel.id);

  let activeAllocations = 0;
  let totalRevenue = 0;
  if (hostelIds.length > 0) {
    activeAllocations = await prisma.allocation.count({
      where: {
        hostelId: { in: hostelIds },
        status: 'active',
      },
    });

    const paymentAggregate = await prisma.payment.aggregate({
      where: {
        hostelId: { in: hostelIds },
        status: 'paid',
      },
      _sum: { amount: true },
    });
    totalRevenue = Number(paymentAggregate._sum.amount || 0);
  }

  const occupancyRate =
    totals.totalBeds > 0
      ? Number(((totals.occupiedBeds / totals.totalBeds) * 100).toFixed(2))
      : 0;

  return {
    hostels: formattedHostels,
    summary: {
      ...totals,
      occupancyRate,
      activeAllocations,
      totalRevenue,
    },
  };
};

const createOwner = async (req, res) => {
  try {
    const {
      // Owner fields
      name,
      alternatePhone,
      HostelName,
      taxId,
      registrationNumber,
      address,
      bankDetails,
      documents,
      profilePhoto,
      status = 'active',
      emergencyContact,
      notes,
      ownerCode,
      // User account fields (optional)
      email,
      username,
      phone,
      password,
    } = req.body || {};

    // Validate required fields
    if (!name) {
      return errorResponse(res, 'Name is required', 400);
    }

    let userId = null;

    // If email/password provided, create User account first
    if (email && password) {
      // Check if email already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return errorResponse(res, 'Email already in use', 400);
      }

      // Check if user already has an owner profile
      if (existingUser?.ownerProfile) {
        return errorResponse(res, 'User already has an owner profile', 400);
      }

      // Hash password and create user
      const hashedPassword = await bcrypt.hash(String(password), 10);
      const newUser = await prisma.user.create({
        data: {
          username: username || name,
          email,
          phone: phone || null,
          password: hashedPassword,
          role: 'owner',
          status: 'active',
        },
      });
      userId = newUser.id;
    }

    // Check if ownerCode already exists
    if (ownerCode) {
      const existingOwner = await prisma.owner.findUnique({
        where: { ownerCode },
      });
      if (existingOwner) {
        // If we created a user, delete it
        if (userId) {
          await prisma.user.delete({ where: { id: userId } });
        }
        return errorResponse(res, 'Owner code already exists', 400);
      }
    }

    // Handle uploaded profile photo
    const profilePhotoPath = req.files?.profilePhoto?.[0]
      ? `/uploads/owners/${req.files.profilePhoto[0].filename}`
      : (profilePhoto || null);

    // Handle uploaded documents
    let documentsArray = [];
    if (req.files?.documents && req.files.documents.length > 0) {
      documentsArray = req.files.documents.map(file => ({
        name: file.originalname,
        url: `/uploads/owners/documents/${file.filename}`,
        uploadedAt: new Date().toISOString()
      }));
    } else if (documents) {
      // If documents provided as JSON string or array
      if (typeof documents === 'string') {
        try {
          documentsArray = JSON.parse(documents);
        } catch {
          documentsArray = [];
        }
      } else if (Array.isArray(documents)) {
        documentsArray = documents;
      }
    }

    // Create Owner record
    const owner = await prisma.owner.create({
      data: {
        userId: userId || null,
        ownerCode: ownerCode || null,
        name,
        alternatePhone: alternatePhone || null,
        HostelName: HostelName || null,
        taxId: taxId || null,
        registrationNumber: registrationNumber || null,
        address: address ? (typeof address === 'string' ? JSON.parse(address) : address) : null,
        bankDetails: bankDetails ? (typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails) : null,
        documents: documentsArray.length > 0 ? documentsArray : null,
        profilePhoto: profilePhotoPath,
        status: status || 'active',
        emergencyContact: emergencyContact ? (typeof emergencyContact === 'string' ? JSON.parse(emergencyContact) : emergencyContact) : null,
        notes: notes || null,
      },
      select: OWNER_SELECT_FIELDS,
    });

    await writeLog({
      userId: req.userId,
      action: 'create',
      module: 'owner',
      description: `Owner ${name} created${email ? ` with email ${email}` : ''}`,
    });

    return successResponse(res, owner, 'Owner created successfully', 201);
  } catch (error) {
    console.error('Create owner error:', error);
    return errorResponse(res, error.message);
  }
};

const listOwners = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      ...(status ? { status: String(status) } : {}),
    };

    if (search) {
      const term = String(search);
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { ownerCode: { contains: term, mode: 'insensitive' } },
        { HostelName: { contains: term, mode: 'insensitive' } },
        { taxId: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [owners, total] = await Promise.all([
      prisma.owner.findMany({
        where,
        select: {
          ...OWNER_SELECT_FIELDS,
          _count: { select: { hostels: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNumber,
      }),
      prisma.owner.count({ where }),
    ]);

    return successResponse(
      res,
      {
        items: owners.map((owner) => ({
          ...owner,
          hostelCount: owner._count?.hostels ?? 0,
        })),
        total,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          pages: Math.ceil(total / limitNumber) || 1,
        },
      },
      'Owners retrieved successfully'
    );
  } catch (error) {
    console.error('List owners error:', error);
    return errorResponse(res, error.message);
  }
};

const getOwnerById = async (req, res) => {
  try {
    const ownerId = Number(req.params.id);
    if (!Number.isFinite(ownerId)) {
      return errorResponse(res, 'Invalid owner id', 400);
    }

    // Check authorization - if user is owner, they can only view their own profile
    if (req.userRole === 'owner') {
      const ownerProfile = await prisma.owner.findFirst({
        where: { userId: req.userId },
        select: { id: true },
      });
      if (ownerProfile && ownerProfile.id !== ownerId) {
        return errorResponse(res, 'Unauthorized to view this owner', 403);
      }
    }

    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      select: OWNER_SELECT_FIELDS,
    });

    if (!owner) {
      return errorResponse(res, 'Owner not found', 404);
    }

    const snapshot = await buildOwnerSnapshot(ownerId);
    return successResponse(
      res,
      {
        owner,
        ...snapshot,
      },
      'Owner profile fetched successfully'
    );
  } catch (error) {
    console.error('Get owner error:', error);
    return errorResponse(res, error.message);
  }
};

const getMyOwnerProfile = async (req, res) => {
  console.log('getMyOwnerProfile called - userRole:', req.userRole, 'userId:', req.userId);
  if (req.userRole !== 'owner') {
    return errorResponse(res, 'Only owners can access their profile', 403);
  }
  
  // Find owner profile by userId
  let ownerProfile = await prisma.owner.findFirst({
    where: { userId: req.userId },
    select: { id: true },
  });
  console.log(ownerProfile);
  if (!ownerProfile) {
    try {
      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { username: true, email: true, phone: true },
      });

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Create owner profile automatically
      const newOwner = await prisma.owner.create({
        data: {
          userId: req.userId,
          name: user.username || 'Owner',
          status: 'active',
        },
        select: { id: true },
      });

      ownerProfile = newOwner;
    } catch (error) {
      console.error('Error creating owner profile:', error);
      return errorResponse(res, 'Failed to create owner profile. Please contact admin.', 500);
    }
  }

  req.params.id = ownerProfile.id;
  return getOwnerById(req, res);
};

const getOwnerDashboard = async (req, res) => {
  try {
    const ownerIdParam = req.params.id;
    let ownerId;

    if (ownerIdParam === 'me') {
      if (req.userRole !== 'owner') {
        return errorResponse(res, 'Only owners can access this dashboard', 403);
      }
      // Find owner profile by userId
      let ownerProfile = await prisma.owner.findFirst({
        where: { userId: req.userId },
        select: { id: true },
      });
      
      // If no owner profile exists, create one automatically
      if (!ownerProfile) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { username: true, email: true, phone: true },
          });

          if (user) {
            const newOwner = await prisma.owner.create({
              data: {
                userId: req.userId,
                name: user.username || 'Owner',
                status: 'active',
              },
              select: { id: true },
            });
            ownerProfile = newOwner;
          }
        } catch (error) {
          console.error('Error creating owner profile:', error);
          return errorResponse(res, 'Owner profile not found', 404);
        }
      }
      
      if (!ownerProfile) {
        return errorResponse(res, 'Owner profile not found', 404);
      }
      ownerId = ownerProfile.id;
    } else {
      ownerId = Number(ownerIdParam);
      if (!Number.isFinite(ownerId)) {
        return errorResponse(res, 'Invalid owner id', 400);
      }
      // Check authorization
      if (req.userRole === 'owner') {
        const ownerProfile = await prisma.owner.findFirst({
          where: { userId: req.userId },
          select: { id: true },
        });
        if (ownerProfile && ownerProfile.id !== ownerId) {
          return errorResponse(res, 'Unauthorized to view this dashboard', 403);
        }
      }
    }

    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      select: OWNER_SELECT_FIELDS,
    });

    if (!owner) {
      return errorResponse(res, 'Owner not found', 404);
    }

    const snapshot = await buildOwnerSnapshot(ownerId);
    // Get recent activity if owner has linked user account
    let recentActivity = [];
    if (owner.userId) {
      recentActivity = await prisma.activityLog.findMany({
        where: { userId: owner.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          module: true,
          description: true,
          createdAt: true,
        },
      });
    }

    return successResponse(
      res,
      {
        owner,
        ...snapshot,
        recentActivity,
      },
      'Owner dashboard fetched successfully'
    );
  } catch (error) {
    console.error('Owner dashboard error:', error);
    return errorResponse(res, error.message);
  }
};

const updateOwner = async (req, res) => {
  try {
    const ownerId = Number(req.params.id);
    if (!Number.isFinite(ownerId)) {
      return errorResponse(res, 'Invalid owner id', 400);
    }

    // Check if owner exists
    const existingOwner = await prisma.owner.findUnique({
      where: { id: ownerId },
      select: { userId: true, profilePhoto: true },
    });

    if (!existingOwner) {
      return errorResponse(res, 'Owner not found', 404);
    }

    const isAdmin = req.userRole === 'admin';
    const isSelf = req.userRole === 'owner' && existingOwner.userId === req.userId;

    if (!isAdmin && !isSelf) {
      return errorResponse(res, 'Unauthorized to update this owner', 403);
    }

    const {
      name,
      alternatePhone,
      HostelName,
      taxId,
      registrationNumber,
      address,
      bankDetails,
      documents,
      profilePhoto,
      status,
      emergencyContact,
      notes,
      ownerCode,
      // User account fields (optional)
      email,
      username,
      phone,
      password,
    } = req.body || {};

    const ownerData = {};
    const userData = {};

    // Update Owner fields
    if (name !== undefined) ownerData.name = name;
    if (alternatePhone !== undefined) ownerData.alternatePhone = alternatePhone;
    if (HostelName !== undefined) ownerData.HostelName = HostelName;
    if (taxId !== undefined) ownerData.taxId = taxId;
    if (registrationNumber !== undefined) ownerData.registrationNumber = registrationNumber;
    if (address !== undefined) {
      ownerData.address = typeof address === 'string' ? JSON.parse(address) : address;
    }
    if (bankDetails !== undefined) {
      ownerData.bankDetails = typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails;
    }
    // Handle uploaded profile photo
    if (req.files?.profilePhoto?.[0]) {
      // Delete old profile photo if it exists
      if (existingOwner.profilePhoto) {
        const oldPhotoPath = path.join(__dirname, '../../..', existingOwner.profilePhoto);
        if (fs.existsSync(oldPhotoPath)) {
          try {
            fs.unlinkSync(oldPhotoPath);
          } catch (err) {
            console.error('Error deleting old profile photo:', err);
          }
        }
      }
      ownerData.profilePhoto = `/uploads/owners/${req.files.profilePhoto[0].filename}`;
    } else if (profilePhoto !== undefined) {
      ownerData.profilePhoto = profilePhoto;
    }

    // Handle uploaded documents
    if (req.files?.documents && req.files.documents.length > 0) {
      const newDocuments = req.files.documents.map(file => ({
        name: file.originalname,
        url: `/uploads/owners/documents/${file.filename}`,
        uploadedAt: new Date().toISOString()
      }));

      // Get existing documents if any
      const existingOwnerFull = await prisma.owner.findUnique({
        where: { id: ownerId },
        select: { documents: true },
      });

      let existingDocuments = [];
      if (existingOwnerFull?.documents) {
        if (typeof existingOwnerFull.documents === 'string') {
          try {
            existingDocuments = JSON.parse(existingOwnerFull.documents);
          } catch {
            existingDocuments = [];
          }
        } else if (Array.isArray(existingOwnerFull.documents)) {
          existingDocuments = existingOwnerFull.documents;
        }
      }

      // Merge existing and new documents
      ownerData.documents = [...existingDocuments, ...newDocuments];
    } else if (documents !== undefined) {
      // If documents provided as JSON string or array (replacing existing)
      if (typeof documents === 'string') {
        try {
          ownerData.documents = JSON.parse(documents);
        } catch {
          ownerData.documents = documents;
        }
      } else if (Array.isArray(documents)) {
        ownerData.documents = documents;
      }
    }
    if (status !== undefined) ownerData.status = status;
    if (emergencyContact !== undefined) {
      ownerData.emergencyContact = typeof emergencyContact === 'string' ? JSON.parse(emergencyContact) : emergencyContact;
    }
    if (notes !== undefined) ownerData.notes = notes;
    if (ownerCode !== undefined) {
      // Check if ownerCode already exists (excluding current owner)
      const existingCode = await prisma.owner.findFirst({
        where: { ownerCode, id: { not: ownerId } },
      });
      if (existingCode) {
        return errorResponse(res, 'Owner code already exists', 400);
      }
      ownerData.ownerCode = ownerCode;
    }

    // Update User account if linked
    if (existingOwner.userId) {
      if (email !== undefined) {
        const existing = await prisma.user.findFirst({
          where: { email, id: { not: existingOwner.userId } },
        });
        if (existing) {
          return errorResponse(res, 'Email already in use', 400);
        }
        userData.email = email;
      }
      if (username !== undefined) userData.username = username;
      if (phone !== undefined) userData.phone = phone;
      if (password) {
        userData.password = await bcrypt.hash(String(password), 10);
      }

      // Update user if there are changes
      if (Object.keys(userData).length > 0) {
        await prisma.user.update({
          where: { id: existingOwner.userId },
          data: userData,
        });
      }
    }

    // Update owner
    const updatedOwner = await prisma.owner.update({
      where: { id: ownerId },
      data: ownerData,
      select: OWNER_SELECT_FIELDS,
    });

    await writeLog({
      userId: req.userId,
      action: 'update',
      module: 'owner',
      description: `Owner ${ownerId} updated`,
    });

    return successResponse(res, updatedOwner, 'Owner updated successfully');
  } catch (error) {
    console.error('Update owner error:', error);
    if (error.code === 'P2025') {
      return errorResponse(res, 'Owner not found', 404);
    }
    return errorResponse(res, error.message);
  }
};

const deleteOwner = async (req, res) => {
  try {
    const ownerId = Number(req.params.id);
    if (!Number.isFinite(ownerId)) {
      return errorResponse(res, 'Invalid owner id', 400);
    }

    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      select: { id: true, userId: true, name: true },
    });

    if (!owner) {
      return errorResponse(res, 'Owner not found', 404);
    }

    const hostelCount = await prisma.hostel.count({
      where: { ownerId },
    });

    if (hostelCount > 0) {
      return errorResponse(
        res,
        'Cannot delete owner with assigned hostels. Reassign or delete hostels first.',
        400
      );
    }

    // Delete owner (this will set userId to null in User if linked)
    await prisma.owner.delete({
      where: { id: ownerId },
    });

    // Optionally delete user account if it exists and has no other relations
    if (owner.userId) {
      // Check if user has other relations before deleting
      const userHostels = await prisma.hostel.count({
        where: { ownerId: null }, // Check if user owns hostels through other means
      });
      // For now, we'll keep the user account, just unlink it
      // If you want to delete the user account too, uncomment below:
      // await prisma.user.delete({ where: { id: owner.userId } });
    }

    await writeLog({
      userId: req.userId,
      action: 'delete',
      module: 'owner',
      description: `Owner ${owner.email} deleted`,
    });

    return successResponse(res, null, 'Owner deleted successfully');
  } catch (error) {
    console.error('Delete owner error:', error);
    return errorResponse(res, error.message);
  }
};

module.exports = {
  createOwner,
  listOwners,
  getOwnerById,
  getMyOwnerProfile,
  getOwnerDashboard,
  updateOwner,
  deleteOwner,
};

