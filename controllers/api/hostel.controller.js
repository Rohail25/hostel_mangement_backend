const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');

const HOSTEL_CATEGORY_CONFIG = {
  home2: {
    label: 'Home2',
    description: 'Separate hostel spaces for girls and boys',
    segments: [
      { key: 'girls', label: 'Girls Wing', audience: 'female_only' },
      { key: 'boys', label: 'Boys Wing', audience: 'male_only' },
    ],
  },
  back_pack: {
    label: 'Back Pack',
    description: 'Flexible backpacker stays ideal for boys, girls, and families',
    segments: [
      { key: 'boys', label: 'Boys Dorm', audience: 'male' },
      { key: 'girls', label: 'Girls Dorm', audience: 'female' },
      { key: 'family', label: 'Family Room', audience: 'family' },
    ],
  },
  luxury_stage: {
    label: 'Luxury Stage',
    description: 'Premium experience for families and combined stays',
    segments: [
      { key: 'family', label: 'Family Suite', audience: 'family' },
      { key: 'combined', label: 'Combined Stay', audience: 'mixed' },
    ],
  },
};

const CATEGORY_ALIASES = {
  home2: 'home2',
  home_2: 'home2',
  'home-2': 'home2',
  'home 2': 'home2',
  'separate_hostel_girls_and_boys': 'home2',
  'separate hostel girls and boys': 'home2',
  backpack: 'back_pack',
  'back_pack': 'back_pack',
  'back pack': 'back_pack',
  'boy_and_girls_family': 'back_pack',
  'boy and girls, family': 'back_pack',
  'boys_and_girls_family': 'back_pack',
  'luxury_stage': 'luxury_stage',
  'luxury stage': 'luxury_stage',
  luxurystage: 'luxury_stage',
  'luxury_stage_family': 'luxury_stage',
  'family_combine': 'luxury_stage',
  combine: 'luxury_stage',
  'lurury_stage': 'luxury_stage',
};

const sanitizeCategoryInput = (value) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');

/**
 * Valid type values - must match HostelType enum in schema.prisma
 * Enum: HostelType { boy, girl, family, mixed }
 */
const VALID_TYPES = ['boy', 'girl', 'family', 'mixed'];

/**
 * Valid category values - must match HostelCategory enum in schema.prisma
 * Enum: HostelCategory { luxury, back_pack, home2 }
 */
const VALID_CATEGORIES = ['luxury', 'back_pack', 'home2'];
// Category mapping: user input -> schema key
const CATEGORY_MAPPING = {
  'luxury': 'luxury_stage',
  'luxury_stage': 'luxury_stage',
  'back_pack': 'back_pack',
  'backpack': 'back_pack',
  'home2': 'home2',
  'home_2': 'home2',
};

// Validate and normalize type array
const validateAndNormalizeType = (typeInput) => {
  if (!typeInput) return null;
  
  // Handle both array and single value
  const types = Array.isArray(typeInput) ? typeInput : [typeInput];
  
  // Normalize and validate each type
  const normalizedTypes = types
    .map(t => {
      if (!t) return null;
      const normalized = t.toString().trim().toLowerCase();
      return normalized;
    })
    .filter(t => t && VALID_TYPES.includes(t));
  
  // Remove duplicates
  const uniqueTypes = [...new Set(normalizedTypes)];
  
  return uniqueTypes.length > 0 ? uniqueTypes : null;
};

// Validate and normalize category array
const validateAndNormalizeCategory = (categoryInput) => {
  if (!categoryInput) return null;
  
  // Handle both array and single value
  const categories = Array.isArray(categoryInput) ? categoryInput : [categoryInput];
  
  // Normalize and validate each category
  const normalizedCategories = categories
    .map(c => {
      if (!c) return null;
      const sanitized = sanitizeCategoryInput(c);
      
      // Check aliases first
      if (CATEGORY_ALIASES[sanitized]) {
        const mappedKey = CATEGORY_ALIASES[sanitized];
        // Map to user-facing category name
        if (mappedKey === 'luxury_stage') return 'luxury';
        if (mappedKey === 'back_pack') return 'back_pack';
        if (mappedKey === 'home2') return 'home2';
        return null;
      }
      
      // Check direct match in config
      if (HOSTEL_CATEGORY_CONFIG[sanitized]) {
        // Map to user-facing category name
        if (sanitized === 'luxury_stage') return 'luxury';
        if (sanitized === 'back_pack') return 'back_pack';
        if (sanitized === 'home2') return 'home2';
        return null;
      }
      
      // Check direct match in valid categories
      if (VALID_CATEGORIES.includes(sanitized)) {
        return sanitized;
      }
      
      return null;
    })
    .filter(c => c && VALID_CATEGORIES.includes(c));
  
  // Remove duplicates
  const uniqueCategories = [...new Set(normalizedCategories)];
  
  return uniqueCategories.length > 0 ? uniqueCategories : null;
};

