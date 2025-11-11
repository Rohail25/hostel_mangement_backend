// ===============================
// Authentication Middleware
// ===============================

const { verifyToken } = require('../Helper/jwt.helper');
const { errorResponse } = require('../Helper/helper');
const { prisma } = require('../config/db');

/**
 * Supported User Roles:
 * - admin: System administrator with full access
 * - owner: Property owner with access to their properties
 * - manager: Property manager with management access
 * - staff: Staff member with limited access
 * - user: Regular user/tenant with basic access
 */
const VALID_ROLES = ['admin', 'owner', 'manager', 'staff', 'user'];

/**
 * Verify JWT Token Middleware
 * Checks for token in cookies or Authorization header
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from cookie or Authorization header
        let token = req.cookies.token;

        // If not in cookie, check Authorization header
        if (!token && req.headers.authorization) {
            if (req.headers.authorization.startsWith('Bearer ')) {
                token = req.headers.authorization.substring(7);
            }
        }

        // Check if token exists
        if (!token) {
            return errorResponse(res, "Authentication required. Please login.", 401);
        }

        // Verify token
        const decoded = verifyToken(token);

        // Get user from database using Prisma
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
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
            return errorResponse(res, "User not found. Please login again.", 401);
        }

        // Check if user is active (status defaults to 'active' but can be null)
        if (user.status && user.status !== 'active') {
            return errorResponse(res, "Your account is inactive. Please contact support.", 403);
        }

        // Validate user role
        if (user.role && !VALID_ROLES.includes(user.role)) {
            console.warn(`Invalid role detected for user ${user.id}: ${user.role}`);
        }

        // Attach user to request object
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;

        next();
    } catch (err) {
        console.error("Authentication Error:", err);
        return errorResponse(res, "Invalid or expired token. Please login again.", 401);
    }
};

/**
 * Check if user has required role
 * Supports: 'admin', 'owner', 'manager', 'staff', 'user'
 * @param {...string} roles - Allowed roles (e.g., authorize('admin', 'owner'))
 * @example
 * router.get('/route', authenticate, authorize('admin', 'owner'), handler);
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, "Authentication required", 401);
        }

        // Validate that the user's role is valid
        if (!req.user.role) {
            return errorResponse(res, "User role not found", 403);
        }

        // Check if user has one of the required roles
        if (!roles.includes(req.user.role)) {
            return errorResponse(
                res,
                `Access denied. This action requires ${roles.join(' or ')} role. Your role: ${req.user.role}`,
                403
            );
        }

        next();
    };
};

/**
 * Optional authentication - doesn't fail if no token
 * Used for routes that work differently for authenticated users
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token = req.cookies.token;

        if (!token && req.headers.authorization) {
            if (req.headers.authorization.startsWith('Bearer ')) {
                token = req.headers.authorization.substring(7);
            }
        }

        if (token) {
            const decoded = verifyToken(token);
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    phone: true,
                    role: true,
                    status: true
                }
            });
            
            if (user && user.status === 'active') {
                req.user = user;
                req.userId = user.id;
                req.userRole = user.role;
            }
        }

        next();
    } catch (err) {
        // Don't fail, just continue without user
        next();
    }
};

module.exports = {
    authenticate,
    authorize,
    optionalAuth
};
