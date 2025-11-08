const { prisma } = require('../../../config/db');
const { successResponse, errorResponse } = require('../../../Helper/helper');

const parseYear = (value, fallback) => {
  const year = Number(value);
  if (!Number.isFinite(year)) return fallback;
  if (year < 2000 || year > 9999) return fallback;
  return year;
};

const parseMonth = (value, fallback) => {
  const month = Number(value);
  if (!Number.isFinite(month)) return fallback;
  if (month < 1 || month > 12) return fallback;
  return month;
};

const monthName = (index) =>
  [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][index - 1] || 'Unknown';

const buildDateRange = (year, month) => {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
};

const getMonthlyRevenue = async ({ hostelId, year }) => {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);

  const paidPayments = await prisma.payment.findMany({
    where: {
      status: 'paid',
      paymentDate: { gte: start, lt: end },
      ...(hostelId ? { hostelId } : {}),
    },
    select: {
      amount: true,
      paymentDate: true,
    },
  });

  const monthly = Array.from({ length: 12 }, (_, idx) => ({
    month: idx + 1,
    revenue: 0,
  }));

  paidPayments.forEach((payment) => {
    const date = new Date(payment.paymentDate);
    const index = date.getMonth();
    monthly[index].revenue += payment.amount || 0;
  });

  return monthly.map((entry) => ({
    month: entry.month,
    label: monthName(entry.month),
    revenue: Number(entry.revenue.toFixed(2)),
  }));
};

const getMonthlyExpenses = async ({ hostelId, year }) => {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);

  const expenses = await prisma.expense.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(hostelId ? { hostelId } : {}),
    },
    select: {
      amount: true,
      date: true,
    },
  });

  const monthly = Array.from({ length: 12 }, (_, idx) => ({
    month: idx + 1,
    expense: 0,
  }));

  expenses.forEach((expense) => {
    const date = new Date(expense.date);
    const index = date.getMonth();
    monthly[index].expense += expense.amount || 0;
  });

  return monthly.map((entry) => ({
    month: entry.month,
    label: monthName(entry.month),
    expense: Number(entry.expense.toFixed(2)),
  }));
};

const sumBy = (rows, field) => rows.reduce((sum, row) => sum + (row[field] || 0), 0);

const getIncomeExpenseByCategory = async ({ hostelId, year }) => {
  const { start, end } = buildDateRange(year, 1);
  start.setMonth(0);
  end.setFullYear(year + 1, 0);

  const payments = await prisma.payment.findMany({
    where: {
      status: 'paid',
      paymentDate: { gte: start, lt: end },
      ...(hostelId ? { hostelId } : {}),
    },
    select: {
      amount: true,
      paymentType: true,
    },
  });

  const expenses = await prisma.expense.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(hostelId ? { hostelId } : {}),
    },
    select: {
      amount: true,
      category: true,
    },
  });

  const incomeByCategory = {};
  payments.forEach((payment) => {
    const category = payment.paymentType || 'Other';
    incomeByCategory[category] = (incomeByCategory[category] || 0) + (payment.amount || 0);
  });

  const expenseByCategory = {};
  expenses.forEach((entry) => {
    const category = entry.category || 'Other';
    expenseByCategory[category] = (expenseByCategory[category] || 0) + (entry.amount || 0);
  });

  const income = Object.entries(incomeByCategory).map(([category, amount]) => ({
    category,
    amount: Number(amount.toFixed(2)),
  }));

  const expense = Object.entries(expenseByCategory).map(([category, amount]) => ({
    category,
    amount: Number(amount.toFixed(2)),
  }));

  return { income, expense };
};

const getCashFlow = async ({ hostelId, year }) => {
  const months = await Promise.all(
    Array.from({ length: 12 }, (_, idx) => idx + 1).map(async (month) => {
      const { start, end } = buildDateRange(year, month);
      const [incomeRows, expenseRows] = await Promise.all([
        prisma.payment.findMany({
          where: {
            status: 'paid',
            paymentDate: { gte: start, lt: end },
            ...(hostelId ? { hostelId } : {}),
          },
          select: { amount: true },
        }),
        prisma.expense.findMany({
          where: {
            date: { gte: start, lt: end },
            ...(hostelId ? { hostelId } : {}),
          },
          select: { amount: true },
        }),
      ]);

      const income = sumBy(incomeRows, 'amount');
      const expense = sumBy(expenseRows, 'amount');
      const net = income - expense;

      return {
        month,
        label: monthName(month),
        income: Number(income.toFixed(2)),
        expense: Number(expense.toFixed(2)),
        net: Number(net.toFixed(2)),
      };
    })
  );

  let cumulative = 0;
  const timeline = months.map((entry) => {
    cumulative += entry.net;
    return {
      ...entry,
      cumulative: Number(cumulative.toFixed(2)),
    };
  });

  return timeline;
};

