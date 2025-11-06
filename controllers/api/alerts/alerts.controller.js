const { prisma } = require('../../../config/db');
const { successResponse, errorResponse } = require('../../../Helper/helper');

/**
 * =====================================================
 * ALERTS CONTROLLER - Dashboard Alerts Management
 * =====================================================
 * 
 * Provides alerts listing, summary, and management
 * for the Alerts dashboard
 */

// Helper function to format date as "Mon Day, Year"
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

// Helper function to map priority to severity
const getSeverity = (priority) => {
  const priorityMap = {
    'urgent': 'DANGER',
    'high': 'WARN',
    'medium': 'INFO',
    'low': 'INFO'
  };
  return priorityMap[priority] || 'INFO';
};

// Helper function to map priority to summary card type
const getPriorityCategory = (priority) => {
  if (priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warning';
  return 'info';
};

/**
 * GET /api/admin/alerts/list
 * Get all alerts formatted for dashboard
 * ?type=bill|maintenance &status=pending|in_progress|resolved|dismissed &priority=low|medium|high|urgent
 * &hostelId= &search= &page= &limit=
 */
const listAlerts = async (req, res) => {
  try {
    const { type, status, priority, hostelId, search, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build filter object
    const where = {};
    
    if (type) {
      // For dashboard tabs: 'bill' includes bill, rent, payable, receivable
      if (type === 'bill') {
        where.type = { in: ['bill', 'rent', 'payable', 'receivable'] };
      } else if (type === 'maintenance') {
        where.type = 'maintenance';
      } else {
        where.type = type;
      }
    }
    
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (hostelId) where.hostelId = parseInt(hostelId);

    // Get total count before search filter
    const total = await prisma.alert.count({ where });

    // Get alerts with relations
    let alerts = await prisma.alert.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        hostel: { select: { id: true, name: true } },
        room: { select: { id: true, roomNumber: true } },
        tenant: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } }
      }
    });

    // Apply search filter if provided (post-processing for title, description, tenant name)
    if (search) {
      const searchLower = search.toLowerCase();
      alerts = alerts.filter(alert => {
        const titleMatch = alert.title?.toLowerCase().includes(searchLower);
        const descMatch = alert.description?.toLowerCase().includes(searchLower);
        const tenantMatch = alert.tenant?.name?.toLowerCase().includes(searchLower);
        return titleMatch || descMatch || tenantMatch;
      });
    }

    // Format alerts for dashboard
    const formattedAlerts = alerts.map(alert => ({
      id: alert.id,
      severity: getSeverity(alert.priority || 'medium'),
      title: alert.title,
      description: alert.description || '',
      assignedTo: alert.assignedTo?.name || 'Unassigned',
      created: formatDate(alert.createdAt),
      status: alert.status || 'pending',
      priority: alert.priority || 'medium',
      type: alert.type,
      hostel: alert.hostel?.name || null,
      room: alert.room?.roomNumber || null,
      tenant: alert.tenant?.name || null
    }));

    return successResponse(res, {
      alerts: formattedAlerts,
      pagination: {
        total: search ? formattedAlerts.length : total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((search ? formattedAlerts.length : total) / parseInt(limit))
      }
    }, 'Alerts fetched successfully', 200);

  } catch (error) {
    console.error('List Alerts Error:', error);
    return errorResponse(res, 'Failed to fetch alerts', 500);
  }
};

/**
 * GET /api/admin/alerts/summary
 * Get alert summary cards (Danger, Warning, Info counts)
 */
const getAlertsSummary = async (req, res) => {
  try {
    const { hostelId, type } = req.query;

    // Build filter
    const where = {};
    if (hostelId) where.hostelId = parseInt(hostelId);
    if (type) {
      if (type === 'bill') {
        where.type = { in: ['bill', 'rent', 'payable', 'receivable'] };
      } else if (type === 'maintenance') {
        where.type = 'maintenance';
      } else {
        where.type = type;
      }
    }

    // Get all alerts for counting
    const alerts = await prisma.alert.findMany({
      where,
      select: { priority: true }
    });

    // Count by priority category
    let danger = 0; // urgent
    let warning = 0; // high
    let info = 0; // medium + low

    alerts.forEach(alert => {
      const priority = alert.priority || 'medium';
      if (priority === 'urgent') danger++;
      else if (priority === 'high') warning++;
      else info++;
    });

    return successResponse(res, {
      danger,
      warning,
      info
    }, 'Alert summary fetched successfully', 200);

  } catch (error) {
    console.error('Get Alerts Summary Error:', error);
    return errorResponse(res, 'Failed to fetch alert summary', 500);
  }
};

/**
 * GET /api/admin/alerts/tabs
 * Get alert counts by type for tabs (Bills, Maintenance)
 */
