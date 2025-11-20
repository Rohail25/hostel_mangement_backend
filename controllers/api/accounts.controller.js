const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');

/**
 * =====================================================
 * ACCOUNTS CONTROLLER - Financial Dashboard
 * =====================================================
 *
 * Provides financial overview, payables, and receivables
 * for the Accounts dashboard
 */

const RECEIVABLE_PENDING_STATUSES = ['pending', 'overdue', 'partial'];
const RECEIVABLE_PAID_STATUSES = ['paid'];
const RECEIVABLE_ALL_STATUSES = [
  ...new Set([...RECEIVABLE_PENDING_STATUSES, ...RECEIVABLE_PAID_STATUSES]),
];

const RECEIVABLE_STATUS_LABELS = {
  pending: 'Pending',
  overdue: 'Overdue',
  partial: 'Partial',
  paid: 'Paid',
};

const CAPITAL_TRANSACTION_TYPES = [
  'capital_investment',
  'owner_investment',
  'owner_contribution',
  'investment',
  'capital',
  'deposit',
  'security_deposit',
  'refundable_deposit',
];

const CAPITAL_PAYMENT_TYPES = ['deposit'];

const formatAmount = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
};

const parseHostelId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildExpenseSearchClause = (searchTerm) => {
  if (!searchTerm) return null;
  const value = searchTerm.trim();
  if (!value) return null;

  // Check if search term looks like a reference number (e.g., EXP-3001)
  const referenceMatch = value.match(/^(EXP|LAUNDRY|ALERT)-?(\d+)$/i);
  
  return {
    OR: [
      { title: { contains: value, mode: 'insensitive' } },
      { category: { contains: value, mode: 'insensitive' } },
      { type: { contains: value, mode: 'insensitive' } },
      // If it's a reference number, search by ID
      ...(referenceMatch ? [{ id: parseInt(referenceMatch[2], 10) }] : []),
    ],
  };
};

const buildAlertSearchClause = (searchTerm) => {
  if (!searchTerm) return null;
  const value = searchTerm.trim();
  if (!value) return null;

  return {
    OR: [
      { title: { contains: value, mode: 'insensitive' } },
      { description: { contains: value, mode: 'insensitive' } },
    ],
  };
};

const buildVendorSearchClause = (searchTerm) => {
  if (!searchTerm) return null;
  const value = searchTerm.trim();
  if (!value) return null;

  return {
    OR: [
      { name: { contains: value, mode: 'insensitive' } },
      { companyName: { contains: value, mode: 'insensitive' } },
      { email: { contains: value, mode: 'insensitive' } },
    ],
  };
};

const buildPaymentSearchClause = (searchTerm) => {
  if (!searchTerm) return null;
  const value = searchTerm.trim();
  if (!value) return null;

  // Check if search term looks like a reference number (e.g., RENT-1001)
  const referenceMatch = value.match(/^(RENT|DEPOSIT|MAINTENANCE|ELECTRICITY|WATER|OTHER)-?(\d+)$/i);
  
  return {
    OR: [
      { receiptNumber: { contains: value, mode: 'insensitive' } },
      { paymentType: { contains: value, mode: 'insensitive' } },
      { tenant: { name: { contains: value, mode: 'insensitive' } } },
      { tenant: { email: { contains: value, mode: 'insensitive' } } },
      { hostel: { name: { contains: value, mode: 'insensitive' } } },
      // If it's a reference number, search by ID
      ...(referenceMatch ? [{ id: parseInt(referenceMatch[2], 10) }] : []),
    ],
  };
};

const buildExpenseFilter = ({ hostelId, search, excludeLaundry = false }) => {
  const andClauses = [];

  // Exclude laundry expenses if requested (for bills view)
  if (excludeLaundry) {
    andClauses.push({
      NOT: {
        OR: [
          { category: { contains: 'laundry', mode: 'insensitive' } },
          { title: { contains: 'laundry', mode: 'insensitive' } },
        ],
      },
    });
  }

  const searchClause = buildExpenseSearchClause(search);
  if (searchClause) {
    andClauses.push(searchClause);
  }

  const filter = {
    ...(hostelId ? { hostelId } : {}),
    ...(andClauses.length > 0 ? { AND: andClauses } : {}),
  };

  return filter;
};

