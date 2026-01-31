const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper function to build date range for a month
const buildDateRange = (year, month) => {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
};

// Helper function to get month name
const getMonthName = (month) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
};

// Helper function to get month abbreviation
const getMonthAbbr = (month) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month - 1] || 'Unknown';
};

// Helper function to format amounts
const formatAmount = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
};

// Helper function to parse hostel ID
const parseHostelId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

// ===============================
// 🧮 Generate Full FP&A Summary (Dashboard Format)
// ===============================
const generateFPASummary = async (req, res) => {
  try {
    const { month, year, hostelId } = req.query;
    
    // Validate and parse inputs
    const monthNum = month ? parseInt(month) : new Date().getMonth() + 1;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const parsedHostelId = parseHostelId(hostelId);

    if (monthNum < 1 || monthNum > 12) {
      return errorResponse(res, 'Invalid month. Must be between 1-12', 400);
    }

    if (yearNum < 2000 || yearNum > 9999) {
      return errorResponse(res, 'Invalid year', 400);
    }

    const { start, end } = buildDateRange(yearNum, monthNum);

    // Build filters (matching accounts controller pattern)
    const paymentFilter = {
      status: 'paid',
      paymentDate: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    const expenseFilter = {
      date: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    // ===== 1️⃣ Income & Expense Totals =====
    const [payments, expenses] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: paymentFilter,
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: expenseFilter,
      }),
    ]);

    const totalIncome = formatAmount(payments._sum.amount);
    const totalExpense = formatAmount(expenses._sum.amount);

    // ===== 2️⃣ Core Metrics =====
    const netIncome = formatAmount(totalIncome - totalExpense);
    const profitMargin = totalIncome > 0 
      ? formatAmount((netIncome / totalIncome) * 100)
      : 0;
    const expenseRatio = totalIncome > 0 
      ? formatAmount((totalExpense / totalIncome) * 100)
      : 0;

    // ===== 3️⃣ Break-Even Analysis =====
    const fixedCosts = formatAmount(totalExpense * 0.6);
    const variableCosts = formatAmount(totalExpense * 0.4);
    const contributionMargin = formatAmount(totalIncome - variableCosts);
    const contributionMarginRatio = totalIncome > 0
      ? formatAmount((contributionMargin / totalIncome) * 100)
      : 0;
    const breakEvenRevenue = contributionMarginRatio > 0
      ? formatAmount(fixedCosts / (contributionMarginRatio / 100))
      : 0;
    const marginOfSafety = totalIncome > 0
      ? formatAmount(((totalIncome - breakEvenRevenue) / totalIncome) * 100)
      : 0;
    const marginOfSafetyValue = formatAmount(totalIncome - breakEvenRevenue);

    // ===== 4️⃣ YoY & Growth Metrics =====
    const previousYear = yearNum - 1;
    const prevFPA = await prisma.fPA.findFirst({
      where: { 
        month: monthNum.toString(),
        year: previousYear,
        ...(parsedHostelId ? { hostelId: parsedHostelId } : { hostelId: null }),
      },
    });

    const prevProfit = prevFPA?.profit || 0;
    const yoyGrowth = prevProfit > 0 
      ? formatAmount(((netIncome - prevProfit) / prevProfit) * 100)
      : 0;
    const netProfitGrowth = prevProfit === 0 && netIncome > 0 
      ? 100 
      : yoyGrowth;

    // ===== 5️⃣ Operational Metrics =====
    const tenantFilter = parsedHostelId 
      ? {
          status: 'active',
          allocations: {
            some: { hostelId: parsedHostelId, status: 'active' }
          }
        }
      : { status: 'active' };

    const [totalTenants, totalRooms, totalBeds] = await Promise.all([
      prisma.tenant.count({ where: tenantFilter }),
      prisma.room.count({
        ...(parsedHostelId ? { where: { hostelId: parsedHostelId } } : {}),
      }),
      parsedHostelId
        ? prisma.bed.count({
            where: {
              room: {
                hostelId: parsedHostelId,
              },
            },
          })
        : prisma.bed.count(),
    ]);

    // Revenue per Available Unit (RevPAU) - For backward compatibility
    // Annual: (monthly income * 12) / totalBeds
    // Monthly: monthly income / totalBeds
    const annualRevPAU = totalBeds > 0 
      ? formatAmount((totalIncome * 12) / totalBeds)
      : 0;
    const monthlyRevPAU = totalBeds > 0 
      ? formatAmount(totalIncome / totalBeds)
      : 0;

    // ===== New Metrics =====
    // Monthly Bills: Total revenue for the month (bills/income collected)
    const monthlyBills = formatAmount(totalIncome);

    // Monthly Rent: Average rent per tenant/bed for the month
    const monthlyRent = totalBeds > 0 
      ? formatAmount(totalIncome / totalBeds)
      : 0;

    // Collection Efficiency (Rent Collection Rate)
    // Compare paid rent vs all rent payments (paid + pending + overdue) for the period
    const paidRentPayments = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        ...paymentFilter,
        paymentType: 'rent',
      },
    });

    const allRentPayments = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        paymentType: 'rent',
        paymentDate: { gte: start, lt: end },
        ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
      },
    });

    const collectedRent = paidRentPayments._sum.amount || 0;
    const totalRentDue = allRentPayments._sum.amount || 0;
    const collectionEfficiency = totalRentDue > 0
      ? formatAmount((collectedRent / totalRentDue) * 100)
      : 0;

    // Total Payable: Total rent due for the month (all rent payments expected)
    const totalPayable = formatAmount(totalRentDue);

    // ===== 6️⃣ Cash Flow =====
    const monthlyCashFlow = netIncome;
    
    // Calculate cumulative cash flow from January to current month (year-to-date)
    let cumulativeCashFlow = monthlyCashFlow;
    if (monthNum > 1) {
      // Calculate cumulative from January to previous month
      let cumulativeFromStart = 0;
      for (let m = 1; m < monthNum; m++) {
        const { start: mStart, end: mEnd } = buildDateRange(yearNum, m);
        const [mPayments, mExpenses] = await Promise.all([
          prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
              status: 'paid',
              paymentDate: { gte: mStart, lt: mEnd },
              ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
            },
          }),
          prisma.expense.aggregate({
            _sum: { amount: true },
            where: {
              date: { gte: mStart, lt: mEnd },
              ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
            },
          }),
        ]);
        const mNet = (mPayments._sum.amount || 0) - (mExpenses._sum.amount || 0);
        cumulativeFromStart += mNet;
      }
      cumulativeCashFlow = formatAmount(cumulativeFromStart + monthlyCashFlow);
    }
    const cashflowRatio = totalExpense > 0 
      ? formatAmount(totalIncome / totalExpense)
      : 0;

    // ===== 7️⃣ Save or Update in DB =====
    // Only save fields that exist in the FPA schema
    const fpaData = {
      month: monthNum.toString(),
      year: yearNum,
      totalIncome,
      totalExpense,
      profit: netIncome,
      breakeven: breakEvenRevenue,
      cashflowRatio,
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    // Find existing FPA record
    const existingFPA = await prisma.fPA.findFirst({
      where: {
        month: monthNum.toString(),
        year: yearNum,
        ...(parsedHostelId ? { hostelId: parsedHostelId } : { hostelId: null }),
      },
    });

    const fpa = existingFPA
      ? await prisma.fPA.update({
          where: { id: existingFPA.id },
          data: fpaData,
        })
      : await prisma.fPA.create({
          data: fpaData,
        });

    // ===== 8️⃣ Return Comprehensive Response (Dashboard Format) =====
    return successResponse(res, {
      // Key Financial Metrics Cards (Top Section)
      keyMetrics: {
        netIncome: {
          value: netIncome,
          yoyGrowth: yoyGrowth, // Percentage for YoY display
          label: 'NET INCOME',
        },
        totalRevenue: {
          value: totalIncome,
          label: 'TOTAL REVENUE',
        },
        totalExpenses: {
          value: totalExpense,
          label: 'TOTAL EXPENSES',
        },
        profitMargin: {
          value: profitMargin,
          label: 'PROFIT MARGIN',
        },
      },
      // Break Even Analysis
      breakEvenAnalysis: {
        breakEvenRevenue: breakEvenRevenue,
        marginOfSafety: {
          value: marginOfSafetyValue,
          percentage: marginOfSafety,
        },
        contributionMargin: contributionMargin,
        contributionMarginRatio: contributionMarginRatio,
      },
      // Additional Performance Metrics
      performanceMetrics: {
        netProfitGrowth: netProfitGrowth,
        collectionEfficiency: collectionEfficiency,
        annualRevPAU: annualRevPAU,
        monthlyRevPAU: monthlyRevPAU,
        contributionMarginRatio: contributionMarginRatio,
        // New Metrics
        monthlyBills: monthlyBills,
        monthlyRent: monthlyRent,
        totalPayable: totalPayable,
      },
      // Summary Data
      summary: {
        month: monthNum,
        monthName: getMonthName(monthNum),
        year: yearNum,
        totalIncome,
        totalExpense,
        netIncome,
        profitMargin,
        expenseRatio,
        yoyGrowth,
        ...fpa,
      },
      // Operational Data
      operational: {
        totalTenants,
        totalRooms,
        totalBeds,
      },
    }, 'FP&A Summary Generated Successfully');
  } catch (error) {
    console.error('FP&A Summary Error:', error);
    return errorResponse(res, error.message || 'Failed to generate FP&A summary', 500);
  }
};

