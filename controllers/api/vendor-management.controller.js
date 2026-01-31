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
    
    // Handle file upload if present
    let attachmentData = null;
    if (req.file) {
      // File uploaded via multer
      attachmentData = [{
        name: req.file.originalname,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: req.file.path || `/uploads/${req.file.filename}`,
        uploadedAt: new Date().toISOString(),
      }];
    } else if (req.body.attachment) {
      // Handle if attachment is sent as JSON string
      try {
        attachmentData = typeof req.body.attachment === 'string' 
          ? JSON.parse(req.body.attachment) 
          : req.body.attachment;
      } catch (e) {
        attachmentData = null;
      }
    }

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
        // Handle file upload if present
        let attachmentData = existingAssignment.attachment;
        if (req.file) {
          attachmentData = [{
            name: req.file.originalname,
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            url: req.file.path || `/uploads/${req.file.filename}`,
            uploadedAt: new Date().toISOString(),
          }];
        } else if (req.body.attachment) {
          try {
            attachmentData = typeof req.body.attachment === 'string' 
              ? JSON.parse(req.body.attachment) 
              : req.body.attachment;
          } catch (e) {
            attachmentData = existingAssignment.attachment;
          }
        }
        
        const updated = await prisma.vendorServiceAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            isActive: true,
            notes: notes || existingAssignment.notes,
            attachment: attachmentData,
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
        attachment: attachmentData,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    // Map services to include 'unit' as alias for 'priceUnit' for frontend compatibility
    const mappedServices = services.map(service => ({
      ...service,
      unit: service.priceUnit, // Add unit alias
    }));

    return successResponse(res, mappedServices, 'Services retrieved successfully', 200);
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

/**
 * Create Service
 * POST /api/admin/vendor/management/services
 */
const createService = async (req, res) => {
  try {
    const { name, description, category, price, unit } = req.body;
    const userId = req.user?.id;

    if (!name || !name.trim()) {
      return errorResponse(res, 'Service name is required', 400);
    }

    // Check if service with same name already exists
    const existingService = await prisma.service.findUnique({
      where: { name: name.trim() },
    });

    if (existingService) {
      return errorResponse(res, 'Service with this name already exists', 400);
    }

    const service = await prisma.service.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        category: category?.trim() || null,
        price: parseNullableFloat(price),
        priceUnit: unit?.trim() || null,
        isActive: true,
      },
    });

    return successResponse(res, service, 'Service created successfully', 201);
  } catch (error) {
    console.error('Create Service Error:', error);
    return errorResponse(res, error.message || 'Failed to create service', 500);
  }
};

/**
 * Update Service
 * PUT /api/admin/vendor/management/services/:id
 */
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, unit, isActive } = req.body;

    const serviceId = parseInt(id, 10);
    if (isNaN(serviceId)) {
      return errorResponse(res, 'Invalid service ID', 400);
    }

    // Check if service exists
    const existingService = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!existingService) {
      return errorResponse(res, 'Service not found', 404);
    }

    // If name is being changed, check if new name already exists
    if (name && name.trim() !== existingService.name) {
      const nameExists = await prisma.service.findUnique({
        where: { name: name.trim() },
      });
      if (nameExists) {
        return errorResponse(res, 'Service with this name already exists', 400);
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (category !== undefined) updateData.category = category?.trim() || null;
    if (price !== undefined) updateData.price = parseNullableFloat(price);
    if (unit !== undefined) updateData.priceUnit = unit?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive === true || isActive === 'true';

    const service = await prisma.service.update({
      where: { id: serviceId },
      data: updateData,
    });

    return successResponse(res, service, 'Service updated successfully', 200);
  } catch (error) {
    console.error('Update Service Error:', error);
    return errorResponse(res, error.message || 'Failed to update service', 500);
  }
};

/**
 * Delete Service
 * DELETE /api/admin/vendor/management/services/:id
 */
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const serviceId = parseInt(id, 10);

    if (isNaN(serviceId)) {
      return errorResponse(res, 'Invalid service ID', 400);
    }

    // Check if service exists
    const existingService = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        vendorAssignments: {
          take: 1,
        },
      },
    });

    if (!existingService) {
      return errorResponse(res, 'Service not found', 404);
    }

    // Check if service has active assignments
    if (existingService.vendorAssignments.length > 0) {
      return errorResponse(res, 'Cannot delete service with active vendor assignments. Please remove assignments first.', 400);
    }

    await prisma.service.delete({
      where: { id: serviceId },
    });

    return successResponse(res, null, 'Service deleted successfully', 200);
  } catch (error) {
    console.error('Delete Service Error:', error);
    return errorResponse(res, error.message || 'Failed to delete service', 500);
  }
};

module.exports = {
  getServiceManagement,
  assignVendorToService,
  removeVendorAssignment,
  getAllServices,
  getAvailableVendors,
  createService,
  updateService,
  deleteService,
};