const resolveCategoryKey = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const sanitized = sanitizeCategoryInput(value);
  if (CATEGORY_ALIASES[sanitized]) {
    return CATEGORY_ALIASES[sanitized];
  }
  if (HOSTEL_CATEGORY_CONFIG[sanitized]) {
    return sanitized;
  }
  return null;
};

const buildCategoryMeta = (categories, currentMeta) => {
  // Handle both array and single value for backward compatibility
  const categoryArray = Array.isArray(categories) ? categories : (categories ? [categories] : []);
  
  if (categoryArray.length === 0) return currentMeta || null;
  
  // Map user-facing category names to config keys
  const categoryKeyMap = {
    'luxury': 'luxury_stage',
    'back_pack': 'back_pack',
    'home2': 'home2',
  };
  
  // Build meta for multiple categories
  const metaSegments = [];
  const metaLabels = [];
  const metaDescriptions = [];
  
  categoryArray.forEach(userCategory => {
    const configKey = categoryKeyMap[userCategory];
    const config = configKey ? HOSTEL_CATEGORY_CONFIG[configKey] : null;
    if (config) {
      metaLabels.push(config.label);
      metaDescriptions.push(config.description);
      if (Array.isArray(config.segments)) {
        metaSegments.push(...config.segments);
      }
    }
  });
  
  // Remove duplicate segments
  const uniqueSegments = metaSegments.filter((segment, index, self) =>
    index === self.findIndex(s => s.key === segment.key)
  );
  
  return {
    keys: categoryArray,
    labels: metaLabels,
    descriptions: metaDescriptions,
    segments: uniqueSegments,
  };
};

const composeCategoryPayload = (categoryKey, categoryMeta) => {
  const resolvedKey = resolveCategoryKey(categoryKey);
  const defaultMeta = resolvedKey ? buildCategoryMeta(resolvedKey) : null;
  const meta = categoryMeta
    ? {
        key: categoryMeta.key || resolvedKey || null,
        label: categoryMeta.label || defaultMeta?.label || null,
        description: categoryMeta.description || defaultMeta?.description || null,
        segments:
          Array.isArray(categoryMeta.segments) && categoryMeta.segments.length > 0
            ? categoryMeta.segments
            : defaultMeta?.segments || [],
      }
    : defaultMeta;

  return {
    key: resolvedKey,
    label: meta?.label || null,
    description: meta?.description || null,
    segments: meta?.segments || [],
    meta,
  };
};

const buildHostelAccessFilter = (req) => {
  if (req.userRole === 'owner') {
    return { ownerId: req.userId };
  }
  if (req.userRole === 'manager') {
    return { managedBy: req.userId };
  }
  return {};
};

const ensureHostelAccess = async (req, hostelId) => {
  const where = { id: hostelId, ...buildHostelAccessFilter(req) };
  return prisma.hostel.findFirst({
    where,
    select: { id: true },
  });
};

const parseJsonField = (field) => {
  if (!field) return null;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return null;
    }
  }
  return field;
};

const buildOwnerDirectory = async (ownerIds = []) => {
  const uniqueIds = [...new Set(ownerIds.filter((id) => Number.isFinite(id)))];
  if (!uniqueIds.length) {
    return new Map();
  }

  const [users, ownerProfiles] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { 
        id: true, 
        username: true, 
        email: true, 
        phone: true, 
        userRole: {
          select: {
            id: true,
            roleName: true,
            description: true
          }
        }
      },
    }),
    prisma.owner.findMany({
      where: { userId: { in: uniqueIds } },
      select: { id: true, userId: true, name: true, ownerCode: true },
    }),
  ]);

  const profileMap = new Map(ownerProfiles.map((profile) => [profile.userId, profile]));
  const directory = new Map();

  users.forEach((user) => {
    const profile = profileMap.get(user.id);
    directory.set(user.id, {
      userId: user.id,
      ownerProfileId: profile?.id || null,
      ownerCode: profile?.ownerCode || null,
      name: profile?.name || user.username || user.email || 'Unknown',
      email: user.email,
      phone: user.phone || null,
      role: user.userRole?.roleName || null,
    });
  });

  return directory;
};