const getYearlyComparison = async ({ hostelId, year, range = 6 }) => {
  const years = Array.from({ length: range }, (_, idx) => year - (range - 1) + idx);

  const rows = await Promise.all(
    years.map(async (yearItem) => {
      const start = new Date(yearItem, 0, 1);
      const end = new Date(yearItem + 1, 0, 1);

      const [incomeRows, expenseRows] = await Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: 'paid',
            paymentDate: { gte: start, lt: end },
            ...(hostelId ? { hostelId } : {}),
          },
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            date: { gte: start, lt: end },
            ...(hostelId ? { hostelId } : {}),
          },
        }),
      ]);

      const income = incomeRows._sum.amount || 0;
      const expense = expenseRows._sum.amount || 0;
      const net = income - expense;

      return {
        year: yearItem,
        income: Number(income.toFixed(2)),
        expense: Number(expense.toFixed(2)),
        netIncome: Number(net.toFixed(2)),
      };
    })
  );

  return rows;
};

const getYearOverYearGrowth = (comparisonRows) => {
  const sorted = [...comparisonRows].sort((a, b) => a.year - b.year);

  const withGrowth = sorted.map((row, index) => {
    if (index === 0) {
      return { ...row, incomeGrowth: null, expenseGrowth: null, netGrowth: null };
    }

    const prev = sorted[index - 1];
    const incomeGrowth = prev.income ? ((row.income - prev.income) / prev.income) * 100 : null;
    const expenseGrowth = prev.expense ? ((row.expense - prev.expense) / prev.expense) * 100 : null;
    const netGrowth = prev.netIncome ? ((row.netIncome - prev.netIncome) / prev.netIncome) * 100 : null;

    return {
      ...row,
      incomeGrowth: incomeGrowth !== null ? Number(incomeGrowth.toFixed(1)) : null,
      expenseGrowth: expenseGrowth !== null ? Number(expenseGrowth.toFixed(1)) : null,
      netGrowth: netGrowth !== null ? Number(netGrowth.toFixed(1)) : null,
    };
  });

  return withGrowth;
};

const getPerformanceMetrics = async ({ hostelId, year }) => {
  const { start, end } = buildDateRange(year, 1);
  start.setMonth(0);
  end.setFullYear(year + 1, 0);

  const [incomeRows, expenseRows, allocationRows, tenantAggregation] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'paid',
        paymentDate: { gte: start, lt: end },
        ...(hostelId ? { hostelId } : {}),
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        date: { gte: start, lt: end },
        ...(hostelId ? { hostelId } : {}),
      },
    }),
    prisma.allocation.findMany({
      where: {
        status: 'active',
        ...(hostelId ? { hostelId } : {}),
      },
      select: {
        rentAmount: true,
        hostel: { select: { totalBeds: true } },
      },
    }),
    prisma.tenant.aggregate({
      _sum: { totalDue: true },
      where: hostelId
        ? {
            allocations: {
              some: { hostelId, status: 'active' },
            },
          }
        : {},
    }),
  ]);

  const totalIncome = incomeRows._sum.amount || 0;
  const totalExpense = expenseRows._sum.amount || 0;
  const netIncome = totalIncome - totalExpense;

  const activeRentIncome = sumBy(allocationRows, 'rentAmount');
  const totalBeds = allocationRows.reduce(
    (sum, allocation) => sum + (allocation.hostel?.totalBeds || 0),
    0
  );

  const perUnitRevenue = totalBeds ? totalIncome / totalBeds : null;
  const monthlyRevPAU = perUnitRevenue ? perUnitRevenue / 12 : null;

  const collectionEfficiency = totalIncome + (tenantAggregation._sum.totalDue || 0)
    ? (totalIncome / (totalIncome + (tenantAggregation._sum.totalDue || 0))) * 100
    : null;

  return {
    netIncome: Number(netIncome.toFixed(2)),
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
    profitMargin:
      totalIncome > 0 ? Number(((netIncome / totalIncome) * 100).toFixed(1)) : null,
    breakevenRevenue: Number((totalExpense || 0).toFixed(2)),
    marginOfSafety:
      totalIncome > 0
        ? Number(((totalIncome - totalExpense) / totalIncome).toFixed(3))
        : null,
    contributionMargin: Number((totalIncome - totalExpense).toFixed(2)),
    contributionMarginRatio:
      totalIncome > 0
        ? Number(((totalIncome - totalExpense) / totalIncome * 100).toFixed(1))
        : null,
    netProfitGrowth: null,
    collectionEfficiency: collectionEfficiency !== null
      ? Number(collectionEfficiency.toFixed(1))
      : null,
    annualRevPAU: perUnitRevenue !== null ? Number(perUnitRevenue.toFixed(2)) : null,
    monthlyRevPAU: monthlyRevPAU !== null ? Number(monthlyRevPAU.toFixed(2)) : null,
  };
};

