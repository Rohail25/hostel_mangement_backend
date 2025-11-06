const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @route   GET /api/admin/table/tenants
 * @desc    Get all tenants with relevant data for table display
 * @access  Admin, Manager, Staff
 */
const getAllTenantsTable = async (req, res) => {
    try {
        const { 
            status, 
            search, 
            page = 1, 
            limit = 50,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause
        const where = {};

        if (status) {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
                { cnicNumber: { contains: search } }
            ];
        }

        // Get total count
        const totalCount = await prisma.tenant.count({ where });

        // Get tenants with related data
        const tenants = await prisma.tenant.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: {
                [sortBy]: sortOrder
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true,
                        status: true
                    }
                },
                allocations: {
                    where: {
                        status: 'active'
                    },
                    include: {
                        hostel: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        room: {
                            select: {
                                id: true,
                                roomNumber: true,
                                roomType: true
                            }
                        },
                        bed: {
                            select: {
                                id: true,
                                bedNumber: true
                            }
                        }
                    }
                },
                payments: {
                    take: 5,
                    orderBy: {
                        paymentDate: 'desc'
                    },
                    select: {
                        id: true,
                        amount: true,
                        paymentType: true,
                        paymentMethod: true,
                        paymentDate: true,
                        status: true,
                        forMonth: true
                    }
                },
                transactions: {
                    take: 5,
                    orderBy: {
                        createdAt: 'desc'
                    },
                    select: {
                        id: true,
                        amount: true,
                        gateway: true,
                        transactionType: true,
                        status: true,
                        createdAt: true
                    }
                }
            }
        });

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / parseInt(limit));

        return res.status(200).json({
            success: true,
            message: 'Tenants retrieved successfully',
            data: {
                tenants,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalCount,
                    limit: parseInt(limit),
                    hasNextPage: parseInt(page) < totalPages,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('❌ Get all tenants table error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve tenants',
            error: error.message
        });
    }
};

/**
 * @route   GET /api/admin/table/staff
 * @desc    Get all staff members with relevant data
 * @access  Admin, Manager
 */
