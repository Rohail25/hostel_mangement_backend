// ===============================
// Role Controller
// ===============================

const { successResponse, errorResponse } = require('../../Helper/helper');
const { prisma } = require('../../config/db');

// ===================================
// GET ALL ROLES
// ===================================
const getAllRoles = async (req, res) => {
    try {
        const { page = 1, limit = 50, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Get current user to check if admin
        const currentUser = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { isAdmin: true }
        });

        if (!currentUser) {
            return errorResponse(res, "User not found", 404);
        }

        // Build where clause
        const where = {};

        // If not admin, only show roles where userId matches current user OR userId is null (global)
        if (!currentUser.isAdmin) {
            where.OR = [
                { userId: req.userId },
                { userId: null }
            ];
        }

        // Add search filter if provided
        if (search) {
            where.AND = [
                {
                    OR: [
                        { roleName: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } }
                    ]
                }
            ];
        }

        const [roles, total] = await Promise.all([
            prisma.role.findMany({
                where,
                skip,
                take,
                include: {
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    },
                    _count: {
                        select: {
                            users: true,
                            permissions: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.role.count({ where })
        ]);

        return successResponse(
            res,
            {
                roles,
                pagination: {
                    page: parseInt(page),
                    limit: take,
                    total,
                    totalPages: Math.ceil(total / take)
                }
            },
            "Roles retrieved successfully"
        );
    } catch (err) {
        console.error("Get All Roles Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ROLE BY ID
// ===================================
const getRoleById = async (req, res) => {
    try {
        const { id } = req.params;
        const roleId = parseInt(id);

        if (isNaN(roleId)) {
            return errorResponse(res, "Invalid role ID", 400);
        }

        // Get current user to check if admin
        const currentUser = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { isAdmin: true }
        });

        if (!currentUser) {
            return errorResponse(res, "User not found", 404);
        }

        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                },
                permissions: {
                    include: {
                        permission: true
                    }
                },
                _count: {
                    select: {
                        users: true
                    }
                }
            }
        });

        if (!role) {
            return errorResponse(res, "Role not found", 404);
        }

        // Check if user has access to this role (admin can see all, others only their own or global)
        if (!currentUser.isAdmin && role.userId !== null && role.userId !== req.userId) {
            return errorResponse(res, "Access denied. You don't have permission to view this role.", 403);
        }

        // Format permissions for easier frontend consumption
        const formattedRole = {
            ...role,
            permissions: role.permissions.map(rp => ({
                id: rp.permission.id,
                resource: rp.permission.resource,
                action: rp.permission.action,
                description: rp.permission.description
            }))
        };

        return successResponse(res, formattedRole, "Role retrieved successfully");
    } catch (err) {
        console.error("Get Role By ID Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// CREATE ROLE
// ===================================
const createRole = async (req, res) => {
    try {
        const { rolename, description, permissions, hostelId } = req.body;

        // Validation
        if (!rolename || !rolename.trim()) {
            return errorResponse(res, "Role name is required", 400);
        }

        // Get current user to check if admin
        const currentUser = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { isAdmin: true }
        });

        if (!currentUser) {
            return errorResponse(res, "User not found", 404);
        }

        // IMPORTANT: userId is ALWAYS taken from authenticated user (req.userId)
        // It represents who created/owns the role, not from form input
        const roleUserId = req.userId;

        // Validate hostelId if provided
        let parsedHostelId = null;
        if (hostelId) {
            parsedHostelId = parseInt(hostelId);
            if (isNaN(parsedHostelId)) {
                return errorResponse(res, "Invalid hostel ID format", 400);
            }
            
            // Verify hostel exists
            const hostelExists = await prisma.hostel.findUnique({
                where: { id: parsedHostelId }
            });
            
            if (!hostelExists) {
                return errorResponse(res, "Hostel not found", 404);
            }
        }

        // Check if role with same name already exists for this user and hostel combination
        const existingRole = await prisma.role.findFirst({
            where: {
                roleName: rolename.trim(),
                userId: roleUserId,
                hostelId: parsedHostelId
            }
        });

        if (existingRole) {
            return errorResponse(res, "Role with this name already exists for this user and hostel", 400);
        }

        // Create role with permissions if provided
        const roleData = {
            roleName: rolename.trim(),
            description: description?.trim() || null,
            userId: roleUserId,
            hostelId: parsedHostelId
        };

        let role;
        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            // Validate permission IDs
            const permissionIds = permissions.map(p => 
                typeof p === 'object' ? p.id : p
            ).filter(Boolean);

            if (permissionIds.length > 0) {
                // Verify all permissions exist
                const existingPermissions = await prisma.permission.findMany({
                    where: { id: { in: permissionIds } }
                });

                if (existingPermissions.length !== permissionIds.length) {
                    return errorResponse(res, "One or more permissions not found", 400);
                }

                // Create role with permissions
                role = await prisma.role.create({
                    data: {
                        ...roleData,
                        permissions: {
                            create: permissionIds.map(permissionId => ({
                                permissionId
                            }))
                        }
                    },
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        },
                        hostel: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                });
            } else {
                role = await prisma.role.create({
                    data: roleData,
                    include: {
                        hostel: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                });
            }
        } else {
            role = await prisma.role.create({
                data: roleData,
                include: {
                    hostel: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
        }

        return successResponse(
            res,
            role,
            "Role created successfully",
            201
        );
    } catch (err) {
        console.error("Create Role Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE ROLE
// ===================================
const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { rolename, description, permissions, hostelId } = req.body;
        const roleId = parseInt(id);

        if (isNaN(roleId)) {
            return errorResponse(res, "Invalid role ID", 400);
        }

        // Get current user to check if admin
        const currentUser = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { isAdmin: true }
        });

        if (!currentUser) {
            return errorResponse(res, "User not found", 404);
        }

        // Check if role exists
        const existingRole = await prisma.role.findUnique({
            where: { id: roleId }
        });

        if (!existingRole) {
            return errorResponse(res, "Role not found", 404);
        }

        // Check if user has access to update this role
        if (!currentUser.isAdmin && existingRole.userId !== null && existingRole.userId !== req.userId) {
            return errorResponse(res, "Access denied. You don't have permission to update this role.", 403);
        }

        // IMPORTANT: userId is ALWAYS taken from authenticated user (req.userId)
        // It should NOT be modified from form input
        const roleUserId = existingRole.userId || req.userId;

        // Validate and parse hostelId if provided
        let parsedHostelId = existingRole.hostelId; // Keep existing if not changing
        if (hostelId !== undefined) {
            if (hostelId === null) {
                parsedHostelId = null; // Allow removing hostel assignment
            } else {
                parsedHostelId = parseInt(hostelId);
                if (isNaN(parsedHostelId)) {
                    return errorResponse(res, "Invalid hostel ID format", 400);
                }
                
                // Verify hostel exists
                const hostelExists = await prisma.hostel.findUnique({
                    where: { id: parsedHostelId }
                });
                
                if (!hostelExists) {
                    return errorResponse(res, "Hostel not found", 404);
                }
            }
        }

        // Check if name is being changed and if it conflicts
        if (rolename && rolename.trim() !== existingRole.roleName) {
            const nameConflict = await prisma.role.findFirst({
                where: {
                    roleName: rolename.trim(),
                    userId: roleUserId,
                    hostelId: parsedHostelId
                }
            });

            if (nameConflict && nameConflict.id !== roleId) {
                return errorResponse(res, "Role with this name already exists for this user and hostel", 400);
            }
        }

        // Prepare update data
        const updateData = {};
        if (rolename) updateData.roleName = rolename.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (hostelId !== undefined) updateData.hostelId = parsedHostelId;

        // Update role
        let role = await prisma.role.update({
            where: { id: roleId },
            data: updateData,
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                },
                hostel: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // Update permissions if provided
        if (permissions !== undefined) {
            if (Array.isArray(permissions)) {
                // Remove all existing permissions
                await prisma.rolePermission.deleteMany({
                    where: { roleId }
                });

                // Add new permissions if any
                if (permissions.length > 0) {
                    const permissionIds = permissions.map(p =>
                        typeof p === 'object' ? p.id : p
                    ).filter(Boolean);

                    if (permissionIds.length > 0) {
                        // Verify all permissions exist
                        const existingPermissions = await prisma.permission.findMany({
                            where: { id: { in: permissionIds } }
                        });

                        if (existingPermissions.length !== permissionIds.length) {
                            return errorResponse(res, "One or more permissions not found", 400);
                        }

                        // Create new role permissions
                        await prisma.rolePermission.createMany({
                            data: permissionIds.map(permissionId => ({
                                roleId,
                                permissionId
                            }))
                        });
                    }
                }

                // Fetch updated role with permissions
                role = await prisma.role.findUnique({
                    where: { id: roleId },
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        },
                        hostel: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                });
            }
        }

        return successResponse(res, role, "Role updated successfully");
    } catch (err) {
        console.error("Update Role Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// DELETE ROLE
// ===================================
const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const roleId = parseInt(id);

        if (isNaN(roleId)) {
            return errorResponse(res, "Invalid role ID", 400);
        }

        // Get current user to check if admin
        const currentUser = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { isAdmin: true }
        });

        if (!currentUser) {
            return errorResponse(res, "User not found", 404);
        }

        // Check if role exists
        const existingRole = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                _count: {
                    select: {
                        users: true
                    }
                }
            }
        });

        if (!existingRole) {
            return errorResponse(res, "Role not found", 404);
        }

        // Check if user has access to delete this role
        if (!currentUser.isAdmin && existingRole.userId !== null && existingRole.userId !== req.userId) {
            return errorResponse(res, "Access denied. You don't have permission to delete this role.", 403);
        }

        // Check if role is assigned to any users
        if (existingRole._count.users > 0) {
            return errorResponse(
                res,
                `Cannot delete role. It is assigned to ${existingRole._count.users} user(s). Please reassign users before deleting.`,
                400
            );
        }

        // Delete role (permissions will be cascade deleted)
        await prisma.role.delete({
            where: { id: roleId }
        });

        return successResponse(res, { id: roleId }, "Role deleted successfully");
    } catch (err) {
        console.error("Delete Role Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ROLE PERMISSIONS
// ===================================
const getRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const roleId = parseInt(id);

        if (isNaN(roleId)) {
            return errorResponse(res, "Invalid role ID", 400);
        }

        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        if (!role) {
            return errorResponse(res, "Role not found", 404);
        }

        const permissions = role.permissions.map(rp => ({
            id: rp.permission.id,
            resource: rp.permission.resource,
            action: rp.permission.action,
            description: rp.permission.description
        }));

        return successResponse(res, permissions, "Role permissions retrieved successfully");
    } catch (err) {
        console.error("Get Role Permissions Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE ROLE PERMISSIONS
// ===================================
const updateRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;
        const roleId = parseInt(id);

        if (isNaN(roleId)) {
            return errorResponse(res, "Invalid role ID", 400);
        }

        if (!Array.isArray(permissions)) {
            return errorResponse(res, "Permissions must be an array", 400);
        }

        // Check if role exists
        const existingRole = await prisma.role.findUnique({
            where: { id: roleId }
        });

        if (!existingRole) {
            return errorResponse(res, "Role not found", 404);
        }

        // Extract permission IDs
        const permissionIds = permissions.map(p =>
            typeof p === 'object' ? p.id : p
        ).filter(Boolean);

        // Verify all permissions exist
        if (permissionIds.length > 0) {
            const existingPermissions = await prisma.permission.findMany({
                where: { id: { in: permissionIds } }
            });

            if (existingPermissions.length !== permissionIds.length) {
                return errorResponse(res, "One or more permissions not found", 400);
            }
        }

        // Remove all existing permissions
        await prisma.rolePermission.deleteMany({
            where: { roleId }
        });

        // Add new permissions
        if (permissionIds.length > 0) {
            await prisma.rolePermission.createMany({
                data: permissionIds.map(permissionId => ({
                    roleId,
                    permissionId
                }))
            });
        }

        // Fetch updated role with permissions
        const updatedRole = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        return successResponse(res, updatedRole, "Role permissions updated successfully");
    } catch (err) {
        console.error("Update Role Permissions Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    getRolePermissions,
    updateRolePermissions
};

