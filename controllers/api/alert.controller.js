const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');

/**
 * =====================================================
 * ALERT CONTROLLER - Complete Alert Management System
 * =====================================================
 * 
 * Alert Types:
 * 1. bill - General bill alerts
 * 2. rent - Rent due alerts
 * 3. payable - Payment obligations
 * 4. receivable - Payments to be received
 * 5. maintenance - Room cleaning, repairs, purchase demands
 * 
 * Maintenance Subtypes:
 * - room_cleaning
 * - repairs
 * - purchase_demand
 */

// Helper function to format date as "Mon Day, Year"
const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

// Helper function to map priority to severity (for frontend display)
const getSeverity = (priority) => {
    const priorityMap = {
        'urgent': 'DANGER',
        'high': 'WARN',
        'medium': 'INFO',
        'low': 'INFO'
    };
    return priorityMap[priority] || 'INFO';
};

// Helper function to map severity to priority (for backend storage)
const getPriorityFromSeverity = (severity) => {
    const severityMap = {
        'DANGER': 'urgent',
        'WARN': 'high',
        'WARNING': 'high',
        'INFO': 'medium',
        'LOW': 'low'
    };
    return severityMap[severity?.toUpperCase()] || 'medium';
};

// Helper function to map status to display format (open/closed)
const getStatusDisplay = (status) => {
    const statusMap = {
        'pending': 'open',
        'in_progress': 'open',
        'resolved': 'closed',
        'dismissed': 'closed'
    };
    return statusMap[status] || 'open';
};

// Helper function to get user display name
const getUserDisplayName = (user) => {
    if (!user) return 'Unassigned';
    // Use username as display name (primary identifier)
    // Format: "FirstName LastName" or "username" or "email"
    if (user.username) {
        // If username contains space or looks like a name, use it directly
        if (user.username.includes(' ') || /^[A-Z][a-z]+/.test(user.username)) {
            return user.username;
        }
        return user.username;
    }
    return user.email || 'Unassigned';
};

// Helper function to find user by name or ID
const findUserForAssignment = async (assignedTo) => {
    if (!assignedTo) return null;
    
    // If it's a number, treat as user ID
    const userId = parseInt(assignedTo);
    if (!isNaN(userId)) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true }
        });
        return user?.id || null;
    }
    
    // If it's a string, search by username or email
    const searchTerm = String(assignedTo).trim();
    if (!searchTerm) return null;
    
    // Try to find user by username (case-insensitive partial match)
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { username: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } }
            ]
        },
        select: { id: true, username: true, email: true }
    });
    
    return user?.id || null;
};

// Helper function to build search clause
const buildSearchClause = (searchTerm) => {
    if (!searchTerm) return null;
    const value = searchTerm.trim();
    if (!value) return null;

    return {
        OR: [
            { title: { contains: value, mode: 'insensitive' } },
            { description: { contains: value, mode: 'insensitive' } },
            { tenant: { name: { contains: value, mode: 'insensitive' } } },
            { tenant: { email: { contains: value, mode: 'insensitive' } } },
        ],
    };
};

/**
 * @route   POST /api/admin/alerts
 * @desc    Create a new alert
 * @access  Admin/Manager
 */
