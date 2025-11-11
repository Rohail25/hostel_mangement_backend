const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

// =================== CREATE EMPLOYEE ===================
exports.createEmployee = async (req, res) => {
    try {
        const {
            // User data
            name,
            username,
            email,
            phone,
            password,
            role: userRole, // User role (staff, manager, etc)
            
            // Employee data
            role: employeeRole, // Employee role (staff, manager, supervisor, etc)
            department,
            designation,
            salary,
            salaryType,
            joinDate,
            workingHours,
            hostelAssigned,
            bankDetails,
            address,
            emergencyContact,
            qualifications,
            profilePhoto,
            documents,
            notes
        } = req.body;
        console.log(req.user.role);
        // Validation
        const userName = username || name; // Support both name and username for backward compatibility
        if (!userName || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username (or name), email, phone, and password are required'
            });
        }

        if (!salary || !joinDate) {
            return res.status(400).json({
                success: false,
                message: 'Salary and join date are required'
            });
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create User and Employee in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
                data: {
                    username: userName,
                    email,
                    phone,
                    password: hashedPassword,
                    role: userRole || 'staff', // Default to staff if not provided
                    status: 'active'
                }
            });

            // Create employee profile
            const employee = await tx.employee.create({
                data: {
                    userId: user.id,
                    employeeCode: `EMP${String(user.id).padStart(5, '0')}`,
                    role: employeeRole || 'staff',
                    department,
                    designation,
                    salary: parseFloat(salary),
                    salaryType: salaryType || 'monthly',
                    joinDate: new Date(joinDate),
                    workingHours,
                    hostelAssigned: hostelAssigned ? parseInt(hostelAssigned) : null,
                    bankDetails,
                    address,
                    emergencyContact,
                    qualifications,
                    profilePhoto,
                    documents,
                    notes,
                    status: 'active'
                }
            });

            return { user, employee };
        });

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: {
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    email: result.user.email,
                    phone: result.user.phone,
                    role: result.user.role
                },
                employee: result.employee
            }
        });

    } catch (error) {
        console.error('Create employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create employee',
            error: error.message
        });
    }
};

// =================== GET ALL EMPLOYEES ===================
exports.getAllEmployees = async (req, res) => {
    try {
        const {
            status,
            role,
            department,
            hostelAssigned,
            search,
            page = 1,
            limit = 10
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build filters
        const filters = {};

        if (status) filters.status = status;
        if (role) filters.role = role;
        if (department) filters.department = department;
        if (hostelAssigned) filters.hostelAssigned = parseInt(hostelAssigned);

        // Build search conditions
        const searchConditions = [];
        if (search) {
            searchConditions.push(
                { user: { username: { contains: search } } },
                { user: { email: { contains: search } } },
                { user: { phone: { contains: search } } },
                { employeeCode: { contains: search } },
                { designation: { contains: search } }
            );
        }

        const where = {
            ...filters,
            ...(searchConditions.length > 0 ? { OR: searchConditions } : {})
        };

        // Get employees with user data
        const [employees, total] = await Promise.all([
            prisma.employee.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                            phone: true,
                            role: true,
                            status: true
                        }
                    }
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.employee.count({ where })
        ]);

        res.status(200).json({
            success: true,
            message: 'Employees fetched successfully',
            data: employees,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employees',
            error: error.message
        });
    }
};

// =================== GET EMPLOYEE BY ID ===================
exports.getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;

        const employee = await prisma.employee.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true,
                        role: true,
                        status: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Employee fetched successfully',
            data: employee
        });

    } catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee',
            error: error.message
        });
    }
};

// =================== GET EMPLOYEE BY USER ID ===================
exports.getEmployeeByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        const employee = await prisma.employee.findUnique({
            where: { userId: parseInt(userId) },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true,
                        role: true,
                        status: true
                    }
                }
            }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found for this user'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Employee fetched successfully',
            data: employee
        });

    } catch (error) {
        console.error('Get employee by user ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee',
            error: error.message
        });
    }
};

