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

const parseOptionalDate = (value, fieldLabel) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid ${fieldLabel}`);
    }
    return value;
  }

  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    throw new Error(`Invalid ${fieldLabel}`);
  }
  return dateValue;
};

const parseOptionalFloat = (value, fieldLabel, { allowNegative = false } = {}) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(parsed) || (!allowNegative && parsed < 0)) {
    throw new Error(`Invalid ${fieldLabel}`);
  }
  return parsed;
};

const parseOptionalInt = (value, fieldLabel) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${fieldLabel}`);
  }
  return parsed;
};

const normalizeNullableString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const pickBodyValue = (body, keys = []) => {
  for (const key of keys) {
    if (hasOwn(body, key) && body[key] !== undefined) {
      return body[key];
    }
  }
  return undefined;
};

const parseDocumentsList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const sanitizeDocumentEntries = (docs = []) =>
  docs.map((doc) => ({
    field: doc.field || null,
    url: doc.url,
    filename: doc.filename || null,
    originalName: doc.originalName || null,
    mimetype: doc.mimetype || null,
    size: doc.size || null,
    uploadedAt: doc.uploadedAt || new Date().toISOString(),
  }));

const DOCUMENT_UPLOAD_FIELDS = [
  'documents',
  'identityDocuments',
  'personalDocuments',
  'leaseDocuments',
  'allocationDocuments',
  'attachments',
  'academicAttachments',
  'jobAttachments',
  'businessAttachments',
  'rentalDocument',
  'securityDepositFile',
  'advancedRentReceivedFile',
];