const buildAlertFilter = ({ hostelId, search }) => {
  const filter = {
    type: 'bill',
    ...(hostelId ? { hostelId } : {}),
  };

  const searchClause = buildAlertSearchClause(search);
  if (searchClause) {
    filter.AND = [searchClause];
  }

  return filter;
};

const buildVendorFilter = ({ hostelId, search }) => {
  const filter = {
    status: 'active',
    ...(hostelId ? { hostelId } : {}),
  };

  const searchClause = buildVendorSearchClause(search);
  if (searchClause) {
    filter.AND = [searchClause];
  }

  return filter;
};

const buildLaundryFilter = ({ hostelId, search }) => {
  const filter = {
    ...(hostelId ? { hostelId } : {}),
    category: { contains: 'laundry' },
  };

  const searchClause = buildExpenseSearchClause(search);
  if (searchClause) {
    filter.AND = [searchClause];
  }

  return filter;
};

const buildPaymentWhere = ({ hostelId, paymentType, statuses, startDate, endDate, search }) => {
  const where = {};

  if (hostelId) {
    where.hostelId = hostelId;
  }

  if (paymentType) {
    where.paymentType = paymentType;
  }

  if (statuses?.length) {
    where.status = { in: statuses };
  }

  const andClauses = [];

  if (startDate || endDate) {
    const createdRange = {};
    const paymentRange = {};

    if (startDate) {
      const start = new Date(startDate);
      createdRange.gte = start;
      paymentRange.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      createdRange.lte = end;
      paymentRange.lte = end;
    }

    andClauses.push({
      OR: [
        { createdAt: createdRange },
        { paymentDate: paymentRange },
      ],
    });
  }

  const searchClause = buildPaymentSearchClause(search);
  if (searchClause) {
    andClauses.push(searchClause);
  }

  if (andClauses.length) {
    where.AND = andClauses;
  }

  return where;
};

