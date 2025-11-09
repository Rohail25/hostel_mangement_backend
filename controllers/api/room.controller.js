// ===============================
// Room Controller
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

// ===================================
// CREATE ROOM
// ===================================
const createRoom = async (req, res) => {
    try {
        const {
            hostel,
            floor,
            roomNumber,
            roomType,
            totalBeds,
            pricePerBed,
            amenities,
            hasAttachedBathroom,
            furnishing,
        } = req.body;

        const hostelId = parseInt(hostel, 10);
        const floorId = parseInt(floor, 10);

        // Validation
        if (!Number.isFinite(hostelId) || !Number.isFinite(floorId) || !roomNumber || !roomType || !totalBeds || pricePerBed === undefined) {
            return errorResponse(res, "Hostel, floor, room number, room type, total beds, and price are required", 400);
        }

        const totalBedsValue = Number(totalBeds);
        const pricePerBedValue = Number(pricePerBed);

        if (!Number.isFinite(totalBedsValue) || totalBedsValue <= 0) {
            return errorResponse(res, "Invalid total beds", 400);
        }

        if (!Number.isFinite(pricePerBedValue) || pricePerBedValue < 0) {
            return errorResponse(res, "Invalid price per bed", 400);
        }

        // Check if floor exists
        const floorExists = await prisma.floor.findUnique({
            where: { id: floorId },
            include: {
                hostel: {
                    select: { id: true }
                }
            }
        });
        
        if (!floorExists) {
            return errorResponse(res, "Floor not found", 404);
        }

        if (floorExists.hostelId !== hostelId) {
            return errorResponse(res, "Floor does not belong to the provided hostel", 400);
        }

        const access = await assertFloorAccess(req, floorId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        // Check if room number already exists for this hostel
        const existingRoom = await prisma.room.findUnique({
            where: {
                hostelId_roomNumber: {
                    hostelId: hostelId,
                    roomNumber: roomNumber
                }
            }
        });
        
        if (existingRoom) {
            return errorResponse(res, "Room number already exists for this hostel", 400);
        }

        // Create room
        const room = await prisma.room.create({
            data: {
                hostelId: hostelId,
                floorId: floorId,
                roomNumber,
                roomType,
                totalBeds: totalBedsValue,
                pricePerBed: pricePerBedValue,
                amenities: amenities || [],
                // dimensions: dimensions ? {
                //     length: dimensions.length || null,
                //     width: dimensions.width || null,
                //     area: dimensions.area || null
                // } : null,
                hasAttachedBathroom: hasAttachedBathroom || false,
                // hasBalcony: hasBalcony || false,
                furnishing: furnishing || 'furnished',
                // images: images || []
            },
            include: {
                hostel: {
                    select: { name: true }
                },
                floor: {
                    select: { floorNumber: true, floorName: true }
                }
            }
        });

        // Update floor and hostel counts
        await Promise.all([
            prisma.floor.update({
                where: { id: floorId },
                data: {
                    totalRooms: { increment: 1 },
                    totalBeds: { increment: totalBedsValue }
                }
            }),
            prisma.hostel.update({
                where: { id: hostelId },
                data: {
                    totalRooms: { increment: 1 },
                    totalBeds: { increment: totalBedsValue }
                }
            })
        ]);

        return successResponse(res, room, "Room created successfully", 201);
    } catch (err) {
        console.error("Create Room Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ALL ROOMS
// ===================================
const getAllRooms = async (req, res) => {
    try {
        const { hostel, floor, status, roomType, page = 1, limit = 20 } = req.query;

        const pageNumber = parseInt(page, 10) || 1;
        const limitNumber = parseInt(limit, 10) || 20;

        // Build filter
        const where = {};
        if (hostel) {
            const hostelId = parseInt(hostel, 10);
            if (!Number.isFinite(hostelId)) {
                return errorResponse(res, "Invalid hostel id", 400);
            }
            where.hostelId = hostelId;
        }
        if (floor) {
            const floorId = parseInt(floor, 10);
            if (!Number.isFinite(floorId)) {
                return errorResponse(res, "Invalid floor id", 400);
            }
            where.floorId = floorId;
        }
        if (status) where.status = status;
        if (roomType) where.roomType = roomType;

        const hostelAccessFilter = getHostelAccessFilter(req);
        if (Object.keys(hostelAccessFilter).length > 0) {
            where.hostel = hostelAccessFilter;
        }

        // Pagination
        const skip = (pageNumber - 1) * limitNumber;

        const [rooms, total] = await Promise.all([
            prisma.room.findMany({
                where,
                include: {
                    hostel: {
                        select: { name: true }
                    },
                    floor: {
                        select: { floorNumber: true, floorName: true }
                    }
                },
                orderBy: { roomNumber: 'asc' },
                take: limitNumber,
                skip: skip
            }),
            prisma.room.count({ where })
        ]);

        return successResponse(res, {
            rooms,
            pagination: {
                total,
                page: pageNumber,
                limit: limitNumber,
                pages: Math.ceil(total / limitNumber)
            }
        }, "Rooms retrieved successfully", 200);
    } catch (err) {
        console.error("Get All Rooms Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ROOMS BY HOSTEL
// ===================================
const getRoomsByHostel = async (req, res) => {
    try {
        const { hostelId } = req.params;
        const { status } = req.query;
        const convertedHostelId = parseInt(hostelId,10);
        if (!Number.isFinite(convertedHostelId)) {
            return errorResponse(res, "Invalid hostel id", 400);
        }

        const access = await assertHostelAccess(req, convertedHostelId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const where = { hostelId: convertedHostelId };
        if (status) where.status = status;

        const rooms = await prisma.room.findMany({
            where,
            include: {
                floor: {
                    select: { floorNumber: true, floorName: true }
                }
            },
            orderBy: [
                { floorId: 'asc' },
                { roomNumber: 'asc' }
            ]
        });

        return successResponse(res, rooms, "Rooms retrieved successfully", 200);
    } catch (err) {
        console.error("Get Rooms By Hostel Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ROOMS BY FLOOR
// ===================================
const getRoomsByFloor = async (req, res) => {
    try {
        const { floorId } = req.params;
        const convertedFloorId = parseInt(floorId,10);
        if (!Number.isFinite(convertedFloorId)) {
            return errorResponse(res, "Invalid floor id", 400);
        }

        const access = await assertFloorAccess(req, convertedFloorId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const rooms = await prisma.room.findMany({
            where: { floorId: convertedFloorId },
            include: {
                hostel: {
                    select: { name: true }
                }
            },
            orderBy: { roomNumber: 'asc' }
        });

        return successResponse(res, rooms, "Rooms retrieved successfully", 200);
    } catch (err) {
        console.error("Get Rooms By Floor Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ROOM BY ID
// ===================================
const getRoomById = async (req, res) => {
    try {
        const { id } = req.params;
        const roomId = parseInt(id,10);

        const access = await assertRoomAccess(req, roomId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const room = await prisma.room.findUnique({
            where: { id: roomId },
            include: {
                hostel: {
                    select: { name: true, address: true, contactInfo: true }
                },
                floor: {
                    select: { floorNumber: true, floorName: true }
                }
            }
        });

        // Get beds in this room
        const beds = await prisma.bed.findMany({
            where: { roomId: roomId },
            include: {
                currentUser: {
                    select: { name: true, email: true, phone: true }
                }
            }
        });

        const roomData = {
            ...room,
            beds,
            availableBeds: room.totalBeds - room.occupiedBeds,
            isFullyOccupied: room.occupiedBeds >= room.totalBeds
        };

        return successResponse(res, roomData, "Room retrieved successfully", 200);
    } catch (err) {
        console.error("Get Room Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE ROOM
// ===================================
const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const roomId = parseInt(id,10);

        const access = await assertRoomAccess(req, roomId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        // Remove fields that shouldn't be updated directly
        delete updates.hostel;
        delete updates.hostelId;
        delete updates.floor;
        delete updates.floorId;
        delete updates.occupiedBeds;

        const oldRoom = access.room;

        // Prepare update data
        const updateData = {};
        if (updates.roomNumber) updateData.roomNumber = updates.roomNumber;
        if (updates.roomType) updateData.roomType = updates.roomType;
        if (updates.totalBeds !== undefined) {
            const newTotalBeds = Number(updates.totalBeds);
            if (!Number.isFinite(newTotalBeds) || newTotalBeds < 0) {
                return errorResponse(res, "Invalid total beds", 400);
            }
            updateData.totalBeds = newTotalBeds;
        }
        if (updates.pricePerBed !== undefined) {
            const newPrice = Number(updates.pricePerBed);
            if (!Number.isFinite(newPrice) || newPrice < 0) {
                return errorResponse(res, "Invalid price per bed", 400);
            }
            updateData.pricePerBed = newPrice;
        }
        if (updates.status) updateData.status = updates.status;
        if (updates.amenities) updateData.amenities = updates.amenities;
        if (updates.hasAttachedBathroom !== undefined) updateData.hasAttachedBathroom = updates.hasAttachedBathroom;
        if (updates.hasBalcony !== undefined) updateData.hasBalcony = updates.hasBalcony;
        if (updates.furnishing) updateData.furnishing = updates.furnishing;
        if (updates.images) updateData.images = updates.images;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        
        if (updates.dimensions) {
            updateData.dimensions = {
                length: updates.dimensions.length || null,
                width: updates.dimensions.width || null,
                area: updates.dimensions.area || null
            };
        }

        const room = await prisma.room.update({
            where: { id: roomId },
            data: updateData,
            include: {
                hostel: {
                    select: { name: true }
                },
                floor: {
                    select: { floorNumber: true, floorName: true }
                }
            }
        });

        // If total beds changed, update floor and hostel counts
        if (updateData.totalBeds !== undefined && updateData.totalBeds !== oldRoom.totalBeds) {
            const difference = updateData.totalBeds - oldRoom.totalBeds;
            
            await Promise.all([
                prisma.floor.update({
                    where: { id: oldRoom.floorId },
                    data: {
                        totalBeds: { increment: difference }
                    }
                }),
                prisma.hostel.update({
                    where: { id: oldRoom.hostelId },
                    data: {
                        totalBeds: { increment: difference }
                    }
                })
            ]);
        }

        return successResponse(res, room, "Room updated successfully", 200);
    } catch (err) {
        console.error("Update Room Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE ROOM STATUS
// ===================================
const updateRoomStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const roomId = parseInt(id,10);

        if (!['vacant', 'occupied', 'under_maintenance', 'reserved'].includes(status)) {
            return errorResponse(res, "Invalid status", 400);
        }

        const access = await assertRoomAccess(req, roomId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const room = await prisma.room.update({
            where: { id: roomId },
            data: { status },
            include: {
                hostel: {
                    select: { name: true }
                },
                floor: {
                    select: { floorNumber: true, floorName: true }
                }
            }
        });

        return successResponse(res, room, "Room status updated successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Room not found", 404);
        }
        console.error("Update Room Status Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// SCHEDULE MAINTENANCE
// ===================================
const scheduleMaintenance = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, description } = req.body;

        if (!date || !description) {
            return errorResponse(res, "Date and description are required", 400);
        }

        const roomId = parseInt(id, 10);
        if (!Number.isFinite(roomId)) {
            return errorResponse(res, "Invalid room id", 400);
        }

        const access = await assertRoomAccess(req, roomId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        // Get current room data
        const currentRoom = await prisma.room.findUnique({
            where: { id: roomId }
        });

        if (!currentRoom) {
            return errorResponse(res, "Room not found", 404);
        }

        // Add new maintenance schedule
        const updatedSchedule = [
            ...(currentRoom.maintenanceSchedule || []),
            {
                date: new Date(date),
                description,
                status: 'scheduled'
            }
        ];

        const room = await prisma.room.update({
            where: { id: roomId },
            data: {
                maintenanceSchedule: updatedSchedule
            }
        });

        return successResponse(res, room, "Maintenance scheduled successfully", 200);
    } catch (err) {
        console.error("Schedule Maintenance Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// DELETE ROOM
// ===================================
const deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const roomId = parseInt(id, 10);
        if (!Number.isFinite(roomId)) {
            return errorResponse(res, "Invalid room id", 400);
        }

        const access = await assertRoomAccess(req, roomId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const room = await prisma.room.findUnique({
            where: { id: roomId }
        });
        
        if (!room) {
            return errorResponse(res, "Room not found", 404);
        }

        // Check if room has any beds
        const bedCount = await prisma.bed.count({ where: { roomId: roomId } });
        if (bedCount > 0) {
            return errorResponse(
                res,
                "Cannot delete room with existing beds. Please delete all beds first.",
                400
            );
        }

        await prisma.room.delete({
            where: { id: roomId }
        });

        // Update floor and hostel counts
        await Promise.all([
            prisma.floor.update({
                where: { id: room.floorId },
                data: {
                    totalRooms: { decrement: 1 },
                    totalBeds: { decrement: room.totalBeds }
                }
            }),
            prisma.hostel.update({
                where: { id: room.hostelId },
                data: {
                    totalRooms: { decrement: 1 },
                    totalBeds: { decrement: room.totalBeds }
                }
            })
        ]);

        return successResponse(res, { id }, "Room deleted successfully", 200);
    } catch (err) {
        console.error("Delete Room Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    createRoom,
    getAllRooms,
    getRoomsByHostel,
    getRoomsByFloor,
    getRoomById,
    updateRoom,
    updateRoomStatus,
    scheduleMaintenance,
    deleteRoom
};
