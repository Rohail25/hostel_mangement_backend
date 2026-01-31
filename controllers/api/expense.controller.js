const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');

/**
 * =====================================================
 * EXPENSE CONTROLLER - Bills/Expenses Management
 * =====================================================
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
 * POST /api/admin/expenses
 * Create a new expense/bill
 */
const createExpense = async (req, res) => {
  try {
    const { title, category, amount, type, date, hostelId, status } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return errorResponse(res, 'Title is required', 400);
    }

    if (!category || !category.trim()) {
      return errorResponse(res, 'Category is required', 400);
    }

    if (!amount || parseFloat(amount) <= 0) {
      return errorResponse(res, 'Valid amount is required', 400);
    }

    if (!date) {
      return errorResponse(res, 'Date is required', 400);
    }

    const parsedHostelId = parseNullableInt(hostelId);
    const parsedAmount = parseFloat(amount);
    const expenseType = type || 'expense';

    // Create expense
    const expense = await prisma.expense.create({
      data: {
        title: title.trim(),
        category: category.trim(),
        amount: parsedAmount,
        type: expenseType,
        date: new Date(date),
        hostelId: parsedHostelId,
      },
      include: {
        hostel: { select: { id: true, name: true } },
      },
    });

    return successResponse(res, expense, 'Expense created successfully', 201);
  } catch (error) {
    console.error('Create Expense Error:', error);
    return errorResponse(res, error.message || 'Failed to create expense', 500);
  }
};

/**
 * GET /api/admin/expenses
 * Get all expenses with filters
 */
const getExpenses = async (req, res) => {
  try {
    const {
      hostelId,
      search,
      category,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const parsedHostelId = parseNullableInt(hostelId);
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    // Build where clause
    const where = {};

    if (parsedHostelId) {
      where.hostelId = parsedHostelId;
    }

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (search) {
      const searchTerm = search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { category: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          hostel: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNumber,
      }),
      prisma.expense.count({ where }),
    ]);

    const formattedExpenses = expenses.map((expense) => ({
      id: expense.id,
      reference: `EXP-${String(expense.id).padStart(4, '0')}`,
      type: 'Expense',
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      hostelId: expense.hostelId,
      hostelName: expense.hostel?.name || null,
      description: expense.title,
      status: 'Pending', // Expenses can have status (stored separately or derived)
    }));

    return successResponse(
      res,
      {
        items: formattedExpenses,
        total,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          pages: Math.ceil(total / limitNumber),
        },
      },
      'Expenses retrieved successfully'
    );
  } catch (error) {
    console.error('Get Expenses Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch expenses', 500);
  }
};

/**
 * GET /api/admin/expenses/:id
 * Get expense by ID
 */
const getExpenseById = async (req, res) => {
  try {
    const expenseId = parseNullableInt(req.params.id);

    if (!expenseId) {
      return errorResponse(res, 'Valid expense ID is required', 400);
    }

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        hostel: { select: { id: true, name: true } },
      },
    });

    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    return successResponse(res, expense, 'Expense retrieved successfully');
  } catch (error) {
    console.error('Get Expense Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch expense', 500);
  }
};

/**
 * PUT /api/admin/expenses/:id
 * Update an expense
 */
const updateExpense = async (req, res) => {
  try {
    const expenseId = parseNullableInt(req.params.id);

    if (!expenseId) {
      return errorResponse(res, 'Valid expense ID is required', 400);
    }

    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      return errorResponse(res, 'Expense not found', 404);
    }

    const { title, category, amount, type, date, hostelId } = req.body;

    const updateData = {};

    if (title !== undefined) updateData.title = title.trim();
    if (category !== undefined) updateData.category = category.trim();
    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (parsedAmount <= 0) {
        return errorResponse(res, 'Amount must be greater than 0', 400);
      }
      updateData.amount = parsedAmount;
    }
    if (type !== undefined) updateData.type = type;
    if (date !== undefined) updateData.date = new Date(date);
    if (hostelId !== undefined) {
      updateData.hostelId = parseNullableInt(hostelId);
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
      include: {
        hostel: { select: { id: true, name: true } },
      },
    });

    return successResponse(res, updated, 'Expense updated successfully');
  } catch (error) {
    console.error('Update Expense Error:', error);
    return errorResponse(res, error.message || 'Failed to update expense', 500);
  }
};

/**
 * DELETE /api/admin/expenses/:id
 * Delete an expense
 */
const deleteExpense = async (req, res) => {
  try {
    const expenseId = parseNullableInt(req.params.id);

    if (!expenseId) {
      return errorResponse(res, 'Valid expense ID is required', 400);
    }

    const existing = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      return errorResponse(res, 'Expense not found', 404);
    }

    await prisma.expense.delete({
      where: { id: expenseId },
    });

    return successResponse(res, null, 'Expense deleted successfully');
  } catch (error) {
    console.error('Delete Expense Error:', error);
    return errorResponse(res, error.message || 'Failed to delete expense', 500);
  }
};

/**
 * PUT /api/admin/expenses/:id/status
 * Update expense status (for bills that have status tracking)
 * Note: Expense model doesn't have status field, but we can use Alert model for bills
 */
const updateExpenseStatus = async (req, res) => {
  try {
    const expenseId = parseNullableInt(req.params.id);
    const { status } = req.body;

    if (!expenseId) {
      return errorResponse(res, 'Valid expense ID is required', 400);
    }

    if (!status) {
      return errorResponse(res, 'Status is required', 400);
    }

    // Check if there's a related alert (bill alert)
    const relatedAlert = await prisma.alert.findFirst({
      where: {
        type: 'bill',
        amount: { not: null },
        OR: [
          { title: { contains: `EXP-${expenseId}`, mode: 'insensitive' } },
        ],
      },
    });

    if (relatedAlert) {
      // Update alert status
      const statusMap = {
        Pending: 'pending',
        Paid: 'resolved',
        Overdue: 'in_progress',
      };

      const alertStatus = statusMap[status] || 'pending';

      await prisma.alert.update({
        where: { id: relatedAlert.id },
        data: { status: alertStatus },
      });

      return successResponse(res, { id: relatedAlert.id, status: alertStatus }, 'Bill status updated successfully');
    }

    // If no alert exists, we can't track status for this expense
    // In a real system, you might want to add status field to Expense model
    return errorResponse(res, 'Status tracking not available for this expense. Bill alerts are used for status tracking.', 400);
  } catch (error) {
    console.error('Update Expense Status Error:', error);
    return errorResponse(res, error.message || 'Failed to update expense status', 500);
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  updateExpenseStatus,
};
