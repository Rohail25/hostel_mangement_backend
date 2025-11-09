const { prisma } = require('../../../config/db');
const { successResponse, errorResponse } = require('../../../Helper/helper');

/**
 * =====================================================
 * HOSTEL CONTROLLER - Hostel Management Dashboard
 * =====================================================
 *
 * Provides hostel listing, details, and architecture
 * for the Hostel Management dashboard
 */

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

// Helper function to parse JSON fields
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

/**
 * GET /api/admin/hostels
 * Get all hostels (for table view)
 * ?status= &city= &search= &page= &limit=
 */
const getAllHostels = async (req, res) => {
  try {
    const { status, city, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const where = { ...buildHostelAccessFilter(req) };
    if (status) where.status = status;

    // Search filter - search by name, city, or manager
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    // City filter - handled separately as JSON field
    if (city && !search) {
      // For city, we'll filter after fetching or use a different approach
      // Since Prisma JSON field search is limited, we'll handle it in post-processing
    }

    const [hostels, total] = await Promise.all([
      prisma.hostel.findMany({
        where,
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          floors: {
            select: {
              id: true,
            },
          },
          rooms: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.hostel.count({ where }),
    ]);

    // Format hostels for dashboard table
    let formattedHostels = hostels.map(hostel => {
      const address = parseJsonField(hostel.address) || {};
      const contactInfo = parseJsonField(hostel.contactInfo) || {};

      const totalFloors = hostel.floors?.length || hostel.totalFloors || 0;
      const totalRooms = hostel.rooms?.length || hostel.totalRooms || 0;
      const roomsPerFloor = totalFloors > 0 ? Math.round(totalRooms / totalFloors) : 0;

      // Get phone from contactInfo or manager
      const phone = contactInfo?.phone || hostel.manager?.phone || null;

      return {
        id: hostel.id,
        name: hostel.name,
        city: address?.city || null,
        floors: totalFloors,
        roomsPerFloor: roomsPerFloor,
        manager: hostel.manager?.name || null,
        managerId: hostel.manager?.id || null,
        phone: phone,
        status: hostel.status,
      };
    });

    // Filter by city if provided (post-processing for JSON field)
    if (city) {
      const cityLower = city.toLowerCase();
      formattedHostels = formattedHostels.filter(h => 
        h.city && h.city.toLowerCase().includes(cityLower)
      );
    }

    // Filter by search (name, city, or manager) if provided
    if (search) {
      const searchLower = search.toLowerCase();
      formattedHostels = formattedHostels.filter(h =>
        h.name?.toLowerCase().includes(searchLower) ||
        h.city?.toLowerCase().includes(searchLower) ||
        h.manager?.toLowerCase().includes(searchLower)
      );
    }

    // Update total to reflect filtered results
    const filteredTotal = formattedHostels.length;

    return successResponse(res, {
      items: formattedHostels,
      total: filteredTotal,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(filteredTotal / parseInt(limit)),
      },
    }, 'Hostels retrieved successfully');
  } catch (error) {
    console.error('Get all hostels error:', error);
    return errorResponse(res, error.message);
  }
};

/**
 * GET /api/admin/hostel/:id
 * Get hostel details (for Details tab)
 */
const getHostelById = async (req, res) => {
  try {
    const { id } = req.params;
    const hostelId = parseInt(id, 10);

    const hostel = await prisma.hostel.findFirst({
      where: { id: hostelId, ...buildHostelAccessFilter(req) },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        floors: {
          select: {
            id: true,
          },
        },
        rooms: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!hostel) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    // Parse JSON fields
    const address = parseJsonField(hostel.address) || {};
    const contactInfo = parseJsonField(hostel.contactInfo) || {};

    // Calculate statistics
    const totalFloors = hostel.floors?.length || hostel.totalFloors || 0;
    const totalRooms = hostel.rooms?.length || hostel.totalRooms || 0;
    const totalBeds = hostel.totalBeds || 0;
    const occupiedBeds = hostel.occupiedBeds || 0;
    const availableBeds = totalBeds - occupiedBeds;
    const roomsPerFloor = totalFloors > 0 ? Math.round(totalRooms / totalFloors) : 0;

    // Get phone from contactInfo or manager
    const phone = contactInfo?.phone || hostel.manager?.phone || null;

    return successResponse(res, {
      id: hostel.id,
      name: hostel.name,
      description: hostel.description,
      address: address,
      city: address?.city || null,
      manager: hostel.manager ? {
        id: hostel.manager.id,
        name: hostel.manager.name,
        email: hostel.manager.email,
        phone: hostel.manager.phone,
      } : null,
      managerName: hostel.manager?.name || null,
      managerPhone: phone,
      totalFloors: totalFloors,
      roomsPerFloor: roomsPerFloor,
      phone: phone,
      status: hostel.status,
      statistics: {
        totalRooms: totalRooms,
        availableSeats: availableBeds,
        occupiedSeats: occupiedBeds,
        totalSeats: totalBeds,
      },
      amenities: hostel.amenities,
      contactInfo: contactInfo,
      operatingHours: hostel.operatingHours,
      images: hostel.images,
    }, 'Hostel retrieved successfully');
  } catch (error) {
    console.error('Get hostel error:', error);
    return errorResponse(res, error.message);
  }
};

/**
 * GET /api/admin/hostel/:id/architecture
 * Get hostel architecture (floors, rooms, beds) for Architecture tab
 */
const getHostelArchitecture = async (req, res) => {
  try {
    const { id } = req.params;
    const hostelId = parseInt(id, 10);

    const hostel = await prisma.hostel.findFirst({
      where: { id: hostelId, ...buildHostelAccessFilter(req) },
      select: {
        id: true,
        name: true,
      },
    });

    if (!hostel) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    // Get all floors with rooms and beds
    const floors = await prisma.floor.findMany({
      where: {
        hostelId: hostelId,
        status: 'active',
      },
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
            beds: {
              select: {
                id: true,
                bedNumber: true,
                status: true,
                currentUserId: true,
              },
              orderBy: { bedNumber: 'asc' },
            },
          },
          orderBy: { roomNumber: 'asc' },
        },
      },
      orderBy: { floorNumber: 'asc' },
    });

    // Calculate overall statistics
    let totalRooms = 0;
    let totalBeds = 0;
    let occupiedBeds = 0;

    const formattedFloors = floors.map(floor => {
      const floorRooms = floor.rooms || [];
      totalRooms += floorRooms.length;

      const formattedRooms = floorRooms.map(room => {
        const roomBeds = room.beds || [];
        const roomTotalBeds = roomBeds.length;
        const roomOccupiedBeds = roomBeds.filter(bed =>
          bed.status === 'occupied' || bed.currentUserId !== null
        ).length;

        totalBeds += roomTotalBeds;
        occupiedBeds += roomOccupiedBeds;

        // Format beds for display (A, B, C, D, etc.)
        const formattedBeds = roomBeds.map(bed => ({
          id: bed.id,
          number: bed.bedNumber,
          label: bed.bedNumber, // A, B, C, D, etc.
          status: bed.status,
          isOccupied: bed.status === 'occupied' || bed.currentUserId !== null,
        }));

        return {
          id: room.id,
          number: room.roomNumber,
          status: room.status,
          totalBeds: roomTotalBeds,
          occupiedBeds: roomOccupiedBeds,
          availableBeds: roomTotalBeds - roomOccupiedBeds,
          beds: formattedBeds,
        };
      });

      return {
        id: floor.id,
        name: floor.floorName || `Floor ${floor.floorNumber}`,
        status: floor.status,
        roomCount: formattedRooms.length,
        rooms: formattedRooms,
      };
    });

    const statistics = {
      totalRooms: totalRooms,
      availableSeats: totalBeds - occupiedBeds,
      occupiedSeats: occupiedBeds,
      totalSeats: totalBeds,
    };

    return successResponse(res, {
      hostel: {
        id: hostel.id,
        name: hostel.name,
      },
      statistics: statistics,
      floors: formattedFloors,
    }, 'Hostel architecture retrieved successfully');
  } catch (error) {
    console.error('Get hostel architecture error:', error);
    return errorResponse(res, error.message);
  }
};

