/**
 * Currency Controller
 * Manages user currency preferences (one currency per user)
 */

const { prisma } = require('../../config/db');

/**
 * Get user's currency
 */
exports.getUserCurrency = async (req, res) => {
  try {
    const userId = parseInt(req.user.id);

    const currency = await prisma.currency.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!currency) {
      return res.status(404).json({
        success: false,
        message: "No currency set for this user",
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Currency retrieved successfully",
      data: currency,
    });
  } catch (error) {
    console.error("Error getting currency:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get currency",
    });
  }
};

/**
 * Create or update user's currency (only one per user)
 */
exports.createOrUpdateCurrency = async (req, res) => {
  try {
    const userId = parseInt(req.user.id);
    const { symbol, code, name } = req.body;

    // Validate input
    if (!symbol || !symbol.trim()) {
      return res.status(400).json({
        success: false,
        message: "Currency symbol is required",
      });
    }

    // Check if currency already exists for this user
    const existingCurrency = await prisma.currency.findUnique({
      where: { userId },
    });

    let currency;

    if (existingCurrency) {
      // Update existing currency
      currency = await prisma.currency.update({
        where: { userId },
        data: {
          symbol: symbol.trim(),
          code: code?.trim() || null,
          name: name?.trim() || null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      res.status(200).json({
        success: true,
        message: "Currency updated successfully",
        data: currency,
      });
    } else {
      // Create new currency
      currency = await prisma.currency.create({
        data: {
          userId,
          symbol: symbol.trim(),
          code: code?.trim() || null,
          name: name?.trim() || null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        message: "Currency created successfully",
        data: currency,
      });
    }
  } catch (error) {
    console.error("Error creating/updating currency:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to save currency",
    });
  }
};

/**
 * Delete user's currency
 */
exports.deleteCurrency = async (req, res) => {
  try {
    const userId = parseInt(req.user.id);

    const currency = await prisma.currency.findUnique({
      where: { userId },
    });

    if (!currency) {
      return res.status(404).json({
        success: false,
        message: "No currency found for this user",
      });
    }

    await prisma.currency.delete({
      where: { userId },
    });

    res.status(200).json({
      success: true,
      message: "Currency deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting currency:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete currency",
    });
  }
};