// ===============================
// 📊 Get Complete Dashboard Data
// ===============================
const getDashboardData = async (req, res) => {
  try {
    const { year, hostelId, viewType = 'monthly' } = req.query;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const parsedHostelId = parseHostelId(hostelId);
    const isMonthly = viewType === 'monthly';

    // Get monthly data for the year
    const monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      const { start, end } = buildDateRange(yearNum, month);
      
      const [payments, expenses] = await Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: 'paid',
            paymentDate: { gte: start, lt: end },
            ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
          },
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            date: { gte: start, lt: end },
            ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
          },
        }),
      ]);

      const income = formatAmount(payments._sum.amount || 0);
      const expense = formatAmount(expenses._sum.amount || 0);
      const net = formatAmount(income - expense);

      monthlyData.push({
        month: getMonthAbbr(month),
        monthName: getMonthName(month),
        monthNum: month,
        income,
        expenses: expense,
        net,
        netIncome: net,
      });
    }

    // Calculate month-to-month comparisons
    const monthlyDataWithComparison = monthlyData.map((month, index) => {
      const prevMonth = index > 0 ? monthlyData[index - 1] : null;
      return {
        ...month,
        incomeChange: prevMonth ? formatAmount(month.income - prevMonth.income) : 0,
        expenseChange: prevMonth ? formatAmount(month.expenses - prevMonth.expenses) : 0,
        netChange: prevMonth ? formatAmount(month.net - prevMonth.net) : 0,
      };
    });

    // Get yearly data (last 5 years)
    const yearlyData = [];
    const startYear = yearNum - 4;
    for (let y = startYear; y <= yearNum; y++) {
      const yearStart = new Date(y, 0, 1, 0, 0, 0, 0);
      const yearEnd = new Date(y + 1, 0, 1, 0, 0, 0, 0);

      const [payments, expenses] = await Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: 'paid',
            paymentDate: { gte: yearStart, lt: yearEnd },
            ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
          },
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            date: { gte: yearStart, lt: yearEnd },
            ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
          },
        }),
      ]);

      const income = formatAmount(payments._sum.amount || 0);
      const expense = formatAmount(expenses._sum.amount || 0);
      const net = formatAmount(income - expense);

      yearlyData.push({
        year: y,
        income,
        expenses: expense,
        net,
        netIncome: net,
      });
    }

    // Calculate year-over-year comparisons
    const yearlyDataWithComparison = yearlyData.map((year, index) => {
      const prevYear = index > 0 ? yearlyData[index - 1] : null;
      return {
        ...year,
        incomeChange: prevYear ? formatAmount(year.income - prevYear.income) : 0,
        expenseChange: prevYear ? formatAmount(year.expenses - prevYear.expenses) : 0,
        netChange: prevYear ? formatAmount(year.net - prevYear.net) : 0,
        incomeGrowth: prevYear && prevYear.income > 0
          ? formatAmount(((year.income - prevYear.income) / prevYear.income) * 100)
          : 0,
        expenseGrowth: prevYear && prevYear.expenses > 0
          ? formatAmount(((year.expenses - prevYear.expenses) / prevYear.expenses) * 100)
          : 0,
      };
    });

    // Current period totals
    const currentYear = yearlyData[yearlyData.length - 1];
    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousYear = yearlyData[yearlyData.length - 2];

    const totalIncome = isMonthly
      ? monthlyData.reduce((sum, m) => sum + m.income, 0)
      : currentYear.income;
    const totalExpenses = isMonthly
      ? monthlyData.reduce((sum, m) => sum + m.expenses, 0)
      : currentYear.expenses;
    const netIncome = formatAmount(totalIncome - totalExpenses);
    const monthlyNet = formatAmount(currentMonth.income - currentMonth.expenses);

    // YoY Growth
    const yoyGrowth = previousYear && previousYear.income > 0
      ? formatAmount(((currentYear.income - previousYear.income) / previousYear.income) * 100)
      : 0;

    // Profit Margin
    const profitMargin = totalIncome > 0
      ? formatAmount((netIncome / totalIncome) * 100)
      : 0;

    // Break Even Analysis (using average monthly data)
    const avgMonthlyIncome = monthlyData.reduce((sum, m) => sum + m.income, 0) / 12;
    const avgMonthlyExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0) / 12;
    const fixedCosts = formatAmount(avgMonthlyExpenses * 0.6);
    const variableCosts = formatAmount(avgMonthlyExpenses * 0.4);
    const contributionMargin = formatAmount(avgMonthlyIncome - variableCosts);
    const contributionMarginRatio = avgMonthlyIncome > 0
      ? formatAmount((contributionMargin / avgMonthlyIncome) * 100)
      : 0;
    const breakEvenRevenue = contributionMarginRatio > 0
      ? formatAmount(fixedCosts / (contributionMarginRatio / 100))
      : 0;
    const marginOfSafety = formatAmount(avgMonthlyIncome - breakEvenRevenue);
    const marginOfSafetyPercent = avgMonthlyIncome > 0
      ? formatAmount(((avgMonthlyIncome - breakEvenRevenue) / avgMonthlyIncome) * 100)
      : 0;

    // Additional KPIs
    const currentNet = currentYear.income - currentYear.expenses;
    const previousNet = previousYear ? previousYear.income - previousYear.expenses : 0;
    const netProfitGrowth = previousNet > 0
      ? formatAmount(((currentNet - previousNet) / previousNet) * 100)
      : 0;

    // Collection Efficiency (from payments)
    const yearStart = new Date(yearNum, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(yearNum + 1, 0, 1, 0, 0, 0, 0);
    
    const [paidRent, allRent] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'paid',
          paymentType: 'rent',
          paymentDate: { gte: yearStart, lt: yearEnd },
          ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          paymentType: 'rent',
          paymentDate: { gte: yearStart, lt: yearEnd },
          ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
        },
      }),
    ]);

    const collectedRent = formatAmount(paidRent._sum.amount || 0);
    const totalRentDue = formatAmount(allRent._sum.amount || 0);
    const collectionEfficiency = totalRentDue > 0
      ? formatAmount((collectedRent / totalRentDue) * 100)
      : 0;

    // RevPAU
    const totalBeds = parsedHostelId
      ? await prisma.bed.count({
          where: {
            room: { hostelId: parsedHostelId },
          },
        })
      : await prisma.bed.count();

    const annualRevPAU = totalBeds > 0
      ? formatAmount((currentYear.income / totalBeds))
      : 0;
    const monthlyRevPAU = totalBeds > 0
      ? formatAmount((currentMonth.income / totalBeds))
      : 0;

    // Cash Flow Analysis
    let cumulative = 0;
    const cashFlow = monthlyData.map((data) => {
      cumulative += data.net;
      return {
        ...data,
        netCashFlow: data.net,
        cumulative: formatAmount(cumulative),
      };
    });

    // Financial Ratios
    const expenseRatio = totalIncome > 0
      ? formatAmount((totalExpenses / totalIncome) * 100)
      : 0;
    const currentRatio = totalExpenses > 0
      ? formatAmount(totalIncome / totalExpenses)
      : 0;
    const operatingExpenseRatio = expenseRatio;
    const returnOnRevenue = profitMargin;

    // Category Breakdown
    const [paymentCategories, expenseCategories] = await Promise.all([
      prisma.payment.groupBy({
        by: ['paymentType'],
        where: {
          status: 'paid',
          paymentDate: { gte: yearStart, lt: yearEnd },
          ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
        },
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where: {
          date: { gte: yearStart, lt: yearEnd },
          ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
        },
        _sum: { amount: true },
      }),
    ]);

    const incomeCategories = paymentCategories.map((cat) => ({
      name: cat.paymentType || 'other',
      value: formatAmount(cat._sum.amount || 0),
    }));

    const expenseCategoriesData = expenseCategories.map((cat) => ({
      name: cat.category || 'other',
      value: formatAmount(cat._sum.amount || 0),
    }));

    return successResponse(res, {
      // Key Metrics Cards
      keyMetrics: {
        netIncome: {
          value: isMonthly ? monthlyNet : netIncome,
          yoyGrowth: yoyGrowth,
          label: 'NET INCOME',
        },
        totalRevenue: {
          value: totalIncome,
          label: 'TOTAL REVENUE',
        },
        totalExpenses: {
          value: totalExpenses,
          label: 'TOTAL EXPENSES',
        },
        profitMargin: {
          value: profitMargin,
          label: 'PROFIT MARGIN',
        },
      },
      // Monthly/Yearly Data
      monthlyData: monthlyDataWithComparison,
      yearlyData: yearlyDataWithComparison,
      // Break Even Analysis
      breakEven: {
        breakEvenRevenue,
        marginOfSafety,
        marginOfSafetyPercent,
        contributionMargin,
        contributionMarginRatio,
        fixedCosts,
        variableCosts,
      },
      // Additional Performance Metrics
      additionalKPIs: {
        netProfitGrowth,
        collectionEfficiency,
        revPAU: annualRevPAU,
        monthlyRevPAU,
        contributionMarginRatio,
      },
      // Cash Flow
      cashFlow,
      // Financial Ratios
      ratios: {
        profitMargin,
        expenseRatio,
        currentRatio,
        operatingExpenseRatio,
        returnOnRevenue,
      },
      // Category Breakdown
      categoryBreakdown: {
        income: incomeCategories,
        expenses: expenseCategoriesData,
      },
      // Summary
      summary: {
        year: yearNum,
        viewType: isMonthly ? 'monthly' : 'yearly',
        totalIncome,
        totalExpenses,
        netIncome,
        profitMargin,
        yoyGrowth,
      },
    }, 'Dashboard data fetched successfully');
  } catch (error) {
    console.error('Dashboard Data Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch dashboard data', 500);
  }
};

