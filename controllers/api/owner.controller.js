const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');
const { writeLog } = require('../../Helper/audit.helper');

const OWNER_SELECT_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
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
          name: true,
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
    const { name, email, phone, password, status = 'active' } = req.body || {};

    if (!name || !email || !password) {
      return errorResponse(res, 'Name, email and password are required', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse(res, 'Email already in use', 400);
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const owner = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: hashedPassword,
        role: 'owner',
        status,
      },
      select: OWNER_SELECT_FIELDS,
    });

    await writeLog({
      userId: req.userId,
      action: 'create',
      module: 'owner',
      description: `Owner ${email} created`,
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
      role: 'owner',
      ...(status ? { status: String(status) } : {}),
    };

    if (search) {
      const term = String(search);
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [owners, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          ...OWNER_SELECT_FIELDS,
          _count: { select: { ownedHostels: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNumber,
      }),
      prisma.user.count({ where }),
    ]);

    return successResponse(
      res,
      {
        items: owners.map((owner) => ({
          ...owner,
          hostelCount: owner._count?.ownedHostels ?? 0,
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

    if (req.userRole === 'owner' && req.userId !== ownerId) {
      return errorResponse(res, 'Unauthorized to view this owner', 403);
    }

    const owner = await prisma.user.findFirst({
      where: { id: ownerId, role: 'owner' },
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
  if (req.userRole !== 'owner') {
    return errorResponse(res, 'Only owners can access their profile', 403);
  }
  req.params.id = req.userId;
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
      ownerId = req.userId;
    } else {
      ownerId = Number(ownerIdParam);
      if (!Number.isFinite(ownerId)) {
        return errorResponse(res, 'Invalid owner id', 400);
      }
      if (req.userRole === 'owner' && req.userId !== ownerId) {
        return errorResponse(res, 'Unauthorized to view this dashboard', 403);
      }
    }

    const owner = await prisma.user.findFirst({
      where: { id: ownerId, role: 'owner' },
      select: OWNER_SELECT_FIELDS,
    });

    if (!owner) {
      return errorResponse(res, 'Owner not found', 404);
    }

    const snapshot = await buildOwnerSnapshot(ownerId);
    const recentActivity = await prisma.activityLog.findMany({
      where: { userId: ownerId },
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

    const isAdmin = req.userRole === 'admin';
    const isSelf = req.userRole === 'owner' && req.userId === ownerId;

    if (!isAdmin && !isSelf) {
      return errorResponse(res, 'Unauthorized to update this owner', 403);
    }

    const { name, email, phone, status, password } = req.body || {};
    const data = {};

    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;

    if (password) {
      data.password = await bcrypt.hash(String(password), 10);
    }

    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== ownerId) {
        return errorResponse(res, 'Email already in use', 400);
      }
      data.email = email;
    }

    if (isAdmin && status !== undefined) {
      data.status = status;
    }

    if (!isAdmin && status !== undefined) {
      return errorResponse(res, 'Owners cannot change their status', 403);
    }

    if (Object.keys(data).length === 0) {
      const owner = await prisma.user.findFirst({
        where: { id: ownerId, role: 'owner' },
        select: OWNER_SELECT_FIELDS,
      });
      if (!owner) {
        return errorResponse(res, 'Owner not found', 404);
      }
      return successResponse(res, owner, 'Owner updated successfully');
    }

    const owner = await prisma.user.update({
      where: { id: ownerId, role: 'owner' },
      data,
      select: OWNER_SELECT_FIELDS,
    });

    await writeLog({
      userId: req.userId,
      action: 'update',
      module: 'owner',
      description: `Owner #${ownerId} updated`,
    });

    return successResponse(res, owner, 'Owner updated successfully');
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

    const owner = await prisma.user.findFirst({
      where: { id: ownerId, role: 'owner' },
      select: { id: true, email: true },
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

    await prisma.user.delete({
      where: { id: ownerId },
    });

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

