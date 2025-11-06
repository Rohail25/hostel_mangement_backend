const { prisma } = require('../../../config/db');
const { successResponse, errorResponse } = require('../../../Helper/helper');

/**
 * =====================================================
 * ACCOUNTS CONTROLLER - Financial Dashboard
 * =====================================================
 * 
 * Provides financial overview, payables, and receivables
 * for the Accounts dashboard
 */

// Helper function to determine transaction category
const getTransactionCategory = (transactionType) => {
  const receivableTypes = [
    'rent_received', 'rent', 'deposit_received', 'deposit',
    'advance_received', 'advance', 'dues_received', 'other_received'
  ];
  const payableTypes = [
    'salary_paid', 'vendor_paid', 'maintenance_paid', 
    'utility_paid', 'refund_paid', 'other_paid', 'refund'
  ];
  
  const type = transactionType?.toLowerCase();
  
  if (receivableTypes.some(t => type?.includes(t))) {
    return 'receivable';
  } else if (payableTypes.some(t => type?.includes(t))) {
    return 'payable';
  }
  
  return 'other';
};

/**
 * GET /api/admin/accounts/summary
 * Get financial summary (Total Income, Expenses, Profit/Loss, Bad Debt)
 */
const getFinancialSummary = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;

    // Build date filter for payments
    const paymentDateFilter = {};
    if (startDate || endDate) {
      paymentDateFilter.createdAt = {};
      if (startDate) paymentDateFilter.createdAt.gte = new Date(startDate);
      if (endDate) paymentDateFilter.createdAt.lte = new Date(endDate);
    }

    // Build date filter for expenses
    const expenseDateFilter = {};
    if (startDate || endDate) {
      expenseDateFilter.date = {};
      if (startDate) expenseDateFilter.date.gte = new Date(startDate);
      if (endDate) expenseDateFilter.date.lte = new Date(endDate);
    }

    // Calculate Total Income (from paid payments)
    const paymentFilter = {
      status: 'paid',
      ...(hostelId ? { hostelId: parseInt(hostelId) } : {}),
      ...paymentDateFilter,
    };

    const payments = await prisma.payment.aggregate({
      where: paymentFilter,
      _sum: { amount: true },
    });

    const totalIncome = payments._sum.amount || 0;

    // Calculate Total Expenses (from expenses table)
    const expenseFilter = {
      ...(hostelId ? { hostelId: parseInt(hostelId) } : {}),
      ...expenseDateFilter,
    };

    const expenses = await prisma.expense.aggregate({
      where: expenseFilter,
      _sum: { amount: true },
    });

    const totalExpenses = expenses._sum.amount || 0;

    // Calculate Profit/Loss
    const profitLoss = totalIncome - totalExpenses;

    // Calculate Bad Debt (unpaid/overdue payments)
    const badDebtFilter = {
      status: 'pending',
      ...(hostelId ? { hostelId: parseInt(hostelId) } : {}),
      ...paymentDateFilter,
    };

    const badDebtPayments = await prisma.payment.aggregate({
      where: badDebtFilter,
      _sum: { amount: true },
    });

    // Also check tenant totalDue
    const tenantFilter = {
      ...(hostelId ? {
        allocations: {
          some: { hostelId: parseInt(hostelId), status: 'active' },
        },
      } : {}),
    };

    const tenants = await prisma.tenant.aggregate({
      where: tenantFilter,
      _sum: { totalDue: true },
    });

    const badDebt = (badDebtPayments._sum.amount || 0) + (tenants._sum.totalDue || 0);

    return successResponse(res, {
      totalIncome: parseFloat(totalIncome.toFixed(2)),
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      profitLoss: parseFloat(profitLoss.toFixed(2)),
      badDebt: parseFloat(badDebt.toFixed(2)),
      isProfit: profitLoss >= 0,
    }, 'Financial summary retrieved successfully');
  } catch (error) {
    console.error('Get financial summary error:', error);
    return errorResponse(res, error.message);
  }
};

/**
 * GET /api/admin/accounts/payables
 * Get payables (Bills, Vendor, Laundry)
 * ?type=bills|vendor|laundry
 */