const createAlert = async (req, res) => {
    try {
        const {
            type,
            priority,
            severity, // Accept severity from frontend (DANGER, WARN, INFO)
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
            assignedTo, // Can be user ID (number) or name string (e.g., "David Kim")
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

        // Determine priority: use severity if provided, otherwise use priority, default to medium
        let finalPriority = 'medium';
        if (severity) {
            finalPriority = getPriorityFromSeverity(severity);
        } else if (priority) {
            const validPriorities = ['low', 'medium', 'high', 'urgent'];
            if (validPriorities.includes(priority)) {
                finalPriority = priority;
            }
        }

        // Get creator ID from authenticated user
        const createdBy = req.user?.id || null;

        // Find user for assignment (can be ID or name string)
        let assignedToUserId = null;
        if (assignedTo) {
            assignedToUserId = await findUserForAssignment(assignedTo);
            // If name provided but user not found, still allow creation (will be unassigned)
            // Optionally, you can return an error here if strict validation is needed
        }

        // Create alert
        const alert = await prisma.alert.create({
            data: {
                type,
                status: 'pending',
                priority: finalPriority,
                title,
                description: description || null,
                maintenanceType: type === 'maintenance' ? maintenanceType : null,
                hostelId: hostelId ? parseInt(hostelId) : null,
                roomId: roomId ? parseInt(roomId) : null,
                tenantId: tenantId ? parseInt(tenantId) : null,
                allocationId: allocationId ? parseInt(allocationId) : null,
                paymentId: paymentId ? parseInt(paymentId) : null,
                amount: amount ? parseFloat(amount) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                assignedTo: assignedToUserId,
                createdBy,
                metadata: metadata ? (typeof metadata === 'string' ? (() => { try { return JSON.parse(metadata); } catch { return metadata; } })() : metadata) : null,
                attachments: attachments ? (typeof attachments === 'string' ? (() => { try { return JSON.parse(attachments); } catch { return attachments; } })() : attachments) : null,
                remarks: remarks || null
            },
            include: {
                hostel: { select: { id: true, name: true } },
                room: { select: { id: true, roomNumber: true } },
                tenant: { select: { id: true, name: true, phone: true } },
                assignedUser: { select: { id: true, username: true, email: true } },
                creator: { select: { id: true, username: true } }
            }
        });

        // Format alert for response
        const formattedAlert = {
            id: alert.id,
            type: alert.type,
            priority: alert.priority || 'medium',
            severity: getSeverity(alert.priority || 'medium'),
            title: alert.title,
            description: alert.description || '',
            status: getStatusDisplay(alert.status || 'pending'),
            rawStatus: alert.status || 'pending',
            maintenanceType: alert.maintenanceType || null,
            assignedTo: getUserDisplayName(alert.assignedUser),
            created: formatDate(alert.createdAt),
            createdAt: alert.createdAt.toISOString(),
            updatedAt: alert.updatedAt.toISOString(),
            hostel: alert.hostel?.name || null,
            room: alert.room?.roomNumber || null,
            tenant: alert.tenant?.name || null,
            amount: alert.amount || null,
            dueDate: alert.dueDate ? formatDate(alert.dueDate) : null,
            // Include full user object for detailed view
            assignedUser: alert.assignedUser ? {
                id: alert.assignedUser.id,
                name: getUserDisplayName(alert.assignedUser),
                username: alert.assignedUser.username,
                email: alert.assignedUser.email
            } : null
        };

        return successResponse(res, formattedAlert, 'Alert created successfully', 201);

    } catch (error) {
        console.error('Create Alert Error:', error);
        return errorResponse(res, 'Failed to create alert', 500);
    }
};

/**
 * @route   GET /api/admin/alerts
 * @desc    Get all alerts with filters
 * @access  Admin/Manager
 * 
 * Query params:
 * - type: bill|maintenance|rent|payable|receivable (bill includes bill, rent, payable, receivable)
 * - status: pending|in_progress|resolved|dismissed|open|closed
 * - priority: low|medium|high|urgent
 * - severity: DANGER|WARN|INFO (maps to priority)
 * - hostelId: number
 * - roomId: number
 * - tenantId: number
 * - assignedTo: number (user ID)
 * - maintenanceType: room_cleaning|repairs|purchase_demand
 * - search: string (searches title, description, tenant name/email)
 * - page: number (default: 1)
 * - limit: number (default: 50)
 * - sortBy: string (default: createdAt)
 * - sortOrder: asc|desc (default: desc)
 */
const getAllAlerts = async (req, res) => {
    try {
        const {
            type,
            status,
            priority,
            severity,
            hostelId,
            roomId,
            tenantId,
            assignedTo,
            maintenanceType,
            search,
            page = 1,
            limit = 50,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const where = {};

        // Handle type filter - 'bill' includes bill, rent, payable, receivable
        if (type) {
            if (type === 'bill') {
                where.type = { in: ['bill', 'rent', 'payable', 'receivable'] };
            } else if (type === 'maintenance') {
                where.type = 'maintenance';
            } else {
                where.type = type;
            }
        }

        // Handle status filter - support both raw status and display status (open/closed)
        if (status) {
            if (status === 'open') {
                where.status = { in: ['pending', 'in_progress'] };
            } else if (status === 'closed') {
                where.status = { in: ['resolved', 'dismissed'] };
            } else {
                where.status = status;
            }
        }

        // Handle priority filter
        if (priority) {
            where.priority = priority;
        }

        // Handle severity filter (map to priority)
        if (severity) {
            const severityToPriority = {
                'DANGER': 'urgent',
                'WARN': 'high',
                'INFO': ['medium', 'low']
            };
            const priorityValue = severityToPriority[severity];
            if (priorityValue) {
                if (Array.isArray(priorityValue)) {
                    where.priority = { in: priorityValue };
                } else {
                    where.priority = priorityValue;
                }
            }
        }

        // Other filters
        if (hostelId) where.hostelId = parseInt(hostelId);
        if (roomId) where.roomId = parseInt(roomId);
        if (tenantId) where.tenantId = parseInt(tenantId);
        if (assignedTo) where.assignedTo = parseInt(assignedTo);
        if (maintenanceType) where.maintenanceType = maintenanceType;

        // Add search clause
        const searchClause = buildSearchClause(search);
        if (searchClause) {
            where.AND = where.AND || [];
            where.AND.push(searchClause);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Get total count
        const total = await prisma.alert.count({ where });

        // Get alerts with relations
        const alerts = await prisma.alert.findMany({
            where,
            skip,
            take,
            orderBy: {
                [sortBy]: sortOrder
            },
            include: {
                hostel: { select: { id: true, name: true } },
                room: { select: { id: true, roomNumber: true } },
                tenant: { select: { id: true, name: true, phone: true, email: true } },
                allocation: { select: { id: true } },
                payment: { select: { id: true, amount: true, paymentType: true } },
                assignedUser: { select: { id: true, username: true, email: true } },
                creator: { select: { id: true, username: true } },
                resolver: { select: { id: true, username: true } }
            }
        });

        // Format alerts for frontend
        const formattedAlerts = alerts.map(alert => ({
            id: alert.id,
            severity: getSeverity(alert.priority || 'medium'),
            title: alert.title,
            description: alert.description || '',
            assignedTo: getUserDisplayName(alert.assignedUser),
            created: formatDate(alert.createdAt),
            status: getStatusDisplay(alert.status || 'pending'),
            rawStatus: alert.status || 'pending',
            priority: alert.priority || 'medium',
            type: alert.type,
            maintenanceType: alert.maintenanceType || null,
            hostel: alert.hostel?.name || null,
            room: alert.room?.roomNumber || null,
            tenant: alert.tenant?.name || null,
            amount: alert.amount || null,
            dueDate: alert.dueDate ? formatDate(alert.dueDate) : null,
            createdAt: alert.createdAt.toISOString(),
            updatedAt: alert.updatedAt.toISOString(),
            // Include full relations for detailed view
            assignedUser: alert.assignedUser ? {
                id: alert.assignedUser.id,
                name: getUserDisplayName(alert.assignedUser),
                username: alert.assignedUser.username,
                email: alert.assignedUser.email
            } : null,
            creator: alert.creator ? {
                id: alert.creator.id,
                name: getUserDisplayName(alert.creator),
                username: alert.creator.username
            } : null,
            resolver: alert.resolver ? {
                id: alert.resolver.id,
                name: getUserDisplayName(alert.resolver),
                username: alert.resolver.username
            } : null
        }));

        return successResponse(res, {
            alerts: formattedAlerts,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        }, 'Alerts fetched successfully', 200);

    } catch (error) {
        console.error('Get All Alerts Error:', error);
        return errorResponse(res, 'Failed to fetch alerts', 500);
    }
};

/**
 * @route   GET /api/admin/alerts/:id
 * @desc    Get single alert by ID
 * @access  Admin/Manager
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
                allocation: { select: { id: true } },
                payment: { select: { id: true, amount: true, paymentType: true } },
                assignedUser: { select: { id: true, name: true, email: true } },
                creator: { select: { id: true, name: true, email: true } },
                resolver: { select: { id: true, name: true, email: true } }
            }
        });

        if (!alert) {
            return errorResponse(res, 'Alert not found', 404);
        }

        // Format alert for frontend
        const formattedAlert = {
            id: alert.id,
            type: alert.type,
            priority: alert.priority || 'medium',
            severity: getSeverity(alert.priority || 'medium'),
            title: alert.title,
            description: alert.description || '',
            status: getStatusDisplay(alert.status || 'pending'),
            rawStatus: alert.status || 'pending',
            maintenanceType: alert.maintenanceType || null,
            assignedTo: getUserDisplayName(alert.assignedUser),
            assignedUser: alert.assignedUser ? {
                id: alert.assignedUser.id,
                name: getUserDisplayName(alert.assignedUser),
                username: alert.assignedUser.username,
                email: alert.assignedUser.email
            } : null,
            created: formatDate(alert.createdAt),
            createdAt: alert.createdAt.toISOString(),
            updatedAt: alert.updatedAt.toISOString(),
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
                name: getUserDisplayName(alert.creator),
                username: alert.creator.username,
                email: alert.creator.email
            } : null,
            resolver: alert.resolver ? {
                id: alert.resolver.id,
                name: getUserDisplayName(alert.resolver),
                username: alert.resolver.username,
                email: alert.resolver.email
            } : null,
            amount: alert.amount || null,
            dueDate: alert.dueDate ? formatDate(alert.dueDate) : null,
            resolvedAt: alert.resolvedAt ? formatDate(alert.resolvedAt) : null,
            remarks: alert.remarks || null,
            metadata: alert.metadata || null,
            attachments: alert.attachments || null
        };

        return successResponse(res, formattedAlert, 'Alert fetched successfully', 200);

    } catch (error) {
        console.error('Get Alert By ID Error:', error);
        return errorResponse(res, 'Failed to fetch alert', 500);
    }
};

/**
 * @route   PUT /api/admin/alerts/:id
 * @desc    Update an alert
 * @access  Admin/Manager
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
        
        // Handle priority update - can come from priority or severity
        if (priority) {
            const validPriorities = ['low', 'medium', 'high', 'urgent'];
            if (validPriorities.includes(priority)) {
                updateData.priority = priority;
            }
        } else if (req.body.severity) {
            updateData.priority = getPriorityFromSeverity(req.body.severity);
        }
        
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
        
        // Handle assignedTo - can be ID or name string
        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                updateData.assignedTo = null;
            } else {
                const assignedUserId = await findUserForAssignment(assignedTo);
                updateData.assignedTo = assignedUserId;
            }
        }
        
        if (metadata !== undefined) {
            updateData.metadata = metadata ? (typeof metadata === 'string' ? (() => { try { return JSON.parse(metadata); } catch { return metadata; } })() : metadata) : null;
        }
        if (attachments !== undefined) {
            updateData.attachments = attachments ? (typeof attachments === 'string' ? (() => { try { return JSON.parse(attachments); } catch { return attachments; } })() : attachments) : null;
        }
        if (remarks !== undefined) updateData.remarks = remarks;

        // Update alert
        const alert = await prisma.alert.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                hostel: { select: { id: true, name: true } },
                room: { select: { id: true, roomNumber: true } },
                tenant: { select: { id: true, name: true, phone: true } },
                assignedUser: { select: { id: true, username: true, email: true } },
                creator: { select: { id: true, username: true } },
                resolver: { select: { id: true, username: true } }
            }
        });

        // Format alert for response
        const formattedAlert = {
            id: alert.id,
            type: alert.type,
            priority: alert.priority || 'medium',
            severity: getSeverity(alert.priority || 'medium'),
            title: alert.title,
            description: alert.description || '',
            status: getStatusDisplay(alert.status || 'pending'),
            rawStatus: alert.status || 'pending',
            maintenanceType: alert.maintenanceType || null,
            assignedTo: getUserDisplayName(alert.assignedUser),
            assignedUser: alert.assignedUser ? {
                id: alert.assignedUser.id,
                name: getUserDisplayName(alert.assignedUser),
                username: alert.assignedUser.username,
                email: alert.assignedUser.email
            } : null,
            created: formatDate(alert.createdAt),
            createdAt: alert.createdAt.toISOString(),
            updatedAt: alert.updatedAt.toISOString(),
            hostel: alert.hostel?.name || null,
            room: alert.room?.roomNumber || null,
            tenant: alert.tenant?.name || null,
            amount: alert.amount || null,
            dueDate: alert.dueDate ? formatDate(alert.dueDate) : null
        };

        return successResponse(res, formattedAlert, 'Alert updated successfully', 200);

    } catch (error) {
        console.error('Update Alert Error:', error);
        return errorResponse(res, 'Failed to update alert', 500);
    }
};

/**
 * @route   PUT /api/admin/alerts/:id/status
 * @desc    Update alert status (pending, in_progress, resolved, dismissed)
 * @access  Admin/Manager
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
                assignedUser: { select: { id: true, name: true, email: true } },
                resolver: { select: { id: true, name: true } }
            }
        });

        // Format alert for response
        const formattedAlert = {
            id: alert.id,
            type: alert.type,
            priority: alert.priority || 'medium',
            severity: getSeverity(alert.priority || 'medium'),
            title: alert.title,
            description: alert.description || '',
            status: getStatusDisplay(alert.status || 'pending'),
            rawStatus: alert.status || 'pending',
            assignedTo: getUserDisplayName(alert.assignedUser),
            assignedUser: alert.assignedUser ? {
                id: alert.assignedUser.id,
                name: getUserDisplayName(alert.assignedUser),
                username: alert.assignedUser.username,
                email: alert.assignedUser.email
            } : null,
            created: formatDate(alert.createdAt),
            createdAt: alert.createdAt.toISOString(),
            updatedAt: alert.updatedAt.toISOString()
        };

        return successResponse(res, formattedAlert, `Alert status updated to ${status}`, 200);

    } catch (error) {
        console.error('Update Alert Status Error:', error);
        return errorResponse(res, 'Failed to update alert status', 500);
    }
};

/**
 * @route   PUT /api/admin/alerts/:id/assign
 * @desc    Assign alert to a user
 * @access  Admin/Manager
 */
const assignAlert = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedTo } = req.body;

        if (!assignedTo) {
            return errorResponse(res, 'assignedTo (user ID or name) is required', 400);
        }

        // Check if alert exists
        const existingAlert = await prisma.alert.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingAlert) {
            return errorResponse(res, 'Alert not found', 404);
        }

        // Find user by ID or name
        const assignedUserId = await findUserForAssignment(assignedTo);
        
        if (!assignedUserId) {
            return errorResponse(res, 'User not found. Please provide a valid user ID or username', 404);
        }

        // Get user details for response
        const user = await prisma.user.findUnique({
            where: { id: assignedUserId },
            select: { id: true, username: true, email: true }
        });

        // Update alert
        const alert = await prisma.alert.update({
            where: { id: parseInt(id) },
            data: {
                assignedTo: assignedUserId,
                status: existingAlert.status === 'pending' ? 'in_progress' : existingAlert.status
            },
            include: {
                assignedUser: { select: { id: true, username: true, email: true } },
                hostel: { select: { id: true, name: true } },
                room: { select: { id: true, roomNumber: true } }
            }
        });

        // Format alert for response
        const formattedAlert = {
            id: alert.id,
            type: alert.type,
            priority: alert.priority || 'medium',
            severity: getSeverity(alert.priority || 'medium'),
            title: alert.title,
            description: alert.description || '',
            status: getStatusDisplay(alert.status || 'pending'),
            rawStatus: alert.status || 'pending',
            assignedTo: getUserDisplayName(alert.assignedUser),
            assignedUser: alert.assignedUser ? {
                id: alert.assignedUser.id,
                name: getUserDisplayName(alert.assignedUser),
                username: alert.assignedUser.username,
                email: alert.assignedUser.email
            } : null,
            created: formatDate(alert.createdAt),
            createdAt: alert.createdAt.toISOString(),
            updatedAt: alert.updatedAt.toISOString()
        };

        return successResponse(res, formattedAlert, `Alert assigned to ${getUserDisplayName(user)}`, 200);

    } catch (error) {
        console.error('Assign Alert Error:', error);
        return errorResponse(res, 'Failed to assign alert', 500);
    }
};