const pickOwnerFromDirectory = (directory, ownerId) => {
  if (!ownerId || !directory) return null;
  const owner = directory.get(ownerId);
  if (!owner) return null;
  return {
    id: owner.ownerProfileId,
    userId: owner.userId,
    ownerCode: owner.ownerCode,
    name: owner.name,
    email: owner.email,
    phone: owner.phone,
    role: owner.role,
  };
};

const formatManager = (manager) => {
  if (!manager) return null;
  return {
    id: manager.id,
    name: manager.username || manager.email || 'N/A',
    username: manager.username,
    email: manager.email,
    phone: manager.phone,
  };
};

const formatHostelListItem = (hostel, ownerDirectory) => {
  const address = parseJsonField(hostel.address) || {};
  const contactInfo = parseJsonField(hostel.contactInfo) || {};
  const categoryPayload = composeCategoryPayload(hostel.category, parseJsonField(hostel.categoryMeta));
  const totalFloors = hostel.floors?.length || hostel.totalFloors || 0;
  const totalRooms = hostel.rooms?.length || hostel.totalRooms || 0;
  const roomsPerFloor = totalFloors > 0 ? Math.round(totalRooms / totalFloors) : 0;
  const owner = pickOwnerFromDirectory(ownerDirectory, hostel.ownerId);

  return {
    id: hostel.id,
    name: hostel.name,
    city: address?.city || null,
    floors: totalFloors,
    roomsPerFloor,
    manager: hostel.manager?.username || hostel.manager?.email || null,
    managerId: hostel.manager?.id || null,
    owner,
    ownerId: owner?.userId || null,
    ownerName: owner?.name || null,
    phone: contactInfo?.phone || hostel.manager?.phone || owner?.phone || null,
    status: hostel.status,
    category: categoryPayload.key,
    categoryLabel: categoryPayload.label,
    categoryDescription: categoryPayload.description,
    categorySegments: categoryPayload.segments,
  };
};

const formatHostelDetail = (hostel, ownerDirectory) => {
  const address = parseJsonField(hostel.address) || {};
  const contactInfo = parseJsonField(hostel.contactInfo) || {};
  const operatingHours = parseJsonField(hostel.operatingHours) || {};
  const categoryPayload = composeCategoryPayload(hostel.category, parseJsonField(hostel.categoryMeta));
  const owner = pickOwnerFromDirectory(ownerDirectory, hostel.ownerId);
  const totalFloors = hostel.totalFloors || hostel.floors?.length || 0;
  const totalRooms = hostel.totalRooms || hostel.rooms?.length || 0;
  const roomsPerFloor = totalFloors > 0 ? Math.round(totalRooms / totalFloors) : 0;
  const totalBeds = hostel.totalBeds || 0;
  const occupiedBeds = hostel.occupiedBeds || 0;
  const availableBeds = Math.max(totalBeds - occupiedBeds, 0);

  return {
    id: hostel.id,
    name: hostel.name,
    description: hostel.description,
    status: hostel.status,
    address,
    city: address?.city || null,
    contactInfo,
    operatingHours,
    amenities: hostel.amenities,
    images: hostel.images,
    manager: formatManager(hostel.manager),
    owner,
    category: categoryPayload.key,
    categoryLabel: categoryPayload.label,
    categoryDescription: categoryPayload.description,
    categorySegments: categoryPayload.segments,
    categoryMeta: categoryPayload.meta,
    statistics: {
      totalFloors,
      totalRooms,
      roomsPerFloor,
      totalBeds,
      occupiedBeds,
      availableBeds,
    },
  };
};