const buildCapitalTransactionFilter = ({ hostelId, startDate, endDate }) => {
  const where = {
    transactionType: { in: CAPITAL_TRANSACTION_TYPES },
  };

  if (hostelId) {
    where.hostelId = hostelId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  return where;
};

const buildCapitalPaymentFilter = ({ hostelId, startDate, endDate }) => {
  const where = {
    status: 'paid',
    paymentType: { in: CAPITAL_PAYMENT_TYPES },
  };

  if (hostelId) {
    where.hostelId = hostelId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  return where;
};

const computePayablesSummary = async ({ hostelId, search, type }) => {
  // For bills summary, exclude laundry
  const billsExpenseFilter = buildExpenseFilter({ hostelId, search, excludeLaundry: true });
  const alertFilter = buildAlertFilter({ hostelId, search });
  const vendorFilter = buildVendorFilter({ hostelId, search });
  const laundryFilter = buildLaundryFilter({ hostelId, search });
  // For "all" summary, include everything
  const allExpenseFilter = buildExpenseFilter({ hostelId, search, excludeLaundry: false });

  const [billsExpenseAgg, alertAgg, vendorAgg, laundryAgg, allExpenseAgg] = await Promise.all([
    prisma.expense.aggregate({
      where: billsExpenseFilter,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.alert.aggregate({
      where: alertFilter,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.vendor.aggregate({
      where: vendorFilter,
      _sum: { totalPayable: true },
      _count: { _all: true },
    }),
    prisma.expense.aggregate({
      where: laundryFilter,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.expense.aggregate({
      where: allExpenseFilter,
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const billsAmount = (billsExpenseAgg._sum.amount || 0) + (alertAgg._sum.amount || 0);
  const billsCount = (billsExpenseAgg._count._all || 0) + (alertAgg._count._all || 0);

  const vendorAmount = vendorAgg._sum.totalPayable || 0;
  const vendorCount = vendorAgg._count._all || 0;

  const laundryAmount = laundryAgg._sum.amount || 0;
  const laundryCount = laundryAgg._count._all || 0;

  // For "all" type, include all expenses (bills + laundry) but not vendor
  const allAmount = (allExpenseAgg._sum.amount || 0) + (alertAgg._sum.amount || 0);
  const allCount = (allExpenseAgg._count._all || 0) + (alertAgg._count._all || 0);

  return {
    bills: {
      total: formatAmount(billsAmount),
      count: billsCount,
    },
    vendor: {
      total: formatAmount(vendorAmount),
      count: vendorCount,
    },
    laundry: {
      total: formatAmount(laundryAmount),
      count: laundryCount,
    },
    all: {
      total: formatAmount(allAmount),
      count: allCount,
    },
    total: formatAmount(billsAmount + vendorAmount + laundryAmount),
  };
};

/**
 * GET /api/admin/accounts/summary
 * Get financial summary (Total Income, Expenses, Profit/Loss, Capital Invested)
 */
const getFinancialSummary = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const parsedHostelId = parseHostelId(hostelId);

    const paymentDateFilter = {};
    if (startDate || endDate) {
      paymentDateFilter.createdAt = {};
      if (startDate) paymentDateFilter.createdAt.gte = new Date(startDate);
      if (endDate) paymentDateFilter.createdAt.lte = new Date(endDate);
    }

    const expenseDateFilter = {};
    if (startDate || endDate) {
      expenseDateFilter.date = {};
      if (startDate) expenseDateFilter.date.gte = new Date(startDate);
      if (endDate) expenseDateFilter.date.lte = new Date(endDate);
    }

    const [incomeAgg, expenseAgg, receivableGroups, capitalTransactionsAgg, capitalPaymentsAgg] =
      await Promise.all([
        prisma.payment.aggregate({
          where: {
            status: 'paid',
            ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
            ...paymentDateFilter,
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
            ...expenseDateFilter,
          },
          _sum: { amount: true },
        }),
        prisma.payment.groupBy({
          by: ['status'],
          where: {
            ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
            ...paymentDateFilter,
            status: { in: RECEIVABLE_ALL_STATUSES },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.transaction.aggregate({
          where: buildCapitalTransactionFilter({
            hostelId: parsedHostelId,
            startDate,
            endDate,
          }),
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: buildCapitalPaymentFilter({
            hostelId: parsedHostelId,
            startDate,
            endDate,
          }),
          _sum: { amount: true },
        }),
      ]);

    const totalIncome = formatAmount(incomeAgg._sum.amount);
    const totalExpenses = formatAmount(expenseAgg._sum.amount);
    const profitLoss = formatAmount(totalIncome - totalExpenses);

    const receivableBreakdown = RECEIVABLE_ALL_STATUSES.reduce((acc, status) => {
      acc[status] = { amount: 0, count: 0 };
      return acc;
    }, {});

    receivableGroups.forEach((group) => {
      const status = group.status?.toLowerCase();
      if (!status || !receivableBreakdown[status]) return;
      receivableBreakdown[status] = {
        amount: formatAmount(group._sum.amount),
        count: group._count._all || 0,
      };
    });

    const pendingTotal =
      (receivableBreakdown.pending?.amount || 0) +
      (receivableBreakdown.overdue?.amount || 0) +
      (receivableBreakdown.partial?.amount || 0);

    const receivedTotal = receivableBreakdown.paid?.amount || 0;

    const capitalInvested = formatAmount(
      (capitalTransactionsAgg._sum.amount || 0) + (capitalPaymentsAgg._sum.amount || 0),
    );

    return successResponse(
      res,
      {
        totalIncome,
        totalExpenses,
        profitLoss,
        capitalInvested,
        badDebt: pendingTotal, // Backwards compatibility with previous field name
        totalReceivable: formatAmount(pendingTotal),
        totalReceived: formatAmount(receivedTotal),
        isProfit: profitLoss >= 0,
        receivablesBreakdown: receivableBreakdown,
        meta: {
          hostelId: parsedHostelId,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
      'Financial summary retrieved successfully',
    );
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
    const parsedHostelId = parseHostelId(hostelId);
    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Number.parseInt(limit, 10) || 20;
    const skip = (pageNumber - 1) * limitNumber;
    const normalizedSearch = typeof search === 'string' ? search.trim() : null;

    let payables = [];
    let total = 0;
    let totalAmount = 0;

    if (type === 'vendor') {
      const vendorFilter = buildVendorFilter({ hostelId: parsedHostelId, search: normalizedSearch });

      const [vendors, vendorsCount] = await Promise.all([
        prisma.vendor.findMany({
          where: vendorFilter,
          include: {
            hostel: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNumber,
        }),
        prisma.vendor.count({ where: vendorFilter }),
      ]);

      payables = vendors.map((vendor) => {
        // Determine status based on balance
        let status = 'Paid';
        if (vendor.balance > 0) {
          status = 'Pending';
        } else if (vendor.totalPayable > 0 && vendor.totalPaid === 0) {
          status = 'Pending';
        }

        return {
          id: vendor.id,
          reference: `VENDOR-${String(vendor.id).padStart(4, '0')}`,
          type: 'Vendor',
          title: vendor.name,
          companyName: vendor.companyName,
          category: vendor.category || 'vendor',
          amount: formatAmount(-Math.abs(vendor.totalPayable || 0)), // Negative amount for payables
          balance: formatAmount(vendor.balance || 0),
          totalPaid: formatAmount(vendor.totalPaid || 0),
          date: vendor.createdAt,
          hostel: vendor.hostel?.name || null,
          description: vendor.paymentTerms ? `Terms: ${vendor.paymentTerms}` : `Payable to ${vendor.name}`,
          paymentTerms: vendor.paymentTerms,
          status,
        };
      });

      total = vendorsCount;
      totalAmount = payables.reduce((sum, vendor) => sum + Math.abs(vendor.amount || 0), 0);
    } else if (type === 'laundry') {
      const laundryFilter = buildLaundryFilter({ hostelId: parsedHostelId, search: normalizedSearch });

      const [laundryExpenses, laundryCount] = await Promise.all([
        prisma.expense.findMany({
          where: laundryFilter,
          include: {
            hostel: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          skip,
          take: limitNumber,
        }),
        prisma.expense.count({ where: laundryFilter }),
      ]);

      payables = laundryExpenses.map((expense) => ({
        id: expense.id,
        reference: `EXP-${String(expense.id).padStart(4, '0')}`,
        type: 'Expense',
        title: expense.title,
        category: expense.category,
        amount: formatAmount(-Math.abs(expense.amount)), // Negative amount for expenses
        date: expense.date,
        hostel: expense.hostel?.name || null,
        description: expense.title || expense.category,
        status: 'Paid', // Laundry expenses are considered paid when created
      }));

      total = laundryCount;
      totalAmount = payables.reduce((sum, expense) => sum + Math.abs(expense.amount || 0), 0);
    } else if (type === 'bills' || !type) {
      // Bills view: expenses (excluding laundry) + bill alerts
      const expenseFilter = buildExpenseFilter({ 
        hostelId: parsedHostelId, 
        search: normalizedSearch,
        excludeLaundry: true 
      });
      const alertFilter = buildAlertFilter({ hostelId: parsedHostelId, search: normalizedSearch });

      const [expenses, expenseCount, billAlerts] = await Promise.all([
        prisma.expense.findMany({
          where: expenseFilter,
          include: {
            hostel: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          skip,
          take: limitNumber,
        }),
        prisma.expense.count({ where: expenseFilter }),
        prisma.alert.findMany({
          where: alertFilter,
          include: {
            hostel: { select: { name: true } },
            tenant: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const formattedBills = expenses.map((bill) => ({
        id: bill.id,
        reference: `EXP-${String(bill.id).padStart(4, '0')}`,
        type: 'Expense',
        title: bill.title,
        category: bill.category,
        amount: formatAmount(-Math.abs(bill.amount)), // Negative amount for expenses
        date: bill.date,
        hostel: bill.hostel?.name || null,
        description: bill.title || bill.category,
        status: 'Paid', // Expenses are considered paid when created
      }));

      const formattedAlerts = billAlerts.map((alert) => {
        // Map alert status to payment status format
        const statusMap = {
          pending: 'Pending',
          in_progress: 'Pending',
          resolved: 'Paid',
          dismissed: 'Paid',
        };
        const status = statusMap[alert.status] || 'Pending';

        return {
          id: alert.id,
          reference: `ALERT-${String(alert.id).padStart(4, '0')}`,
          type: 'Expense',
          title: alert.title,
          category: 'bill',
          amount: formatAmount(-Math.abs(alert.amount || 0)), // Negative amount
          date: alert.createdAt,
          hostel: alert.hostel?.name || null,
          tenant: alert.tenant?.name || null,
          description: alert.description || alert.title,
          status,
        };
      });

      payables = [...formattedBills, ...formattedAlerts];
      total = expenseCount + billAlerts.length;
      totalAmount = payables.reduce((sum, payable) => sum + Math.abs(payable.amount || 0), 0);
    } else {
      // Default to "all" - all expenses (bills + laundry) + bill alerts, but not vendor
      const expenseFilter = buildExpenseFilter({ 
        hostelId: parsedHostelId, 
        search: normalizedSearch,
        excludeLaundry: false 
      });
      const alertFilter = buildAlertFilter({ hostelId: parsedHostelId, search: normalizedSearch });

      const [expenses, expenseCount, billAlerts] = await Promise.all([
        prisma.expense.findMany({
          where: expenseFilter,
          include: {
            hostel: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          skip,
          take: limitNumber,
        }),
        prisma.expense.count({ where: expenseFilter }),
        prisma.alert.findMany({
          where: alertFilter,
          include: {
            hostel: { select: { name: true } },
            tenant: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const formattedBills = expenses.map((bill) => ({
        id: bill.id,
        reference: `EXP-${String(bill.id).padStart(4, '0')}`,
        type: 'Expense',
        title: bill.title,
        category: bill.category,
        amount: formatAmount(-Math.abs(bill.amount)), // Negative amount for expenses
        date: bill.date,
        hostel: bill.hostel?.name || null,
        description: bill.title || bill.category,
        status: 'Paid',
      }));

      const formattedAlerts = billAlerts.map((alert) => {
        const statusMap = {
          pending: 'Pending',
          in_progress: 'Pending',
          resolved: 'Paid',
          dismissed: 'Paid',
        };
        const status = statusMap[alert.status] || 'Pending';

        return {
          id: alert.id,
          reference: `ALERT-${String(alert.id).padStart(4, '0')}`,
          type: 'Expense',
          title: alert.title,
          category: 'bill',
          amount: formatAmount(-Math.abs(alert.amount || 0)),
          date: alert.createdAt,
          hostel: alert.hostel?.name || null,
          tenant: alert.tenant?.name || null,
          description: alert.description || alert.title,
          status,
        };
      });

      payables = [...formattedBills, ...formattedAlerts];
      total = expenseCount + billAlerts.length;
      totalAmount = payables.reduce((sum, payable) => sum + Math.abs(payable.amount || 0), 0);
    }

    const summary = await computePayablesSummary({
      hostelId: parsedHostelId,
      search: normalizedSearch,
      type: type || 'bills',
    });

    return successResponse(
      res,
      {
        items: payables,
        total,
        totalAmount: formatAmount(totalAmount),
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          pages: limitNumber > 0 ? Math.ceil(total / limitNumber) : 1,
        },
        summary,
        meta: {
          type: type || 'bills',
          hostelId: parsedHostelId,
          search: normalizedSearch || null,
        },
      },
      'Payables retrieved successfully',
    );
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
    const {
      hostelId,
      search,
      page = 1,
      limit = 20,
      startDate,
      endDate,
      status,
      view,
      category,
      type,
    } = req.query;

    const parsedHostelId = parseHostelId(hostelId);
    const pageNumber = Number.parseInt(page, 10) || 1;
    const limitNumber = Number.parseInt(limit, 10) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const normalizedSearch = typeof search === 'string' ? search.trim() : null;
    const normalizedView = (view || status || 'all').toString().toLowerCase();

    const paymentTypeFilter = (() => {
      const raw = category || type;
      if (!raw || raw === 'all') return null;
      return raw.toString().toLowerCase();
    })();

    const statusMap = {
      all: RECEIVABLE_ALL_STATUSES, // Show all payments (pending + paid)
      pending: ['pending'],
      overdue: ['overdue'],
      partial: ['partial'],
      received: RECEIVABLE_PAID_STATUSES,
      paid: RECEIVABLE_PAID_STATUSES,
      completed: RECEIVABLE_PAID_STATUSES,
      everything: RECEIVABLE_ALL_STATUSES,
    };

    const activeStatuses = statusMap[normalizedView] || statusMap.all;

    const baseFilterParams = {
      hostelId: parsedHostelId,
      paymentType: paymentTypeFilter,
      startDate,
      endDate,
      search: normalizedSearch,
    };

    const itemsWhere = buildPaymentWhere({
      ...baseFilterParams,
      statuses: activeStatuses,
    });

    const summaryWhere = buildPaymentWhere({
      ...baseFilterParams,
      statuses: RECEIVABLE_ALL_STATUSES,
    });

    const [payments, totalItems, summaryGroups] = await Promise.all([
      prisma.payment.findMany({
        where: itemsWhere,
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
        orderBy: [
          { paymentDate: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limitNumber,
      }),
      prisma.payment.count({ where: itemsWhere }),
      prisma.payment.groupBy({
        by: ['status'],
        where: summaryWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const summary = RECEIVABLE_ALL_STATUSES.reduce((acc, statusKey) => {
      acc[statusKey] = { amount: 0, count: 0 };
      return acc;
    }, {});

    summaryGroups.forEach((group) => {
      const statusKey = group.status?.toLowerCase();
      if (!statusKey || !summary[statusKey]) return;
      summary[statusKey] = {
        amount: formatAmount(group._sum.amount),
        count: group._count._all || 0,
      };
    });

    const generateReference = (payment) => {
      if (payment.receiptNumber) return payment.receiptNumber;
      const typeLabel = (payment.paymentType || 'rent').toUpperCase();
      // Format: RENT-1001, DEPOSIT-2001, etc.
      return `${typeLabel}-${String(payment.id).padStart(4, '0')}`;
    };

    const formattedReceivables = payments.map((payment) => {
      const statusKey = payment.status?.toLowerCase();
      const statusLabel =
        RECEIVABLE_STATUS_LABELS[statusKey] || RECEIVABLE_STATUS_LABELS.pending;

      // Capitalize payment type for display
      const paymentType = payment.paymentType || 'rent';
      const capitalizedType = paymentType.charAt(0).toUpperCase() + paymentType.slice(1);

      return {
        id: payment.id,
        reference: generateReference(payment),
        type: capitalizedType,
        amount: formatAmount(Math.abs(payment.amount || 0)), // Positive amount for receivables
        date: payment.paymentDate || payment.createdAt,
        tenant: payment.tenant
          ? {
              id: payment.tenant.id,
              name: payment.tenant.name,
              email: payment.tenant.email,
              phone: payment.tenant.phone,
            }
          : null,
        hostel: payment.hostel?.name || null,
        status: statusLabel,
        rawStatus: statusKey,
        isOverdue: statusKey === 'overdue',
      };
    });

    const totalAmount = formattedReceivables.reduce(
      (sum, item) => sum + Math.abs(item.amount || 0),
      0,
    );

    const pendingTotal =
      (summary.pending?.amount || 0) +
      (summary.overdue?.amount || 0) +
      (summary.partial?.amount || 0);

    return successResponse(
      res,
      {
        items: formattedReceivables,
        total: totalItems,
        totalAmount: formatAmount(totalAmount),
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          pages: limitNumber > 0 ? Math.ceil(totalItems / limitNumber) : 1,
        },
        summary: {
          ...summary,
          totals: {
            pending: formatAmount(pendingTotal),
            received: formatAmount(summary.paid?.amount || 0),
          },
        },
        meta: {
          hostelId: parsedHostelId,
          view: normalizedView,
          paymentType: paymentTypeFilter,
          search: normalizedSearch || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
      'Receivables retrieved successfully',
    );
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
    const { hostelId, search, type } = req.query;
    const parsedHostelId = parseHostelId(hostelId);
    const normalizedSearch = typeof search === 'string' ? search.trim() : null;

    const summary = await computePayablesSummary({
      hostelId: parsedHostelId,
      search: normalizedSearch,
      type: type || 'bills',
    });

    return successResponse(
      res,
      {
        ...summary,
        meta: {
          hostelId: parsedHostelId,
          search: normalizedSearch || null,
          type: type || 'bills',
        },
      },
      'Payables summary retrieved successfully',
    );
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