const collectUploadedDocuments = (files = {}) => {
  const uploads = [];
  DOCUMENT_UPLOAD_FIELDS.forEach((field) => {
    const fieldFiles = files?.[field] || [];
    fieldFiles.forEach((file) => {
      uploads.push({
        field,
        url: `/uploads/tenants/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    });
  });
  return uploads;
};

const mergeDocuments = (existingDocs, uploadedDocs = []) => {
  const base = parseDocumentsList(existingDocs);
  if (!uploadedDocs.length) return base;
  return [...base, ...sanitizeDocumentEntries(uploadedDocs)];
};

const paged = (page = 1, limit = 12) => {
  const p = parseInt(page, 10) || 1;
  const l = Math.min(parseInt(limit, 10) || 12, 100);
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

const buildUploads = (profilePhoto, docs) => ({
  profilePhoto: profilePhoto || null,
  documents: parseDocumentsList(docs),
});

const allocationDocumentFields = new Set(['allocationDocuments', 'leaseDocuments']);

const formatAllocationForResponse = (allocation) => {
  if (!allocation) return null;
  return {
    id: allocation.id,
    status: allocation.status,
    checkInDate: allocation.checkInDate,
    expectedCheckOutDate: allocation.expectedCheckOutDate,
    checkOutDate: allocation.checkOutDate,
    rentAmount: allocation.rentAmount,
    depositAmount: allocation.depositAmount,
    notes: allocation.notes,
    documents: parseDocumentsList(allocation.documents),
    hostel: allocation.hostel
      ? {
          id: allocation.hostel.id,
          name: allocation.hostel.name,
        }
      : null,
    floor: allocation.floor
      ? {
          id: allocation.floor.id,
          number: allocation.floor.floorNumber,
          name: allocation.floor.floorName,
        }
      : null,
    room: allocation.room
      ? {
          id: allocation.room.id,
          number: allocation.room.roomNumber,
        }
      : null,
    bed: allocation.bed
      ? {
          id: allocation.bed.id,
          number: allocation.bed.bedNumber,
        }
      : null,
  };
};

const formatTenantForResponse = (tenant) => {
  if (!tenant) return null;
  const allocations = tenant.allocations || [];
  const activeAllocation =
    allocations.find((allocation) => allocation.status === 'active') || allocations[0] || null;

  return {
    id: tenant.id,
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    name: tenant.name,
    email: tenant.email,
    phone: tenant.phone,
    alternatePhone: tenant.alternatePhone,
    gender: tenant.gender,
    dateOfBirth: tenant.dateOfBirth,
    status: tenant.status,
    leaseStartDate: tenant.leaseStartDate,
    leaseEndDate: tenant.leaseEndDate,
    monthlyRent: tenant.monthlyRent,
    securityDeposit: tenant.securityDeposit,
    notes: tenant.notes,
    rating: tenant.rating,
    profilePhoto: tenant.profilePhoto,
    documents: parseDocumentsList(tenant.documents),
    counts: tenant._count || null,
    activeAllocation: formatAllocationForResponse(activeAllocation),
    allocations: allocations.map(formatAllocationForResponse),
  };
};

const allocationLocationInclude = {
  hostel: { select: { id: true, name: true } },
  floor: { select: { id: true, floorNumber: true, floorName: true } },
  room: { select: { id: true, roomNumber: true } },
  bed: { select: { id: true, bedNumber: true } },
};

const tenantCardInclude = {
  allocations: {
    orderBy: { createdAt: 'desc' },
    include: allocationLocationInclude,
  },
  _count: { select: { payments: true, allocations: true } },
};

const tenantProfileInclude = {
  ...tenantCardInclude,
  user: {
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      userRole: {
        select: {
          id: true,
          roleName: true,
        },
      },
    },
  },
  payments: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      hostel: { select: { id: true, name: true } },
      collector: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  },
  alerts: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

const extractAllocationPayload = (body, defaults = {}, options = {}) => {
  const { allowPartial = false, uploadedDocuments = [] } = options;

  let allocationRaw = pickBodyValue(body, ['allocation', 'allocationDetails']);
  if (allocationRaw && typeof allocationRaw === 'string') {
    try {
      allocationRaw = JSON.parse(allocationRaw);
    } catch {
      allocationRaw = null;
    }
  }
  const source = allocationRaw && typeof allocationRaw === 'object' ? allocationRaw : {};
  const getValue = (keys) => pickBodyValue(source, keys) ?? pickBodyValue(body, keys);

  const hostelIdValue = getValue(['allocationHostelId', 'hostelId']);
  const floorIdValue = getValue(['allocationFloorId', 'floorId']);
  const roomIdValue = getValue(['allocationRoomId', 'roomId']);
  const bedIdValue = getValue(['allocationBedId', 'bedId', 'seatId']);
  const checkInDateValue = getValue(['checkInDate', 'allocationCheckInDate']);
  const expectedCheckOutValue = getValue(['expectedCheckOutDate', 'allocationExpectedCheckOutDate']);
  const checkOutValue = getValue(['checkOutDate', 'allocationCheckOutDate']);
  const notesValue = getValue(['allocationNotes']);
  const rentValue = getValue(['allocationRent', 'rentAmount', 'monthlyRent']);
  const depositValue = getValue(['allocationDeposit', 'depositAmount', 'securityDeposit', 'deposit']);
  const allocationDocsValue = getValue(['allocationDocuments', 'leaseDocuments']);

  const hasAnyField = [
    hostelIdValue,
    floorIdValue,
    roomIdValue,
    bedIdValue,
    checkInDateValue,
    expectedCheckOutValue,
    checkOutValue,
    notesValue,
    rentValue,
    depositValue,
    allocationDocsValue,
    uploadedDocuments.length ? true : null,
  ].some((val) => val !== undefined && val !== null && val !== '');

  if (!hasAnyField) return null;

  const payload = {};

  const hostelId = parseOptionalInt(hostelIdValue ?? defaults.hostelId, 'hostel');
  const floorId = parseOptionalInt(floorIdValue ?? defaults.floorId, 'floor');
  const roomId = parseOptionalInt(roomIdValue ?? defaults.roomId, 'room');
  const bedId = parseOptionalInt(bedIdValue ?? defaults.bedId, 'bed');

  if (!allowPartial) {
    const missing = [];
    if (!hostelId) missing.push('hostel');
    if (!floorId) missing.push('floor');
    if (!roomId) missing.push('room');
    if (!bedId) missing.push('bed');
    if (missing.length) {
      throw new Error(`Allocation requires ${missing.join(', ')} selection${missing.length > 1 ? 's' : ''}`);
    }
  }

  if (hostelId) payload.hostelId = hostelId;
  if (floorId) payload.floorId = floorId;
  if (roomId) payload.roomId = roomId;
  if (bedId) payload.bedId = bedId;

  const derivedCheckIn = checkInDateValue ?? defaults.checkInDate ?? defaults.leaseStartDate;
  const derivedExpected = expectedCheckOutValue ?? defaults.expectedCheckOutDate ?? defaults.leaseEndDate;
  const derivedCheckOut = checkOutValue ?? defaults.checkOutDate ?? null;

  const parsedCheckIn = parseOptionalDate(derivedCheckIn, 'check-in date');
  if (parsedCheckIn) {
    payload.checkInDate = parsedCheckIn;
  } else if (!allowPartial) {
    throw new Error('Allocation requires a check-in date');
  }

  const parsedExpectedCheckOut = parseOptionalDate(derivedExpected, 'expected check-out date');
  if (parsedExpectedCheckOut) {
    payload.expectedCheckOutDate = parsedExpectedCheckOut;
  }

  const parsedCheckOut = parseOptionalDate(derivedCheckOut, 'check-out date');
  if (parsedCheckOut) {
    payload.checkOutDate = parsedCheckOut;
  }

  const rentAmountInput =
    rentValue ?? defaults.rentAmount ?? defaults.monthlyRent ?? defaults.tenantMonthlyRent ?? null;
  const rentAmount = rentAmountInput !== null ? parseOptionalFloat(rentAmountInput, 'rent amount') : null;
  if (rentAmount !== null) {
    payload.rentAmount = rentAmount;
  }

  const depositInput =
    depositValue ??
    defaults.depositAmount ??
    defaults.securityDeposit ??
    defaults.tenantSecurityDeposit ??
    null;
  const depositAmount =
    depositInput !== null ? parseOptionalFloat(depositInput, 'deposit amount') ?? null : null;
  if (depositAmount !== null) {
    payload.depositAmount = depositAmount;
  }

  if (notesValue) {
    payload.notes = notesValue;
  } else if (defaults.notes && !allowPartial) {
    payload.notes = defaults.notes;
  }

  const parsedAllocationDocs = mergeDocuments(
    allocationDocsValue ?? defaults.documents,
    uploadedDocuments
  );
  if (parsedAllocationDocs.length) {
    payload.documents = parsedAllocationDocs;
  }

  return payload;
};

// ======================================================
// CREATE TENANT
// ======================================================
const createTenant = async (req, res) => {
  try {
    const {
      userId,
      fullName,
      fatherName,
      email,
      phone,
      alternatePhone,
      whatsappNumber,
      gender,
      genderOther,
      dateOfBirth,
      cnicNumber,
      address,
      permanentAddress,
      emergencyContact,
      emergencyContactWhatsapp,
      emergencyContactRelationOther,
      anyDisease,
      bloodGroup,
      nearestRelative,
      professionType,
      professionDescription,
      // Profession detail fields (will be combined into professionDetail JSON)
      // Student fields
      academicName,
      academicAddress,
      academicLocation,
      studentCardNo,
      // Job fields
      jobTitle,
      companyName,
      jobAddress,
      jobLocation,
      jobIdNo,
      // Business fields
      businessName,
      businessAddress,
      businessLocation,
      notes,
      leaseStartDate,
      leaseEndDate,
      monthlyRent,
      securityDeposit: securityDepositInput,
      deposit,
      depositAmount,
      lateFeesFine,
      lateFeesPercentage
    } = req.body;

    // Handle uploaded files - when using uploadAny.any(), files come as an array
    // Group files by fieldname
    const filesByField = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        if (!filesByField[file.fieldname]) {
          filesByField[file.fieldname] = [];
        }
        filesByField[file.fieldname].push(file);
      });
    } else if (req.files) {
      // Fallback for when files come as object (upload.fields format)
      Object.keys(req.files).forEach(fieldname => {
        filesByField[fieldname] = Array.isArray(req.files[fieldname]) 
          ? req.files[fieldname] 
          : [req.files[fieldname]];
      });
    }

    // Handle uploaded files
    const profilePhoto = filesByField.profilePhoto?.[0]
      ? `/uploads/tenants/${filesByField.profilePhoto[0].filename}`
      : null;

    // Handle attachments (multiple images)
    const attachmentsFiles = filesByField.attachments || [];
    const attachments = attachmentsFiles.map(file => ({
      field: 'attachments',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));

    // Handle academic attachments
    const academicAttachmentsFiles = filesByField.academicAttachments || [];
    const academicAttachments = academicAttachmentsFiles.map(file => ({
      field: 'academicAttachments',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));

    // Handle job attachments
    const jobAttachmentsFiles = filesByField.jobAttachments || [];
    const jobAttachments = jobAttachmentsFiles.map(file => ({
      field: 'jobAttachments',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));

    // Handle business attachments
    const businessAttachmentsFiles = filesByField.businessAttachments || [];
    const businessAttachments = businessAttachmentsFiles.map(file => ({
      field: 'businessAttachments',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));

    // Handle rental document
    const rentalDocumentFiles = filesByField.rentalDocument || [];
    const rentalDocument = rentalDocumentFiles.map(file => ({
      field: 'rentalDocument',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));

    // Handle security deposit file
    const securityDepositFiles = filesByField.securityDepositFile || [];
    const securityDepositFile = securityDepositFiles.map(file => ({
      field: 'securityDepositFile',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));

    // Handle advanced rent received file
    const advancedRentFiles = filesByField.advancedRentReceivedFile || [];
    const advancedRentReceivedFile = advancedRentFiles.map(file => ({
      field: 'advancedRentReceivedFile',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));

    // Group files for collectUploadedDocuments (needs object format)
    let filesForCollection = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        if (!filesForCollection[file.fieldname]) {
          filesForCollection[file.fieldname] = [];
        }
        filesForCollection[file.fieldname].push(file);
      });
    } else if (req.files) {
      filesForCollection = req.files;
    }

    const uploadedDocs = collectUploadedDocuments(filesForCollection);
    const tenantDocUploads = uploadedDocs.filter(
      (doc) => !allocationDocumentFields.has(doc.field)
    );
    const allocationDocUploads = uploadedDocs.filter((doc) =>
      allocationDocumentFields.has(doc.field)
    );
    const providedDocuments = mergeDocuments(req.body?.documents, tenantDocUploads);

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
    if (!fullName || !phone) {
      return errorResponse(res, "Full name and phone number are required", 400);
    }

    // Validate CNIC length
    if (cnicNumber && cnicNumber.length !== 13) {
      return errorResponse(res, "CNIC number must be exactly 13 digits", 400);
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

    // Build professionDetail JSON based on professionType
    let professionDetailData = null;
    if (professionType) {
      professionDetailData = {};
      
      if (professionType === 'student') {
        if (academicName) professionDetailData.academicName = academicName;
        if (academicAddress) professionDetailData.academicAddress = academicAddress;
        if (academicLocation) professionDetailData.academicLocation = academicLocation;
        if (studentCardNo) professionDetailData.studentCardNo = studentCardNo;
        if (academicAttachments.length > 0) professionDetailData.academicAttachments = academicAttachments;
      } else if (professionType === 'job') {
        if (jobTitle) professionDetailData.jobTitle = jobTitle;
        if (companyName) professionDetailData.companyName = companyName;
        if (jobAddress) professionDetailData.jobAddress = jobAddress;
        if (jobLocation) professionDetailData.jobLocation = jobLocation;
        if (jobIdNo) professionDetailData.jobIdNo = jobIdNo;
        if (jobAttachments.length > 0) professionDetailData.jobAttachments = jobAttachments;
      } else if (professionType === 'business') {
        if (businessName) professionDetailData.businessName = businessName;
        if (businessAddress) professionDetailData.businessAddress = businessAddress;
        if (businessLocation) professionDetailData.businessLocation = businessLocation;
        if (businessAttachments.length > 0) professionDetailData.businessAttachments = businessAttachments;
      }
      
      // Only set professionDetail if there's data
      if (Object.keys(professionDetailData).length === 0) {
        professionDetailData = null;
      }
    }

    // Build emergency contact JSON
    const emergencyContactData = emergencyContact ? parseJsonField(emergencyContact) : {};
    if (req.body.emergencyContactName || req.body.emergencyContactNumber || req.body.emergencyContactRelation) {
      emergencyContactData.name = req.body.emergencyContactName || emergencyContactData.name || null;
      emergencyContactData.phone = req.body.emergencyContactNumber || emergencyContactData.phone || null;
      emergencyContactData.relationship = req.body.emergencyContactRelation || emergencyContactData.relationship || null;
      emergencyContactData.whatsappNumber = emergencyContactWhatsapp || emergencyContactData.whatsappNumber || null;
      emergencyContactData.relationOther = emergencyContactRelationOther || emergencyContactData.relationOther || null;
    }

    // Build nearest relative JSON
    let nearestRelativeData = null;
    if (req.body.nearestRelativeContact || req.body.nearestRelativeWhatsapp || req.body.nearestRelativeRelation) {
      nearestRelativeData = {
        contactNumber: req.body.nearestRelativeContact || null,
        whatsappNumber: req.body.nearestRelativeWhatsapp || null,
        relation: req.body.nearestRelativeRelation || null,
        relationOther: req.body.nearestRelativeRelationOther || null,
      };
    }

    // Parse late fees percentage
    let parsedLateFeesPercentage = null;
    if (lateFeesFine === 'Yes' && lateFeesPercentage) {
      parsedLateFeesPercentage = parseFloat(lateFeesPercentage);
      if (Number.isNaN(parsedLateFeesPercentage) || parsedLateFeesPercentage < 0 || parsedLateFeesPercentage > 100) {
        return errorResponse(res, "Invalid late fees percentage (must be between 0 and 100)", 400);
      }
    }

    const tenantData = {
      // Only include userId if it exists, otherwise omit it (Prisma relation requirement)
      ...(userIdExist && { userId: userIdExist }),
      fullName: fullName,
      fatherName: fatherName || null,
      name: fullName, // Use fullName as primary name
      email: email || null,
      phone,
      alternatePhone: alternatePhone || null,
      whatsappNumber: whatsappNumber || null,
      gender: gender || null,
      genderOther: gender === 'other' ? (genderOther || null) : null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      cnicNumber: cnicNumber || null,
      address: parseJsonField(address),
      permanentAddress: parseJsonField(permanentAddress),
      attachments: attachments.length > 0 ? attachments : null,
      emergencyContact: Object.keys(emergencyContactData).length > 0 ? emergencyContactData : null,
      emergencyContactWhatsapp: emergencyContactWhatsapp || null,
      emergencyContactRelationOther: emergencyContactRelationOther || null,
      anyDisease: anyDisease || null,
      bloodGroup: bloodGroup || null,
      nearestRelative: nearestRelativeData,
      professionType: professionType || null,
      professionDetail: professionDetailData,
      professionDescription: professionDescription || null,
      documents: providedDocuments.length ? providedDocuments : null,
      profilePhoto,
      notes: notes || null,
      leaseStartDate: parsedLeaseStartDate,
      leaseEndDate: parsedLeaseEndDate,
      monthlyRent: parsedMonthlyRent,
      securityDeposit: parsedSecurityDeposit ?? 0,
      lateFeesFine: lateFeesFine || null,
      lateFeesPercentage: parsedLateFeesPercentage,
      rentalDocument: rentalDocument.length > 0 ? rentalDocument : null,
      securityDepositFile: securityDepositFile.length > 0 ? securityDepositFile : null,
      advancedRentReceivedFile: advancedRentReceivedFile.length > 0 ? advancedRentReceivedFile : null,
    };

    const allocationPayload = extractAllocationPayload(
      req.body,
      {
        leaseStartDate: parsedLeaseStartDate,
        leaseEndDate: parsedLeaseEndDate,
        rentAmount: parsedMonthlyRent,
        depositAmount: parsedSecurityDeposit ?? 0
      },
      {
        uploadedDocuments: allocationDocUploads
      }
    );

    const result = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: tenantData
      });

      let createdAllocation = null;
      if (allocationPayload) {
        if (!req.userId) {
          throw new Error("Authenticated user id is required to create allocations");
        }

        const existingBedAllocation = await tx.allocation.findFirst({
          where: {
            bedId: allocationPayload.bedId,
            status: 'active'
          },
          select: { id: true }
        });

        if (existingBedAllocation) {
          throw new Error("Selected bed is already allocated to another tenant");
        }

        createdAllocation = await tx.allocation.create({
          data: {
            hostelId: allocationPayload.hostelId,
            floorId: allocationPayload.floorId,
            roomId: allocationPayload.roomId,
            bedId: allocationPayload.bedId,
            tenantId: createdTenant.id,
            allocatedById: req.userId,
            checkInDate: allocationPayload.checkInDate,
            expectedCheckOutDate: allocationPayload.expectedCheckOutDate,
            checkOutDate: allocationPayload.checkOutDate,
            rentAmount:
              allocationPayload.rentAmount ?? parsedMonthlyRent ?? 0,
            depositAmount:
              allocationPayload.depositAmount ?? parsedSecurityDeposit ?? 0,
            notes: allocationPayload.notes || null,
            documents: allocationPayload.documents?.length
              ? allocationPayload.documents
              : null
          },
          include: allocationLocationInclude
        });
      }

      const tenantWithRelations = await tx.tenant.findUnique({
        where: { id: createdTenant.id },
        include: tenantCardInclude,
      });

      return {
        tenant: tenantWithRelations,
        allocation: createdAllocation,
      };
    });

    return successResponse(
      res,
      {
        tenant: formatTenantForResponse(result.tenant),
        allocation: formatAllocationForResponse(result.allocation),
      },
      "Tenant created successfully",
      201
    );
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

    // Handle uploaded files - when using uploadAny.any(), files come as an array
    // Group files by fieldname
    const filesByField = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        if (!filesByField[file.fieldname]) {
          filesByField[file.fieldname] = [];
        }
        filesByField[file.fieldname].push(file);
      });
    } else if (req.files) {
      // Fallback for when files come as object (upload.fields format)
      Object.keys(req.files).forEach(fieldname => {
        filesByField[fieldname] = Array.isArray(req.files[fieldname]) 
          ? req.files[fieldname] 
          : [req.files[fieldname]];
      });
    }

    // Handle uploaded files
    const profilePhoto = filesByField.profilePhoto?.[0]
      ? `/uploads/tenants/${filesByField.profilePhoto[0].filename}`
      : undefined;

    // Handle attachments (multiple images)
    const attachmentsFiles = filesByField.attachments || [];
    const newAttachments = attachmentsFiles.map(file => ({
      field: 'attachments',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));
    const mergedAttachments = existingTenant.attachments 
      ? [...parseDocumentsList(existingTenant.attachments), ...newAttachments]
      : (newAttachments.length > 0 ? newAttachments : null);

    // Handle academic attachments
    const academicAttachmentsFiles = filesByField.academicAttachments || [];
    const newAcademicAttachments = academicAttachmentsFiles.map(file => ({
      field: 'academicAttachments',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));
    const mergedAcademicAttachments = existingTenant.academicAttachments
      ? [...parseDocumentsList(existingTenant.academicAttachments), ...newAcademicAttachments]
      : (newAcademicAttachments.length > 0 ? newAcademicAttachments : null);

    // Handle job attachments
    const jobAttachmentsFiles = filesByField.jobAttachments || [];
    const newJobAttachments = jobAttachmentsFiles.map(file => ({
      field: 'jobAttachments',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));
    const mergedJobAttachments = existingTenant.jobAttachments
      ? [...parseDocumentsList(existingTenant.jobAttachments), ...newJobAttachments]
      : (newJobAttachments.length > 0 ? newJobAttachments : null);

    // Handle business attachments
    const businessAttachmentsFiles = filesByField.businessAttachments || [];
    const newBusinessAttachments = businessAttachmentsFiles.map(file => ({
      field: 'businessAttachments',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));
    const mergedBusinessAttachments = existingTenant.businessAttachments
      ? [...parseDocumentsList(existingTenant.businessAttachments), ...newBusinessAttachments]
      : (newBusinessAttachments.length > 0 ? newBusinessAttachments : null);

    // Handle rental document
    const rentalDocumentFiles = filesByField.rentalDocument || [];
    const newRentalDocument = rentalDocumentFiles.map(file => ({
      field: 'rentalDocument',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));
    const mergedRentalDocument = existingTenant.rentalDocument
      ? [...parseDocumentsList(existingTenant.rentalDocument), ...newRentalDocument]
      : (newRentalDocument.length > 0 ? newRentalDocument : null);

    // Handle security deposit file
    const securityDepositFiles = filesByField.securityDepositFile || [];
    const newSecurityDepositFile = securityDepositFiles.map(file => ({
      field: 'securityDepositFile',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));
    const mergedSecurityDepositFile = existingTenant.securityDepositFile
      ? [...parseDocumentsList(existingTenant.securityDepositFile), ...newSecurityDepositFile]
      : (newSecurityDepositFile.length > 0 ? newSecurityDepositFile : null);

    // Handle advanced rent received file
    const advancedRentFiles = filesByField.advancedRentReceivedFile || [];
    const newAdvancedRentReceivedFile = advancedRentFiles.map(file => ({
      field: 'advancedRentReceivedFile',
      url: `/uploads/tenants/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));
    const mergedAdvancedRentReceivedFile = existingTenant.advancedRentReceivedFile
      ? [...parseDocumentsList(existingTenant.advancedRentReceivedFile), ...newAdvancedRentReceivedFile]
      : (newAdvancedRentReceivedFile.length > 0 ? newAdvancedRentReceivedFile : null);

    // Handle documents (backward compatibility)
    const documentFiles = filesByField.documents?.map(file => `/uploads/tenants/${file.filename}`) || [];
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

    // Validate CNIC length
    if (updates.cnicNumber && updates.cnicNumber.length !== 13) {
      return errorResponse(res, "CNIC number must be exactly 13 digits", 400);
    }

    // Handle fullName and fatherName
    const updatedFullName = hasOwn(updates, "fullName")
      ? (updates.fullName === null || updates.fullName === '' ? null : updates.fullName)
      : existingTenant.fullName;

    const updatedFatherName = hasOwn(updates, "fatherName")
      ? (updates.fatherName === null || updates.fatherName === '' ? null : updates.fatherName)
      : existingTenant.fatherName;

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

    // Build emergency contact JSON
    let emergencyContactData = existingTenant.emergencyContact ? (typeof existingTenant.emergencyContact === 'string' ? JSON.parse(existingTenant.emergencyContact) : existingTenant.emergencyContact) : {};
    if (hasOwn(updates, "emergencyContactName") || hasOwn(updates, "emergencyContactNumber") || hasOwn(updates, "emergencyContactRelation")) {
      if (hasOwn(updates, "emergencyContactName")) emergencyContactData.name = updates.emergencyContactName || null;
      if (hasOwn(updates, "emergencyContactNumber")) emergencyContactData.phone = updates.emergencyContactNumber || null;
      if (hasOwn(updates, "emergencyContactRelation")) emergencyContactData.relationship = updates.emergencyContactRelation || null;
      if (hasOwn(updates, "emergencyContactWhatsapp")) emergencyContactData.whatsappNumber = updates.emergencyContactWhatsapp || null;
      if (hasOwn(updates, "emergencyContactRelationOther")) emergencyContactData.relationOther = updates.emergencyContactRelationOther || null;
    } else if (hasOwn(updates, "emergencyContact")) {
      emergencyContactData = parseJsonField(updates.emergencyContact) || emergencyContactData;
    }

    // Build nearest relative JSON
    let nearestRelativeData = existingTenant.nearestRelative ? (typeof existingTenant.nearestRelative === 'string' ? JSON.parse(existingTenant.nearestRelative) : existingTenant.nearestRelative) : null;
    if (hasOwn(updates, "nearestRelativeContact") || hasOwn(updates, "nearestRelativeWhatsapp") || hasOwn(updates, "nearestRelativeRelation")) {
      nearestRelativeData = nearestRelativeData || {};
      if (hasOwn(updates, "nearestRelativeContact")) nearestRelativeData.contactNumber = updates.nearestRelativeContact || null;
      if (hasOwn(updates, "nearestRelativeWhatsapp")) nearestRelativeData.whatsappNumber = updates.nearestRelativeWhatsapp || null;
      if (hasOwn(updates, "nearestRelativeRelation")) nearestRelativeData.relation = updates.nearestRelativeRelation || null;
      if (hasOwn(updates, "nearestRelativeRelationOther")) nearestRelativeData.relationOther = updates.nearestRelativeRelationOther || null;
    }

    // Parse late fees percentage
    let updateLateFeesPercentage = existingTenant.lateFeesPercentage;
    if (hasOwn(updates, "lateFeesFine") && updates.lateFeesFine === 'Yes' && hasOwn(updates, "lateFeesPercentage")) {
      if (updates.lateFeesPercentage === null || updates.lateFeesPercentage === "") {
        updateLateFeesPercentage = null;
      } else {
        const parsed = parseFloat(updates.lateFeesPercentage);
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
          return errorResponse(res, "Invalid late fees percentage (must be between 0 and 100)", 400);
        }
        updateLateFeesPercentage = parsed;
      }
    } else if (hasOwn(updates, "lateFeesFine") && updates.lateFeesFine === 'No') {
      updateLateFeesPercentage = null;
    }

    // Build professionDetail JSON based on professionType
    let professionDetailData = existingTenant.professionDetail 
      ? (typeof existingTenant.professionDetail === 'string' ? JSON.parse(existingTenant.professionDetail) : existingTenant.professionDetail)
      : null;
    
    const updatedProfessionType = hasOwn(updates, "professionType") ? (updates.professionType || null) : existingTenant.professionType;
    
    if (updatedProfessionType) {
      // If professionType is being updated or professionDetail fields are being updated, rebuild professionDetail
      const hasProfessionUpdates = hasOwn(updates, "academicName") || hasOwn(updates, "academicAddress") || 
        hasOwn(updates, "academicLocation") || hasOwn(updates, "studentCardNo") || 
        hasOwn(updates, "jobTitle") || hasOwn(updates, "companyName") || hasOwn(updates, "jobAddress") ||
        hasOwn(updates, "jobLocation") || hasOwn(updates, "jobIdNo") ||
        hasOwn(updates, "businessName") || hasOwn(updates, "businessAddress") || hasOwn(updates, "businessLocation") ||
        mergedAcademicAttachments || mergedJobAttachments || mergedBusinessAttachments;
      
      if (hasProfessionUpdates || hasOwn(updates, "professionType")) {
        professionDetailData = {};
        
        if (updatedProfessionType === 'student') {
          const existingDetail = existingTenant.professionDetail 
            ? (typeof existingTenant.professionDetail === 'string' ? JSON.parse(existingTenant.professionDetail) : existingTenant.professionDetail)
            : {};
          if (hasOwn(updates, "academicName")) professionDetailData.academicName = updates.academicName || null;
          else professionDetailData.academicName = existingDetail.academicName || null;
          
          if (hasOwn(updates, "academicAddress")) professionDetailData.academicAddress = updates.academicAddress || null;
          else professionDetailData.academicAddress = existingDetail.academicAddress || null;
          
          if (hasOwn(updates, "academicLocation")) professionDetailData.academicLocation = updates.academicLocation || null;
          else professionDetailData.academicLocation = existingDetail.academicLocation || null;
          
          if (hasOwn(updates, "studentCardNo")) professionDetailData.studentCardNo = updates.studentCardNo || null;
          else professionDetailData.studentCardNo = existingDetail.studentCardNo || null;
          
          if (mergedAcademicAttachments) professionDetailData.academicAttachments = mergedAcademicAttachments;
          else professionDetailData.academicAttachments = existingDetail.academicAttachments || null;
        } else if (updatedProfessionType === 'job') {
          const existingDetail = existingTenant.professionDetail 
            ? (typeof existingTenant.professionDetail === 'string' ? JSON.parse(existingTenant.professionDetail) : existingTenant.professionDetail)
            : {};
          if (hasOwn(updates, "jobTitle")) professionDetailData.jobTitle = updates.jobTitle || null;
          else professionDetailData.jobTitle = existingDetail.jobTitle || null;
          
          if (hasOwn(updates, "companyName")) professionDetailData.companyName = updates.companyName || null;
          else professionDetailData.companyName = existingDetail.companyName || null;
          
          if (hasOwn(updates, "jobAddress")) professionDetailData.jobAddress = updates.jobAddress || null;
          else professionDetailData.jobAddress = existingDetail.jobAddress || null;
          
          if (hasOwn(updates, "jobLocation")) professionDetailData.jobLocation = updates.jobLocation || null;
          else professionDetailData.jobLocation = existingDetail.jobLocation || null;
          
          if (hasOwn(updates, "jobIdNo")) professionDetailData.jobIdNo = updates.jobIdNo || null;
          else professionDetailData.jobIdNo = existingDetail.jobIdNo || null;
          
          if (mergedJobAttachments) professionDetailData.jobAttachments = mergedJobAttachments;
          else professionDetailData.jobAttachments = existingDetail.jobAttachments || null;
        } else if (updatedProfessionType === 'business') {
          const existingDetail = existingTenant.professionDetail 
            ? (typeof existingTenant.professionDetail === 'string' ? JSON.parse(existingTenant.professionDetail) : existingTenant.professionDetail)
            : {};
          if (hasOwn(updates, "businessName")) professionDetailData.businessName = updates.businessName || null;
          else professionDetailData.businessName = existingDetail.businessName || null;
          
          if (hasOwn(updates, "businessAddress")) professionDetailData.businessAddress = updates.businessAddress || null;
          else professionDetailData.businessAddress = existingDetail.businessAddress || null;
          
          if (hasOwn(updates, "businessLocation")) professionDetailData.businessLocation = updates.businessLocation || null;
          else professionDetailData.businessLocation = existingDetail.businessLocation || null;
          
          if (mergedBusinessAttachments) professionDetailData.businessAttachments = mergedBusinessAttachments;
          else professionDetailData.businessAttachments = existingDetail.businessAttachments || null;
        }
        
        // Only set professionDetail if there's data
        if (Object.keys(professionDetailData).length === 0) {
          professionDetailData = null;
        }
      }
    }

    // Update data
    const updateData = {
      fullName: updatedFullName,
      fatherName: updatedFatherName,
      name: updatedFullName || existingTenant.name,
      email: hasOwn(updates, "email") ? (updates.email || null) : existingTenant.email,
      phone: hasOwn(updates, "phone") ? updates.phone : existingTenant.phone,
      alternatePhone: hasOwn(updates, "alternatePhone") ? (updates.alternatePhone || null) : existingTenant.alternatePhone,
      whatsappNumber: hasOwn(updates, "whatsappNumber") ? (updates.whatsappNumber || null) : existingTenant.whatsappNumber,
      gender: hasOwn(updates, "gender") ? (updates.gender || null) : existingTenant.gender,
      genderOther: hasOwn(updates, "gender") && updates.gender === 'other' && hasOwn(updates, "genderOther")
        ? (updates.genderOther || null)
        : (hasOwn(updates, "gender") && updates.gender !== 'other' ? null : existingTenant.genderOther),
      dateOfBirth: hasOwn(updates, "dateOfBirth") ? (updates.dateOfBirth ? new Date(updates.dateOfBirth) : null) : existingTenant.dateOfBirth,
      cnicNumber: hasOwn(updates, "cnicNumber") ? (updates.cnicNumber || null) : existingTenant.cnicNumber,
      address: hasOwn(updates, "address") ? parseJsonField(updates.address) : existingTenant.address,
      permanentAddress: hasOwn(updates, "permanentAddress") ? parseJsonField(updates.permanentAddress) : existingTenant.permanentAddress,
      attachments: mergedAttachments,
      emergencyContact: Object.keys(emergencyContactData).length > 0 ? emergencyContactData : null,
      emergencyContactWhatsapp: hasOwn(updates, "emergencyContactWhatsapp") ? (updates.emergencyContactWhatsapp || null) : existingTenant.emergencyContactWhatsapp,
      emergencyContactRelationOther: hasOwn(updates, "emergencyContactRelationOther") ? (updates.emergencyContactRelationOther || null) : existingTenant.emergencyContactRelationOther,
      anyDisease: hasOwn(updates, "anyDisease") ? (updates.anyDisease || null) : existingTenant.anyDisease,
      bloodGroup: hasOwn(updates, "bloodGroup") ? (updates.bloodGroup || null) : existingTenant.bloodGroup,
      nearestRelative: nearestRelativeData,
      professionType: updatedProfessionType,
      professionDetail: professionDetailData,
      professionDescription: hasOwn(updates, "professionDescription") ? (updates.professionDescription || null) : existingTenant.professionDescription,
      documents,
      profilePhoto: profilePhoto ?? existingTenant.profilePhoto,
      notes: hasOwn(updates, "notes") ? (updates.notes || null) : existingTenant.notes,
      status: hasOwn(updates, "status") ? updates.status : existingTenant.status,
      rating: hasOwn(updates, "rating") ? (updates.rating ? parseInt(updates.rating) : existingTenant.rating) : existingTenant.rating,
      leaseStartDate: updateLeaseStartDate,
      leaseEndDate: updateLeaseEndDate,
      monthlyRent: updateMonthlyRent,
      securityDeposit: updateSecurityDeposit,
      lateFeesFine: hasOwn(updates, "lateFeesFine") ? (updates.lateFeesFine || null) : existingTenant.lateFeesFine,
      lateFeesPercentage: updateLateFeesPercentage,
      rentalDocument: mergedRentalDocument,
      securityDepositFile: mergedSecurityDepositFile,
      advancedRentReceivedFile: mergedAdvancedRentReceivedFile,
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
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { cnicNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: tenantCardInclude,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip,
      }),
      prisma.tenant.count({ where }),
    ]);

    const formattedTenants = tenants.map(formatTenantForResponse);

    return successResponse(
      res,
      {
        tenants: formattedTenants,
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
      include: tenantProfileInclude
    });

    if (!tenant) {
      return errorResponse(res, "Tenant not found", 404);
    }

    const formattedTenant = formatTenantForResponse(tenant);
    
    // Add additional profile data
    const response = {
      ...formattedTenant,
      user: tenant.user || null,
      recentPayments: tenant.payments || [],
      recentAlerts: tenant.alerts || []
    };

    return successResponse(res, response, "Tenant retrieved successfully");
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
          collector: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          }
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
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      include: tenantCardInclude
    });

    const formattedTenants = tenants.map(formatTenantForResponse);

    return successResponse(res, formattedTenants, "Active tenants retrieved successfully");
  } catch (err) {
    console.error("Get Active Tenants Error:", err);
    return errorResponse(res, err.message);
  }
};

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
          leaseStartDate: true,
          leaseEndDate: true,
          monthlyRent: true,
          securityDeposit: true,
          documents: true,
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

    const tenantIdsWithAllocations = rows
      .filter((t) => t.allocations[0] && t.userId)
      .map((t) => ({ tenantId: t.id, userId: t.userId, allocation: t.allocations[0] }));

    const bedInfoMap = {};
    if (tenantIdsWithAllocations.length > 0) {
      const userIds = tenantIdsWithAllocations.map((t) => t.userId);
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

      beds.forEach((bed) => {
        const tenant = tenantIdsWithAllocations.find((t) => t.userId === bed.currentUserId);
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
      const documentList = parseDocumentsList(t.documents);

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
        documents: documentList,
        uploads: buildUploads(t.profilePhoto, t.documents),
        lease: {
          startDate: t.leaseStartDate ? t.leaseStartDate.toISOString().split('T')[0] : null,
          endDate: t.leaseEndDate ? t.leaseEndDate.toISOString().split('T')[0] : null,
          monthlyRent: t.monthlyRent ?? null,
          deposit: typeof t.securityDeposit === 'number' ? t.securityDeposit : null,
        },
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

    const allocation = tenant.allocations[0];
    let leaseStart = tenant.leaseStartDate || (allocation ? allocation.createdAt : null);
    let leaseEnd = tenant.leaseEndDate || null;
    if (!leaseEnd && tenant.userId) {
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
        const endDate = new Date(leaseStart);
        endDate.setMonth(endDate.getMonth() + 6);
        leaseEnd = endDate;
      }
    }

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
      console.log('ScoreCard query failed:', e.message);
    }

    const tenantDocuments = parseDocumentsList(tenant.documents);

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
      documents: tenantDocuments,
      uploads: buildUploads(tenant.profilePhoto, tenant.documents),
      lease: {
        startDate: leaseStart ? leaseStart.toISOString().split('T')[0] : null,
        endDate: leaseEnd ? leaseEnd.toISOString().split('T')[0] : null,
        monthlyRent: tenant.monthlyRent ?? null,
        deposit: tenant.securityDeposit ?? null,
      },
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

const getTenantScoreHistory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const limitNum = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const rows = await prisma.scoreCard.findMany({
      where: {
        entityType: 'tenant',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
    });
    return successResponse(res, rows);
  } catch (e) {
    console.error('Get tenant score history error:', e);
    return errorResponse(res, e.message);
  }
};

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
    return successResponse(
      res,
      {
        ...row,
        behavior: clamp0to5(behavior),
        punctuality: clamp0to5(punctuality),
        cleanliness: clamp0to5(cleanliness),
        overall,
      },
      'Tenant score saved',
    );
  } catch (e) {
    console.error('Upsert tenant score error:', e);
    return errorResponse(res, e.message);
  }
};