const formatArchitecture = (floors = []) => {
  let totalRooms = 0;
  let totalBeds = 0;
  let occupiedBeds = 0;
  const roomStatusCounts = {
    vacant: 0,
    occupied: 0,
    underMaintenance: 0,
    other: 0,
  };

  const formattedFloors = floors.map((floor, index) => {
    const floorRooms = floor.rooms || [];
    totalRooms += floorRooms.length;

    const formattedRooms = floorRooms.map((room) => {
      const roomBeds = room.beds || [];
      const formattedBeds = roomBeds.map((bed) => {
        const isOccupied = bed.status === 'occupied' || bed.currentTenantId !== null;
        return {
          id: bed.id,
          number: bed.bedNumber,
          label: bed.bedNumber,
          status: bed.status,
          isOccupied,
        };
      });

      const roomTotalBeds = roomBeds.length > 0 ? roomBeds.length : room.totalBeds || formattedBeds.length || 0;
      const roomOccupiedBeds =
        roomBeds.length > 0
          ? roomBeds.filter((bed) => bed.status === 'occupied' || bed.currentTenantId !== null).length
          : room.occupiedBeds || 0;

      totalBeds += roomTotalBeds;
      occupiedBeds += roomOccupiedBeds;

      switch (room.status) {
        case 'vacant':
          roomStatusCounts.vacant += 1;
          break;
        case 'occupied':
          roomStatusCounts.occupied += 1;
          break;
        case 'under_maintenance':
          roomStatusCounts.underMaintenance += 1;
          break;
        default:
          roomStatusCounts.other += 1;
      }

      return {
        id: room.id,
        number: room.roomNumber,
        status: room.status,
        totalBeds: roomTotalBeds,
        occupiedBeds: roomOccupiedBeds,
        availableBeds: Math.max(roomTotalBeds - roomOccupiedBeds, 0),
        beds: formattedBeds,
      };
    });

    return {
      id: floor.id,
      floorNumber: floor.floorNumber,
      name: floor.floorName || `Block ${floor.floorNumber ?? index + 1}`,
      label: floor.floorName || `Block ${floor.floorNumber ?? index + 1}`,
      status: floor.status,
      roomCount: formattedRooms.length,
      rooms: formattedRooms,
    };
  });

  const availableBeds = Math.max(totalBeds - occupiedBeds, 0);

  return {
    floors: formattedFloors,
    totals: {
      totalRooms,
      totalBeds,
      occupiedBeds,
      availableBeds,
    },
    roomStatusCounts,
  };
};

const buildSummaryCards = (hostel, architecture) => {
  const blocks = architecture.floors.length || hostel.totalFloors || 0;
  const rooms = architecture.totals.totalRooms || hostel.totalRooms || 0;
  const totalSeats = architecture.totals.totalBeds || hostel.totalBeds || 0;
  const occupiedSeats = architecture.totals.occupiedBeds || hostel.occupiedBeds || 0;
  const availableSeats =
    architecture.totals.availableBeds !== undefined
      ? architecture.totals.availableBeds
      : Math.max(totalSeats - occupiedSeats, 0);

  return {
    blocks,
    rooms,
    availableSeats,
    occupiedSeats,
    totalSeats,
  };
};

const getHostelArchitecture = async (req, res) => {
  try {
    const hostelId = Number(req.params.id);
    if (!Number.isFinite(hostelId)) {
      return errorResponse(res, 'Invalid hostel id', 400);
    }

    const hostel = await prisma.hostel.findFirst({
      where: { id: hostelId, ...buildHostelAccessFilter(req) },
      select: {
        id: true,
        name: true,
        status: true,
        totalFloors: true,
        totalRooms: true,
        totalBeds: true,
        occupiedBeds: true,
      },
    });

    if (!hostel) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    const floors = await prisma.floor.findMany({
      where: { hostelId, status: 'active' },
      select: {
        id: true,
        floorNumber: true,
        floorName: true,
        status: true,
        rooms: {
          select: {
            id: true,
            roomNumber: true,
            status: true,
            totalBeds: true,
            occupiedBeds: true,
            beds: {
              select: {
                id: true,
                bedNumber: true,
                status: true,
                currentTenantId: true,
              },
              orderBy: { bedNumber: 'asc' },
            },
          },
          orderBy: { roomNumber: 'asc' },
        },
      },
      orderBy: { floorNumber: 'asc' },
    });

    const architecture = formatArchitecture(floors);
    const summaryCards = buildSummaryCards(hostel, architecture);

    return successResponse(
      res,
      {
        hostel: {
          id: hostel.id,
          name: hostel.name,
          status: hostel.status,
        },
        summaryCards,
        totals: architecture.totals,
        roomStatusCounts: architecture.roomStatusCounts,
        floors: architecture.floors,
      },
      'Hostel architecture retrieved successfully',
      200,
    );
  } catch (error) {
    console.error('Get Hostel Architecture Error:', error);
    return errorResponse(res, error.message, 400);
  }
};

