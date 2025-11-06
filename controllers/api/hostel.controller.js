// ===============================
// Hostel Controller
// ===============================

const { parse } = require('dotenv');
const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');

// ===================================
// CREATE HOSTEL
// ===================================
const createHostel = async (req, res) => {
    try {
        const {
            name,
            address,
            description,
            amenities,
            contactInfo,
            operatingHours,
            images
        } = req.body;

        // Validation
        if (!name || !address?.city || !address?.country) {
            return errorResponse(res, "Name, city, and country are required", 400);
        }
        const hostelExists = await prisma.hostel.findFirst({
            where: {
                name: name
            }
        });
        if (hostelExists) {
            return errorResponse(res, "Hostel already exists", 400);
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
                    zipCode: address.zipCode || null
                },
                description: description || null,
                amenities: amenities || [],
                contactInfo: contactInfo ? {
                    phone: contactInfo.phone || null,
                    email: contactInfo.email || null,
                    emergencyContact: contactInfo.emergencyContact || null
                } : null,
                operatingHours: operatingHours ? {
                    checkIn: operatingHours.checkIn || '12:00 PM',
                    checkOut: operatingHours.checkOut || '11:00 AM'
                } : null,
                images: images || [],
                managedBy: req.userId // From auth middleware
            },
            include: {
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        return successResponse(res, hostel, "Hostel created successfully", 201);
    } catch (err) {
        console.error("Create Hostel Error:", err);
        return errorResponse(res, err.message, 400);
    }
};
 
// ===================================
// GET ALL HOSTELS
// ===================================
const getAllHostels = async (req, res) => {
    try {
        const { status, city, page = 1, limit = 10 } = req.query;

        // Build filter
        const where = {};
        if (status) where.status = status;
        if (city) {
            where.address = {
                is: {
                    city: { contains: city, mode: 'insensitive' }
                }
            };
        }

        // Pagination
        const skip = (page - 1) * limit;

        const [hostels, total] = await Promise.all([
            prisma.hostel.findMany({
                where,
                include: {
                    manager: {
                        select: {
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip: skip
            }),
            prisma.hostel.count({ where })
        ]);

        return successResponse(res, {
            hostels,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        }, "Hostels retrieved successfully", 200);
    } catch (err) {
        console.error("Get All Hostels Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET HOSTEL BY ID
// ===================================
const getHostelById = async (req, res) => {
    try {
        const { id } = req.params;
        const hostelId = parseInt(id,10);
        const hostel = await prisma.hostel.findFirst({
            where: { 
                id: hostelId
             },
            include: {
                manager: {
                    select: {
                        name: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        if (!hostel) {
            return errorResponse(res, "Hostel not found", 404);
        }

        // Get additional statistics
        const [floors, rooms] = await Promise.all([
            prisma.floor.count({ where: { hostelId: hostelId } }),
            prisma.room.count({ where: { hostelId: hostelId } })
        ]);

        const hostelData = {
            ...hostel,
            statistics: {
                totalFloors: floors,
                totalRooms: rooms,
                occupancyRate: hostel.totalBeds > 0 
                    ? ((hostel.occupiedBeds / hostel.totalBeds) * 100).toFixed(2) 
                    : 0
            }
        };

        return successResponse(res, hostelData, "Hostel retrieved successfully", 200);
    } catch (err) {
        console.error("Get Hostel Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE HOSTEL
// ===================================
const updateHostel = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const hostelId = parseInt(id,10);
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
                zipCode: updates.address.zipCode || null
            };
        }
        
        if (updates.contactInfo) {
            updateData.contactInfo = {
                phone: updates.contactInfo.phone || null,
                email: updates.contactInfo.email || null,
                emergencyContact: updates.contactInfo.emergencyContact || null
            };
        }
        
        if (updates.operatingHours) {
            updateData.operatingHours = {
                checkIn: updates.operatingHours.checkIn || null,
                checkOut: updates.operatingHours.checkOut || null
            };
        }
        
        if (updates.images) updateData.images = updates.images;

        const hostel = await prisma.hostel.update({
            where: { id: hostelId },
            data: updateData,
            include: {
                manager: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        return successResponse(res, hostel, "Hostel updated successfully", 200);
    } catch (err) {
        console.error("Update Hostel Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// DELETE HOSTEL
// ===================================
const deleteHostel = async (req, res) => {
    try {
        const { id } = req.params;
        const hostelId = parseInt(id,10);

        // Check if hostel has any floors/rooms
        const floorCount = await prisma.floor.count({ where: { hostelId: hostelId } });
        if (floorCount > 0) {
            return errorResponse(
                res, 
                "Cannot delete hostel with existing floors. Please delete all floors first.", 
                400
            );
        }

        const hostel = await prisma.hostel.delete({
            where: { id: hostelId }
        });

        return successResponse(res, { id }, "Hostel deleted successfully", 200);
    } catch (err) {
        if (err.code === 'P2025') {
            return errorResponse(res, "Hostel not found", 404);
        }
        console.error("Delete Hostel Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET HOSTEL DASHBOARD STATS
// ===================================
const getHostelStats = async (req, res) => {
    try {
        const { id } = req.params;
        const hostelId = parseInt(id,10);
        const hostel = await prisma.hostel.findUnique({
            where: { id: hostelId }
        });
        
        if (!hostel) {
            return errorResponse(res, "Hostel not found", 404);
        }

        // Get detailed statistics
        const [floors, rooms, vacantRooms, occupiedRooms, maintenanceRooms] = await Promise.all([
            prisma.floor.count({ where: { hostelId: hostelId, status: 'active' } }),
            prisma.room.count({ where: { hostelId: hostelId } }),
            prisma.room.count({ where: { hostelId: hostelId, status: 'vacant' } }),
            prisma.room.count({ where: { hostelId: hostelId, status: 'occupied' } }),
            prisma.room.count({ where: { hostelId: hostelId, status: 'under_maintenance' } })
        ]);

        const stats = {
            hostelInfo: {
                name: hostel.name,
                status: hostel.status,
                totalFloors: floors,
                totalRooms: rooms
            },
            bedStatistics: {
                totalBeds: hostel.totalBeds,
                occupiedBeds: hostel.occupiedBeds,
                availableBeds: hostel.totalBeds - hostel.occupiedBeds,
                occupancyRate: hostel.totalBeds > 0 
                    ? ((hostel.occupiedBeds / hostel.totalBeds) * 100).toFixed(2) 
                    : 0
            },
            roomStatistics: {
                total: rooms,
                vacant: vacantRooms,
                occupied: occupiedRooms,
                underMaintenance: maintenanceRooms
            }
        };

        return successResponse(res, stats, "Hostel statistics retrieved successfully", 200);
    } catch (err) {
        console.error("Get Hostel Stats Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    createHostel,
    getAllHostels,
    getHostelById,
    updateHostel,
    deleteHostel,
    getHostelStats
};
