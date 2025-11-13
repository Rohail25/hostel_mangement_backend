const bcrypt = require('bcrypt');
const { successResponse, errorResponse } = require('../../Helper/helper');
const { generateToken, setTokenCookie, clearTokenCookie } = require('../../Helper/jwt.helper');
const { prisma } = require('../../config/db');

// ===================================
// REGISTER USER
// ===================================
const registerUser = async (req, res) => {
    try {
        const { username, email, phone, password } = req.body;

        // Validation
        if (!username || !email || !phone || !password) {
            return errorResponse(res, "All fields are required", 400);
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return errorResponse(res, "Invalid email format", 400);
        }

        // Password length validation
        if (password.length < 6) {
            return errorResponse(res, "Password must be at least 6 characters", 400);
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return errorResponse(res, "User with this email already exists", 400);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                username,
                email,
                phone,
                password: hashedPassword,
                role: 'user'
            }
        });

        // Return user without password
        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt
        };

        return successResponse(res, userResponse, "User registered successfully", 201);
    } catch (err) {
        console.error("Register Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// LOGIN USER
// ===================================
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return errorResponse(res, "Email and password are required", 400);
        }

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return errorResponse(res, "Invalid email or password", 401);
        }

        // Check if user is active
        if (user.status !== 'active') {
            return errorResponse(res, "Your account is inactive. Please contact support.", 403);
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return errorResponse(res, "Invalid email or password", 401);
        }

        // Generate JWT token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role
        };
        
        const token = generateToken(tokenPayload);

        // Set token in HTTP-only cookie
        setTokenCookie(res, token);

        // Return user data without password
        const userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
            token: token // Also return token in response for mobile apps
        };

        return successResponse(res, userData, "Login successful", 200);
    } catch (err) {
        console.error("Login Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET ALL USERS
// ===================================
const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return successResponse(res, users, "Users retrieved successfully", 200);
    } catch (err) {
        console.error("Get All Users Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// GET USER BY ID
// ===================================
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ID is a valid number
        const userId = parseInt(id);
        if (isNaN(userId)) {
            return errorResponse(res, "Invalid user ID", 400);
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            return errorResponse(res, "User not found", 404);
        }

        return successResponse(res, user, "User retrieved successfully", 200);
    } catch (err) {
        console.error("Get User By ID Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// UPDATE USER
// ===================================
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, phone, password, role, status } = req.body;

        // Validate ID is a valid number
        const userId = parseInt(id);
        if (isNaN(userId)) {
            return errorResponse(res, "Invalid user ID", 400);
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            return errorResponse(res, "User not found", 404);
        }

        // Prepare update data
        const updateData = {};

        if (username) updateData.username = username;
        if (phone) updateData.phone = phone;
        if (role && ['admin', 'manager', 'staff', 'user'].includes(role)) {
            updateData.role = role;
        }
        if (status && ['active', 'inactive'].includes(status)) {
            updateData.status = status;
        }

        // Check if email is being changed and if it's already taken
        if (email && email !== existingUser.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return errorResponse(res, "Invalid email format", 400);
            }

            const emailExists = await prisma.user.findUnique({
                where: { email }
            });

            if (emailExists) {
                return errorResponse(res, "Email already exists", 400);
            }

            updateData.email = email;
        }

        // Hash new password if provided
        if (password) {
            if (password.length < 6) {
                return errorResponse(res, "Password must be at least 6 characters", 400);
            }
            updateData.password = await bcrypt.hash(password, 10);
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                username: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                updatedAt: true
            }
        });

        return successResponse(res, updatedUser, "User updated successfully", 200);
    } catch (err) {
        console.error("Update User Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// DELETE USER
// ===================================
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ID is a valid number
        const userId = parseInt(id);
        if (isNaN(userId)) {
            return errorResponse(res, "Invalid user ID", 400);
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            return errorResponse(res, "User not found", 404);
        }

        // Delete user
        await prisma.user.delete({
            where: { id: userId }
        });

        return successResponse(res, { id: userId }, "User deleted successfully", 200);
    } catch (err) {
        console.error("Delete User Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// SOFT DELETE USER (Change status to inactive)
// ===================================
const softDeleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ID is a valid number
        const userId = parseInt(id);
        if (isNaN(userId)) {
            return errorResponse(res, "Invalid user ID", 400);
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existingUser) {
            return errorResponse(res, "User not found", 404);
        }

        // Update user status to inactive
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { status: 'inactive' },
            select: {
                id: true,
                username: true,
                email: true,
                status: true
            }
        });

        return successResponse(res, updatedUser, "User deactivated successfully", 200);
    } catch (err) {
        console.error("Soft Delete User Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

// ===================================
// LOGOUT USER
// ===================================
const logoutUser = async (req, res) => {
    try {
        // Clear the token cookie
        clearTokenCookie(res);

        return successResponse(res, null, "Logout successful", 200);
    } catch (err) {
        console.error("Logout Error:", err);
        return errorResponse(res, err.message, 400);
    }
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    softDeleteUser
};