const getAllStaffTable = async (req, res) => {
    try {
        const {
            status,
            department,
            search,
            page = 1,
            limit = 50,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause for employees
        const employeeWhere = {
            role: 'staff' // Only staff, not managers
        };

        if (status) {
            employeeWhere.status = status;
        }

        if (department) {
            employeeWhere.department = { contains: department };
        }

        // Build where clause for user search
        const userWhere = {};
        if (search) {
            userWhere.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        // Get total count
        const totalCount = await prisma.employee.count({
            where: {
                ...employeeWhere,
                user: userWhere
            }
        });

        // Get staff members
        const staff = await prisma.employee.findMany({
            where: {
                ...employeeWhere,
                user: userWhere
            },
            skip,
            take: parseInt(limit),
            orderBy: {
                [sortBy]: sortOrder
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true,
                        status: true,
                        createdAt: true
                    }
                }
            }
        });

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / parseInt(limit));

        return res.status(200).json({
            success: true,
            message: 'Staff members retrieved successfully',
            data: {
                staff,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalCount,
                    limit: parseInt(limit),
                    hasNextPage: parseInt(page) < totalPages,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('❌ Get all staff table error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve staff members',
            error: error.message
        });
    }
};

/**
 * @route   GET /api/admin/table/managers
 * @desc    Get all managers with relevant data
 * @access  Admin only
 */
const getAllManagersTable = async (req, res) => {
    try {
        const {
            status,
            search,
            page = 1,
            limit = 50,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause for employees
        const employeeWhere = {
            role: 'manager' // Only managers
        };

        if (status) {
            employeeWhere.status = status;
        }

        // Build where clause for user search
        const userWhere = {};
        if (search) {
            userWhere.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        // Get total count
        const totalCount = await prisma.employee.count({
            where: {
                ...employeeWhere,
                user: userWhere
            }
        });

        // Get managers
        const managers = await prisma.employee.findMany({
            where: {
                ...employeeWhere,
                user: userWhere
            },
            skip,
            take: parseInt(limit),
            orderBy: {
                [sortBy]: sortOrder
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true,
                        status: true,
                        createdAt: true
                    }
                }
            }
        });

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / parseInt(limit));

        return res.status(200).json({
            success: true,
            message: 'Managers retrieved successfully',
            data: {
                managers,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalCount,
                    limit: parseInt(limit),
                    hasNextPage: parseInt(page) < totalPages,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('❌ Get all managers table error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve managers',
            error: error.message
        });
    }
};

/**
 * @route   PUT /api/admin/table/staff/:id
 * @desc    Update staff member (managers can update staff, but not admins)
 * @access  Admin, Manager
 */
const updateStaffMember = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            email,
            phone,
            department,
            designation,
            salary,
            status,
            workingHours,
            address,
            emergencyContact
        } = req.body;

        // Get the employee
        const employee = await prisma.employee.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: true
            }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }

        // Check if employee is staff role
        if (employee.role !== 'staff') {
            return res.status(403).json({
                success: false,
                message: 'Can only update staff members with this endpoint'
            });
        }

        // Check if current user is manager and trying to update admin
        if (req.user.role === 'manager' && employee.user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Managers cannot update admin users'
            });
        }

        // Update user information if provided
        const userUpdateData = {};
        if (name) userUpdateData.name = name;
        if (email) userUpdateData.email = email;
        if (phone) userUpdateData.phone = phone;

        if (Object.keys(userUpdateData).length > 0) {
            await prisma.user.update({
                where: { id: employee.userId },
                data: userUpdateData
            });
        }

        // Update employee information
        const employeeUpdateData = {};
        if (department) employeeUpdateData.department = department;
        if (designation) employeeUpdateData.designation = designation;
        if (salary !== undefined) employeeUpdateData.salary = parseFloat(salary);
        if (status) employeeUpdateData.status = status;
        if (workingHours) employeeUpdateData.workingHours = workingHours;
        if (address) employeeUpdateData.address = address;
        if (emergencyContact) employeeUpdateData.emergencyContact = emergencyContact;

        const updatedEmployee = await prisma.employee.update({
            where: { id: parseInt(id) },
            data: employeeUpdateData,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true,
                        status: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Staff member updated successfully',
            data: updatedEmployee
        });

    } catch (error) {
        console.error('❌ Update staff member error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update staff member',
            error: error.message
        });
    }
};

/**
 * @route   PUT /api/admin/table/manager/:id
 * @desc    Update manager (only admin can update managers)
 * @access  Admin only
 */
const updateManager = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            email,
            phone,
            department,
            designation,
            salary,
            status,
            workingHours,
            address,
            emergencyContact
        } = req.body;

        // Get the employee
        const employee = await prisma.employee.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: true
            }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Manager not found'
            });
        }

        // Check if employee is manager role
        if (employee.role !== 'manager') {
            return res.status(403).json({
                success: false,
                message: 'Can only update managers with this endpoint'
            });
        }

        // Update user information if provided
        const userUpdateData = {};
        if (name) userUpdateData.name = name;
        if (email) userUpdateData.email = email;
        if (phone) userUpdateData.phone = phone;

        if (Object.keys(userUpdateData).length > 0) {
            await prisma.user.update({
                where: { id: employee.userId },
                data: userUpdateData
            });
        }

        // Update employee information
        const employeeUpdateData = {};
        if (department) employeeUpdateData.department = department;
        if (designation) employeeUpdateData.designation = designation;
        if (salary !== undefined) employeeUpdateData.salary = parseFloat(salary);
        if (status) employeeUpdateData.status = status;
        if (workingHours) employeeUpdateData.workingHours = workingHours;
        if (address) employeeUpdateData.address = address;
        if (emergencyContact) employeeUpdateData.emergencyContact = emergencyContact;

        const updatedManager = await prisma.employee.update({
            where: { id: parseInt(id) },
            data: employeeUpdateData,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        role: true,
                        status: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Manager updated successfully',
            data: updatedManager
        });

    } catch (error) {
        console.error('❌ Update manager error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update manager',
            error: error.message
        });
    }
};

module.exports = {
    getAllTenantsTable,
    getAllStaffTable,
    getAllManagersTable,
    updateStaffMember,
    updateManager
};