// ===============================
// 🖨️ Generate FP&A Printable PDF
// ===============================
const printFPAReport = async (req, res) => {
  try {
    const { month, year, hostelId } = req.query;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const parsedHostelId = hostelId ? parseInt(hostelId) : null;

    const fpa = await prisma.fPA.findFirst({
      where: { 
        month, 
        year: yearNum,
        ...(parsedHostelId ? { hostelId: parsedHostelId } : { hostelId: null }),
      },
    });

    if (!fpa) return errorResponse(res, 'No FP&A record found', 404);

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `FPA_Report_${month}_${yearNum}${parsedHostelId ? `_Hostel${parsedHostelId}` : ''}.pdf`;
    const uploadsDir = path.join(__dirname, '../../../uploads');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filePath = path.join(uploadsDir, fileName);
    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(18).text('🏨 Hostel Management - FP&A Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Month: ${month} / Year: ${yearNum}`);
    if (parsedHostelId) {
      const hostel = await prisma.hostel.findUnique({ where: { id: parsedHostelId } });
      if (hostel) {
        doc.text(`Hostel: ${hostel.name || 'N/A'}`);
      }
    }
    doc.moveDown(2);

    // Calculate metrics for display (not stored in DB)
    const profitMargin = fpa.totalIncome > 0 
      ? Number(((fpa.profit / fpa.totalIncome) * 100).toFixed(2)) 
      : 0;
    const expenseRatio = fpa.totalIncome > 0 
      ? Number(((fpa.totalExpense / fpa.totalIncome) * 100).toFixed(2)) 
      : 0;

    const keyMetrics = [
      ['Total Income', fpa.totalIncome],
      ['Total Expense', fpa.totalExpense],
      ['Profit', fpa.profit],
      ['Profit Margin (%)', profitMargin],
      ['Expense Ratio (%)', expenseRatio],
      ['Break-Even Revenue', fpa.breakeven],
      ['Cash Flow Ratio', fpa.cashflowRatio],
    ];

    keyMetrics.forEach(([label, value]) => {
      doc.text(`${label}: Rs. ${Number(value || 0).toFixed(2)}`);
    });

    doc.moveDown(2);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.end();

    doc.on('finish', () => {
      res.download(filePath, fileName, (err) => {
        if (err) console.error('Error sending file:', err);
      });
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message);
  }
};

// ===============================
// 📊 Get Monthly Comparison Data
// ===============================
const getMonthlyComparison = async (req, res) => {
  try {
    const { year, hostelId } = req.query;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const parsedHostelId = hostelId ? parseInt(hostelId) : null;

    const start = new Date(yearNum, 0, 1, 0, 0, 0, 0);
    const end = new Date(yearNum + 1, 0, 1, 0, 0, 0, 0);

    const paymentFilter = {
      status: 'paid',
      paymentDate: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    const expenseFilter = {
      date: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    // Get all payments and expenses for the year
    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: paymentFilter,
        select: { amount: true, paymentDate: true },
      }),
      prisma.expense.findMany({
        where: expenseFilter,
        select: { amount: true, date: true },
      }),
    ]);

    // Group by month
    const monthlyData = Array.from({ length: 12 }, (_, idx) => ({
      month: idx + 1,
      monthName: getMonthName(idx + 1),
      income: 0,
      expense: 0,
      netIncome: 0,
    }));

    payments.forEach((payment) => {
      const month = new Date(payment.paymentDate).getMonth();
      monthlyData[month].income += payment.amount || 0;
    });

    expenses.forEach((expense) => {
      const month = new Date(expense.date).getMonth();
      monthlyData[month].expense += expense.amount || 0;
    });

    // Calculate net income for each month
    monthlyData.forEach((data) => {
      data.netIncome = Number((data.income - data.expense).toFixed(2));
      data.income = Number(data.income.toFixed(2));
      data.expense = Number(data.expense.toFixed(2));
    });

    return successResponse(res, {
      year: yearNum,
      monthlyData,
    }, 'Monthly comparison data fetched successfully');
  } catch (error) {
    console.error('Monthly Comparison Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch monthly comparison', 500);
  }
};

