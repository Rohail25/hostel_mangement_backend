const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');

/* ----------------------------- helpers ----------------------------- */

const paged = (page = 1, limit = 12) => {
  const p = parseInt(page) || 1;
  const l = Math.min(parseInt(limit) || 12, 100);
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
};

const clamp0to5 = (n) => {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(5, x));
};

const overallFrom = (...vals) => {
  const arr = vals.map(clamp0to5);
  const sum = arr.reduce((a, b) => a + b, 0);
  return +(sum / arr.length).toFixed(1);
};

const briefAddress = (addr) => {
  if (!addr) return null;
  try {
    const a = typeof addr === 'string' ? JSON.parse(addr) : addr;
    return [a.line1, a.city, a.state].filter(Boolean).join(', ');
  } catch {
    return null;
  }
};

/* -------------------------- list (cards) --------------------------- */

/**
 * GET /api/admin/people/tenants
 * ?hostelId= &status=active|inactive|blacklisted &search= &page= &limit=
 */
const listTenants = async (req, res) => {
  try {
    const { hostelId, status, search, page, limit } = req.query;
    const { skip, take } = paged(page, limit);

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { cnicNumber: { contains: search } },
            ],
          }
        : {}),
      ...(hostelId
        ? {
            allocations: {
              some: { hostelId: Number(hostelId), status: 'active' },
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          profilePhoto: true,
          address: true,
          userId: true,
          allocations: {
            where: { status: 'active' },
            select: {
              id: true,
              hostelId: true,
              createdAt: true,
              hostel: { select: { name: true } },
            },
            take: 1,
          },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    // Get bed/room info for tenants with active allocations
    const tenantIdsWithAllocations = rows
      .filter(t => t.allocations[0] && t.userId)
      .map(t => ({ tenantId: t.id, userId: t.userId, allocation: t.allocations[0] }));

    const bedInfoMap = {};
    if (tenantIdsWithAllocations.length > 0) {
      const userIds = tenantIdsWithAllocations.map(t => t.userId);
      const beds = await prisma.bed.findMany({
        where: {
          currentUserId: { in: userIds },
          status: 'occupied',
        },
        select: {
          id: true,
          number: true,
          currentUserId: true,
          room: {
            select: {
              id: true,
              number: true,
            },
          },
        },
      });

      beds.forEach(bed => {
        const tenant = tenantIdsWithAllocations.find(t => t.userId === bed.currentUserId);
        if (tenant) {
          bedInfoMap[tenant.tenantId] = {
            roomNumber: bed.room.number,
            bedNumber: bed.number,
          };
        }
      });
    }

    const cards = rows.map((t) => {
      const bedInfo = bedInfoMap[t.id];
      const allocation = t.allocations[0];
      
      let location = briefAddress(t.address);
      if (allocation && bedInfo) {
        location = `Room ${bedInfo.roomNumber}-${bedInfo.bedNumber}`;
      } else if (allocation && allocation.hostel) {
        location = allocation.hostel.name;
      }

      return {
        id: t.id,
        name: t.name,
        email: t.email,
        phone: t.phone,
        avatar: t.profilePhoto,
        status: t.status === 'active' ? 'Active' : t.status === 'inactive' ? 'Inactive' : t.status,
        room: bedInfo ? `Room ${bedInfo.roomNumber}-${bedInfo.bedNumber}` : null,
      };
    });

    return successResponse(res, {
      items: cards,
      total,
    });
  } catch (e) {
    console.error('List tenants error:', e);
    return errorResponse(res, e.message);
  }
};

/**
 * GET /api/admin/people/employees
 * ?status=active|inactive &search= &page= &limit=
 */
const listEmployees = async (req, res) => {
  try {
    const { status, search, page, limit } = req.query;
    const { skip, take } = paged(page, limit);

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { role: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          name: true,           // if you keep firstName/lastName, replace with a computed name in select
          email: true,
          phone: true,
          role: true,
          status: true,
          avatar: true,
          joinedAt: true,
        },
      }),
      prisma.employee.count({ where }),
    ]);

    const cards = rows.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      phone: e.phone,
      role: e.role,
      status: e.status === 'active' ? 'Active' : e.status === 'inactive' ? 'Inactive' : e.status,
      avatar: e.avatar,
      joinedAt: e.joinedAt ? e.joinedAt.toISOString().split('T')[0] : null,
    }));

    return successResponse(res, { items: cards, total });
  } catch (e) {
    console.error('List employees error:', e);
    return errorResponse(res, e.message);
  }
};