const getPayables = async (req, res) => {
  try {
    const { type, hostelId, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      ...(hostelId ? { hostelId: parseInt(hostelId) } : {}),
    };

    let payables = [];
    let total = 0;
    let totalAmount = 0;

    if (type === 'bills' || !type) {
      // Bills from expenses and alerts
      const expenseFilter = {
        ...filter,
        ...(search ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      };

      const [bills, billsCount] = await Promise.all([
        prisma.expense.findMany({
          where: expenseFilter,
          include: {
            hostel: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          skip: type === 'bills' ? skip : 0,
          take: type === 'bills' ? parseInt(limit) : 1000,
        }),
        prisma.expense.count({ where: expenseFilter }),
      ]);

      // Also get bill alerts
      const alertFilter = {
        type: 'bill',
        ...filter,
        ...(search ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      };

      const billAlerts = await prisma.alert.findMany({
        where: alertFilter,
        include: {
          hostel: { select: { name: true } },
          tenant: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Format bills
      const formattedBills = bills.map(bill => ({
        id: bill.id,
        reference: `EXP-${bill.id}`,
        type: 'expense',
        title: bill.title,
        category: bill.category,
        amount: bill.amount,
        date: bill.date,
        hostel: bill.hostel?.name || null,
        description: bill.title,
      }));

      const formattedAlerts = billAlerts.map(alert => ({
        id: alert.id,
        reference: `ALERT-${alert.id}`,
        type: 'alert',
        title: alert.title,
        category: 'bill',
        amount: alert.amount || 0,
        date: alert.createdAt,
        hostel: alert.hostel?.name || null,
        tenant: alert.tenant?.name || null,
        description: alert.description,
      }));

      payables = [...formattedBills, ...formattedAlerts];
      total = type === 'bills' ? billsCount : payables.length;
      totalAmount = payables.reduce((sum, p) => sum + (p.amount || 0), 0);
    } else if (type === 'vendor') {
      // Vendor payables
      const vendorFilter = {
        ...filter,
        status: 'active',
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { companyName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      };

      const [vendors, vendorsCount] = await Promise.all([
        prisma.vendor.findMany({
          where: vendorFilter,
          include: {
            hostel: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.vendor.count({ where: vendorFilter }),
      ]);

      payables = vendors.map(vendor => ({
        id: vendor.id,
        reference: `VENDOR-${vendor.id}`,
        type: 'vendor',
        title: vendor.name,
        companyName: vendor.companyName,
        category: vendor.category || 'vendor',
        amount: vendor.totalPayable || 0,
        balance: vendor.balance || 0,
        totalPaid: vendor.totalPaid || 0,
        date: vendor.createdAt,
        hostel: vendor.hostel?.name || null,
        description: `Payable to ${vendor.name}`,
        paymentTerms: vendor.paymentTerms,
      }));

      total = vendorsCount;
      totalAmount = vendors.reduce((sum, v) => sum + (v.totalPayable || 0), 0);
    } else if (type === 'laundry') {
      // Laundry payables (from expenses with laundry category or alerts)
      const laundryFilter = {
        ...filter,
        category: { contains: 'laundry', mode: 'insensitive' },
        ...(search ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      };

      const [laundryExpenses, laundryCount] = await Promise.all([
        prisma.expense.findMany({
          where: laundryFilter,
          include: {
            hostel: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.expense.count({ where: laundryFilter }),
      ]);

      payables = laundryExpenses.map(expense => ({
        id: expense.id,
        reference: `LAUNDRY-${expense.id}`,
        type: 'laundry',
        title: expense.title,
        category: expense.category,
        amount: expense.amount,
        date: expense.date,
        hostel: expense.hostel?.name || null,
        description: expense.title,
      }));

      total = laundryCount;
      totalAmount = laundryExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    }

    return successResponse(res, {
      items: payables,
      total,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    }, 'Payables retrieved successfully');
  } catch (error) {
    console.error('Get payables error:', error);
    return errorResponse(res, error.message);
  }
};

/**
 * GET /api/admin/accounts/receivables
 * Get receivables (money to be received - pending/overdue payments)
 */
const getReceivables = async (req, res) => {
  try {
    const { hostelId, search, page = 1, limit = 20, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build date filter - try paymentDate first, fallback to createdAt
    const paymentDateFilter = {};
    if (startDate || endDate) {
      paymentDateFilter.createdAt = {};
      if (startDate) paymentDateFilter.createdAt.gte = new Date(startDate);
      if (endDate) paymentDateFilter.createdAt.lte = new Date(endDate);
    }

    // Build search filter
    const searchFilter = {};
    if (search) {
      searchFilter.OR = [
        { receiptNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Receivables are payments with status: pending, overdue, or partial
    const paymentFilter = {
      status: { in: ['pending', 'overdue', 'partial'] },
      ...(hostelId ? { hostelId: parseInt(hostelId) } : {}),
      ...paymentDateFilter,
      ...searchFilter,
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: paymentFilter,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          hostel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.payment.count({ where: paymentFilter }),
    ]);

    // Also search by tenant name if search is provided
    let filteredPayments = payments;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPayments = payments.filter(p => 
        !p.tenant || 
        p.tenant.name?.toLowerCase().includes(searchLower) ||
        p.tenant.email?.toLowerCase().includes(searchLower) ||
        (p.receiptNumber && p.receiptNumber.toLowerCase().includes(searchLower)) ||
        (p.paymentType && p.paymentType.toLowerCase().includes(searchLower))
      );
    }

    // Helper function to generate reference number
    const generateReference = (payment) => {
      if (payment.receiptNumber) {
        return payment.receiptNumber;
      }
      const type = (payment.paymentType || 'RENT').toUpperCase();
      return `${type}-${String(payment.id).padStart(4, '0')}`;
    };

    // Helper function to determine if payment is overdue
    const isOverdue = (payment) => {
      if (payment.status === 'overdue') return true;
      if (payment.status === 'paid') return false;
      
      const paymentDate = payment.paymentDate || payment.createdAt;
      if (!paymentDate) return false;
      
      const dueDate = new Date(paymentDate);
      // If payment date is in the past and status is pending, it's overdue
      return dueDate < new Date() && payment.status === 'pending';
    };

    // Helper function to format date
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    };

    const formattedReceivables = filteredPayments.map(p => {
      const overdue = isOverdue(p);
      const status = overdue ? 'Overdue' : (p.status === 'partial' ? 'Partial' : 'Pending');
      
      return {
        id: p.id,
        reference: generateReference(p),
        type: p.paymentType || 'Rent',
        amount: parseFloat((p.amount || 0).toFixed(2)),
        date: formatDate(p.paymentDate || p.createdAt),
        rawDate: p.paymentDate || p.createdAt,
        tenant: p.tenant ? {
          id: p.tenant.id,
          name: p.tenant.name,
          email: p.tenant.email,
          phone: p.tenant.phone,
        } : null,
        tenantName: p.tenant?.name || null,
        hostel: p.hostel?.name || null,
        status: status,
        isOverdue: overdue,
      };
    });

    const totalAmount = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return successResponse(res, {
      items: formattedReceivables,
      total: filteredPayments.length,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    }, 'Receivables retrieved successfully');
  } catch (error) {
    console.error('Get receivables error:', error);
    return errorResponse(res, error.message);
  }
};

/**
 * GET /api/admin/accounts/payables/summary
 * Get summary of payables by type
 */
const getPayablesSummary = async (req, res) => {
  try {
    const { hostelId } = req.query;

    const filter = {
      ...(hostelId ? { hostelId: parseInt(hostelId) } : {}),
    };

    // Bills
    const bills = await prisma.expense.findMany({
      where: filter,
      select: { amount: true },
    });
    const billsTotal = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
    const billsCount = bills.length;

    // Vendor payables
    const vendors = await prisma.vendor.findMany({
      where: {
        ...filter,
        status: 'active',
      },
      select: { totalPayable: true },
    });
    const vendorTotal = vendors.reduce((sum, v) => sum + (v.totalPayable || 0), 0);
    const vendorCount = vendors.length;

    // Laundry
    const laundry = await prisma.expense.findMany({
      where: {
        ...filter,
        category: { contains: 'laundry', mode: 'insensitive' },
      },
      select: { amount: true },
    });
    const laundryTotal = laundry.reduce((sum, l) => sum + (l.amount || 0), 0);
    const laundryCount = laundry.length;

    return successResponse(res, {
      bills: {
        total: parseFloat(billsTotal.toFixed(2)),
        count: billsCount,
      },
      vendor: {
        total: parseFloat(vendorTotal.toFixed(2)),
        count: vendorCount,
      },
      laundry: {
        total: parseFloat(laundryTotal.toFixed(2)),
        count: laundryCount,
      },
      total: parseFloat((billsTotal + vendorTotal + laundryTotal).toFixed(2)),
    }, 'Payables summary retrieved successfully');
  } catch (error) {
    console.error('Get payables summary error:', error);
    return errorResponse(res, error.message);
  }
};

module.exports = {
  getFinancialSummary,
  getPayables,
  getReceivables,
  getPayablesSummary,
};