// ===============================
// 📊 Get Income & Expense Categories
// ===============================
const getCategoryBreakdown = async (req, res) => {
  try {
    const { year, month, hostelId } = req.query;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const monthNum = month ? parseInt(month) : null;
    const parsedHostelId = hostelId ? parseInt(hostelId) : null;

    let start, end;
    if (monthNum) {
      const range = buildDateRange(yearNum, monthNum);
      start = range.start;
      end = range.end;
    } else {
      start = new Date(yearNum, 0, 1, 0, 0, 0, 0);
      end = new Date(yearNum + 1, 0, 1, 0, 0, 0, 0);
    }

    const paymentFilter = {
      status: 'paid',
      paymentDate: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    const expenseFilter = {
      date: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: paymentFilter,
        select: { amount: true, paymentType: true },
      }),
      prisma.expense.findMany({
        where: expenseFilter,
        select: { amount: true, category: true },
      }),
    ]);

    // Group income by payment type
    const incomeByCategory = {};
    payments.forEach((payment) => {
      const category = payment.paymentType || 'other';
      incomeByCategory[category] = (incomeByCategory[category] || 0) + (payment.amount || 0);
    });

    // Group expenses by category
    const expenseByCategory = {};
    expenses.forEach((expense) => {
      const category = expense.category || 'other';
      expenseByCategory[category] = (expenseByCategory[category] || 0) + (expense.amount || 0);
    });

    // Calculate totals and percentages
    const totalIncome = Object.values(incomeByCategory).reduce((sum, val) => sum + val, 0);
    const totalExpense = Object.values(expenseByCategory).reduce((sum, val) => sum + val, 0);

    const incomeCategories = Object.entries(incomeByCategory).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
      percentage: totalIncome > 0 ? Number(((amount / totalIncome) * 100).toFixed(2)) : 0,
    }));

    const expenseCategories = Object.entries(expenseByCategory).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
      percentage: totalExpense > 0 ? Number(((amount / totalExpense) * 100).toFixed(2)) : 0,
    }));

    return successResponse(res, {
      income: {
        total: Number(totalIncome.toFixed(2)),
        categories: incomeCategories,
      },
      expenses: {
        total: Number(totalExpense.toFixed(2)),
        categories: expenseCategories,
      },
    }, 'Category breakdown fetched successfully');
  } catch (error) {
    console.error('Category Breakdown Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch category breakdown', 500);
  }
};

