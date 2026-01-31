const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');

// Verify Prisma client is available
if (!prisma) {
  console.error('❌ Prisma client is not initialized');
}

// Verify vendorCategory model is available
if (prisma && !prisma.vendorCategory) {
  console.error('❌ VendorCategory model not found in Prisma client. Please run: npx prisma generate');
}

const parseNullableInt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * GET /api/admin/vendor-categories
 * Get all vendor categories for the current user
 */
const getVendorCategories = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return errorResponse(res, 'User not authenticated', 401);
    }

    const categories = await prisma.vendorCategory.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return successResponse(res, categories, 'Vendor categories retrieved successfully');
  } catch (error) {
    console.error('Get Vendor Categories Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch vendor categories', 500);
  }
};

/**
 * POST /api/admin/vendor-categories
 * Create a new vendor category
 */
const createVendorCategory = async (req, res) => {
  try {
    // Check if Prisma client and model are available
    if (!prisma) {
      console.error('❌ Prisma client is not initialized');
      return errorResponse(res, 'Database connection error. Please contact administrator.', 500);
    }

    if (!prisma.vendorCategory) {
      console.error('❌ VendorCategory model not found in Prisma client. Please run: npx prisma generate');
      return errorResponse(res, 'Database model not available. Please run: npx prisma generate', 500);
    }

    const userId = req.user?.id;
    
    if (!userId) {
      return errorResponse(res, 'User not authenticated', 401);
    }

    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return errorResponse(res, 'Category name is required', 400);
    }

    // Check if category with same name already exists for this user
    // Use findFirst for composite unique constraint
    const existing = await prisma.vendorCategory.findFirst({
      where: {
        name: name.trim(),
        userId: userId,
      },
    });

    if (existing) {
      return errorResponse(res, 'Category with this name already exists', 409);
    }

    const category = await prisma.vendorCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        userId: userId,
      },
    });

    return successResponse(res, category, 'Vendor category created successfully', 201);
  } catch (error) {
    console.error('Create Vendor Category Error:', error);
    if (error.code === 'P2002') {
      return errorResponse(res, 'Category with this name already exists', 409);
    }
    return errorResponse(res, error.message || 'Failed to create vendor category', 500);
  }
};

/**
 * GET /api/admin/vendor-categories/:id
 * Get a vendor category by ID
 */
const getVendorCategoryById = async (req, res) => {
  try {
    const userId = req.user?.id;
    const categoryId = parseNullableInt(req.params.id);

    if (!userId) {
      return errorResponse(res, 'User not authenticated', 401);
    }

    if (!categoryId) {
      return errorResponse(res, 'Valid category ID is required', 400);
    }

    const category = await prisma.vendorCategory.findFirst({
      where: {
        id: categoryId,
        userId: userId, // Ensure user can only access their own categories
      },
    });

    if (!category) {
      return errorResponse(res, 'Vendor category not found', 404);
    }

    return successResponse(res, category, 'Vendor category retrieved successfully');
  } catch (error) {
    console.error('Get Vendor Category Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch vendor category', 500);
  }
};

/**
 * PUT /api/admin/vendor-categories/:id
 * Update a vendor category
 */
const updateVendorCategory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const categoryId = parseNullableInt(req.params.id);

    if (!userId) {
      return errorResponse(res, 'User not authenticated', 401);
    }

    if (!categoryId) {
      return errorResponse(res, 'Valid category ID is required', 400);
    }

    const { name, description } = req.body;

    // Check if category exists and belongs to user
    const existing = await prisma.vendorCategory.findFirst({
      where: {
        id: categoryId,
        userId: userId,
      },
    });

    if (!existing) {
      return errorResponse(res, 'Vendor category not found', 404);
    }

    // If name is being changed, check for duplicates
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.vendorCategory.findFirst({
        where: {
          name: name.trim(),
          userId: userId,
        },
      });

      if (duplicate) {
        return errorResponse(res, 'Category with this name already exists', 409);
      }
    }

    const category = await prisma.vendorCategory.update({
      where: {
        id: categoryId,
      },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });

    return successResponse(res, category, 'Vendor category updated successfully');
  } catch (error) {
    console.error('Update Vendor Category Error:', error);
    if (error.code === 'P2002') {
      return errorResponse(res, 'Category with this name already exists', 409);
    }
    return errorResponse(res, error.message || 'Failed to update vendor category', 500);
  }
};

/**
 * DELETE /api/admin/vendor-categories/:id
 * Delete a vendor category
 */
const deleteVendorCategory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const categoryId = parseNullableInt(req.params.id);

    if (!userId) {
      return errorResponse(res, 'User not authenticated', 401);
    }

    if (!categoryId) {
      return errorResponse(res, 'Valid category ID is required', 400);
    }

    // Check if category exists and belongs to user
    const existing = await prisma.vendorCategory.findFirst({
      where: {
        id: categoryId,
        userId: userId,
      },
    });

    if (!existing) {
      return errorResponse(res, 'Vendor category not found', 404);
    }

    await prisma.vendorCategory.delete({
      where: {
        id: categoryId,
      },
    });

    return successResponse(res, null, 'Vendor category deleted successfully');
  } catch (error) {
    console.error('Delete Vendor Category Error:', error);
    return errorResponse(res, error.message || 'Failed to delete vendor category', 500);
  }
};

module.exports = {
  getVendorCategories,
  createVendorCategory,
  getVendorCategoryById,
  updateVendorCategory,
  deleteVendorCategory,
};
