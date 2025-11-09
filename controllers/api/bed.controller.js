// ===============================
// Bed Controller
// ===============================

const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');

const getHostelAccessFilter = (req) => {
    if (req.userRole === 'owner') {
        return { ownerId: req.userId };
    }
    if (req.userRole === 'manager') {
        return { managedBy: req.userId };
    }
    return {};
};

const assertHostelAccess = async (req, hostelId) => {
    const hostel = await prisma.hostel.findUnique({
        where: { id: hostelId },
        select: { id: true, ownerId: true, managedBy: true }
    });

    if (!hostel) {
        return { ok: false, status: 404, message: "Hostel not found" };
    }

    if (req.userRole === 'owner' && hostel.ownerId !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this hostel" };
    }

    if (req.userRole === 'manager' && hostel.managedBy !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this hostel" };
    }

    return { ok: true, hostel };
};

const assertFloorAccess = async (req, floorId) => {
    const floor = await prisma.floor.findUnique({
        where: { id: floorId },
        include: {
            hostel: {
                select: { id: true, ownerId: true, managedBy: true }
            }
        }
    });

    if (!floor) {
        return { ok: false, status: 404, message: "Floor not found" };
    }

    if (req.userRole === 'owner' && floor.hostel.ownerId !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this floor" };
    }

    if (req.userRole === 'manager' && floor.hostel.managedBy !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this floor" };
    }

    return { ok: true, floor };
};

const assertRoomAccess = async (req, roomId) => {
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
            hostel: { select: { id: true, ownerId: true, managedBy: true } },
            floor: { select: { id: true, hostelId: true } }
        }
    });

    if (!room) {
        return { ok: false, status: 404, message: "Room not found" };
    }

    if (req.userRole === 'owner' && room.hostel.ownerId !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this room" };
    }

    if (req.userRole === 'manager' && room.hostel.managedBy !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this room" };
    }

    return { ok: true, room };
};

const assertBedAccess = async (req, bedId) => {
    const bed = await prisma.bed.findUnique({
        where: { id: bedId },
        include: {
            hostel: { select: { id: true, ownerId: true, managedBy: true } },
            floor: { select: { id: true, hostelId: true } },
            room: { select: { id: true, hostelId: true, floorId: true } }
        }
    });

    if (!bed) {
        return { ok: false, status: 404, message: "Bed not found" };
    }

    if (req.userRole === 'owner' && bed.hostel.ownerId !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this bed" };
    }

    if (req.userRole === 'manager' && bed.hostel.managedBy !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this bed" };
    }

    return { ok: true, bed };
};

