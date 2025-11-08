const { prisma } = require('../../../config/db');
const { successResponse, errorResponse } = require('../../../Helper/helper');

const paged = (page = 1, limit = 12, max = 100) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(parseInt(limit, 10) || 12, max);
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
};

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const iso = (date) => (date ? new Date(date).toISOString() : null);

const buildSearchFilter = (fields, term) => {
  if (!term) return undefined;
  const q = term.trim();
  if (!q) return undefined;
  return fields.map((field) => ({ [field]: { contains: q, mode: 'insensitive' } }));
};

const mapTenantCard = (tenant, bedMap) => {
  const activeAllocation = tenant.allocations[0] || null;
  const latestBooking = tenant.bookings[0] || null;
  const bedInfo = tenant.userId ? bedMap[tenant.userId] : null;

  let roomLabel = null;
  if (bedInfo) {
    roomLabel = bedInfo.roomNumber ? `Room ${bedInfo.roomNumber}-${bedInfo.bedNumber}` : `Bed ${bedInfo.bedNumber}`;
  } else if (latestBooking?.room?.number) {
    roomLabel = `Room ${latestBooking.room.number}`;
  }

  return {
    id: tenant.id,
    name: tenant.name,
    status: tenant.status,
    email: tenant.email,
    phone: tenant.phone,
    avatar: tenant.profilePhoto,
    hostel: activeAllocation?.hostel || null,
    room: roomLabel,
    leaseStart: iso(latestBooking?.checkIn) || iso(activeAllocation?.createdAt),
    leaseEnd: iso(latestBooking?.checkOut) || null,
    createdAt: iso(tenant.createdAt),
  };
};

const tenantContacts = async (req, res) => {
  try {
    const { status, hostelId, search, page = 1, limit = 12 } = req.query;
    const filters = {};

    if (status) filters.status = status;

    if (hostelId) {
      const hostelNumeric = parseId(hostelId);
      if (!hostelNumeric) return errorResponse(res, 'hostelId must be numeric', 400);
      filters.allocations = {
        some: { status: 'active', hostelId: hostelNumeric },
      };
    }

    const searchFilter = buildSearchFilter(['name', 'email', 'phone'], search);

    const { skip, take, page: currentPage, limit: pageSize } = paged(page, limit);

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where: {
          ...filters,
          ...(searchFilter ? { OR: searchFilter } : {}),
        },
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
          userId: true,
          createdAt: true,
          allocations: {
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              createdAt: true,
              hostel: { select: { id: true, name: true } },
            },
          },
          bookings: {
            where: { status: { not: 'cancelled' } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              checkIn: true,
              checkOut: true,
              room: { select: { number: true } },
            },
          },
        },
      }),
      prisma.tenant.count({
        where: {
          ...filters,
          ...(searchFilter ? { OR: searchFilter } : {}),
        },
      }),
    ]);

    const userIds = tenants.map((t) => t.userId).filter(Boolean);
    const bedMap = {};

    if (userIds.length) {
      const beds = await prisma.bed.findMany({
        where: {
          currentUserId: { in: userIds },
          status: 'occupied',
        },
        select: {
          currentUserId: true,
          number: true,
          room: { select: { number: true } },
        },
      });

      beds.forEach((bed) => {
        bedMap[bed.currentUserId] = {
          bedNumber: bed.number,
          roomNumber: bed.room?.number || null,
        };
      });
    }

    const items = tenants.map((tenant) => mapTenantCard(tenant, bedMap));

    return successResponse(res, {
      items,
      total,
      pagination: {
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }, 'Tenant contacts fetched successfully');
  } catch (error) {
    console.error('Tenant contacts error:', error);
    return errorResponse(res, 'Failed to fetch tenant contacts');
  }
};

const tenantContactDetails = async (req, res) => {
  try {
    const tenantId = parseId(req.params.id);
    if (!tenantId) return errorResponse(res, 'Valid tenant id is required', 400);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        profilePhoto: true,
        occupation: true,
        gender: true,
        dateOfBirth: true,
        address: true,
        userId: true,
        createdAt: true,
        allocations: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            hostel: { select: { id: true, name: true } },
          },
        },
        bookings: {
          where: { status: { notIn: ['cancelled'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            checkIn: true,
            checkOut: true,
            room: { select: { number: true } },
            hostel: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!tenant) return errorResponse(res, 'Tenant not found', 404);

    const bed = tenant.userId
      ? await prisma.bed.findFirst({
          where: { currentUserId: tenant.userId, status: 'occupied' },
          select: {
            number: true,
            room: { select: { number: true } },
          },
        })
      : null;

    const payments = await prisma.payment.findMany({
      where: { tenantId },
      orderBy: { paymentDate: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        paymentType: true,
        paymentMethod: true,
        paymentDate: true,
        status: true,
        receiptNumber: true,
      },
    });

    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return successResponse(res, {
      profile: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        status: tenant.status,
        avatar: tenant.profilePhoto,
        occupation: tenant.occupation,
        gender: tenant.gender,
        dateOfBirth: iso(tenant.dateOfBirth),
        address: tenant.address,
        hostel: tenant.allocations[0]?.hostel || tenant.bookings[0]?.hostel || null,
        room: bed?.room?.number || tenant.bookings[0]?.room?.number || null,
        bed: bed?.number || null,
        leaseStart: iso(tenant.bookings[0]?.checkIn) || iso(tenant.allocations[0]?.createdAt),
        leaseEnd: iso(tenant.bookings[0]?.checkOut) || null,
        joinedAt: iso(tenant.createdAt),
      },
      payments: {
        total: payments.length,
        totalAmount,
        recent: payments,
      },
    }, 'Tenant contact details fetched successfully');
  } catch (error) {
    console.error('Tenant contact details error:', error);
    return errorResponse(res, 'Failed to fetch tenant contact details');
  }
};