const createHostel = async (req, res) => {
  try {
    // Check if user is admin or owner - only these roles can create hostels
    const userRoleName = req.userRole?.roleName?.toLowerCase();
    const isAdmin = req.isAdmin === true;
    const isOwner = userRoleName === 'owner';

    if (!isAdmin && !isOwner) {
      return errorResponse(
        res,
        'Access denied. Only admin and owner roles can create hostels.',
        403
      );
    }

    const {
      name,
      address,
      description,
      mapLink,
      amenities,
      contactInfo,
      operatingHours,
      images, // Can be JSON array or will be built from uploaded files
      ownerId, // This is optional - will be auto-set from auth if owner
      type,
      category,
    } = req.body;

    // Handle uploaded image files
    let imagesArray = [];
    if (req.files && req.files.length > 0) {
      imagesArray = req.files.map(file => ({
        url: `/uploads/hostels/${file.filename}`,
        caption: file.originalname || null
      }));
    } else if (images) {
      // If images provided as JSON string or array
      if (typeof images === 'string') {
        try {
          imagesArray = JSON.parse(images);
        } catch {
          imagesArray = Array.isArray(images) ? images : [];
        }
      } else if (Array.isArray(images)) {
        imagesArray = images;
      }
    }

    if (!name || !address?.city || !address?.country) {
      return errorResponse(res, 'Name, city, and country are required', 400);
    }

    const existing = await prisma.hostel.findFirst({
      where: { name: name.trim() },
    });

    if (existing) {
      return errorResponse(res, 'Hostel already exists', 400);
    }

    // Validate and normalize type
    const normalizedType = validateAndNormalizeType(type);
    if (type && !normalizedType) {
      return errorResponse(
        res,
        'Invalid type supplied. Allowed types: boy, girl, family, mixed',
        400,
      );
    }

    // Validate and normalize category
    const normalizedCategory = validateAndNormalizeCategory(category);
    if (category && !normalizedCategory) {
      return errorResponse(
        res,
        'Invalid category supplied. Allowed categories: luxury, back_pack, home2',
        400,
      );
    }

    let ownerIdToUse = null;
    let managedByUserId = null;

    // If logged-in user is owner, automatically use their ownerId
    if (isOwner) {
      // Find the Owner record by userId
      let ownerProfile = await prisma.owner.findFirst({
        where: { userId: req.userId },
        select: { id: true },
      });

      // If owner profile doesn't exist, create it automatically
      if (!ownerProfile) {
        const user = await prisma.user.findUnique({
          where: { id: req.userId },
          select: { username: true, email: true, phone: true },
        });

        if (user) {
          ownerProfile = await prisma.owner.create({
            data: {
              userId: req.userId,
              name: user.username || 'Owner',
              status: 'active',
            },
            select: { id: true },
          });
        }
      }

      if (ownerProfile) {
        ownerIdToUse = ownerProfile.id;
      } else {
        return errorResponse(res, 'Owner profile not found. Please contact support.', 404);
      }
    }
    // If admin is creating and ownerId is provided in request, use it
    else if (isAdmin && ownerId !== undefined && ownerId !== null && ownerId !== '') {
      const numericOwnerId = Number(ownerId);
      if (!Number.isFinite(numericOwnerId)) {
        return errorResponse(res, 'Invalid owner id', 400);
      }
      
      // Verify the owner exists
      const ownerProfile = await prisma.owner.findUnique({
        where: { id: numericOwnerId },
        select: { id: true },
      });
      
      if (!ownerProfile) {
        return errorResponse(res, 'Owner not found', 404);
      }
      
      ownerIdToUse = ownerProfile.id;
      // Admin creating hostel - set managedBy to admin's userId
      managedByUserId = req.userId;
    }
    // If admin is creating without ownerId, set managedBy to admin's userId
    else if (isAdmin) {
      managedByUserId = req.userId;
    }

    const categoryMeta = buildCategoryMeta(normalizedCategory);

    const hostel = await prisma.hostel.create({
      data: {
        name: name.trim(),
        address: {
          street: address.street || null,
          city: address.city,
          state: address.state || null,
          country: address.country,
          zipCode: address.zipCode || null,
        },
        description: description || null,
        mapLink: mapLink || null,
        type: normalizedType,
        amenities: amenities || [],
        contactInfo: contactInfo
          ? {
              phone: contactInfo.phone || null,
              email: contactInfo.email || null,
              emergencyContact: contactInfo.emergencyContact || null,
            }
          : null,
        operatingHours: operatingHours
          ? {
              checkIn: operatingHours.checkIn || '12:00 PM',
              checkOut: operatingHours.checkOut || '11:00 AM',
            }
          : null,
        images: imagesArray,
        managedBy: managedByUserId,
        ownerId: ownerIdToUse,
        category: normalizedCategory,
        categoryMeta: categoryMeta,
      },
      include: {
        manager: { select: { id: true, username: true, email: true, phone: true } },
      },
    });

    const ownerDirectory = await buildOwnerDirectory(ownerIdToUse ? [ownerIdToUse] : []);
    const formatted = formatHostelDetail(hostel, ownerDirectory);

    return successResponse(res, formatted, 'Hostel created successfully', 201);
  } catch (error) {
    console.error('Create Hostel Error:', error);
    return errorResponse(res, error.message, 400);
  }
};