// ===================================
// CREATE BED
// ===================================
const createBed = async (req, res) => {
    try {
        const {
            room,
            bedNumber,
            bedType,
            position
        } = req.body;

        const roomId = parseInt(room, 10);

        // Validation
        if (!Number.isFinite(roomId) || !bedNumber) {
            return errorResponse(res, "Room and bed number are required", 400);
        }

        // Check if room exists
        const roomExists = await prisma.room.findUnique({
            where: { id: roomId }
        });
        
        if (!roomExists) {
            return errorResponse(res, "Room not found", 404);
        }

        const access = await assertRoomAccess(req, roomId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        // Check if room has reached bed capacity
        const existingBeds = await prisma.bed.count({ where: { roomId: roomId } });
        if (existingBeds >= roomExists.totalBeds) {
            return errorResponse(res, "Room has reached maximum bed capacity", 400);
        }

        // Check if bed number already exists in this room
        const existingBed = await prisma.bed.findUnique({
            where: {
                roomId_bedNumber: {
                    roomId: roomId,
                    bedNumber: bedNumber
                }
            }
        });
        
        if (existingBed) {
            return errorResponse(res, "Bed number already exists in this room", 400);
        }

        // Create bed
        const bed = await prisma.bed.create({
            data: {
                roomId: roomId,
                floorId: roomExists.floorId,
                hostelId: roomExists.hostelId,
                bedNumber,
                bedType: bedType || 'single',
                position: position ? {
                    x: position.x || null,
                    y: position.y || null
                } : null
            },
            include: {
                room: {
                    select: { 
                        roomNumber: true, 
                        roomType: true,
                        floor: {
                            select: {
                                floorNumber: true,
                                hostel: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        return successResponse(res, bed, "Bed created successfully", 201);
    } catch (err) {
        console.error("Create Bed Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// CREATE MULTIPLE BEDS
// ===================================
const createMultipleBeds = async (req, res) => {
    try {
        const { roomId, numberOfBeds, bedType, startNumber = 1 } = req.body;

        const parsedRoomId = parseInt(roomId, 10);
        const parsedNumberOfBeds = Number(numberOfBeds);

        if (!Number.isFinite(parsedRoomId) || !Number.isFinite(parsedNumberOfBeds)) {
            return errorResponse(res, "Room ID and number of beds are required", 400);
        }

        const room = await prisma.room.findUnique({
            where: { id: parsedRoomId }
        });
        
        if (!room) {
            return errorResponse(res, "Room not found", 404);
        }

        const access = await assertRoomAccess(req, parsedRoomId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        // Check capacity
        const existingBeds = await prisma.bed.count({ where: { roomId: parsedRoomId } });
        if (existingBeds + parsedNumberOfBeds > room.totalBeds) {
            return errorResponse(res, `Can only create ${room.totalBeds - existingBeds} more beds`, 400);
        }

        // Create beds
        const bedsData = [];
        for (let i = 0; i < parsedNumberOfBeds; i++) {
            bedsData.push({
                roomId: parsedRoomId,
                floorId: room.floorId,
                hostelId: room.hostelId,
                bedNumber: `${room.roomNumber}-B${startNumber + i}`,
                bedType: bedType || 'single'
            });
        }

        const createdBeds = await prisma.bed.createMany({
            data: bedsData
        });

        return successResponse(res, { count: createdBeds.count }, `${parsedNumberOfBeds} beds created successfully`, 201);
    } catch (err) {
        console.error("Create Multiple Beds Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ALL BEDS
// ===================================
const getAllBeds = async (req, res) => {
    try {
        const { hostel, floor, room, status } = req.query;

        // Build filter
        const where = {};
        if (room) {
            const roomId = parseInt(room, 10);
            if (!Number.isFinite(roomId)) {
                return errorResponse(res, "Invalid room id", 400);
            }
            where.roomId = roomId;
        } else if (floor || hostel) {
            where.room = {};
            if (floor) {
                const floorId = parseInt(floor, 10);
                if (!Number.isFinite(floorId)) {
                    return errorResponse(res, "Invalid floor id", 400);
                }
                where.room.floorId = floorId;
            }
            if (hostel) {
                const hostelId = parseInt(hostel, 10);
                if (!Number.isFinite(hostelId)) {
                    return errorResponse(res, "Invalid hostel id", 400);
                }
                where.room.hostelId = hostelId;
            }
        }
        if (status) where.status = status;

        const hostelAccessFilter = getHostelAccessFilter(req);
        if (Object.keys(hostelAccessFilter).length > 0) {
            if (!where.room) {
                where.room = {};
            }
            where.room.hostel = hostelAccessFilter;
        }

        const beds = await prisma.bed.findMany({
            where,
            include: {
                room: {
                    select: { 
                        roomNumber: true, 
                        roomType: true,
                        floor: {
                            select: {
                                floorNumber: true,
                                hostel: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                },
                currentUser: {
                    select: { name: true, email: true, phone: true }
                }
            },
            orderBy: [
                { roomId: 'asc' },
                { bedNumber: 'asc' }
            ]
        });

        return successResponse(res, beds, "Beds retrieved successfully", 200);
    } catch (err) {
        console.error("Get All Beds Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET BEDS BY ROOM
// ===================================
const getBedsByRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const convertRoomId = parseInt(roomId,10);
        if (!Number.isFinite(convertRoomId)) {
            return errorResponse(res, "Invalid room id", 400);
        }

        const access = await assertRoomAccess(req, convertRoomId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const room = await prisma.room.findUnique({
            where: { id: convertRoomId }
        });
        if (!room) {
            return errorResponse(res, "Room not found", 404);
        }

        const beds = await prisma.bed.findMany({
            where: { roomId: convertRoomId },
            include: {
                currentUser: {
                    select: { name: true, email: true, phone: true }
                }
            },
            orderBy: { bedNumber: 'asc' }
        });

        return successResponse(res, beds, "Beds retrieved successfully", 200);
    } catch (err) {
        console.error("Get Beds By Room Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET BED BY ID
// ===================================
const getBedById = async (req, res) => {
    try {
        const { id } = req.params;
        const bedId = parseInt(id,10);
        if (!Number.isFinite(bedId)) {
            return errorResponse(res, "Invalid bed id", 400);
        }

        const access = await assertBedAccess(req, bedId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const bed = await prisma.bed.findUnique({
            where: { id: bedId },
            include: {
                room: {
                    select: { 
                        roomNumber: true, 
                        roomType: true,
                        floor: {
                            select: {
                                floorNumber: true,
                                floorName: true,
                                hostel: {
                                    select: { name: true, address: true }
                                }
                            }
                        }
                    }
                },
                currentUser: {
                    select: { name: true, email: true, phone: true }
                },
                reservedUser: {
                    select: { name: true, email: true, phone: true }
                }
            }
        });

        if (!bed) {
            return errorResponse(res, "Bed not found", 404);
        }

        return successResponse(res, bed, "Bed retrieved successfully", 200);
    } catch (err) {
        console.error("Get Bed Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE BED
// ===================================
const updateBed = async (req, res) => {
    try {
        const { id } = req.params;
        const bedId = parseInt(id,10);
        if (!Number.isFinite(bedId)) {
            return errorResponse(res, "Invalid bed id", 400);
        }

        const access = await assertBedAccess(req, bedId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const updates = req.body;

        // Remove fields that shouldn't be updated directly
        delete updates.hostel;
        delete updates.hostelId;
        delete updates.floor;
        delete updates.floorId;
        delete updates.room;
        delete updates.roomId;
        delete updates.currentTenant;
        delete updates.currentTenantId;

        // Prepare update data
        const updateData = {};
        if (updates.bedNumber) updateData.bedNumber = updates.bedNumber;
        if (updates.bedType) updateData.bedType = updates.bedType;
        if (updates.status) updateData.status = updates.status;
        if (updates.condition) updateData.condition = updates.condition;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.reservedById !== undefined) {
            if (updates.reservedById === null) {
                updateData.reservedById = null;
            } else {
                const reservedId = Number(updates.reservedById);
                if (!Number.isFinite(reservedId)) {
                    return errorResponse(res, "Invalid reservedById", 400);
                }
                updateData.reservedById = reservedId;
            }
        }
        if (updates.reservationExpiry !== undefined) {
            updateData.reservationExpiry = updates.reservationExpiry ? new Date(updates.reservationExpiry) : null;
        }
        
        if (updates.position) {
            updateData.position = {
                x: updates.position.x || null,
                y: updates.position.y || null
            };
        }

        const bed = await prisma.bed.update({
            where: { id: bedId },
            data: updateData,
            include: {
                room: {
                    select: { roomNumber: true, roomType: true }
                },
                currentUser: {
                    select: { name: true, email: true }
                }
            }
        });

        return successResponse(res, bed, "Bed updated successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Bed not found", 404);
        }
        console.error("Update Bed Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE BED STATUS
// ===================================
const updateBedStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const bedId = parseInt(id,10);
        if (!Number.isFinite(bedId)) {
            return errorResponse(res, "Invalid bed id", 400);
        }
        const { status } = req.body;

        if (!['available', 'occupied', 'reserved', 'under_maintenance'].includes(status)) {
            return errorResponse(res, "Invalid status", 400);
        }

        const access = await assertBedAccess(req, bedId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const bed = await prisma.bed.update({
            where: { id: bedId },
            data: { status },
            include: {
                room: {
                    select: { roomNumber: true }
                }
            }
        });

        return successResponse(res, bed, "Bed status updated successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Bed not found", 404);
        }
        console.error("Update Bed Status Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// DELETE BED
// ===================================
const deleteBed = async (req, res) => {
    try {
        const { id } = req.params;
        const bedId = parseInt(id,10);
        if (!Number.isFinite(bedId)) {
            return errorResponse(res, "Invalid bed id", 400);
        }

        const access = await assertBedAccess(req, bedId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const bed = await prisma.bed.findUnique({
            where: { id: bedId }
        });
        
        if (!bed) {
            return errorResponse(res, "Bed not found", 404);
        }

        // Check if bed is occupied
        if (bed.status === 'occupied' || bed.currentUserId) {
            return errorResponse(res, "Cannot delete occupied bed. Please deallocate tenant first.", 400);
        }

        await prisma.bed.delete({
            where: { id: bedId }
        });

        return successResponse(res, { id: bedId }, "Bed deleted successfully", 200);
    } catch (err) {
        console.error("Delete Bed Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET AVAILABLE BEDS
// ===================================
const getAvailableBeds = async (req, res) => {
    try {
        const { hostelId } = req.params;
        const parsedHostelId = parseInt(hostelId, 10);
        if (!Number.isFinite(parsedHostelId)) {
            return errorResponse(res, "Invalid hostel id", 400);
        }

        const access = await assertHostelAccess(req, parsedHostelId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const beds = await prisma.bed.findMany({
            where: {
                room: {
                    hostelId: parsedHostelId
                },
                status: 'available'
            },
            include: {
                room: {
                    select: { 
                        roomNumber: true, 
                        roomType: true,
                        floor: {
                            select: { floorNumber: true }
                        }
                    }
                }
            },
            orderBy: [
                { roomId: 'asc' },
                { bedNumber: 'asc' }
            ]
        });

        return successResponse(res, beds, "Available beds retrieved successfully", 200);
    } catch (err) {
        console.error("Get Available Beds Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    createBed,
    createMultipleBeds,
    getAllBeds,
    getBedsByRoom,
    getBedById,
    updateBed,
    updateBedStatus,
    deleteBed,
    getAvailableBeds
};
