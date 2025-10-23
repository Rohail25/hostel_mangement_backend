// ===============================
// Allocation Controller (Tenant Management)
// ===============================

const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');

// ===================================
// ALLOCATE TENANT TO BED
// ===================================
const allocateTenant = async (req, res) => {
    try {
        const {
            hostel,
            floor,
            room,
            bed,
            tenant,
            checkInDate,
            expectedCheckOutDate,
            rentAmount,
            depositAmount,
            notes
        } = req.body;

        // Validation
        if (!hostel || !floor || !room || !bed || !tenant || !checkInDate || !rentAmount) {
            return errorResponse(
                res,
                "Hostel, floor, room, bed, tenant, check-in date, and rent amount are required",
                400
            );
        }

        // Check if tenant exists
        const tenantExists = await prisma.tenant.findUnique({
            where: { id: parseInt(tenant) }
        });
        
        if (!tenantExists) {
            return errorResponse(res, "Tenant not found", 404);
        }

        // Check if tenant status is active
        if (tenantExists.status !== 'active') {
            return errorResponse(res, `Tenant is ${tenantExists.status}, cannot allocate`, 400);
        }

        // Check if bed exists and is available
        const bedData = await prisma.bed.findUnique({
            where: { id: parseInt(bed) }
        });
        
        if (!bedData) {
            return errorResponse(res, "Bed not found", 404);
        }

        if (bedData.status !== 'available' && bedData.status !== 'reserved') {
            return errorResponse(res, `Bed is ${bedData.status}, cannot allocate`, 400);
        }

        // Check if tenant already has an active allocation
        const existingAllocation = await prisma.allocation.findFirst({
            where: {
                tenantId: parseInt(tenant),
                status: 'active'
            }
        });

        if (existingAllocation) {
            return errorResponse(
                res,
                "Tenant already has an active allocation. Please check out from current bed first.",
                400
            );
        }

        // Use transaction to ensure data consistency
        const allocation = await prisma.$transaction(async (tx) => {
            // Create allocation using relation connect
            const newAllocation = await tx.allocation.create({
                data: {
                    hostel: { connect: { id: parseInt(hostel) } },
                    floor: { connect: { id: parseInt(floor) } },
                    room: { connect: { id: parseInt(room) } },
                    bed: { connect: { id: parseInt(bed) } },
                    tenant: { connect: { id: parseInt(tenant) } },
                    allocatedBy: { connect: { id: req.userId } },
                    checkInDate: new Date(checkInDate),
                    expectedCheckOutDate: expectedCheckOutDate ? new Date(expectedCheckOutDate) : null,
                    rentAmount,
                    depositAmount: depositAmount || 0,
                    notes: notes || null
                }
            });

            // Update bed status (note: currentTenantId still uses User model for backward compatibility)
            await tx.bed.update({
                where: { id: parseInt(bed) },
                data: {
                    status: 'occupied'
                    // currentTenantId removed - we now use Allocation to track tenants
                }
            });

            // Update room occupied beds count
            await tx.room.update({
                where: { id: parseInt(room) },
                data: {
                    occupiedBeds: { increment: 1 }
                }
            });

            // Update floor occupied beds count
            await tx.floor.update({
                where: { id: parseInt(floor) },
                data: {
                    occupiedBeds: { increment: 1 }
                }
            });

            // Update hostel occupied beds count
            await tx.hostel.update({
                where: { id: parseInt(hostel) },
                data: {
                    occupiedBeds: { increment: 1 }
                }
            });

            // Check and update room status if fully occupied
            const roomData = await tx.room.findUnique({
                where: { id: parseInt(room) }
            });
            
            if (roomData.occupiedBeds >= roomData.totalBeds) {
                await tx.room.update({
                    where: { id: parseInt(room) },
                    data: { status: 'occupied' }
                });
            }

            return newAllocation;
        });

        // Fetch populated allocation with tenant info
        const populatedAllocation = await prisma.allocation.findUnique({
            where: { id: allocation.id },
            include: {
                hostel: { select: { name: true } },
                floor: { select: { floorNumber: true } },
                room: { select: { roomNumber: true } },
                bed: { 
                    select: { 
                        bedNumber: true
                    } 
                },
                tenant: {
                    select: { name: true, email: true, phone: true }
                },
                allocatedBy: { select: { name: true, email: true } }
            }
        });

        return successResponse(res, populatedAllocation, "Tenant allocated successfully", 201);
    } catch (err) {
        console.error("Allocate Tenant Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// CHECK OUT TENANT
// ===================================
const checkOutTenant = async (req, res) => {
    try {
        const { allocationId } = req.params;
        const { checkOutDate, notes } = req.body;

        const allocation = await prisma.allocation.findUnique({
            where: { id: parseInt(allocationId) }
        });
        
        if (!allocation) {
            return errorResponse(res, "Allocation not found", 404);
        }

        if (allocation.status !== 'active') {
            return errorResponse(res, "Allocation is not active", 400);
        }

        // Use transaction for consistency
        await prisma.$transaction(async (tx) => {
            // Update allocation
            await tx.allocation.update({
                where: { id: parseInt(allocationId) },
                data: {
                    status: 'checked_out',
                    checkOutDate: checkOutDate ? new Date(checkOutDate) : new Date(),
                    notes: notes ? (allocation.notes ? `${allocation.notes}\n${notes}` : notes) : allocation.notes
                }
            });

            // Update bed
            await tx.bed.update({
                where: { id: parseInt(allocation.bedId) },
                data: {
                    status: 'available'
                    // currentTenantId removed - we now use Allocation to track tenants
                }
            });

            // Update counts
            await tx.room.update({
                where: { id: parseInt(allocation.roomId) },
                data: {
                    occupiedBeds: { decrement: 1 }
                }
            });

            await tx.floor.update({
                where: { id: parseInt(allocation.floorId) },
                data: {
                    occupiedBeds: { decrement: 1 }
                }
            });

            await tx.hostel.update({
                where: { id: parseInt(allocation.hostelId) },
                data: {
                    occupiedBeds: { decrement: 1 }
                }
            });

            // Update room status
            const roomData = await tx.room.findUnique({
                where: { id: parseInt(allocation.roomId) }
            });
            
            if (roomData.occupiedBeds === 0) {
                await tx.room.update({
                    where: { id: parseInt(allocation.roomId) },
                    data: { status: 'vacant' }
                });
            } else if (roomData.occupiedBeds < roomData.totalBeds) {
                await tx.room.update({
                    where: { id: parseInt(allocation.roomId) },
                    data: { status: 'occupied' }
                });
            }
        });

        const populatedAllocation = await prisma.allocation.findUnique({
            where: { id: parseInt(allocationId) },
            include: {
                bed: { select: { bedNumber: true } },
                room: { select: { roomNumber: true } }
            }
        });

        return successResponse(res, populatedAllocation, "Tenant checked out successfully", 200);
    } catch (err) {
        console.error("Check Out Tenant Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// TRANSFER TENANT TO ANOTHER BED
// ===================================
const transferTenant = async (req, res) => {
    try {
        const { allocationId } = req.params;
        const { newBedId, reason } = req.body;

        if (!newBedId) {
            return errorResponse(res, "New bed ID is required", 400);
        }

        const allocation = await prisma.allocation.findUnique({
            where: { id: parseInt(allocationId) }
        });
        
        if (!allocation) {
            return errorResponse(res, "Allocation not found", 404);
        }

        if (allocation.status !== 'active') {
            return errorResponse(res, "Can only transfer active allocations", 400);
        }

        // Check if new bed is available
        const newBed = await prisma.bed.findUnique({
            where: { id: parseInt(newBedId) },
            include: {
                room: {
                    include: {
                        floor: true
                    },
                }
            }
        });
        
        if (!newBed) {
            return errorResponse(res, "New bed not found", 404);
        }

        if (newBed.status !== 'available') {
            return errorResponse(res, "New bed is not available", 400);
        }

        const oldBedId = parseInt(allocation.bedId);
        const oldRoomId = parseInt(allocation.roomId);

        // Get tenant ID from allocation
        const tenantId = parseInt(allocation.tenantId);

        // Use transaction for consistency
        await prisma.$transaction(async (tx) => {
            // Get current transfer history
            const currentAllocation = await tx.allocation.findUnique({
                where: { id: parseInt(allocationId) }
            });

            // Add new transfer record to history
            const updatedHistory = [
                ...(currentAllocation.transferHistory || []),
                {
                    fromBedId: oldBedId,
                    toBedId: newBedId,
                    transferDate: new Date(),
                    reason: reason || 'Not specified',
                    transferredById: req.userId
                }
            ];

            // Update allocation with new bed info
            await tx.allocation.update({
                where: { id: parseInt(allocationId) },
                data: {
                    bedId: newBedId,
                    roomId: newBed.roomId,
                    floorId: newBed.room.floorId,
                    transferHistory: updatedHistory
                }
            });

            // Update old bed
            await tx.bed.update({
                where: { id: oldBedId },
                data: {
                    status: 'available'
                }
            });

            // Update new bed
            await tx.bed.update({
                where: { id: newBedId },
                data: {
                    status: 'occupied'
                }
            });

            // Update old room
            await tx.room.update({
                where: { id: oldRoomId },
                data: {
                    occupiedBeds: { decrement: 1 }
                }
            });

            // Update new room
            await tx.room.update({
                where: { id: newBed.roomId },
                data: {
                    occupiedBeds: { increment: 1 }
                }
            });
        });

        const populatedAllocation = await prisma.allocation.findUnique({
            where: { id: parseInt(allocationId) },
            include: {
                bed: { 
                    select: { 
                        bedNumber: true
                    } 
                },
                tenant: {
                    select: { name: true, email: true, phone: true }
                },
                room: { select: { roomNumber: true } },
                floor: { select: { floorNumber: true } }
            }
        });

        return successResponse(res, populatedAllocation, "Tenant transferred successfully", 200);
    } catch (err) {
        console.error("Transfer Tenant Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ALL ALLOCATIONS
// ===================================
const getAllAllocations = async (req, res) => {
    try {
        const { hostel, status, page = 1, limit = 20 } = req.query;

        // Build filter
        const where = {};
        if (hostel) where.hostelId = hostel;
        if (status) where.status = status;

        // Pagination
        const skip = (page - 1) * limit;

        const [allocations, total] = await Promise.all([
            prisma.allocation.findMany({
                where,
                include: {
                    hostel: { select: { name: true } },
                    room: { select: { roomNumber: true } },
                    bed: { 
                        select: { 
                            bedNumber: true
                        } 
                    },
                    tenant: {
                        select: { name: true, email: true, phone: true }
                    },
                    allocatedBy: { select: { name: true } }
                },
                orderBy: { allocationDate: 'desc' },
                take: parseInt(limit),
                skip: skip
            }),
            prisma.allocation.count({ where })
        ]);

        return successResponse(res, {
            allocations,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        }, "Allocations retrieved successfully", 200);
    } catch (err) {
        console.error("Get All Allocations Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ALLOCATION BY ID
// ===================================
const getAllocationById = async (req, res) => {
    try {
        const { id } = req.params;
        const allocationId = parseInt(id);
        const allocation = await prisma.allocation.findUnique({
            where: { id: allocationId },
            include: {
                hostel: { select: { name: true, address: true } },
                floor: { select: { floorNumber: true } },
                room: { select: { roomNumber: true, roomType: true } },
                bed: { select: { bedNumber: true, bedType: true } },
                tenant: { select: { name: true, email: true, phone: true } },
                allocatedBy: { select: { name: true, email: true } }
            }
        });

        if (!allocation) {
            return errorResponse(res, "Allocation not found", 404);
        }

        return successResponse(res, allocation, "Allocation retrieved successfully", 200);
    } catch (err) {
        console.error("Get Allocation Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ACTIVE ALLOCATIONS BY HOSTEL
// ===================================
const getActiveAllocationsByHostel = async (req, res) => {
    try {
        const { hostelId } = req.params;

        const allocations = await prisma.allocation.findMany({
            where: {
                hostelId,
                status: 'active'
            },
            include: {
                room: { select: { roomNumber: true } },
                bed: { select: { bedNumber: true } },
                tenant: { select: { name: true, email: true, phone: true } }
            },
            orderBy: [
                { roomId: 'asc' },
                { bedId: 'asc' }
            ]
        });

        return successResponse(res, allocations, "Active allocations retrieved successfully", 200);
    } catch (err) {
        console.error("Get Active Allocations Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE ALLOCATION
// ===================================
const updateAllocation = async (req, res) => {
    try {
        const { id } = req.params;
        const allocationId = parseInt(id);
        const updates = req.body;

        // Remove fields that shouldn't be updated directly
        delete updates.hostel;
        delete updates.hostelId;
        delete updates.floor;
        delete updates.floorId;
        delete updates.room;
        delete updates.roomId;
        delete updates.bed;
        delete updates.bedId;
        delete updates.tenant;
        delete updates.tenantId;
        delete updates.status;

        // Prepare update data
        const updateData = {};
        if (updates.rentAmount !== undefined) updateData.rentAmount = updates.rentAmount;
        if (updates.depositAmount !== undefined) updateData.depositAmount = updates.depositAmount;
        if (updates.paymentStatus) updateData.paymentStatus = updates.paymentStatus;
        if (updates.expectedCheckOutDate !== undefined) {
            updateData.expectedCheckOutDate = updates.expectedCheckOutDate ? new Date(updates.expectedCheckOutDate) : null;
        }
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.documents) updateData.documents = updates.documents;

        const allocation = await prisma.allocation.update({
            where: { id: allocationId },
            data: updateData,
            include: {
                tenant: { select: { name: true, email: true } },
                bed: { select: { bedNumber: true } },
                room: { select: { roomNumber: true } }
            }
        });

        return successResponse(res, allocation, "Allocation updated successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Allocation not found", 404);
        }
        console.error("Update Allocation Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    allocateTenant,
    checkOutTenant,
    transferTenant,
    getAllAllocations,
    getAllocationById,
    getActiveAllocationsByHostel,
    updateAllocation
};
