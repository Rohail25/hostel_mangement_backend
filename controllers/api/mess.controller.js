// ===============================
// Mess Management Controller
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

// ===================================
// GET ALL MESS ENTRIES BY HOSTEL
// ===================================
const getMessEntriesByHostel = async (req, res) => {
    try {
        const hostelId = parseInt(req.params.hostelId, 10);

        if (!Number.isFinite(hostelId)) {
            return errorResponse(res, "Invalid hostel ID", 400);
        }

        const access = await assertHostelAccess(req, hostelId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const messEntries = await prisma.messEntry.findMany({
            where: { hostelId: hostelId },
            orderBy: {
                day: 'asc'
            }
        });

        return successResponse(res, messEntries, "Mess entries retrieved successfully", 200);
    } catch (err) {
        console.error("Get Mess Entries Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET MESS ENTRY BY ID
// ===================================
const getMessEntryById = async (req, res) => {
    try {
        const messEntryId = parseInt(req.params.id, 10);

        if (!Number.isFinite(messEntryId)) {
            return errorResponse(res, "Invalid mess entry ID", 400);
        }

        const messEntry = await prisma.messEntry.findUnique({
            where: { id: messEntryId },
            include: {
                hostel: { select: { id: true, ownerId: true, managedBy: true } }
            }
        });

        if (!messEntry) {
            return errorResponse(res, "Mess entry not found", 404);
        }

        const access = await assertHostelAccess(req, messEntry.hostelId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        return successResponse(res, messEntry, "Mess entry retrieved successfully", 200);
    } catch (err) {
        console.error("Get Mess Entry Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// CREATE MESS ENTRY
// ===================================
const createMessEntry = async (req, res) => {
    try {
        const { hostelId, day, breakfast, lunch, dinner, price } = req.body;

        // Validation
        if (!Number.isFinite(parseInt(hostelId, 10))) {
            return errorResponse(res, "Valid hostel ID is required", 400);
        }

        if (!day || typeof day !== 'string') {
            return errorResponse(res, "Day is required and must be a string", 400);
        }

        const hostelIdInt = parseInt(hostelId, 10);

        // Check access
        const access = await assertHostelAccess(req, hostelIdInt);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        // Check if entry already exists for this day
        const existing = await prisma.messEntry.findUnique({
            where: {
                hostelId_day: {
                    hostelId: hostelIdInt,
                    day: day
                }
            }
        });

        if (existing) {
            return errorResponse(res, `Mess entry already exists for ${day}`, 400);
        }

        // Create mess entry with JSON data for meals
        const messEntry = await prisma.messEntry.create({
            data: {
                hostelId: hostelIdInt,
                day: day,
                breakfast: breakfast || null,
                lunch: lunch || null,
                dinner: dinner || null,
                price: price ? parseFloat(price) : 0
            }
        });

        return successResponse(res, messEntry, "Mess entry created successfully", 201);
    } catch (err) {
        if (err.code === 'P2002') {
            return errorResponse(res, "Mess entry already exists for this day", 400);
        }
        console.error("Create Mess Entry Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE MESS ENTRY
// ===================================
const updateMessEntry = async (req, res) => {
    try {
        const messEntryId = parseInt(req.params.id, 10);
        const { day, breakfast, lunch, dinner, price } = req.body;

        if (!Number.isFinite(messEntryId)) {
            return errorResponse(res, "Invalid mess entry ID", 400);
        }

        // Get existing entry to check access
        const existing = await prisma.messEntry.findUnique({
            where: { id: messEntryId },
            select: { hostelId: true }
        });

        if (!existing) {
            return errorResponse(res, "Mess entry not found", 404);
        }

        // Check access
        const access = await assertHostelAccess(req, existing.hostelId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        // Build update data
        const updateData = {};
        if (day !== undefined) updateData.day = day;
        if (breakfast !== undefined) updateData.breakfast = breakfast;
        if (lunch !== undefined) updateData.lunch = lunch;
        if (dinner !== undefined) updateData.dinner = dinner;
        if (price !== undefined) updateData.price = price ? parseFloat(price) : 0;

        // Update mess entry
        const messEntry = await prisma.messEntry.update({
            where: { id: messEntryId },
            data: updateData
        });

        return successResponse(res, messEntry, "Mess entry updated successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Mess entry not found", 404);
        }
        if (err.code === 'P2002') {
            return errorResponse(res, "Mess entry already exists for this day", 400);
        }
        console.error("Update Mess Entry Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// DELETE MESS ENTRY
// ===================================
const deleteMessEntry = async (req, res) => {
    try {
        const messEntryId = parseInt(req.params.id, 10);

        if (!Number.isFinite(messEntryId)) {
            return errorResponse(res, "Invalid mess entry ID", 400);
        }

        // Get entry to check access
        const existing = await prisma.messEntry.findUnique({
            where: { id: messEntryId },
            select: { hostelId: true }
        });

        if (!existing) {
            return errorResponse(res, "Mess entry not found", 404);
        }

        // Check access
        const access = await assertHostelAccess(req, existing.hostelId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        // Delete mess entry
        await prisma.messEntry.delete({
            where: { id: messEntryId }
        });

        return successResponse(res, null, "Mess entry deleted successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Mess entry not found", 404);
        }
        console.error("Delete Mess Entry Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET MESS STATS FOR HOSTEL
// ===================================
const getMessStats = async (req, res) => {
    try {
        const hostelId = parseInt(req.params.hostelId, 10);

        if (!Number.isFinite(hostelId)) {
            return errorResponse(res, "Invalid hostel ID", 400);
        }

        const access = await assertHostelAccess(req, hostelId);
        if (!access.ok) {
            return errorResponse(res, access.message, access.status);
        }

        const totalEntries = await prisma.messEntry.count({
            where: { hostelId: hostelId }
        });

        const totalPrice = await prisma.messEntry.aggregate({
            where: { hostelId: hostelId },
            _sum: { price: true }
        });

        return successResponse(res, {
            totalEntries,
            totalPrice: totalPrice._sum.price || 0,
            averagePrice: totalEntries > 0 ? (totalPrice._sum.price || 0) / totalEntries : 0
        }, "Mess stats retrieved successfully", 200);
    } catch (err) {
        console.error("Get Mess Stats Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    getMessEntriesByHostel,
    getMessEntryById,
    createMessEntry,
    updateMessEntry,
    deleteMessEntry,
    getMessStats
};