const getAlertsTabs = async (req, res) => {
  try {
    const { hostelId } = req.query;

    const where = hostelId ? { hostelId: parseInt(hostelId) } : {};

    // Count bills (bill, rent, payable, receivable)
    const billsCount = await prisma.alert.count({
      where: {
        ...where,
        type: { in: ['bill', 'rent', 'payable', 'receivable'] }
      }
    });

    // Count maintenance
    const maintenanceCount = await prisma.alert.count({
      where: {
        ...where,
        type: 'maintenance'
      }
    });

    return successResponse(res, {
      bills: billsCount,
      maintenance: maintenanceCount
    }, 'Alert tabs fetched successfully', 200);

  } catch (error) {
    console.error('Get Alerts Tabs Error:', error);
    return errorResponse(res, 'Failed to fetch alert tabs', 500);
  }
};

/**
 * GET /api/admin/alerts/:id
 * Get single alert details
 */
const getAlertById = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({
      where: { id: parseInt(id) },
      include: {
        hostel: { select: { id: true, name: true } },
        room: { select: { id: true, roomNumber: true } },
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        resolver: { select: { id: true, name: true, email: true } }
      }
    });

    if (!alert) {
      return errorResponse(res, 'Alert not found', 404);
    }

    // Format alert for dashboard
    const formattedAlert = {
      id: alert.id,
      type: alert.type,
      priority: alert.priority || 'medium',
      severity: getSeverity(alert.priority || 'medium'),
      title: alert.title,
      description: alert.description || '',
      status: alert.status || 'pending',
      maintenanceType: alert.maintenanceType || null,
      assignedTo: alert.assignedTo ? {
        id: alert.assignedTo.id,
        name: alert.assignedTo.name,
        email: alert.assignedTo.email
      } : null,
      created: formatDate(alert.createdAt),
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
      hostel: alert.hostel ? {
        id: alert.hostel.id,
        name: alert.hostel.name
      } : null,
      room: alert.room ? {
        id: alert.room.id,
        roomNumber: alert.room.roomNumber
      } : null,
      tenant: alert.tenant ? {
        id: alert.tenant.id,
        name: alert.tenant.name,
        email: alert.tenant.email,
        phone: alert.tenant.phone
      } : null,
      creator: alert.creator ? {
        id: alert.creator.id,
        name: alert.creator.name,
        email: alert.creator.email
      } : null,
      resolver: alert.resolver ? {
        id: alert.resolver.id,
        name: alert.resolver.name,
        email: alert.resolver.email
      } : null,
      amount: alert.amount || null,
      dueDate: alert.dueDate ? formatDate(alert.dueDate) : null,
      resolvedAt: alert.resolvedAt ? formatDate(alert.resolvedAt) : null,
      remarks: alert.remarks || null
    };

    return successResponse(res, formattedAlert, 'Alert fetched successfully', 200);

  } catch (error) {
    console.error('Get Alert By ID Error:', error);
    return errorResponse(res, 'Failed to fetch alert', 500);
  }
};

/**
 * POST /api/admin/alerts
 * Create a new alert
 */
const createAlert = async (req, res) => {
  try {
    const {
      type,
      priority,
      title,
      description,
      maintenanceType,
      hostelId,
      roomId,
      tenantId,
      allocationId,
      paymentId,
      amount,
      dueDate,
      assignedTo,
      metadata,
      attachments,
      remarks
    } = req.body;

    // Validation
    if (!type || !title) {
      return errorResponse(res, 'Alert type and title are required', 400);
    }

    // Validate type
    const validTypes = ['bill', 'rent', 'payable', 'receivable', 'maintenance'];
    if (!validTypes.includes(type)) {
      return errorResponse(res, `Invalid alert type. Must be one of: ${validTypes.join(', ')}`, 400);
    }

    // If type is maintenance, maintenanceType is required
    if (type === 'maintenance' && !maintenanceType) {
      return errorResponse(res, 'maintenanceType is required for maintenance alerts (room_cleaning, repairs, purchase_demand)', 400);
    }

    // Validate maintenanceType if provided
    if (maintenanceType) {
      const validMaintenanceTypes = ['room_cleaning', 'repairs', 'purchase_demand'];
      if (!validMaintenanceTypes.includes(maintenanceType)) {
        return errorResponse(res, `Invalid maintenance type. Must be one of: ${validMaintenanceTypes.join(', ')}`, 400);
      }
    }

    // Get creator ID from authenticated user
    const createdBy = req.user?.id || null;

    // Create alert
    const alert = await prisma.alert.create({
      data: {
        type,
        status: 'pending',
        priority: priority || 'medium',
        title,
        description,
        maintenanceType: type === 'maintenance' ? maintenanceType : null,
        hostelId: hostelId ? parseInt(hostelId) : null,
        roomId: roomId ? parseInt(roomId) : null,
        tenantId: tenantId ? parseInt(tenantId) : null,
        allocationId: allocationId ? parseInt(allocationId) : null,
        paymentId: paymentId ? parseInt(paymentId) : null,
        amount: amount ? parseFloat(amount) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedTo: assignedTo ? parseInt(assignedTo) : null,
        createdBy,
        metadata: metadata || null,
        attachments: attachments || null,
        remarks
      },
      include: {
        hostel: { select: { id: true, name: true } },
        room: { select: { id: true, roomNumber: true } },
        tenant: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } }
      }
    });

    return successResponse(res, alert, 'Alert created successfully', 201);

  } catch (error) {
    console.error('Create Alert Error:', error);
    return errorResponse(res, 'Failed to create alert', 500);
  }
};