const employeeContacts = async (req, res) => {
  try {
    const { status, department, search, page = 1, limit = 12 } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (department) filters.department = department;

    const searchFilter = buildSearchFilter(['name', 'email', 'phone', 'role', 'designation'], search);
    const { skip, take, page: currentPage, limit: pageSize } = paged(page, limit);

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where: {
          ...filters,
          ...(searchFilter ? { OR: searchFilter } : {}),
        },
        orderBy: { joinDate: 'desc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          department: true,
          designation: true,
          status: true,
          joinedAt: true,
          profilePhoto: true,
        },
      }),
      prisma.employee.count({
        where: {
          ...filters,
          ...(searchFilter ? { OR: searchFilter } : {}),
        },
      }),
    ]);

    const items = employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      department: employee.department,
      designation: employee.designation,
      status: employee.status,
      avatar: employee.profilePhoto,
      joinedAt: iso(employee.joinedAt),
    }));

    return successResponse(res, {
      items,
      total,
      pagination: {
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }, 'Employee contacts fetched successfully');
  } catch (error) {
    console.error('Employee contacts error:', error);
    return errorResponse(res, 'Failed to fetch employee contacts');
  }
};

const employeeContactDetails = async (req, res) => {
  try {
    const employeeId = parseId(req.params.id);
    if (!employeeId) return errorResponse(res, 'Valid employee id is required', 400);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        designation: true,
        status: true,
        joinedAt: true,
        salary: true,
        salaryType: true,
        workingHours: true,
        hostelAssigned: true,
        address: true,
        emergencyContact: true,
        qualifications: true,
        profilePhoto: true,
        notes: true,
      },
    });

    if (!employee) return errorResponse(res, 'Employee not found', 404);

    const scoreAggregate = await prisma.scoreCard.aggregate({
      where: { entityType: 'employee', entityId: employeeId },
      _avg: { score: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    const score = scoreAggregate?._count?._all
      ? {
          average: Number((scoreAggregate._avg.score || 0).toFixed(1)),
          totalReviews: scoreAggregate._count._all,
          lastRecordedAt: iso(scoreAggregate._max.createdAt),
        }
      : null;

    return successResponse(res, {
      profile: {
        ...employee,
        joinedAt: iso(employee.joinedAt),
      },
      score,
    }, 'Employee contact details fetched successfully');
  } catch (error) {
    console.error('Employee contact details error:', error);
    return errorResponse(res, 'Failed to fetch employee contact details');
  }
};

const vendorContacts = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 12 } = req.query;
    const filters = {};
    if (status) filters.status = status.toLowerCase();

    const searchFilter = buildSearchFilter(['name', 'companyName', 'email', 'phone', 'category'], search);
    const { skip, take, page: currentPage, limit: pageSize } = paged(page, limit);

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where: {
          ...filters,
          ...(searchFilter ? { OR: searchFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          phone: true,
          status: true,
          category: true,
          paymentTerms: true,
          totalPayable: true,
          totalPaid: true,
          balance: true,
          createdAt: true,
        },
      }),
      prisma.vendor.count({
        where: {
          ...filters,
          ...(searchFilter ? { OR: searchFilter } : {}),
        },
      }),
    ]);

    const items = vendors.map((vendor) => ({
      ...vendor,
      createdAt: iso(vendor.createdAt),
    }));

    return successResponse(res, {
      items,
      total,
      pagination: {
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }, 'Vendor contacts fetched successfully');
  } catch (error) {
    console.error('Vendor contacts error:', error);
    return errorResponse(res, 'Failed to fetch vendor contacts');
  }
};

const vendorContactDetails = async (req, res) => {
  try {
    const vendorId = parseId(req.params.id);
    if (!vendorId) return errorResponse(res, 'Valid vendor id is required', 400);

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
        alternatePhone: true,
        status: true,
        category: true,
        services: true,
        address: true,
        paymentTerms: true,
        totalPayable: true,
        totalPaid: true,
        balance: true,
        createdAt: true,
        notes: true,
      },
    });

    if (!vendor) return errorResponse(res, 'Vendor not found', 404);

    const scoreAggregate = await prisma.scoreCard.aggregate({
      where: { entityType: 'vendor', entityId: vendorId },
      _avg: { score: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    const score = scoreAggregate?._count?._all
      ? {
          average: Number((scoreAggregate._avg.score || 0).toFixed(1)),
          totalReviews: scoreAggregate._count._all,
          lastRecordedAt: iso(scoreAggregate._max.createdAt),
        }
      : null;

    return successResponse(res, {
      profile: {
        ...vendor,
        createdAt: iso(vendor.createdAt),
      },
      score,
    }, 'Vendor contact details fetched successfully');
  } catch (error) {
    console.error('Vendor contact details error:', error);
    return errorResponse(res, 'Failed to fetch vendor contact details');
  }
};

module.exports = {
  tenantContacts,
  tenantContactDetails,
  employeeContacts,
  employeeContactDetails,
  vendorContacts,
  vendorContactDetails,
};