/* ----------------------------- details ---------------------------- */

/**
 * GET /api/admin/people/tenant/:id
 * (modal → Details tab)
 */
const tenantDetails = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        allocations: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            hostelId: true,
            createdAt: true,
            hostel: { select: { name: true } },
          },
        },
        _count: { select: { payments: true, allocations: true } },
      },
    });

    if (!tenant) return errorResponse(res, 'Tenant not found', 404);

    // Get bed/room info if tenant has userId and active allocation
    let bedInfo = null;
    let roomBed = null;
    if (tenant.userId && tenant.allocations[0]) {
      const bed = await prisma.bed.findFirst({
        where: {
          currentUserId: tenant.userId,
          status: 'occupied',
        },
        select: {
          id: true,
          number: true,
          room: {
            select: {
              id: true,
              number: true,
            },
          },
        },
      });

      if (bed) {
        bedInfo = bed;
        roomBed = `Room ${bed.room.number}-${bed.number}`;
      }
    }

    // Get lease dates from allocation (using createdAt as lease start)
    const allocation = tenant.allocations[0];
    const leaseStart = allocation ? allocation.createdAt : null;
    // For lease end, we can use a default 6 months or check Booking model
    let leaseEnd = null;
    if (tenant.userId) {
      const booking = await prisma.booking.findFirst({
        where: {
          tenantId: id,
          status: { not: 'cancelled' },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          checkOut: true,
        },
      });
      if (booking && booking.checkOut) {
        leaseEnd = booking.checkOut;
      } else if (leaseStart) {
        // Default to 6 months from lease start if no checkout date
        const endDate = new Date(leaseStart);
        endDate.setMonth(endDate.getMonth() + 6);
        leaseEnd = endDate;
      }
    }

    // Try to get current score (using ScoreCard model if TenantScore doesn't exist)
    let currentScore = null;
    try {
      currentScore = await prisma.scoreCard.findFirst({
        where: {
          entityType: 'tenant',
          entityId: id,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          score: true,
          criteria: true,
          remarks: true,
          createdAt: true,
        },
      });
    } catch (e) {
      // ScoreCard might not exist, that's okay
      console.log('ScoreCard query failed:', e.message);
    }

    return successResponse(res, {
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      status: tenant.status === 'active' ? 'Active' : tenant.status === 'inactive' ? 'Inactive' : tenant.status,
      profilePhoto: tenant.profilePhoto,
      address: tenant.address,
      roomBed: roomBed,
      leaseStart: leaseStart ? leaseStart.toISOString().split('T')[0] : null,
      leaseEnd: leaseEnd ? leaseEnd.toISOString().split('T')[0] : null,
      allocation: allocation
        ? {
            hostel: allocation.hostel.name,
            room: bedInfo ? bedInfo.room.number : null,
            bed: bedInfo ? bedInfo.number : null,
          }
        : null,
      counts: tenant._count,
      score: currentScore,
    });
  } catch (e) {
    console.error('Tenant details error:', e);
    return errorResponse(res, e.message);
  }
};

/**
 * GET /api/admin/people/employee/:id
 */
const employeeDetails = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const emp = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, status: true, avatar: true, joinedAt: true,
      },
    });
    if (!emp) return errorResponse(res, 'Employee not found', 404);

    // Try to get current score (using ScoreCard model)
    let currentScore = null;
    try {
      currentScore = await prisma.scoreCard.findFirst({
        where: {
          entityType: 'employee',
          entityId: id,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          score: true,
          criteria: true,
          remarks: true,
          createdAt: true,
        },
      });
    } catch (e) {
      console.log('ScoreCard query failed:', e.message);
    }

    return successResponse(res, {
      ...emp,
      status: emp.status === 'active' ? 'Active' : emp.status === 'inactive' ? 'Inactive' : emp.status,
      joined: emp.joinedAt ? emp.joinedAt.toISOString().split('T')[0] : null,
      score: currentScore,
    });
  } catch (e) {
    console.error('Employee details error:', e);
    return errorResponse(res, e.message);
  }
};