// ===============================
// 💰 Get Cash Flow Analysis
// ===============================
const getCashFlowAnalysis = async (req, res) => {
  try {
    const { year, hostelId } = req.query;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const parsedHostelId = hostelId ? parseInt(hostelId) : null;

    const monthlyCashFlow = [];

    for (let month = 1; month <= 12; month++) {
      const { start, end } = buildDateRange(yearNum, month);

      const [payments, expenses] = await Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: 'paid',
            paymentDate: { gte: start, lt: end },
            ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
          },
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            date: { gte: start, lt: end },
            ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
          },
        }),
      ]);

      const income = payments._sum.amount || 0;
      const expense = expenses._sum.amount || 0;
      const net = income - expense;

      monthlyCashFlow.push({
        month,
        monthName: getMonthName(month),
        monthAbbr: getMonthAbbr(month),
        income: Number(income.toFixed(2)),
        expense: Number(expense.toFixed(2)),
        netIncome: Number(net.toFixed(2)),
      });
    }

    // Calculate cumulative cash flow
    let cumulative = 0;
    const cashFlowWithCumulative = monthlyCashFlow.map((data) => {
      cumulative += data.netIncome;
      return {
        ...data,
        cumulativeCashFlow: Number(cumulative.toFixed(2)),
      };
    });

    return successResponse(res, {
      year: yearNum,
      cashFlow: cashFlowWithCumulative,
    }, 'Cash flow analysis fetched successfully');
  } catch (error) {
    console.error('Cash Flow Analysis Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch cash flow analysis', 500);
  }
};

