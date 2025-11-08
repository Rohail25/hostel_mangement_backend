const { prisma } = require('../../../config/db');
const { successResponse, errorResponse } = require('../../../Helper/helper');

const ALLOWED_STATUSES = ['active', 'inactive', 'blacklisted'];
const ALLOWED_PAYMENT_TERMS = ['prepaid', 'cod', 'net15', 'net30', 'net45', 'net60'];

const normalizePaymentTerms = (value) => {
  if (!value) return null;
  const candidate = String(value).toLowerCase().replace(/\s+/g, '');
  return ALLOWED_PAYMENT_TERMS.includes(candidate) ? candidate : null;
};

const normalizeStatus = (value) => {
  if (!value) return null;
  const candidate = String(value).toLowerCase();
  return ALLOWED_STATUSES.includes(candidate) ? candidate : null;
};

const parseNullableFloat = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseNullableInt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildScoreSnapshot = (aggregateRow) => {
  if (!aggregateRow) return null;
  const average = aggregateRow._avg?.score ?? null;
  const count = aggregateRow._count?._all ?? aggregateRow._count ?? 0;

  if (!average && !count) return null;

  return {
    average: average ? Number(average.toFixed(1)) : null,
    totalReviews: count,
    lastRecordedAt: aggregateRow._max?.createdAt ?? null,
  };
};

const serializeVendor = (vendor, metricMaps) => {
  const scoreAggregate = metricMaps?.scores?.[vendor.id];
  const rating = scoreAggregate ? buildScoreSnapshot(scoreAggregate) : null;

  return {
    id: vendor.id,
    name: vendor.name,
    companyName: vendor.companyName,
    category: vendor.category,
    services: vendor.services,
    hostel: vendor.hostel ? { id: vendor.hostel.id, name: vendor.hostel.name } : null,
    phone: vendor.phone,
    email: vendor.email,
    status: vendor.status,
    paymentTerms: vendor.paymentTerms,
    financials: {
      totalPayable: vendor.totalPayable,
      totalPaid: vendor.totalPaid,
      balance: vendor.balance,
    },
    rating,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
};

const fetchVendorMetrics = async (vendorIds) => {
  if (!vendorIds.length) {
    return {
      scores: {},
    };
  }

  const scores = await prisma.scoreCard.groupBy({
    by: ['entityId'],
    where: { entityType: 'vendor', entityId: { in: vendorIds } },
    _avg: { score: true },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  const scoreMap = scores.reduce((acc, row) => {
    acc[row.entityId] = row;
    return acc;
  }, {});

  return {
    scores: scoreMap,
  };
};

// =================== CREATE VENDOR ===================
const createVendor = async (req, res) => {
  try {
    const {
      name,
      companyName,
      email,
      phone,
      alternatePhone,
      category,
      services,
      address,
      paymentTerms,
      hostelId,
      status,
    } = req.body;

    if (!name) {
      return errorResponse(res, 'Vendor name is required', 400);
    }

    if (status && !normalizeStatus(status)) {
      return errorResponse(res, `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`, 400);
    }

    if (paymentTerms && !normalizePaymentTerms(paymentTerms)) {
      return errorResponse(res, `Invalid paymentTerms. Allowed: ${ALLOWED_PAYMENT_TERMS.join(', ')}`, 400);
    }

    const vendor = await prisma.vendor.create({
      data: {
        name,
        companyName: companyName || null,
        email: email || null,
        phone: phone || null,
        alternatePhone: alternatePhone || null,
        category: category || null,
        services: services || null,
        address: address || null,
        paymentTerms: normalizePaymentTerms(paymentTerms) || 'net30',
        hostelId: parseNullableInt(hostelId),
        status: normalizeStatus(status) || 'active',
      },
      include: {
        hostel: { select: { id: true, name: true } },
      },
    });

    const response = serializeVendor(vendor, { scores: {}, outstanding: {}, invoices: {} });
    return successResponse(res, response, 'Vendor created successfully', 201);
  } catch (error) {
    console.error('Create Vendor Error:', error);
    return errorResponse(res, 'Failed to create vendor', 500);
  }
};

// =================== GET ALL VENDORS ===================
const listVendors = async (req, res) => {
  try {
    const {
      search,
      status,
      category,
      paymentTerms,
      hostelId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const where = {};

    if (status && normalizeStatus(status)) where.status = normalizeStatus(status);
    if (category) where.category = category;
    if (paymentTerms && normalizePaymentTerms(paymentTerms)) where.paymentTerms = normalizePaymentTerms(paymentTerms);

    const hostelIdInt = parseNullableInt(hostelId);
    if (hostelId && hostelIdInt === null) {
      return errorResponse(res, 'hostelId must be a numeric value', 400);
    }
    if (hostelIdInt !== null) where.hostelId = hostelIdInt;

    if (search) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { companyName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          hostel: { select: { id: true, name: true } },
        },
      }),
      prisma.vendor.count({ where }),
    ]);

    const vendorIds = vendors.map((vendor) => vendor.id);
    const metricMaps = await fetchVendorMetrics(vendorIds);

    const items = vendors.map((vendor) => serializeVendor(vendor, metricMaps));

    return successResponse(res, {
      items,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    }, 'Vendors fetched successfully');
  } catch (error) {
    console.error('List Vendors Error:', error);
    return errorResponse(res, 'Failed to fetch vendors', 500);
  }
};