/* --------------------------- score: tenant ------------------------ */

/**
 * GET /api/admin/people/tenant/:id/score
 * (current / latest)
 */
const getTenantCurrentScore = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const score = await prisma.scoreCard.findFirst({
      where: {
        entityType: 'tenant',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, score || null);
  } catch (e) {
    console.error('Get tenant score error:', e);
    return errorResponse(res, e.message);
  }
};

/**
 * GET /api/admin/people/tenant/:id/scores?limit=10
 */
const getTenantScoreHistory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const rows = await prisma.scoreCard.findMany({
      where: {
        entityType: 'tenant',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return successResponse(res, rows);
  } catch (e) {
    console.error('Get tenant score history error:', e);
    return errorResponse(res, e.message);
  }
};

/**
 * POST /api/admin/people/tenant/:id/score
 * { behavior, punctuality, cleanliness, remarks? }
 */
const upsertTenantScore = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { behavior, punctuality, cleanliness, remarks } = req.body;

    const overall = overallFrom(behavior, punctuality, cleanliness);
    const payload = {
      entityType: 'tenant',
      entityId: id,
      score: overall,
      criteria: JSON.stringify({ behavior, punctuality, cleanliness }),
      remarks: remarks || null,
      recordedBy: req.user?.id || null,
    };

    const row = await prisma.scoreCard.create({ data: payload });
    return successResponse(res, {
      ...row,
      behavior: clamp0to5(behavior),
      punctuality: clamp0to5(punctuality),
      cleanliness: clamp0to5(cleanliness),
      overall: overall,
    }, 'Tenant score saved');
  } catch (e) {
    console.error('Upsert tenant score error:', e);
    return errorResponse(res, e.message);
  }
};

/* -------------------------- score: employee ----------------------- */

const getEmployeeCurrentScore = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const score = await prisma.scoreCard.findFirst({
      where: {
        entityType: 'employee',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, score || null);
  } catch (e) {
    console.error('Get employee score error:', e);
    return errorResponse(res, e.message);
  }
};

const getEmployeeScoreHistory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const rows = await prisma.scoreCard.findMany({
      where: {
        entityType: 'employee',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return successResponse(res, rows);
  } catch (e) {
    console.error('Get employee score history error:', e);
    return errorResponse(res, e.message);
  }
};

/**
 * POST /api/admin/people/employee/:id/score
 * { behavior, punctuality, taskQuality, remarks? }
 */
const upsertEmployeeScore = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { behavior, punctuality, taskQuality, remarks } = req.body;

    const overall = overallFrom(behavior, punctuality, taskQuality);
    const payload = {
      entityType: 'employee',
      entityId: id,
      score: overall,
      criteria: JSON.stringify({ behavior, punctuality, taskQuality }),
      remarks: remarks || null,
      recordedBy: req.user?.id || null,
    };

    const row = await prisma.scoreCard.create({ data: payload });
    return successResponse(res, {
      ...row,
      behavior: clamp0to5(behavior),
      punctuality: clamp0to5(punctuality),
      taskQuality: clamp0to5(taskQuality),
      overall: overall,
    }, 'Employee score saved');
  } catch (e) {
    console.error('Upsert employee score error:', e);
    return errorResponse(res, e.message);
  }
};

module.exports = {
  // lists
  listTenants,
  listEmployees,
  // detail
  tenantDetails,
  employeeDetails,
  // tenant scores
  getTenantCurrentScore,
  getTenantScoreHistory,
  upsertTenantScore,
  // employee scores
  getEmployeeCurrentScore,
  getEmployeeScoreHistory,
  upsertEmployeeScore,
};