// ===============================
// 📈 Get Year-over-Year Growth
// ===============================
const getYearOverYearGrowth = async (req, res) => {
  try {
    const { startYear, endYear, hostelId } = req.query;
    const startYearNum = startYear ? parseInt(startYear) : new Date().getFullYear() - 4;
    const endYearNum = endYear ? parseInt(endYear) : new Date().getFullYear();
    const parsedHostelId = hostelId ? parseInt(hostelId) : null;

    const yearData = [];

    for (let year = startYearNum; year <= endYearNum; year++) {
      const start = new Date(year, 0, 1, 0, 0, 0, 0);
      const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);

      const paymentFilter = {
        status: 'paid',
        paymentDate: { gte: start, lt: end },
        ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
      };

      const expenseFilter = {
        date: { gte: start, lt: end },
        ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
      };

      const [payments, expenses] = await Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: paymentFilter,
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          where: expenseFilter,
        }),
      ]);

      const income = Number((payments._sum.amount || 0).toFixed(2));
      const expense = Number((expenses._sum.amount || 0).toFixed(2));
      const netIncome = Number((income - expense).toFixed(2));

      // Calculate growth compared to previous year
      let incomeGrowth = 0;
      let expenseGrowth = 0;
      
      if (year > startYearNum) {
        const prevYearData = yearData[yearData.length - 1];
        if (prevYearData.income > 0) {
          incomeGrowth = Number((((income - prevYearData.income) / prevYearData.income) * 100).toFixed(2));
        }
        if (prevYearData.expense > 0) {
          expenseGrowth = Number((((expense - prevYearData.expense) / prevYearData.expense) * 100).toFixed(2));
        }
      }

      yearData.push({
        year,
        income,
        expenses: expense,
        netIncome,
        incomeGrowth,
        expenseGrowth,
      });
    }

    return successResponse(res, {
      yearOverYearData: yearData,
      summary: {
        startYear: startYearNum,
        endYear: endYearNum,
        totalYears: yearData.length,
      },
    }, 'Year-over-year growth data fetched successfully');
  } catch (error) {
    console.error('Year-over-Year Growth Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch year-over-year growth', 500);
  }
};

