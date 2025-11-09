// ===============================
// Floor Controller
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

// ===================================
// CREATE FLOOR
// ===================================
const createFloor = async (req, res) => {
    try {
        const {
            hostel,
            floorNumber,
            floorName,
            description,
            amenities,
            floorPlan
        } = req.body;

        // Validation
        const hostelId = parseInt(hostel, 10);

        if (!Number.isFinite(hostelId) || floorNumber === undefined) {
            return errorResponse(res, "Hostel ID and floor number are required", 400);
        }

        // Check if hostel exists
        const hostelExists = await prisma.hostel.findUnique({
            where: { id: hostelId },
            select: {
                id: true,
                ownerId: true,
                managedBy: true,
                name: true,
                address: true
            }
        });
        
        if (!hostelExists) {
            return errorResponse(res, "Hostel not found", 404);
        }

        const access = await assertHostelAccess(req, hostelId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        // Check if floor number already exists for this hostel
        const existingFloor = await prisma.floor.findUnique({
            where: {
                hostelId_floorNumber: {
                    hostelId: hostelId,
                    floorNumber: floorNumber
                }
            }
        });
        
        if (existingFloor) {
            return errorResponse(res, "Floor number already exists for this hostel", 400);
        }

        // Create floor
        const floor = await prisma.floor.create({
            data: {
                hostelId: hostelId,
                floorNumber,
                floorName: floorName || `Floor ${floorNumber}`,
                description: description || null,
                amenities: amenities || [],
                floorPlan: floorPlan || null
            },
            include: {
                hostel: {
                    select: {
                        name: true,
                        address: true
                    }
                }
            }
        });

        // Update hostel's total floors count
        await prisma.hostel.update({
            where: { id: hostelId },
            data: {
                totalFloors: { increment: 1 }
            }
        });

        return successResponse(res, floor, "Floor created successfully", 201);
    } catch (err) {
        console.error("Create Floor Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ALL FLOORS
// ===================================
const getAllFloors = async (req, res) => {
    try {
        const { hostel, status } = req.query;

        // Build filter
        const where = {};
        if (hostel) {
            const hostelId = parseInt(hostel, 10);
            if (!Number.isFinite(hostelId)) {
                return errorResponse(res, "Invalid hostel id", 400);
            }
            where.hostelId = hostelId;
        }
        if (status) where.status = status;

        const hostelAccessFilter = getHostelAccessFilter(req);
        if (Object.keys(hostelAccessFilter).length > 0) {
            where.hostel = hostelAccessFilter;
        }

        const floors = await prisma.floor.findMany({
            where,
            include: {
                hostel: {
                    select: {
                        name: true,
                        address: true
                    }
                }
            },
            orderBy: [
                { hostelId: 'asc' },
                { floorNumber: 'asc' }
            ]
        });

        return successResponse(res, floors, "Floors retrieved successfully", 200);
    } catch (err) {
        console.error("Get All Floors Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET FLOORS BY HOSTEL
// ===================================
const getFloorsByHostel = async (req, res) => {
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

        const floors = await prisma.floor.findMany({
            where: { hostelId: parsedHostelId },
            orderBy: { floorNumber: 'asc' }
        });

        return successResponse(res, floors, "Floors retrieved successfully", 200);
    } catch (err) {
        console.error("Get Floors By Hostel Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET FLOOR BY ID
// ===================================
const getFloorById = async (req, res) => {
    try {
        const { id } = req.params;
        const floorId = parseInt(id,10);

        const access = await assertFloorAccess(req, floorId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const floor = await prisma.floor.findUnique({
            where: { id: floorId },
            include: {
                hostel: {
                    select: {
                        name: true,
                        address: true
                    }
                }
            }
        });

        // Get rooms on this floor
        const rooms = await prisma.room.findMany({
            where: { floorId: floorId },
            select: {
                id: true,
                roomNumber: true,
                roomType: true,
                status: true,
                totalBeds: true,
                occupiedBeds: true
            }
        });

        const floorData = {
            ...floor,
            rooms
        };

        return successResponse(res, floorData, "Floor retrieved successfully", 200);
    } catch (err) {
        console.error("Get Floor Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE FLOOR
// ===================================
const updateFloor = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const floorId = parseInt(id,10);
        // Remove fields that shouldn't be updated directly
        delete updates.hostel;
        delete updates.hostelId;
        delete updates.totalRooms;
        delete updates.totalBeds;
        delete updates.occupiedBeds;

        // Prepare update data
        const updateData = {};
        if (updates.floorNumber !== undefined) updateData.floorNumber = updates.floorNumber;
        if (updates.floorName !== undefined) updateData.floorName = updates.floorName;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.amenities !== undefined) updateData.amenities = updates.amenities;
        if (updates.floorPlan !== undefined) updateData.floorPlan = updates.floorPlan;
        if (updates.status !== undefined) updateData.status = updates.status;

        const access = await assertFloorAccess(req, floorId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const floor = await prisma.floor.update({
            where: { id: floorId },
            data: updateData,
            include: {
                hostel: {
                    select: {
                        name: true,
                        address: true
                    }
                }
            }
        });

        return successResponse(res, floor, "Floor updated successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Floor not found", 404);
        }
        console.error("Update Floor Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// DELETE FLOOR
// ===================================
const deleteFloor = async (req, res) => {
    try {
        const { id } = req.params;
        const floorId = parseInt(id, 10);
        if (!Number.isFinite(floorId)) {
            return errorResponse(res, "Invalid floor id", 400);
        }

        const access = await assertFloorAccess(req, floorId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const floor = await prisma.floor.findUnique({
            where: { id: floorId }
        });
        
        if (!floor) {
            return errorResponse(res, "Floor not found", 404);
        }

        // Check if floor has any rooms
        const roomCount = await prisma.room.count({ where: { floorId: floorId } });
        if (roomCount > 0) {
            return errorResponse(
                res,
                "Cannot delete floor with existing rooms. Please delete all rooms first.",
                400
            );
        }

        await prisma.floor.delete({
            where: { id: floorId }
        });

        // Update hostel's total floors count
        await prisma.hostel.update({
            where: { id: floor.hostelId },
            data: {
                totalFloors: { decrement: 1 }
            }
        });

        return successResponse(res, { id }, "Floor deleted successfully", 200);
    } catch (err) {
        console.error("Delete Floor Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    createFloor,
    getAllFloors,
    getFloorsByHostel,
    getFloorById,
    updateFloor,
    deleteFloor
};