/**
 * @route   DELETE /api/admin/alerts/:id
 * @desc    Delete an alert
 * @access  Admin
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

/**
 * @route   GET /api/admin/alerts/stats
 * @desc    Get alert statistics
 * @access  Admin/Manager
 * 
 * Query params:
 * - hostelId: number (optional)
 * - type: bill|maintenance (optional, filters by type before counting)
 */
const getAlertStats = async (req, res) => {
    try {
        const { hostelId, type } = req.query;

        // Build filter
        const where = {};
        if (hostelId) where.hostelId = parseInt(hostelId);
        
        // Handle type filter for summary
        if (type) {
            if (type === 'bill') {
                where.type = { in: ['bill', 'rent', 'payable', 'receivable'] };
            } else if (type === 'maintenance') {
                where.type = 'maintenance';
            } else {
                where.type = type;
            }
        }

        // Get all alerts for counting by priority
        const alerts = await prisma.alert.findMany({
            where,
            select: { priority: true, type: true, status: true }
        });

        // Count by severity (priority-based)
        let danger = 0; // urgent
        let warning = 0; // high
        let info = 0; // medium + low

        alerts.forEach(alert => {
            const priority = alert.priority || 'medium';
            if (priority === 'urgent') danger++;
            else if (priority === 'high') warning++;
            else info++;
        });

        // Get counts by type
        const typeStats = await prisma.alert.groupBy({
            by: ['type'],
            where,
            _count: { type: true }
        });

        // Get counts by status
        const statusStats = await prisma.alert.groupBy({
            by: ['status'],
            where,
            _count: { status: true }
        });

        // Get counts by priority
        const priorityStats = await prisma.alert.groupBy({
            by: ['priority'],
            where,
            _count: { priority: true }
        });

        // Get maintenance type stats
        const maintenanceStats = await prisma.alert.groupBy({
            by: ['maintenanceType'],
            where: {
                ...where,
                type: 'maintenance',
                maintenanceType: { not: null }
            },
            _count: { maintenanceType: true }
        });

        // Get total counts
        const totalAlerts = await prisma.alert.count({ where });
        const pendingAlerts = await prisma.alert.count({ where: { ...where, status: 'pending' } });
        const overdueAlerts = await prisma.alert.count({
            where: {
                ...where,
                status: { not: 'resolved' },
                dueDate: { lt: new Date() }
            }
        });

        // Count bills and maintenance for tabs
        const billsCount = await prisma.alert.count({
            where: {
                ...where,
                type: { in: ['bill', 'rent', 'payable', 'receivable'] }
            }
        });

        const maintenanceCount = await prisma.alert.count({
            where: {
                ...where,
                type: 'maintenance'
            }
        });

        return successResponse(res, {
            // Summary cards (Danger, Warning, Info)
            danger,
            warning,
            info,
            // Tab counts
            tabs: {
                bills: billsCount,
                maintenance: maintenanceCount
            },
            // Detailed stats
            total: totalAlerts,
            pending: pendingAlerts,
            overdue: overdueAlerts,
            byType: typeStats.reduce((acc, item) => {
                acc[item.type] = item._count.type;
                return acc;
            }, {}),
            byStatus: statusStats.reduce((acc, item) => {
                acc[item.status] = item._count.status;
                return acc;
            }, {}),
            byPriority: priorityStats.reduce((acc, item) => {
                acc[item.priority] = item._count.priority;
                return acc;
            }, {}),
            byMaintenanceType: maintenanceStats.reduce((acc, item) => {
                if (item.maintenanceType) {
                    acc[item.maintenanceType] = item._count.maintenanceType;
                }
                return acc;
            }, {})
        }, 'Alert statistics fetched successfully', 200);

    } catch (error) {
        console.error('Get Alert Stats Error:', error);
        return errorResponse(res, 'Failed to fetch alert statistics', 500);
    }
};