// =================== GET VENDOR BY ID ===================
const getVendorById = async (req, res) => {
  try {
    const vendorId = parseNullableInt(req.params.id);
    if (!vendorId) {
      return errorResponse(res, 'Valid vendor id is required', 400);
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        hostel: { select: { id: true, name: true } },
      },
    });

    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    const [metrics, scoreHistory] = await Promise.all([
      fetchVendorMetrics([vendor.id]),
      prisma.scoreCard.findMany({
        where: { entityType: 'vendor', entityId: vendor.id },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          score: true,
          criteria: true,
          remarks: true,
          createdAt: true,
          recordedBy: true,
          recorder: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const response = serializeVendor(vendor, metrics);

    return successResponse(res, {
      ...response,
      scoreHistory,
      recentPayments: [],
    }, 'Vendor fetched successfully');
  } catch (error) {
    console.error('Get Vendor Error:', error);
    return errorResponse(res, 'Failed to fetch vendor', 500);
  }
};

// =================== UPDATE VENDOR ===================
const updateVendor = async (req, res) => {
  try {
    const vendorId = parseNullableInt(req.params.id);
    if (!vendorId) {
      return errorResponse(res, 'Valid vendor id is required', 400);
    }

    const existing = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!existing) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    const updates = req.body || {};

    if (updates.status && !normalizeStatus(updates.status)) {
      return errorResponse(res, `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`, 400);
    }

    if (updates.paymentTerms && !normalizePaymentTerms(updates.paymentTerms)) {
      return errorResponse(res, `Invalid paymentTerms. Allowed: ${ALLOWED_PAYMENT_TERMS.join(', ')}`, 400);
    }

    const data = {
      name: updates.name ?? existing.name,
      companyName: updates.companyName ?? existing.companyName,
      email: updates.email ?? existing.email,
      phone: updates.phone ?? existing.phone,
      alternatePhone: updates.alternatePhone ?? existing.alternatePhone,
      category: updates.category ?? existing.category,
      services: updates.services ?? existing.services,
      address: updates.address ?? existing.address,
      paymentTerms: updates.paymentTerms ? normalizePaymentTerms(updates.paymentTerms) : existing.paymentTerms,
      hostelId: updates.hostelId !== undefined ? parseNullableInt(updates.hostelId) : existing.hostelId,
      status: updates.status ? normalizeStatus(updates.status) : existing.status,
      totalPayable: updates.totalPayable !== undefined ? parseNullableFloat(updates.totalPayable) ?? existing.totalPayable : existing.totalPayable,
      totalPaid: updates.totalPaid !== undefined ? parseNullableFloat(updates.totalPaid) ?? existing.totalPaid : existing.totalPaid,
      balance: updates.balance !== undefined ? parseNullableFloat(updates.balance) ?? existing.balance : existing.balance,
    };

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data,
      include: { hostel: { select: { id: true, name: true } } },
    });

    const metrics = await fetchVendorMetrics([vendor.id]);
    const response = serializeVendor(vendor, metrics);

    return successResponse(res, response, 'Vendor updated successfully');
  } catch (error) {
    console.error('Update Vendor Error:', error);
    return errorResponse(res, 'Failed to update vendor', 500);
  }
};