// ===============================
// 📊 Get Break Even Analysis
// ===============================
const getBreakEvenAnalysis = async (req, res) => {
  try {
    const { year, month, hostelId } = req.query;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const monthNum = month ? parseInt(month) : null;
    const parsedHostelId = hostelId ? parseInt(hostelId) : null;

    let start, end;
    if (monthNum) {
      const range = buildDateRange(yearNum, monthNum);
      start = range.start;
      end = range.end;
    } else {
      start = new Date(yearNum, 0, 1, 0, 0, 0, 0);
      end = new Date(yearNum + 1, 0, 1, 0, 0, 0, 0);
    }

    const paymentFilter = {
      status: 'paid',
      paymentDate: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    const expenseFilter = {
      date: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    const [payments, expenses] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: paymentFilter,
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: expenseFilter,
      }),
    ]);

    const totalIncome = Number((payments._sum.amount || 0).toFixed(2));
    const totalExpense = Number((expenses._sum.amount || 0).toFixed(2));

    // Break-even calculations
    const fixedCosts = Number((totalExpense * 0.6).toFixed(2));
    const variableCosts = Number((totalExpense * 0.4).toFixed(2));
    const contributionMargin = Number((totalIncome - variableCosts).toFixed(2));
    const contributionMarginRatio = totalIncome > 0
      ? Number(((contributionMargin / totalIncome) * 100).toFixed(2))
      : 0;
    const breakEvenRevenue = contributionMarginRatio > 0
      ? Number((fixedCosts / (contributionMarginRatio / 100)).toFixed(2))
      : 0;
    const marginOfSafetyValue = totalIncome > breakEvenRevenue
      ? Number((totalIncome - breakEvenRevenue).toFixed(2))
      : 0;
    const marginOfSafetyPercentage = totalIncome > 0
      ? Number((((totalIncome - breakEvenRevenue) / totalIncome) * 100).toFixed(2))
      : 0;

    return successResponse(res, {
      breakEvenRevenue,
      marginOfSafety: {
        value: marginOfSafetyValue,
        percentage: marginOfSafetyPercentage,
      },
      contributionMargin,
      contributionMarginRatio,
      fixedCosts,
      variableCosts,
      totalRevenue: totalIncome,
      totalExpenses: totalExpense,
    }, 'Break-even analysis fetched successfully');
  } catch (error) {
    console.error('Break-Even Analysis Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch break-even analysis', 500);
  }
};