/**
 * @route   GET /api/admin/alerts/overdue
 * @desc    Get all overdue alerts
 * @access  Admin/Manager
 */
const getOverdueAlerts = async (req, res) => {
    try {
        const { hostelId, page = 1, limit = 20 } = req.query;

        const where = {
            status: { not: 'resolved' },
            dueDate: { lt: new Date() }
        };

        if (hostelId) {
            where.hostelId = parseInt(hostelId);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const total = await prisma.alert.count({ where });

        const alerts = await prisma.alert.findMany({
            where,
            skip,
            take,
            orderBy: { dueDate: 'asc' },
            include: {
                hostel: { select: { id: true, name: true } },
                room: { select: { id: true, roomNumber: true } },
                tenant: { select: { id: true, name: true, phone: true } },
                assignedUser: { select: { id: true, name: true, email: true } }
            }
        });

        // Format alerts for frontend
        const formattedAlerts = alerts.map(alert => ({
            id: alert.id,
            severity: getSeverity(alert.priority || 'medium'),
            title: alert.title,
            description: alert.description || '',
            assignedTo: getUserDisplayName(alert.assignedUser),
            created: formatDate(alert.createdAt),
            status: getStatusDisplay(alert.status || 'pending'),
            rawStatus: alert.status || 'pending',
            priority: alert.priority || 'medium',
            type: alert.type,
            hostel: alert.hostel?.name || null,
            room: alert.room?.roomNumber || null,
            tenant: alert.tenant?.name || null,
            amount: alert.amount || null,
            dueDate: alert.dueDate ? formatDate(alert.dueDate) : null,
            createdAt: alert.createdAt.toISOString(),
            updatedAt: alert.updatedAt.toISOString()
        }));

        return successResponse(res, {
            alerts: formattedAlerts,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        }, 'Overdue alerts fetched successfully', 200);

    } catch (error) {
        console.error('Get Overdue Alerts Error:', error);
        return errorResponse(res, 'Failed to fetch overdue alerts', 500);
    }
};

module.exports = {
    createAlert,
    getAllAlerts,
    getAlertById,
    updateAlert,
    updateAlertStatus,
    assignAlert,
    deleteAlert,
    getAlertStats,
    getOverdueAlerts
};