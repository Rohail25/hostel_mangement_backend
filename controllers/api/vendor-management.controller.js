const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');

/**
 * =====================================================
 * VENDOR MANAGEMENT CONTROLLER - Service Assignments
 * =====================================================
 *
 * Manages vendor-service assignments for hostels
 */

const parseNullableInt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseNullableFloat = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * GET /api/admin/vendor/management
 * Get all services with their assigned vendors
 */
const getServiceManagement = async (req, res) => {
  try {
    const { hostelId, search, page = 1, limit = 50 } = req.query;
    const parsedHostelId = parseNullableInt(hostelId);
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 50;
    const skip = (pageNumber - 1) * limitNumber;

    // Build where clause for services
    const serviceWhere = {
      isActive: true,
    };

    if (search) {
      const searchTerm = search.trim();
      serviceWhere.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Build where clause for assignments
    const assignmentWhere = {
      isActive: true,
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    // Get services with their assignments
    const [services, totalServices] = await Promise.all([
      prisma.service.findMany({
        where: serviceWhere,
        include: {
          vendorAssignments: {
            where: assignmentWhere,
            include: {
              vendor: {
                select: {
                  id: true,
                  name: true,
                  companyName: true,
                  email: true,
                  phone: true,
                  status: true,
                },
              },
              hostel: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limitNumber,
      }),
      prisma.service.count({ where: serviceWhere }),
    ]);

    // Format response
    const formattedServices = services.map((service) => {
      const assignments = service.vendorAssignments || [];
      const vendorCount = assignments.length;
      const vendorNames = assignments.map((assignment) => assignment.vendor.name).join(', ');
      const hostels = assignments
        .map((assignment) => assignment.hostel?.name)
        .filter(Boolean)
        .join(', ');

      return {
        id: service.id,
        serviceName: service.name,
        description: service.description || null,
        category: service.category || null,
        price: service.price || null,
        priceUnit: service.priceUnit || null,
        priceDisplay: service.price
          ? `$${service.price.toFixed(2)}${service.priceUnit ? ` (${service.priceUnit})` : ''}`
          : null,
        vendorCount,
        vendorNames: vendorNames || null,
        hostels: hostels || null,
        assignments: assignments.map((assignment) => ({
          id: assignment.id,
          vendor: {
            id: assignment.vendor.id,
            name: assignment.vendor.name,
            companyName: assignment.vendor.companyName,
            email: assignment.vendor.email,
            phone: assignment.vendor.phone,
            status: assignment.vendor.status,
          },
          hostel: assignment.hostel
            ? {
                id: assignment.hostel.id,
                name: assignment.hostel.name,
              }
            : null,
          notes: assignment.notes,
          createdAt: assignment.createdAt,
        })),
      };
    });

    return successResponse(
      res,
      {
        items: formattedServices,
        total: totalServices,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          pages: Math.ceil(totalServices / limitNumber),
        },
        meta: {
          hostelId: parsedHostelId,
          search: search || null,
        },
      },
      'Service management data retrieved successfully',
    );
  } catch (error) {
    console.error('Get Service Management Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch service management data', 500);
  }
};

/**
 * POST /api/admin/vendor/management/assign
 * Assign a vendor to a service for a hostel
 */
const assignVendorToService = async (req, res) => {
  try {
    const { serviceId, vendorId, hostelId, notes } = req.body;

    if (!serviceId || !vendorId) {
      return errorResponse(res, 'Service ID and Vendor ID are required', 400);
    }

    const parsedServiceId = parseNullableInt(serviceId);
    const parsedVendorId = parseNullableInt(vendorId);
    const parsedHostelId = parseNullableInt(hostelId);

    if (!parsedServiceId || !parsedVendorId) {
      return errorResponse(res, 'Invalid Service ID or Vendor ID', 400);
    }

    // Verify service exists
    const service = await prisma.service.findUnique({
      where: { id: parsedServiceId },
    });

    if (!service) {
      return errorResponse(res, 'Service not found', 404);
    }

    // Verify vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: parsedVendorId },
    });

    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    // Verify hostel exists if provided
    if (parsedHostelId) {
      const hostel = await prisma.hostel.findUnique({
        where: { id: parsedHostelId },
      });

      if (!hostel) {
        return errorResponse(res, 'Hostel not found', 404);
      }
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.vendorServiceAssignment.findUnique({
      where: {
        serviceId_vendorId_hostelId: {
          serviceId: parsedServiceId,
          vendorId: parsedVendorId,
          hostelId: parsedHostelId,
        },
      },
    });

    if (existingAssignment) {
      // If exists but inactive, reactivate it
      if (!existingAssignment.isActive) {
        const updated = await prisma.vendorServiceAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            isActive: true,
            notes: notes || existingAssignment.notes,
            updatedAt: new Date(),
          },
          include: {
            service: {
              select: {
                id: true,
                name: true,
              },
            },
            vendor: {
              select: {
                id: true,
                name: true,
                companyName: true,
              },
            },
            hostel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        return successResponse(
          res,
          {
            id: updated.id,
            service: updated.service,
            vendor: updated.vendor,
            hostel: updated.hostel,
            notes: updated.notes,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
          'Vendor assignment reactivated successfully',
          200,
        );
      }

      return errorResponse(res, 'Vendor is already assigned to this service for this hostel', 409);
    }

    // Create new assignment
    const assignment = await prisma.vendorServiceAssignment.create({
      data: {
        serviceId: parsedServiceId,
        vendorId: parsedVendorId,
        hostelId: parsedHostelId,
        notes: notes || null,
        isActive: true,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        hostel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return successResponse(
      res,
      {
        id: assignment.id,
        service: assignment.service,
        vendor: assignment.vendor,
        hostel: assignment.hostel,
        notes: assignment.notes,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
      },
      'Vendor assigned to service successfully',
      201,
    );
  } catch (error) {
    console.error('Assign Vendor to Service Error:', error);
    if (error.code === 'P2002') {
      return errorResponse(res, 'Vendor is already assigned to this service for this hostel', 409);
    }
    return errorResponse(res, error.message || 'Failed to assign vendor to service', 500);
  }
};

/**
 * DELETE /api/admin/vendor/management/assign/:id
 * Remove a vendor assignment from a service
 */
const removeVendorAssignment = async (req, res) => {
  try {
    const assignmentId = parseNullableInt(req.params.id);

    if (!assignmentId) {
      return errorResponse(res, 'Valid assignment ID is required', 400);
    }

    const assignment = await prisma.vendorServiceAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return errorResponse(res, 'Assignment not found', 404);
    }

    // Soft delete by setting isActive to false
    await prisma.vendorServiceAssignment.update({
      where: { id: assignmentId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return successResponse(res, null, 'Vendor assignment removed successfully', 200);
  } catch (error) {
    console.error('Remove Vendor Assignment Error:', error);
    return errorResponse(res, error.message || 'Failed to remove vendor assignment', 500);
  }
};

/**
 * GET /api/admin/vendor/management/services
 * Get all available services
 */
const getAllServices = async (req, res) => {
  try {
    const { search, category, isActive = true } = req.query;

    const where = {
      ...(isActive !== undefined ? { isActive: isActive === 'true' || isActive === true } : {}),
    };

    if (search) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        price: true,
        priceUnit: true,
        isActive: true,
      },
    });

    return successResponse(res, services, 'Services retrieved successfully', 200);
  } catch (error) {
    console.error('Get All Services Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch services', 500);
  }
};

/**
 * GET /api/admin/vendor/management/vendors
 * Get all available vendors for assignment
 */
const getAvailableVendors = async (req, res) => {
  try {
    const { search, hostelId, status = 'active' } = req.query;
    const parsedHostelId = parseNullableInt(hostelId);

    const where = {
      status: status === 'all' ? undefined : status,
    };

    if (parsedHostelId) {
      where.OR = [{ hostelId: parsedHostelId }, { hostelId: null }];
    }

    if (search) {
      const searchTerm = search.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { companyName: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
        status: true,
        category: true,
        hostel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return successResponse(res, vendors, 'Vendors retrieved successfully', 200);
  } catch (error) {
    console.error('Get Available Vendors Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch vendors', 500);
  }
};

module.exports = {
  getServiceManagement,
  assignVendorToService,
  removeVendorAssignment,
  getAllServices,
  getAvailableVendors,
};