// ===============================
// 📈 Get Financial Ratios
// ===============================
const getFinancialRatios = async (req, res) => {
  try {
    const { year, month, hostelId } = req.query;
    const yearNum = year ? parseInt(year) : new Date().getFullYear();
    const monthNum = month ? parseInt(month) : null;
    const parsedHostelId = hostelId ? parseInt(hostelId) : null;

    let start, end;
    if (monthNum) {
      const range = buildDateRange(yearNum, monthNum);
      start = range.start;
      end = range.end;
    } else {
      start = new Date(yearNum, 0, 1, 0, 0, 0, 0);
      end = new Date(yearNum + 1, 0, 1, 0, 0, 0, 0);
    }

    const paymentFilter = {
      status: 'paid',
      paymentDate: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    const expenseFilter = {
      date: { gte: start, lt: end },
      ...(parsedHostelId ? { hostelId: parsedHostelId } : {}),
    };

    const [payments, expenses] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: paymentFilter,
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: expenseFilter,
      }),
    ]);

    const totalIncome = payments._sum.amount || 0;
    const totalExpense = expenses._sum.amount || 0;
    const netIncome = totalIncome - totalExpense;

    // Calculate ratios
    const profitMargin = totalIncome > 0 
      ? Number(((netIncome / totalIncome) * 100).toFixed(2)) 
      : 0;

    const expenseRatio = totalIncome > 0 
      ? Number(((totalExpense / totalIncome) * 100).toFixed(2)) 
      : 0;

    const currentRatio = totalExpense > 0 
      ? Number((totalIncome / totalExpense).toFixed(2)) 
      : 0;

    const operatingExpenseRatio = totalIncome > 0 
      ? Number(((totalExpense / totalIncome) * 100).toFixed(2)) 
      : 0;

    const returnOnRevenue = totalIncome > 0 
      ? Number(((netIncome / totalIncome) * 100).toFixed(2)) 
      : 0;

    return successResponse(res, {
      ratios: {
        profitMargin: {
          value: profitMargin,
          label: 'Profit Margin',
          description: 'Net Profit / Revenue',
        },
        expenseRatio: {
          value: expenseRatio,
          label: 'Expense Ratio',
          description: 'Expenses / Revenue',
        },
        currentRatio: {
          value: currentRatio,
          label: 'Current Ratio',
          description: 'Income / Expenses',
        },
        operatingExpenseRatio: {
          value: operatingExpenseRatio,
          label: 'Operating Expense Ratio',
          description: 'Operating Costs / Revenue',
        },
        returnOnRevenue: {
          value: returnOnRevenue,
          label: 'Return on Revenue',
          description: 'ROI from Revenue',
        },
      },
      summary: {
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpense: Number(totalExpense.toFixed(2)),
        netIncome: Number(netIncome.toFixed(2)),
      },
    }, 'Financial ratios fetched successfully');
  } catch (error) {
    console.error('Financial Ratios Error:', error);
    return errorResponse(res, error.message || 'Failed to fetch financial ratios', 500);
  }
};

module.exports = { 
  generateFPASummary,
  getDashboardData,
  printFPAReport,
  getMonthlyComparison,
  getCategoryBreakdown,
  getCashFlowAnalysis,
  getFinancialRatios,
  getYearOverYearGrowth,
  getBreakEvenAnalysis,
};
