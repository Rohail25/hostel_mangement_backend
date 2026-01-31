const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');

const ALLOWED_STATUSES = ['active', 'inactive', 'blacklisted', 'pending'];
const STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
  blacklisted: 'Blacklisted',
  pending: 'Pending',
};

// Map frontend status to backend status
const mapStatusToBackend = (status) => {
  if (!status) return null;
  const lower = String(status).toLowerCase();
  // Map 'pending' to 'inactive' for backend compatibility
  if (lower === 'pending') return 'inactive';
  // Check valid statuses (excluding pending as it's mapped to inactive)
  const validStatuses = ['active', 'inactive', 'blacklisted'];
  return validStatuses.includes(lower) ? lower : null;
};

const ALLOWED_PAYMENT_TERMS = ['prepaid', 'cod', 'net15', 'net30', 'net45', 'net60'];

const normalizePaymentTerms = (value) => {
  if (!value) return null;
  const candidate = String(value).toLowerCase().replace(/\s+/g, '');
  return ALLOWED_PAYMENT_TERMS.includes(candidate) ? candidate : null;
};

const normalizeStatus = (value) => {
  if (!value) return null;
  return mapStatusToBackend(value);
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

const safeParseJson = (value) => {
  if (!value && value !== 0) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const ensureArray = (value) => {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

const ensureJsonValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const parsed = safeParseJson(value);
    return parsed ?? value;
  }
  return value;
};

const normalizeServices = (rawServices, fallbackCategory) => {
  const parsed = safeParseJson(rawServices);
  const arr = ensureArray(parsed ?? rawServices).flatMap((entry) => {
    if (typeof entry === 'string' && entry.includes(',')) {
      return entry
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return [entry];
  });

  return arr
    .map((service) => {
      if (!service) return null;
      if (typeof service === 'string') {
        return {
          name: service,
          specialty: service,
          category: fallbackCategory ?? null,
        };
      }
      if (typeof service === 'object') {
        const name = service.name || service.title || service.type || null;
        const category = service.category || fallbackCategory || null;
        const specialty = service.specialty || service.focus || name || category || null;
        const tags = ensureArray(service.tags || service.labels || []).map((tag) =>
          typeof tag === 'string' ? tag : JSON.stringify(tag),
        );
        return {
          id: service.id ?? null,
          name,
          category,
          specialty,
          description: service.description || null,
          tags: tags.length ? tags : null,
        };
      }
      return null;
    })
    .filter(Boolean);
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

const buildRatingSummary = (aggregateRow) => {
  const snapshot = buildScoreSnapshot(aggregateRow);
  if (!snapshot) {
    return {
      average: null,
      totalReviews: 0,
      lastRecordedAt: null,
      label: null,
    };
  }
  return {
    ...snapshot,
    label: snapshot.average ? `${snapshot.average}/5` : null,
  };
};

const briefAddress = (address) => {
  if (!address) return null;
  if (typeof address === 'string') return address;
  const parsed = safeParseJson(address);
  if (!parsed) return null;
  if (typeof parsed === 'string') return parsed;
  const { line1, street, area, city, state, country, zipCode, postalCode } = parsed;
  const parts = [line1, street, area, city, state, country, zipCode || postalCode].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

const serializeVendor = (vendor, metricMaps = {}) => {
  const services = normalizeServices(vendor.services, vendor.category);
  const primaryService = services[0] || null;
  const scoreAggregate = metricMaps?.scores?.[vendor.id];
  const rating = buildRatingSummary(scoreAggregate);

  // Map backend status to frontend-friendly status
  const backendStatus = vendor.status || 'active';
  let statusLabel = STATUS_LABELS[backendStatus] || backendStatus;
  // If status was originally 'pending' but stored as 'inactive', show as 'Pending'
  // This will be handled by the frontend or we keep inactive as Inactive

  const hostel = vendor.hostel
    ? {
        id: vendor.hostel.id,
        name: vendor.hostel.name,
      }
    : null;

  // Format rating as "X/5" for frontend display
  const ratingDisplay = rating.average ? `${rating.average}/5` : null;

  return {
    id: vendor.id,
    name: vendor.name,
    companyName: vendor.companyName || null,
    status: backendStatus,
    statusLabel,
    paymentTerms: vendor.paymentTerms,
    category: vendor.category,
    primaryService: primaryService?.name ?? vendor.category ?? null,
    specialty: primaryService?.specialty ?? vendor.category ?? null,
    services,
    serviceTags: services.map((service) => service?.name).filter(Boolean),
    contact: {
      phone: vendor.phone ?? null,
      alternatePhone: vendor.alternatePhone ?? null,
      email: vendor.email ?? null,
    },
    hostel,
    address: vendor.address || briefAddress(vendor.address),
    location: vendor.location,
    financials: {
      totalPayable: vendor.totalPayable ?? 0,
      totalPaid: vendor.totalPaid ?? 0,
      balance: vendor.balance ?? 0,
      creditLimit: vendor.creditLimit ?? null,
    },
    rating: {
      ...rating,
      display: ratingDisplay,
      average: rating.average,
      totalReviews: rating.totalReviews || 0,
    },
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

const createVendor = async (req, res) => {
  try {
    const {
      name,
      companyName,
      address, // Simple address string
      email,
      phone,
      alternatePhone,
      taxId,
      category,
      specialty, // Accept specialty field from frontend
      services,
      contactPerson,
      location, // Google Map link
      attachments, // File attachments
      paymentTerms,
      creditLimit,
      hostelId,
      notes,
      status,
      rating, // Optional initial rating (1-5)
    } = req.body || {};

    if (!name) {
      return errorResponse(res, 'Vendor name is required', 400);
    }

    // Use specialty if provided, otherwise use category
    const finalCategory = specialty || category;
    
    // If specialty is provided but no services, create a service from specialty
    let servicesPayload;
    if (specialty && !services) {
      // Create a service object from specialty
      servicesPayload = [{
        name: specialty,
        specialty: specialty,
        category: finalCategory || null,
      }];
    } else {
      servicesPayload = normalizeServices(services, finalCategory);
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
        address: address || null,
        email: email || null,
        phone: phone || null,
        alternatePhone: alternatePhone || null,
        taxId: taxId || null,
        category: finalCategory || null,
        services: servicesPayload.length ? servicesPayload : ensureJsonValue(services),
        contactPerson: ensureJsonValue(contactPerson),
        location: location || null,
        attachments: ensureJsonValue(attachments),
        paymentTerms: normalizePaymentTerms(paymentTerms) || 'net30',
        creditLimit: parseNullableFloat(creditLimit) ?? 0,
        hostelId: parseNullableInt(hostelId),
        notes: notes || null,
        status: normalizeStatus(status) || 'active',
      },
      include: {
        hostel: { select: { id: true, name: true } },
      },
    });

    // If rating is provided, create initial score
    if (rating !== undefined && rating !== null) {
      const numericRating = parseFloat(rating);
      if (!Number.isNaN(numericRating)) {
        const clampedRating = Math.max(1, Math.min(5, numericRating));
        try {
          await prisma.scoreCard.create({
            data: {
              entityType: 'vendor',
              entityId: vendor.id,
              score: clampedRating,
              criteria: 'Initial rating',
              remarks: 'Initial rating set during vendor creation',
              recordedBy: req.user?.id || null,
            },
          });
        } catch (scoreError) {
          console.error('Failed to create initial rating:', scoreError);
          // Continue even if rating creation fails
        }
      }
    }

    const metricMaps = await fetchVendorMetrics([vendor.id]);
    const response = serializeVendor(vendor, metricMaps);
    return successResponse(res, response, 'Vendor created successfully', 201);
  } catch (error) {
    console.error('Create Vendor Error:', error);
    // Return more detailed error message for debugging
    const errorMessage = error.message || 'Failed to create vendor';
    return errorResponse(res, errorMessage, 500);
  }
};

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
    if (paymentTerms && normalizePaymentTerms(paymentTerms))
      where.paymentTerms = normalizePaymentTerms(paymentTerms);

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

    const serviceMap = {};
    const hostelMap = new Map();

    const items = vendors.map((vendor) => {
      if (vendor.hostel) {
        hostelMap.set(vendor.hostel.id, {
          id: vendor.hostel.id,
          name: vendor.hostel.name,
        });
      }

      const serialized = serializeVendor(vendor, metricMaps);

      serialized.services.forEach((service) => {
        const key = service?.name || serialized.category || 'General';
        if (!key) return;
        if (!serviceMap[key]) {
          serviceMap[key] = {
            service: key,
            category: service?.category || serialized.category || null,
            description: service?.description || null,
            vendors: [],
          };
        }
        serviceMap[key].vendors.push({
          id: serialized.id,
          name: serialized.name,
          status: serialized.status,
          statusLabel: serialized.statusLabel,
          hostel: serialized.hostel,
          rating: serialized.rating?.average ?? null,
          contact: serialized.contact,
        });
      });

      if (!serialized.services.length) {
        const key = serialized.category || 'General';
        if (!serviceMap[key]) {
          serviceMap[key] = {
            service: key,
            category: serialized.category || null,
            description: null,
            vendors: [],
          };
        }
        serviceMap[key].vendors.push({
          id: serialized.id,
          name: serialized.name,
          status: serialized.status,
          statusLabel: serialized.statusLabel,
          hostel: serialized.hostel,
          rating: serialized.rating?.average ?? null,
          contact: serialized.contact,
        });
      }

      return serialized;
    });

    return successResponse(
      res,
      {
        items,
        serviceBoard: Object.values(serviceMap),
        hostels: Array.from(hostelMap.values()),
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(total / parseInt(limit, 10)),
        },
      },
      'Vendors fetched successfully',
    );
  } catch (error) {
    console.error('List Vendors Error:', error);
    const errorMessage = error.message || 'Failed to fetch vendors';
    return errorResponse(res, errorMessage, 500);
  }
};

const getVendorById = async (req, res) => {
  try {
    const vendorId = parseNullableInt(req.params.id);
    if (!vendorId) {
      return errorResponse(res, 'Valid vendor id is required', 400);
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        hostel: { select: { id: true, name: true, address: true } },
      },
    });

    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    const metricMaps = await fetchVendorMetrics([vendor.id]);
    const serialized = serializeVendor(vendor, metricMaps);

    const recentScores = await prisma.scoreCard.findMany({
      where: { entityType: 'vendor', entityId: vendorId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        score: true,
        criteria: true,
        remarks: true,
        createdAt: true,
        recordedBy: true,
      },
    });

    return successResponse(
      res,
      {
        ...serialized,
        contactPerson: safeParseJson(vendor.contactPerson),
        documents: safeParseJson(vendor.documents),
        notes: vendor.notes,
        scores: recentScores || [],
      },
      'Vendor fetched successfully',
    );
  } catch (error) {
    console.error('Get Vendor Error:', error);
    const errorMessage = error.message || 'Failed to fetch vendor';
    return errorResponse(res, errorMessage, 500);
  }
};

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

    // Handle specialty field
    const finalCategory = updates.specialty || updates.category || existing.category;

    if (updates.status && !normalizeStatus(updates.status)) {
      return errorResponse(res, `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`, 400);
    }

    if (updates.paymentTerms && !normalizePaymentTerms(updates.paymentTerms)) {
      return errorResponse(
        res,
        `Invalid paymentTerms. Allowed: ${ALLOWED_PAYMENT_TERMS.join(', ')}`,
        400,
      );
    }

    // Handle services - if specialty is provided without services, create service from specialty
    let servicesPayload = null;
    if (updates.specialty && !updates.services && !existing.services) {
      servicesPayload = [{
        name: updates.specialty,
        specialty: updates.specialty,
        category: finalCategory || null,
      }];
    } else if (updates.services) {
      servicesPayload = normalizeServices(updates.services, finalCategory);
    }

    const data = {
      name: updates.name ?? existing.name,
      companyName: updates.companyName ?? existing.companyName,
      address: updates.address !== undefined ? updates.address : existing.address,
      email: updates.email ?? existing.email,
      phone: updates.phone ?? existing.phone,
      alternatePhone: updates.alternatePhone ?? existing.alternatePhone,
      taxId: updates.taxId ?? existing.taxId,
      category: finalCategory ?? existing.category,
      services:
        servicesPayload && servicesPayload.length
          ? servicesPayload
          : updates.services !== undefined
          ? ensureJsonValue(updates.services)
          : existing.services,
      contactPerson:
        updates.contactPerson !== undefined ? ensureJsonValue(updates.contactPerson) : existing.contactPerson,
      location: updates.location !== undefined ? updates.location : existing.location,
      attachments:
        updates.attachments !== undefined ? ensureJsonValue(updates.attachments) : existing.attachments,
      paymentTerms:
        updates.paymentTerms !== undefined
          ? normalizePaymentTerms(updates.paymentTerms) || existing.paymentTerms
          : existing.paymentTerms,
      creditLimit:
        updates.creditLimit !== undefined
          ? parseNullableFloat(updates.creditLimit) ?? 0
          : existing.creditLimit,
      hostelId:
        updates.hostelId !== undefined
          ? parseNullableInt(updates.hostelId)
          : existing.hostelId,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      status:
        updates.status !== undefined
          ? normalizeStatus(updates.status) || existing.status
          : existing.status,
    };

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data,
      include: {
        hostel: { select: { id: true, name: true } },
      },
    });

    const metricMaps = await fetchVendorMetrics([vendor.id]);
    const serialized = serializeVendor(vendor, metricMaps);

    return successResponse(res, serialized, 'Vendor updated successfully');
  } catch (error) {
    console.error('Update Vendor Error:', error);
    const errorMessage = error.message || 'Failed to update vendor';
    return errorResponse(res, errorMessage, 500);
  }
};

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
    const errorMessage = error.message || 'Failed to delete vendor';
    return errorResponse(res, errorMessage, 500);
  }
};

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
        totalPayable: { increment: parseFloat(deltaPayable) },
        totalPaid: { increment: parseFloat(deltaPaid) },
        balance: { increment: parseFloat(deltaPayable) - parseFloat(deltaPaid) },
      },
      include: {
        hostel: { select: { id: true, name: true } },
      },
    });

    const metricMaps = await fetchVendorMetrics([vendor.id]);
    const serialized = serializeVendor(vendor, metricMaps);

    return successResponse(res, serialized, 'Vendor financials updated');
  } catch (error) {
    console.error('Update Vendor Financials Error:', error);
    const errorMessage = error.message || 'Failed to update vendor financials';
    return errorResponse(res, errorMessage, 500);
  }
};