/**
 * POST /api/admin/hostel
 * Create new hostel
 */
const createHostel = async (req, res) => {
  try {
    const {
      name,
      address,
      description,
      amenities,
      contactInfo,
      operatingHours,
      images,
      ownerId,
    } = req.body;

    // Validation
    if (!name || !address?.city || !address?.country) {
      return errorResponse(res, 'Name, city, and country are required', 400);
    }

    const hostelExists = await prisma.hostel.findFirst({
      where: { name },
    });

    if (hostelExists) {
      return errorResponse(res, 'Hostel already exists', 400);
    }

    let ownerIdToUse = null;
    if (req.userRole === 'owner') {
      ownerIdToUse = req.userId;
    } else if (ownerId !== undefined && ownerId !== null) {
      const numericOwnerId = Number(ownerId);
      if (!Number.isFinite(numericOwnerId)) {
        return errorResponse(res, 'Invalid owner id', 400);
      }
      const ownerUser = await prisma.user.findUnique({
        where: { id: numericOwnerId },
        select: { id: true, role: true },
      });
      if (!ownerUser) {
        return errorResponse(res, 'Owner not found', 404);
      }
      if (ownerUser.role !== 'owner') {
        return errorResponse(res, 'Provided user is not an owner', 400);
      }
      ownerIdToUse = ownerUser.id;
    }

    // Create hostel
    const hostel = await prisma.hostel.create({
      data: {
        name,
        address: {
          street: address.street || null,
          city: address.city,
          state: address.state || null,
          country: address.country,
          zipCode: address.zipCode || null,
        },
        description: description || null,
        amenities: amenities || [],
        contactInfo: contactInfo ? {
          phone: contactInfo.phone || null,
          email: contactInfo.email || null,
          emergencyContact: contactInfo.emergencyContact || null,
        } : null,
        operatingHours: operatingHours ? {
          checkIn: operatingHours.checkIn || '12:00 PM',
          checkOut: operatingHours.checkOut || '11:00 AM',
        } : null,
        images: images || [],
        managedBy: req.userRole === 'manager' ? req.userId : null,
        ownerId: ownerIdToUse,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return successResponse(res, hostel, 'Hostel created successfully', 201);
  } catch (error) {
    console.error('Create hostel error:', error);
    return errorResponse(res, error.message, 400);
  }
};

/**
 * PUT /api/admin/hostel/:id
 * Update hostel
 */
const updateHostel = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const hostelId = parseInt(id, 10);

    if (!await ensureHostelAccess(req, hostelId)) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    // Remove fields that shouldn't be updated directly
    delete updates.totalFloors;
    delete updates.totalRooms;
    delete updates.totalBeds;
    delete updates.occupiedBeds;

    // Prepare update data
    const updateData = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
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

    if (updates.images) updateData.images = updates.images;

    if (req.userRole !== 'owner' && updates.ownerId !== undefined) {
      if (updates.ownerId === null) {
        updateData.ownerId = null;
      } else {
        const numericOwnerId = Number(updates.ownerId);
        if (!Number.isFinite(numericOwnerId)) {
          return errorResponse(res, 'Invalid owner id', 400);
        }
        const ownerUser = await prisma.user.findUnique({
          where: { id: numericOwnerId },
          select: { id: true, role: true },
        });
        if (!ownerUser) {
          return errorResponse(res, 'Owner not found', 404);
        }
        if (ownerUser.role !== 'owner') {
          return errorResponse(res, 'Provided user is not an owner', 400);
        }
        updateData.ownerId = ownerUser.id;
      }
    }

    const hostel = await prisma.hostel.update({
      where: { id: hostelId },
      data: updateData,
      include: {
        manager: {
          select: {
            name: true,
            email: true,
          },
        },
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return successResponse(res, hostel, 'Hostel updated successfully', 200);
  } catch (error) {
    if (error.code === 'P2025') {
      return errorResponse(res, 'Hostel not found', 404);
    }
    console.error('Update hostel error:', error);
    return errorResponse(res, error.message, 400);
  }
};

/**
 * DELETE /api/admin/hostel/:id
 * Delete hostel
 */
const deleteHostel = async (req, res) => {
  try {
    const { id } = req.params;
    const hostelId = parseInt(id, 10);

    if (!await ensureHostelAccess(req, hostelId)) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    // Check if hostel has any floors/rooms
    const floorCount = await prisma.floor.count({
      where: { hostelId: hostelId },
    });

    if (floorCount > 0) {
      return errorResponse(
        res,
        'Cannot delete hostel with existing floors. Please delete all floors first.',
        400
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
    console.error('Delete hostel error:', error);
    return errorResponse(res, error.message, 400);
  }
};

/**
 * GET /api/admin/hostel/:id/stats
 * Get hostel statistics
 */
const getHostelStats = async (req, res) => {
  try {
    const { id } = req.params;
    const hostelId = parseInt(id, 10);

    const hostel = await prisma.hostel.findFirst({
      where: { id: hostelId, ...buildHostelAccessFilter(req) },
    });

    if (!hostel) {
      return errorResponse(res, 'Hostel not found', 404);
    }

    // Get detailed statistics
    const [floors, rooms, vacantRooms, occupiedRooms, maintenanceRooms] = await Promise.all([
      prisma.floor.count({ where: { hostelId: hostelId, status: 'active' } }),
      prisma.room.count({ where: { hostelId: hostelId } }),
      prisma.room.count({ where: { hostelId: hostelId, status: 'vacant' } }),
      prisma.room.count({ where: { hostelId: hostelId, status: 'occupied' } }),
      prisma.room.count({ where: { hostelId: hostelId, status: 'under_maintenance' } }),
    ]);

    const stats = {
      hostelInfo: {
        name: hostel.name,
        status: hostel.status,
        totalFloors: floors,
        totalRooms: rooms,
      },
      bedStatistics: {
        totalBeds: hostel.totalBeds || 0,
        occupiedBeds: hostel.occupiedBeds || 0,
        availableBeds: (hostel.totalBeds || 0) - (hostel.occupiedBeds || 0),
        occupancyRate: hostel.totalBeds > 0
          ? parseFloat(((hostel.occupiedBeds / hostel.totalBeds) * 100).toFixed(2))
          : 0,
      },
      roomStatistics: {
        total: rooms,
        vacant: vacantRooms,
        occupied: occupiedRooms,
        underMaintenance: maintenanceRooms,
      },
    };

    return successResponse(res, stats, 'Hostel statistics retrieved successfully', 200);
  } catch (error) {
    console.error('Get hostel stats error:', error);
    return errorResponse(res, error.message, 400);
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
};