const parseFilters = (req) => {
  const now = new Date();
  const year = parseYear(req.query.year, now.getFullYear());
  const month = parseMonth(req.query.month, now.getMonth() + 1);
  const hostelIdParam = req.query.hostelId ? Number(req.query.hostelId) : null;
  const hostelId = hostelIdParam && Number.isFinite(hostelIdParam) ? hostelIdParam : null;
  return { year, month, hostelId };
};

const buildFpaData = async ({ year, month, hostelId }) => {
  const { start, end } = buildDateRange(year, month);

  const [incomeRows, expenseRows] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'paid',
        paymentDate: { gte: start, lt: end },
        ...(hostelId ? { hostelId } : {}),
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        date: { gte: start, lt: end },
        ...(hostelId ? { hostelId } : {}),
      },
    }),
  ]);

  const totalRevenue = incomeRows._sum.amount || 0;
  const totalExpenses = expenseRows._sum.amount || 0;
  const netIncome = totalRevenue - totalExpenses;

  const [monthlyRevenue, monthlyExpense, categoryBreakdown, cashFlow, yearlyComparison] =
    await Promise.all([
      getMonthlyRevenue({ hostelId, year }),
      getMonthlyExpenses({ hostelId, year }),
      getIncomeExpenseByCategory({ hostelId, year }),
      getCashFlow({ hostelId, year }),
      getYearlyComparison({ hostelId, year, range: 6 }),
    ]);

  const performance = await getPerformanceMetrics({ hostelId, year });

  const comparisonWithGrowth = getYearOverYearGrowth(yearlyComparison);

  return {
    summary: {
      netIncome: Number(netIncome.toFixed(2)),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      profitMargin:
        totalRevenue > 0
          ? Number(((netIncome / totalRevenue) * 100).toFixed(1))
          : null,
    },
    revenueByMonth: monthlyRevenue,
    expenseByMonth: monthlyExpense,
    categoryBreakdown,
    cashFlow,
    performance,
    yearOverYear: comparisonWithGrowth,
  };
};

const getFpaSummary = async (req, res) => {
  try {
    const params = parseFilters(req);
    const data = await buildFpaData(params);
    return successResponse(res, data, 'FP&A data fetched successfully');
  } catch (error) {
    console.error('FP&A summary error:', error);
    return errorResponse(res, 'Failed to fetch FP&A data');
  }
};

const respondWithSlice = async (req, res, key, message) => {
  try {
    const params = parseFilters(req);
    const data = await buildFpaData(params);
    const payload = key ? data[key] : data;
    return successResponse(res, payload, message);
  } catch (error) {
    console.error(`FP&A ${key} error:`, error);
    return errorResponse(res, `Failed to fetch ${message.toLowerCase()}`);
  }
};

const getFpaSummaryCards = (req, res) => respondWithSlice(req, res, 'summary', 'Summary fetched');
const getFpaRevenueExpense = async (req, res) => {
  try {
    const params = parseFilters(req);
    const data = await buildFpaData(params);
    return successResponse(
      res,
      {
        revenueByMonth: data.revenueByMonth,
        expenseByMonth: data.expenseByMonth,
      },
      'Revenue and expense trends fetched'
    );
  } catch (error) {
    console.error('FP&A revenue/expense error:', error);
    return errorResponse(res, 'Failed to fetch revenue and expense trends');
  }
};
const getFpaCategoryBreakdown = (req, res) =>
  respondWithSlice(req, res, 'categoryBreakdown', 'Category breakdown fetched');
const getFpaCashFlow = (req, res) => respondWithSlice(req, res, 'cashFlow', 'Cash flow fetched');
const getFpaPerformance = (req, res) =>
  respondWithSlice(req, res, 'performance', 'Performance metrics fetched');
const getFpaYearOverYear = (req, res) =>
  respondWithSlice(req, res, 'yearOverYear', 'Year-over-year comparison fetched');

module.exports = {
  getFpaSummary,
  getFpaSummaryCards,
  getFpaRevenueExpense,
  getFpaCategoryBreakdown,
  getFpaCashFlow,
  getFpaPerformance,
  getFpaYearOverYear,
};