const recordVendorScore = async (req, res) => {
  try {
    const vendorId = parseNullableInt(req.params.id);
    if (!vendorId) {
      return errorResponse(res, 'Valid vendor id is required', 400);
    }

    const { score, criteria, remarks } = req.body || {};

    if (score === undefined || score === null) {
      return errorResponse(res, 'Score is required', 400);
    }

    const payload = await prisma.scoreCard.create({
      data: {
        entityType: 'vendor',
        entityId: vendorId,
        score: Number(score),
        criteria: criteria ? JSON.stringify(criteria) : null,
        remarks: remarks || null,
        recordedBy: req.user?.id || null,
      },
    });

    return successResponse(res, payload, 'Vendor score recorded successfully', 201);
  } catch (error) {
    console.error('Record Vendor Score Error:', error);
    const errorMessage = error.message || 'Failed to record vendor score';
    return errorResponse(res, errorMessage, 500);
  }
};

const getVendorScores = async (req, res) => {
  try {
    const vendorId = parseNullableInt(req.params.id);
    if (!vendorId) {
      return errorResponse(res, 'Valid vendor id is required', 400);
    }

    const { limit = 20 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 20, 100);

    const scores = await prisma.scoreCard.findMany({
      where: { entityType: 'vendor', entityId: vendorId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        score: true,
        criteria: true,
        remarks: true,
        recordedBy: true,
        createdAt: true,
      },
    });

    return successResponse(res, scores || [], 'Vendor scores fetched successfully');
  } catch (error) {
    console.error('Get Vendor Scores Error:', error);
    const errorMessage = error.message || 'Failed to fetch vendor scores';
    return errorResponse(res, errorMessage, 500);
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

