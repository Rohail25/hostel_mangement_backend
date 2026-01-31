// ===============================
// Allocation Controller (Tenant Management)
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

const assertAllocationAccess = async (req, allocationId) => {
    const allocation = await prisma.allocation.findUnique({
        where: { id: allocationId },
        include: {
            hostel: { select: { id: true, ownerId: true, managedBy: true } }
        }
    });

    if (!allocation) {
        return { ok: false, status: 404, message: "Allocation not found" };
    }

    if (req.userRole === 'owner' && allocation.hostel.ownerId !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this allocation" };
    }

    if (req.userRole === 'manager' && allocation.hostel.managedBy !== req.userId) {
        return { ok: false, status: 403, message: "You are not allowed to manage this allocation" };
    }

    return { ok: true, allocation };
};

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

        const hostelId = parseInt(hostel, 10);
        const floorId = parseInt(floor, 10);
        const roomId = parseInt(room, 10);
        const bedId = parseInt(bed, 10);
        const tenantId = parseInt(tenant, 10);

        // Validation
        if (!Number.isFinite(hostelId) || !Number.isFinite(floorId) || !Number.isFinite(roomId) || !Number.isFinite(bedId) || !Number.isFinite(tenantId) || !checkInDate || !rentAmount) {
            return errorResponse(
                res,
                "Hostel, floor, room, bed, tenant, check-in date, and rent amount are required",
                400
            );
        }

        // Check if tenant exists
        const tenantExists = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });
        
        if (!tenantExists) {
            return errorResponse(res, "Tenant not found", 404);
        }

        // Check if tenant status is active
        if (tenantExists.status !== 'active') {
            return errorResponse(res, `Tenant is ${tenantExists.status}, cannot allocate`, 400);
        }

        const bedAccess = await assertBedAccess(req, bedId);
        if (!bedAccess.ok) {
            return errorResponse(res, bedAccess.message, bedAccess.status);
        }

        const bedData = bedAccess.bed;
        if (bedData.hostelId !== hostelId || bedData.floorId !== floorId || bedData.roomId !== roomId) {
            return errorResponse(res, "Provided hostel/floor/room do not match the selected bed", 400);
        }

        // Check if bed exists and is available
        if (bedData.status !== 'available' && bedData.status !== 'reserved') {
            return errorResponse(res, `Bed is ${bedData.status}, cannot allocate`, 400);
        }

        // Check if tenant already has an active allocation
        const existingAllocation = await prisma.allocation.findFirst({
            where: {
                tenantId: tenantId,
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

        const rentValue = Number(rentAmount);
        if (!Number.isFinite(rentValue) || rentValue < 0) {
            return errorResponse(res, "Invalid rent amount", 400);
        }

        const depositValue = depositAmount ? Number(depositAmount) : 0;
        if (!Number.isFinite(depositValue) || depositValue < 0) {
            return errorResponse(res, "Invalid deposit amount", 400);
        }

        // Use transaction to ensure data consistency
        const allocation = await prisma.$transaction(async (tx) => {
            // Create allocation using relation connect
            const newAllocation = await tx.allocation.create({
                data: {
                    hostel: { connect: { id: hostelId } },
                    floor: { connect: { id: floorId } },
                    room: { connect: { id: roomId } },
                    bed: { connect: { id: bedId } },
                    tenant: { connect: { id: tenantId } },
                    allocatedBy: { connect: { id: req.userId } },
                    checkInDate: new Date(checkInDate),
                    expectedCheckOutDate: expectedCheckOutDate ? new Date(expectedCheckOutDate) : null,
                    rentAmount: rentValue,
                    depositAmount: depositValue,
                    notes: notes || null
                }
            });

            // Update bed status (note: currentTenantId still uses User model for backward compatibility)
            await tx.bed.update({
                where: { id: bedId },
                data: {
                    status: 'occupied'
                    // currentTenantId removed - we now use Allocation to track tenants
                }
            });

            // Update room occupied beds count
            await tx.room.update({
                where: { id: roomId },
                data: {
                    occupiedBeds: { increment: 1 }
                }
            });

            // Update floor occupied beds count
            await tx.floor.update({
                where: { id: floorId },
                data: {
                    occupiedBeds: { increment: 1 }
                }
            });

            // Update hostel occupied beds count
            await tx.hostel.update({
                where: { id: hostelId },
                data: {
                    occupiedBeds: { increment: 1 }
                }
            });

            // Check and update room status if fully occupied
            const roomData = await tx.room.findUnique({
                where: { id: roomId }
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
        const parsedAllocationId = parseInt(allocationId, 10);

        if (!Number.isFinite(parsedAllocationId)) {
            return errorResponse(res, "Invalid allocation id", 400);
        }

        const access = await assertAllocationAccess(req, parsedAllocationId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const allocation = access.allocation;

        if (allocation.status !== 'active') {
            return errorResponse(res, "Allocation is not active", 400);
        }

        // Use transaction for consistency
        await prisma.$transaction(async (tx) => {
            // Update allocation
            await tx.allocation.update({
                where: { id: parsedAllocationId },
                data: {
                    status: 'checked_out',
                    checkOutDate: checkOutDate ? new Date(checkOutDate) : new Date(),
                    notes: notes ? (allocation.notes ? `${allocation.notes}\n${notes}` : notes) : allocation.notes
                }
            });

            // Update bed
            await tx.bed.update({
                where: { id: allocation.bedId },
                data: {
                    status: 'available'
                    // currentTenantId removed - we now use Allocation to track tenants
                }
            });

            // Update counts
            await tx.room.update({
                where: { id: allocation.roomId },
                data: {
                    occupiedBeds: { decrement: 1 }
                }
            });

            await tx.floor.update({
                where: { id: allocation.floorId },
                data: {
                    occupiedBeds: { decrement: 1 }
                }
            });

            await tx.hostel.update({
                where: { id: allocation.hostelId },
                data: {
                    occupiedBeds: { decrement: 1 }
                }
            });

            // Update room status
            const roomData = await tx.room.findUnique({
                where: { id: allocation.roomId }
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
            where: { id: parsedAllocationId },
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
        const parsedAllocationId = parseInt(allocationId, 10);
        const parsedNewBedId = parseInt(newBedId, 10);

        if (!Number.isFinite(parsedAllocationId) || !Number.isFinite(parsedNewBedId)) {
            return errorResponse(res, "New bed ID is required", 400);
        }

        const access = await assertAllocationAccess(req, parsedAllocationId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const allocation = access.allocation;

        if (allocation.status !== 'active') {
            return errorResponse(res, "Can only transfer active allocations", 400);
        }

        // Check if new bed is available
        const bedAccess = await assertBedAccess(req, parsedNewBedId);
        if (!bedAccess.ok) {
            return errorResponse(res, bedAccess.message, bedAccess.status);
        }

        const newBed = await prisma.bed.findUnique({
            where: { id: parsedNewBedId },
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

        if (allocation.hostelId !== newBed.room.hostelId) {
            return errorResponse(res, "New bed must belong to the same hostel", 400);
        }

        const oldBedId = allocation.bedId;
        const oldRoomId = allocation.roomId;

        // Get tenant ID from allocation
        const tenantId = allocation.tenantId;

        // Use transaction for consistency
        await prisma.$transaction(async (tx) => {
            // Get current transfer history
            const currentAllocation = await tx.allocation.findUnique({
                where: { id: parsedAllocationId }
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
                where: { id: parsedAllocationId },
                data: {
                    bedId: parsedNewBedId,
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
                where: { id: parsedNewBedId },
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
            where: { id: parsedAllocationId },
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

        const pageNumber = parseInt(page, 10) || 1;
        const limitNumber = parseInt(limit, 10) || 20;

        const skip = (pageNumber - 1) * limitNumber;

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
                take: limitNumber,
                skip
            }),
            prisma.allocation.count({ where })
        ]);

        return successResponse(res, {
            allocations,
            pagination: {
                total,
                page: pageNumber,
                limit: limitNumber,
                pages: Math.ceil(total / limitNumber)
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
        const allocationId = parseInt(id, 10);
        if (!Number.isFinite(allocationId)) {
            return errorResponse(res, "Invalid allocation id", 400);
        }

        const access = await assertAllocationAccess(req, allocationId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

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
        const parsedHostelId = parseInt(hostelId, 10);
        if (!Number.isFinite(parsedHostelId)) {
            return errorResponse(res, "Invalid hostel id", 400);
        }

        const access = await assertHostelAccess(req, parsedHostelId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const allocations = await prisma.allocation.findMany({
            where: {
                hostelId: parsedHostelId,
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
        const allocationId = parseInt(id, 10);
        if (!Number.isFinite(allocationId)) {
            return errorResponse(res, "Invalid allocation id", 400);
        }

        const access = await assertAllocationAccess(req, allocationId);
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
        delete updates.bed;
        delete updates.bedId;
        delete updates.tenant;
        delete updates.tenantId;
        delete updates.status;

        // Prepare update data
        const updateData = {};
        if (updates.rentAmount !== undefined) {
            const rentValue = Number(updates.rentAmount);
            if (!Number.isFinite(rentValue) || rentValue < 0) {
                return errorResponse(res, "Invalid rent amount", 400);
            }
            updateData.rentAmount = rentValue;
        }
        if (updates.depositAmount !== undefined) {
            const depositValue = Number(updates.depositAmount);
            if (!Number.isFinite(depositValue) || depositValue < 0) {
                return errorResponse(res, "Invalid deposit amount", 400);
            }
            updateData.depositAmount = depositValue;
        }
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

// ===================================
// UPDATE BED ALLOCATION
// ===================================
const updateBedAllocation = async (req, res) => {
    try {
        const bedId = parseInt(req.params.id, 10);
        const { newBedId } = req.body;

        // Validation
        if (!Number.isFinite(bedId)) {
            return errorResponse(res, "Invalid bed ID", 400);
        }

        if (!Number.isFinite(parseInt(newBedId, 10))) {
            return errorResponse(res, "New bed ID is required", 400);
        }

        const newBedIdInt = parseInt(newBedId, 10);

        // Check access to current bed
        const bedAccess = await assertBedAccess(req, bedId);
        if (!bedAccess.ok) {
            return errorResponse(res, bedAccess.message, bedAccess.status);
        }

        // Check access to new bed
        const newBedAccess = await assertBedAccess(req, newBedIdInt);
        if (!newBedAccess.ok) {
            return errorResponse(res, newBedAccess.message, newBedAccess.status);
        }

        // Check if new bed is available
        const newBed = await prisma.bed.findUnique({
            where: { id: newBedIdInt },
            select: { 
                id: true, 
                status: true, 
                currentTenantId: true,
                bedNumber: true,
                room: {
                    select: {
                        roomNumber: true,
                        floor: {
                            select: { floorNumber: true }
                        }
                    }
                }
            }
        });

        if (!newBed) {
            return errorResponse(res, "New bed not found", 404);
        }

        if (newBed.status === 'occupied' && newBed.currentTenantId) {
            return errorResponse(res, "New bed is already occupied", 400);
        }

        // Get current bed details
        const currentBed = await prisma.bed.findUnique({
            where: { id: bedId },
            select: { 
                id: true, 
                currentTenantId: true,
                status: true
            }
        });

        if (!currentBed) {
            return errorResponse(res, "Current bed not found", 404);
        }

        // If current bed has a tenant, update the allocation
        if (currentBed.currentTenantId) {
            // Find active allocation for this bed
            const allocation = await prisma.allocation.findFirst({
                where: {
                    bedId: bedId,
                    status: 'active'
                }
            });

            if (allocation) {
                // Update allocation to new bed
                await prisma.allocation.update({
                    where: { id: allocation.id },
                    data: {
                        bedId: newBedIdInt,
                        roomId: newBed.room ? allocation.roomId : allocation.roomId, // Keep same room if structure exists
                    }
                });
            }

            // Update bed statuses
            await prisma.$transaction([
                // Update current bed - make it available
                prisma.bed.update({
                    where: { id: bedId },
                    data: {
                        status: 'available',
                        currentTenantId: null
                    }
                }),
                // Update new bed - make it occupied
                prisma.bed.update({
                    where: { id: newBedIdInt },
                    data: {
                        status: 'occupied',
                        currentTenantId: currentBed.currentTenantId
                    }
                })
            ]);
        } else {
            // No tenant on current bed, just update bed assignment (for future planning)
            // This case handles moving empty bed assignments
            return errorResponse(res, "Current bed has no tenant assigned", 400);
        }

        const updatedBed = await prisma.bed.findUnique({
            where: { id: newBedIdInt },
            include: {
                room: {
                    select: {
                        id: true,
                        roomNumber: true,
                        floor: {
                            select: {
                                id: true,
                                floorNumber: true,
                                floorName: true
                            }
                        }
                    }
                },
                currentTenant: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            }
        });

        return successResponse(res, updatedBed, "Bed allocation updated successfully", 200);
    } catch (err) {
        console.error("Update Bed Allocation Error:", err);
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
    updateAllocation,
    updateBedAllocation
};