const getAllHostels = async (req, res) => {
  try {
    const { status, city, search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = {
      ...buildHostelAccessFilter(req),
    };
    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }];
    }

    const [hostels, total] = await Promise.all([
      prisma.hostel.findMany({
        where,
        include: {
          manager: { select: { id: true, username: true, email: true, phone: true } },
          floors: { select: { id: true } },
          rooms: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.hostel.count({ where }),
    ]);

    const ownerIds = hostels.map((hostel) => hostel.ownerId).filter((id) => Number.isFinite(id));
    const ownerDirectory = await buildOwnerDirectory(ownerIds);

    let formattedHostels = hostels.map((hostel) => formatHostelListItem(hostel, ownerDirectory));

    if (city) {
      const cityLower = city.toLowerCase();
      formattedHostels = formattedHostels.filter(
        (item) => item.city && item.city.toLowerCase().includes(cityLower),
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      formattedHostels = formattedHostels.filter(
        (item) =>
          item.name?.toLowerCase().includes(searchLower) ||
          item.city?.toLowerCase().includes(searchLower) ||
          item.manager?.toLowerCase().includes(searchLower) ||
          item.ownerName?.toLowerCase().includes(searchLower),
      );
    }

    return successResponse(
      res,
      {
        items: formattedHostels,
        total: formattedHostels.length,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil((formattedHostels.length || 1) / parseInt(limit, 10)),
        },
      },
      'Hostels retrieved successfully',
      200,
    );
  } catch (error) {
    console.error('Get All Hostels Error:', error);
    return errorResponse(res, error.message, 400);
  }
};

const getHostelById = async (req, res) => {
  try {
    const hostelId = Number(req.params.id);
    if (!Number.isFinite(hostelId)) {
      return errorResponse(res, 'Invalid hostel id', 400);
    }

    const hostel = await prisma.hostel.findFirst({
      where: { id: hostelId, ...buildHostelAccessFilter(req) },
      include: {
        manager: { select: { id: true, username: true, email: true, phone: true } },
      },
    });

    if (!hostel) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    const ownerDirectory = await buildOwnerDirectory(
      hostel.ownerId ? [hostel.ownerId] : [],
    );
    const formatted = formatHostelDetail(hostel, ownerDirectory);

    return successResponse(res, formatted, 'Hostel retrieved successfully', 200);
  } catch (error) {
    console.error('Get Hostel Error:', error);
    return errorResponse(res, error.message, 400);
  }
};

const updateHostel = async (req, res) => {
  try {
    const hostelId = Number(req.params.id);
    if (!Number.isFinite(hostelId)) {
      return errorResponse(res, 'Invalid hostel id', 400);
    }

    if (!await ensureHostelAccess(req, hostelId)) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    const updates = { ...req.body };

    delete updates.totalFloors;
    delete updates.totalRooms;
    delete updates.totalBeds;
    delete updates.occupiedBeds;

    const updateData = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.mapLink !== undefined) updateData.mapLink = updates.mapLink || null;
    if (updates.amenities) updateData.amenities = updates.amenities;
    if (updates.status) updateData.status = updates.status;
    if (updates.address) {
      updateData.address = {
        street: updates.address.street || null,
        city: updates.address.city,
        state: updates.address.state || null,
        country: updates.address.country,
        zipCode: updates.address.zipCode || null,
      };
    }
    if (updates.contactInfo) {
      updateData.contactInfo = {
        phone: updates.contactInfo.phone || null,
        email: updates.contactInfo.email || null,
        emergencyContact: updates.contactInfo.emergencyContact || null,
      };
    }
    if (updates.operatingHours) {
      updateData.operatingHours = {
        checkIn: updates.operatingHours.checkIn || null,
        checkOut: updates.operatingHours.checkOut || null,
      };
    }
    // Handle images update - support both file uploads and JSON array
    if (updates.images !== undefined || (req.files && req.files.length > 0)) {
      let imagesArray = [];
      
      // Get existing images from database if we need to merge
      const existingHostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { images: true }
      });
      const existingImages = existingHostel?.images 
        ? (Array.isArray(existingHostel.images) ? existingHostel.images : [])
        : [];
      
      // Process uploaded files first
      if (req.files && req.files.length > 0) {
        const uploadedImages = req.files.map(file => ({
          url: `/uploads/hostels/${file.filename}`,
          caption: file.originalname || null
        }));
        imagesArray = uploadedImages;
      }
      
      // If images provided in body, handle accordingly
      if (updates.images !== undefined) {
        if (updates.images === null || updates.images === '') {
          // Explicitly set to empty array (clear all images)
          imagesArray = [];
        } else if (typeof updates.images === 'string') {
          try {
            const parsedImages = JSON.parse(updates.images);
            if (Array.isArray(parsedImages)) {
              // If files uploaded, merge uploaded with parsed; otherwise use parsed (replaces existing)
              imagesArray = req.files && req.files.length > 0 
                ? [...imagesArray, ...parsedImages] 
                : parsedImages;
            }
          } catch {
            // Invalid JSON, use uploaded files only
            if (!req.files || req.files.length === 0) {
              // No files and invalid JSON - don't update images
              return errorResponse(res, 'Invalid images format. Expected JSON array or file uploads.', 400);
            }
          }
        } else if (Array.isArray(updates.images)) {
          // If files uploaded, merge uploaded with body array; otherwise use body array (replaces existing)
          imagesArray = req.files && req.files.length > 0 
            ? [...imagesArray, ...updates.images] 
            : updates.images;
        }
      } else if (req.files && req.files.length > 0) {
        // Only files uploaded, no body images - merge with existing images
        imagesArray = [...existingImages, ...imagesArray];
      }
      
      // Only update if we have a valid images array or explicit empty array
      if (updates.images !== undefined || (req.files && req.files.length > 0)) {
        updateData.images = imagesArray;
      }
    }

    // Validate and normalize type
    if (updates.type !== undefined) {
      const normalizedType = validateAndNormalizeType(updates.type);
      if (updates.type && !normalizedType) {
        return errorResponse(
          res,
          'Invalid type supplied. Allowed types: boy, girl, family, mixed',
          400,
        );
      }
      updateData.type = normalizedType;
    }

    // Validate and normalize category
    if (updates.category !== undefined) {
      const normalizedCategory = validateAndNormalizeCategory(updates.category);
      if (updates.category && !normalizedCategory) {
        return errorResponse(
          res,
          'Invalid category supplied. Allowed categories: luxury, back_pack, home2',
          400,
        );
      }
      updateData.category = normalizedCategory;
      updateData.categoryMeta = buildCategoryMeta(normalizedCategory, parseJsonField(updates.categoryMeta));
    }

    if (req.userRole !== 'owner' && updates.ownerId !== undefined) {
      if (updates.ownerId === null || updates.ownerId === '') {
        updateData.ownerId = null;
      } else {
        const numericOwnerId = Number(updates.ownerId);
        if (!Number.isFinite(numericOwnerId)) {
          return errorResponse(res, 'Invalid owner id', 400);
        }
        const ownerUser = await prisma.user.findUnique({
          where: { id: numericOwnerId },
          select: { 
            id: true, 
            userRole: {
              select: {
                id: true,
                roleName: true
              }
            }
          },
        });
        if (!ownerUser) {
          return errorResponse(res, 'Owner not found', 404);
        }
        if (ownerUser.userRole?.roleName !== 'owner') {
          return errorResponse(res, 'Provided user is not registered as an owner', 400);
        }
        updateData.ownerId = ownerUser.id;
      }
    }

    const hostel = await prisma.hostel.update({
      where: { id: hostelId },
      data: updateData,
      include: {
        manager: { select: { id: true, username: true, email: true, phone: true } },
      },
    });

    const ownerDirectory = await buildOwnerDirectory(
      hostel.ownerId ? [hostel.ownerId] : [],
    );
    const formatted = formatHostelDetail(hostel, ownerDirectory);

    return successResponse(res, formatted, 'Hostel updated successfully', 200);
  } catch (error) {
    if (error.code === 'P2025') {
      return errorResponse(res, 'Hostel not found', 404);
    }
    console.error('Update Hostel Error:', error);
    return errorResponse(res, error.message, 400);
  }
};