/**
 * PUT /api/admin/alerts/:id
 * Update an alert
 */
const updateAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      status,
      priority,
      title,
      description,
      maintenanceType,
      hostelId,
      roomId,
      tenantId,
      allocationId,
      paymentId,
      amount,
      dueDate,
      assignedTo,
      metadata,
      attachments,
      remarks
    } = req.body;

    // Check if alert exists
    const existingAlert = await prisma.alert.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingAlert) {
      return errorResponse(res, 'Alert not found', 404);
    }

    // Build update data
    const updateData = {};

    if (type) updateData.type = type;
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (maintenanceType !== undefined) updateData.maintenanceType = maintenanceType;
    if (hostelId !== undefined) updateData.hostelId = hostelId ? parseInt(hostelId) : null;
    if (roomId !== undefined) updateData.roomId = roomId ? parseInt(roomId) : null;
    if (tenantId !== undefined) updateData.tenantId = tenantId ? parseInt(tenantId) : null;
    if (allocationId !== undefined) updateData.allocationId = allocationId ? parseInt(allocationId) : null;
    if (paymentId !== undefined) updateData.paymentId = paymentId ? parseInt(paymentId) : null;
    if (amount !== undefined) updateData.amount = amount ? parseFloat(amount) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo ? parseInt(assignedTo) : null;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (attachments !== undefined) updateData.attachments = attachments;
    if (remarks !== undefined) updateData.remarks = remarks;

    // Update alert
    const alert = await prisma.alert.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        hostel: { select: { id: true, name: true } },
        room: { select: { id: true, roomNumber: true } },
        tenant: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        resolver: { select: { id: true, name: true } }
      }
    });

    return successResponse(res, alert, 'Alert updated successfully', 200);

  } catch (error) {
    console.error('Update Alert Error:', error);
    return errorResponse(res, 'Failed to update alert', 500);
  }
};

/**
 * PUT /api/admin/alerts/:id/status
 * Update alert status
 */
const updateAlertStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    // Check if alert exists
    const existingAlert = await prisma.alert.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingAlert) {
      return errorResponse(res, 'Alert not found', 404);
    }

    // Build update data
    const updateData = { status };

    // If status is resolved, add resolvedBy and resolvedAt
    if (status === 'resolved') {
      updateData.resolvedBy = req.user?.id || null;
      updateData.resolvedAt = new Date();
    }

    if (remarks) {
      updateData.remarks = remarks;
    }

    // Update alert
    const alert = await prisma.alert.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        hostel: { select: { id: true, name: true } },
        room: { select: { id: true, roomNumber: true } },
        tenant: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        resolver: { select: { id: true, name: true } }
      }
    });

    return successResponse(res, alert, `Alert status updated to ${status}`, 200);

  } catch (error) {
    console.error('Update Alert Status Error:', error);
    return errorResponse(res, 'Failed to update alert status', 500);
  }
};

/**
 * PUT /api/admin/alerts/:id/assign
 * Assign alert to a user
 */
const assignAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return errorResponse(res, 'assignedTo (user ID) is required', 400);
    }

    // Check if alert exists
    const existingAlert = await prisma.alert.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingAlert) {
      return errorResponse(res, 'Alert not found', 404);
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(assignedTo) }
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Update alert
    const alert = await prisma.alert.update({
      where: { id: parseInt(id) },
      data: {
        assignedTo: parseInt(assignedTo),
        status: existingAlert.status === 'pending' ? 'in_progress' : existingAlert.status
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        hostel: { select: { id: true, name: true } },
        room: { select: { id: true, roomNumber: true } }
      }
    });

    return successResponse(res, alert, `Alert assigned to ${user.name}`, 200);

  } catch (error) {
    console.error('Assign Alert Error:', error);
    return errorResponse(res, 'Failed to assign alert', 500);
  }
};

/**
 * DELETE /api/admin/alerts/:id
 * Delete an alert
 */
const deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if alert exists
    const existingAlert = await prisma.alert.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingAlert) {
      return errorResponse(res, 'Alert not found', 404);
    }

    // Delete alert
    await prisma.alert.delete({
      where: { id: parseInt(id) }
    });

    return successResponse(res, null, 'Alert deleted successfully', 200);

  } catch (error) {
    console.error('Delete Alert Error:', error);
    return errorResponse(res, 'Failed to delete alert', 500);
  }
};

module.exports = {
  listAlerts,
  getAlertsSummary,
  getAlertsTabs,
  getAlertById,
  createAlert,
  updateAlert,
  updateAlertStatus,
  assignAlert,
  deleteAlert
};