// ===================================
// GET TENANTS BY HOSTEL ID
// ===================================
const getTenantsByHostelId = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const convertHostelId = parseInt(hostelId, 10);

    if (Number.isNaN(convertHostelId)) {
      return errorResponse(res, "Invalid hostel id", 400);
    }

    // Verify hostel exists
    const hostel = await prisma.hostel.findUnique({
      where: { id: convertHostelId },
      select: { id: true, name: true },
    });

    if (!hostel) {
      return errorResponse(res, "Hostel not found", 404);
    }

    // Build access filter based on user role
    const accessFilter = buildTenantAccessFilter(req);

    // Build where clause to find tenants with allocations in this hostel
    const where = {
      ...accessFilter,
      allocations: {
        some: {
          hostelId: convertHostelId,
        },
      },
    };

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        allocations: {
          where: {
            hostelId: convertHostelId,
          },
          include: allocationLocationInclude,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            payments: true,
            allocations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format tenants for response
    const formattedTenants = tenants.map((tenant) => formatTenantForResponse(tenant));

    return successResponse(
      res,
      {
        hostel: {
          id: hostel.id,
          name: hostel.name,
        },
        tenants: formattedTenants,
        count: formattedTenants.length,
      },
      "Tenants retrieved successfully",
      200
    );
  } catch (err) {
    console.error("Get Tenants By Hostel Error:", err);
    return errorResponse(res, err.message || "Error retrieving tenants", 500);
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
  getActiveTenants,
  listTenants,
  tenantDetails,
  getTenantCurrentScore,
  getTenantScoreHistory,
  upsertTenantScore,
  getTenantsByHostelId,
};