// =================== DELETE VENDOR ===================
const deleteVendor = async (req, res) => {
  try {
    const vendorId = parseNullableInt(req.params.id);
    if (!vendorId) {
      return errorResponse(res, 'Valid vendor id is required', 400);
    }

    const existing = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!existing) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    await prisma.vendor.delete({ where: { id: vendorId } });

    return successResponse(res, null, 'Vendor deleted successfully');
  } catch (error) {
    console.error('Delete Vendor Error:', error);
    return errorResponse(res, 'Failed to delete vendor', 500);
  }
};

// =================== UPDATE VENDOR FINANCIALS ===================
const updateVendorFinancials = async (req, res) => {
  try {
    const vendorId = parseNullableInt(req.params.id);
    if (!vendorId) {
      return errorResponse(res, 'Valid vendor id is required', 400);
    }

    const { deltaPayable = 0, deltaPaid = 0 } = req.body || {};

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        totalPayable: { increment: parseNullableFloat(deltaPayable) ?? 0 },
        totalPaid: { increment: parseNullableFloat(deltaPaid) ?? 0 },
        balance: { increment: (parseNullableFloat(deltaPayable) ?? 0) - (parseNullableFloat(deltaPaid) ?? 0) },
      },
      include: { hostel: { select: { id: true, name: true } } },
    });

    const metrics = await fetchVendorMetrics([vendor.id]);
    const response = serializeVendor(vendor, metrics);

    return successResponse(res, response, 'Vendor financials updated');
  } catch (error) {
    console.error('Update Vendor Financials Error:', error);
    return errorResponse(res, 'Failed to update vendor financials', 500);
  }
};

// =================== RECORD/GET VENDOR SCORE ===================
const recordVendorScore = async (req, res) => {
  try {
    const vendorId = parseNullableInt(req.params.id);
    if (!vendorId) {
      return errorResponse(res, 'Valid vendor id is required', 400);
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    const { score, criteria, remarks } = req.body || {};

    if (score === undefined || score === null) {
      return errorResponse(res, 'Score is required', 400);
    }

    const numericScore = Number(score);
    if (Number.isNaN(numericScore)) {
      return errorResponse(res, 'Score must be numeric', 400);
    }

    const clampedScore = Math.max(0, Math.min(5, numericScore));

    const entry = await prisma.scoreCard.create({
      data: {
        entityType: 'vendor',
        entityId: vendorId,
        score: clampedScore,
        criteria: criteria || null,
        remarks: remarks || null,
        recordedBy: req.user?.id || null,
      },
      select: {
        id: true,
        score: true,
        criteria: true,
        remarks: true,
        createdAt: true,
        recordedBy: true,
      },
    });

    const metrics = await fetchVendorMetrics([vendorId]);

    return successResponse(res, {
      entry,
      rating: buildScoreSnapshot(metrics.scores[vendorId] || null),
    }, 'Vendor score recorded successfully', 201);
  } catch (error) {
    console.error('Record Vendor Score Error:', error);
    return errorResponse(res, 'Failed to record vendor score', 500);
  }
};

const getVendorScores = async (req, res) => {
  try {
    const vendorId = parseNullableInt(req.params.id);
    if (!vendorId) {
      return errorResponse(res, 'Valid vendor id is required', 400);
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    const history = await prisma.scoreCard.findMany({
      where: { entityType: 'vendor', entityId: vendorId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        score: true,
        criteria: true,
        remarks: true,
        createdAt: true,
        recordedBy: true,
        recorder: { select: { id: true, name: true, email: true } },
      },
    });

    const metrics = await fetchVendorMetrics([vendorId]);

    return successResponse(res, {
      rating: buildScoreSnapshot(metrics.scores[vendorId] || null),
      history,
    }, 'Vendor score history fetched successfully');
  } catch (error) {
    console.error('Get Vendor Scores Error:', error);
    return errorResponse(res, 'Failed to fetch vendor scores', 500);
  }
};

module.exports = {
  createVendor,
  listVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  updateVendorFinancials,
  recordVendorScore,
  getVendorScores,
};