const deleteHostel = async (req, res) => {
  try {
    const hostelId = Number(req.params.id);
    if (!Number.isFinite(hostelId)) {
      return errorResponse(res, 'Invalid hostel id', 400);
    }

    if (!await ensureHostelAccess(req, hostelId)) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    const floorCount = await prisma.floor.count({ where: { hostelId } });
    if (floorCount > 0) {
      return errorResponse(
        res,
        'Cannot delete hostel with existing floors. Please delete all floors first.',
        400,
      );
    }

    await prisma.hostel.delete({
      where: { id: hostelId },
    });

    return successResponse(res, { id: hostelId }, 'Hostel deleted successfully', 200);
  } catch (error) {
    if (error.code === 'P2025') {
      return errorResponse(res, 'Hostel not found', 404);
    }
    console.error('Delete Hostel Error:', error);
    return errorResponse(res, error.message, 400);
  }
};

const getHostelStats = async (req, res) => {
  try {
    const hostelId = Number(req.params.id);
    if (!Number.isFinite(hostelId)) {
      return errorResponse(res, 'Invalid hostel id', 400);
    }

    const hostel = await prisma.hostel.findFirst({
      where: { id: hostelId, ...buildHostelAccessFilter(req) },
      include: {
        manager: { select: { id: true, name: true, email: true, phone: true } },
        floors: {
          select: {
            id: true,
            floorNumber: true,
            floorName: true,
            status: true,
            rooms: {
              select: {
                id: true,
                roomNumber: true,
                status: true,
                totalBeds: true,
                occupiedBeds: true,
                beds: {
                  select: {
                    id: true,
                    bedNumber: true,
                    status: true,
                    currentTenantId: true,
                  },
                  orderBy: { bedNumber: 'asc' },
                },
              },
              orderBy: { roomNumber: 'asc' },
            },
          },
          orderBy: { floorNumber: 'asc' },
        },
      },
    });

    if (!hostel) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    const ownerDirectory = await buildOwnerDirectory(
      hostel.ownerId ? [hostel.ownerId] : [],
    );
    const owner = pickOwnerFromDirectory(ownerDirectory, hostel.ownerId);
    const categoryPayload = composeCategoryPayload(hostel.category, parseJsonField(hostel.categoryMeta));
    const architecture = formatArchitecture(hostel.floors || []);
    const summaryCards = buildSummaryCards(hostel, architecture);

    const totalBeds = hostel.totalBeds || architecture.totals.totalBeds;
    const occupiedBeds = hostel.occupiedBeds || architecture.totals.occupiedBeds;
    const availableBeds = Math.max(totalBeds - occupiedBeds, 0);

    const bedStatistics = {
      totalBeds,
      occupiedBeds,
      availableBeds,
      occupancyRate:
        totalBeds > 0 ? Number(((occupiedBeds / totalBeds) * 100).toFixed(2)) : 0,
    };

    const roomStatistics = {
      total: architecture.totals.totalRooms,
      vacant: architecture.roomStatusCounts.vacant,
      occupied: architecture.roomStatusCounts.occupied,
      underMaintenance: architecture.roomStatusCounts.underMaintenance,
      other: architecture.roomStatusCounts.other,
    };

    const hostelInfo = {
      id: hostel.id,
      name: hostel.name,
      status: hostel.status,
      totalFloors: architecture.floors.length || hostel.totalFloors || 0,
      totalRooms: architecture.totals.totalRooms || hostel.totalRooms || 0,
      owner,
      manager: formatManager(hostel.manager),
      category: categoryPayload.key,
      categoryLabel: categoryPayload.label,
      categoryDescription: categoryPayload.description,
      categorySegments: categoryPayload.segments,
    };

    const payload = {
      hostelInfo,
      summaryCards,
      bedStatistics,
      roomStatistics,
      architecture: architecture.floors,
      totals: architecture.totals,
      category: categoryPayload,
      owner,
      manager: formatManager(hostel.manager),
    };

    return successResponse(res, payload, 'Hostel statistics retrieved successfully', 200);
  } catch (error) {
    console.error('Get Hostel Stats Error:', error);
    return errorResponse(res, error.message, 400);
  }
};

// ===================================
// GET HOSTEL CATEGORIES
// ===================================
const getHostelCategories = async (req, res) => {
  try {
    // Return the available hostel categories with their configurations
    const categories = Object.keys(HOSTEL_CATEGORY_CONFIG).map(key => {
      const config = HOSTEL_CATEGORY_CONFIG[key];
      return {
        key: key === 'luxury_stage' ? 'luxury' : key,
        label: config.label,
        description: config.description,
        segments: config.segments
      };
    });

    return successResponse(res, categories, 'Hostel categories retrieved successfully');
  } catch (err) {
    console.error('Get Hostel Categories Error:', err);
    return errorResponse(res, err.message || 'Failed to retrieve hostel categories', 500);
  }
};

module.exports = {
  createHostel,
  getAllHostels,
  getHostelById,
  updateHostel,
  deleteHostel,
  getHostelStats,
  getHostelArchitecture,
  getHostelCategories,
};