// =================== UPDATE EMPLOYEE ===================
exports.updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            // User data
            name,
            username,
            email,
            phone,
            role: userRole,
            
            // Employee data
            employeeCode,
            role: employeeRole,
            department,
            designation,
            salary,
            salaryType,
            joinDate,
            terminationDate,
            status,
            workingHours,
            hostelAssigned,
            bankDetails,
            address,
            emergencyContact,
            qualifications,
            profilePhoto,
            documents,
            notes
        } = req.body;

        // Check if employee exists
        const existingEmployee = await prisma.employee.findUnique({
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!existingEmployee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Update in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update user if user data is provided
            const userUpdateData = {};
            const userName = username || name; // Support both name and username
            if (userName) userUpdateData.username = userName;
            if (email) userUpdateData.email = email;
            if (phone) userUpdateData.phone = phone;
            if (userRole) userUpdateData.role = userRole;

            let updatedUser = existingEmployee.user;
            if (Object.keys(userUpdateData).length > 0) {
                updatedUser = await tx.user.update({
                    where: { id: existingEmployee.userId },
                    data: userUpdateData
                });
            }

            // Update employee
            const employeeUpdateData = {};
            if (employeeCode !== undefined) employeeUpdateData.employeeCode = employeeCode;
            if (employeeRole !== undefined) employeeUpdateData.role = employeeRole;
            if (department !== undefined) employeeUpdateData.department = department;
            if (designation !== undefined) employeeUpdateData.designation = designation;
            if (salary !== undefined) employeeUpdateData.salary = parseFloat(salary);
            if (salaryType !== undefined) employeeUpdateData.salaryType = salaryType;
            if (joinDate !== undefined) employeeUpdateData.joinDate = new Date(joinDate);
            if (terminationDate !== undefined) employeeUpdateData.terminationDate = terminationDate ? new Date(terminationDate) : null;
            if (status !== undefined) employeeUpdateData.status = status;
            if (workingHours !== undefined) employeeUpdateData.workingHours = workingHours;
            if (hostelAssigned !== undefined) employeeUpdateData.hostelAssigned = hostelAssigned ? parseInt(hostelAssigned) : null;
            if (bankDetails !== undefined) employeeUpdateData.bankDetails = bankDetails;
            if (address !== undefined) employeeUpdateData.address = address;
            if (emergencyContact !== undefined) employeeUpdateData.emergencyContact = emergencyContact;
            if (qualifications !== undefined) employeeUpdateData.qualifications = qualifications;
            if (profilePhoto !== undefined) employeeUpdateData.profilePhoto = profilePhoto;
            if (documents !== undefined) employeeUpdateData.documents = documents;
            if (notes !== undefined) employeeUpdateData.notes = notes;

            const updatedEmployee = await tx.employee.update({
                where: { id: parseInt(id) },
                data: employeeUpdateData
            });

            return { user: updatedUser, employee: updatedEmployee };
        });

        res.status(200).json({
            success: true,
            message: 'Employee updated successfully',
            data: {
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    email: result.user.email,
                    phone: result.user.phone,
                    role: result.user.role
                },
                employee: result.employee
            }
        });

    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update employee',
            error: error.message
        });
    }
};

// =================== UPDATE EMPLOYEE SALARY ===================
exports.updateEmployeeSalary = async (req, res) => {
    try {
        const { id } = req.params;
        const { salary, salaryType, effectiveDate, notes } = req.body;

        if (!salary) {
            return res.status(400).json({
                success: false,
                message: 'Salary is required'
            });
        }

        const employee = await prisma.employee.update({
            where: { id: parseInt(id) },
            data: {
                salary: parseFloat(salary),
                salaryType: salaryType || 'monthly',
                notes: notes || `Salary updated on ${new Date().toISOString()}`
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            message: 'Employee salary updated successfully',
            data: employee
        });

    } catch (error) {
        console.error('Update salary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update salary',
            error: error.message
        });
    }
};

// =================== UPDATE EMPLOYEE STATUS ===================
exports.updateEmployeeStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, terminationDate, notes } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const updateData = { status };
        if (status === 'terminated' && terminationDate) {
            updateData.terminationDate = new Date(terminationDate);
        }
        if (notes) updateData.notes = notes;

        const employee = await prisma.employee.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        // Also update user status if employee is terminated
        if (status === 'terminated') {
            await prisma.user.update({
                where: { id: employee.userId },
                data: { status: 'inactive' }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Employee status updated successfully',
            data: employee
        });

    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update status',
            error: error.message
        });
    }
};

// =================== DELETE EMPLOYEE ===================
exports.deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if employee exists
        const employee = await prisma.employee.findUnique({
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Delete employee and user in transaction
        await prisma.$transaction(async (tx) => {
            // Delete employee
            await tx.employee.delete({
                where: { id: parseInt(id) }
            });

            // Delete user
            await tx.user.delete({
                where: { id: employee.userId }
            });
        });

        res.status(200).json({
            success: true,
            message: 'Employee deleted successfully'
        });

    } catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete employee',
            error: error.message
        });
    }
};

// =================== GET EMPLOYEE STATISTICS ===================
exports.getEmployeeStatistics = async (req, res) => {
    try {
        const [
            totalEmployees,
            activeEmployees,
            inactiveEmployees,
            onLeaveEmployees,
            terminatedEmployees,
            employeesByRole,
            employeesByDepartment
        ] = await Promise.all([
            prisma.employee.count(),
            prisma.employee.count({ where: { status: 'active' } }),
            prisma.employee.count({ where: { status: 'inactive' } }),
            prisma.employee.count({ where: { status: 'on_leave' } }),
            prisma.employee.count({ where: { status: 'terminated' } }),
            prisma.employee.groupBy({
                by: ['role'],
                _count: true
            }),
            prisma.employee.groupBy({
                by: ['department'],
                _count: true,
                where: {
                    department: {
                        not: null
                    }
                }
            })
        ]);

        // Calculate total salary expense
        const salaryData = await prisma.employee.aggregate({
            where: { status: 'active' },
            _sum: { salary: true },
            _avg: { salary: true }
        });

        res.status(200).json({
            success: true,
            message: 'Employee statistics fetched successfully',
            data: {
                totalEmployees,
                statusBreakdown: {
                    active: activeEmployees,
                    inactive: inactiveEmployees,
                    on_leave: onLeaveEmployees,
                    terminated: terminatedEmployees
                },
                employeesByRole,
                employeesByDepartment,
                salaryStatistics: {
                    totalMonthlySalaryExpense: salaryData._sum.salary || 0,
                    averageSalary: salaryData._avg.salary || 0
                }
            }
        });

    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

