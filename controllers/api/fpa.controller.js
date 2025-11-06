const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ===============================
// 🧮 Generate Full FP&A Summary
// ===============================
const generateFPASummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const monthStr = `${year}-${month}`;

    // ===== 1️⃣ Income & Expense Totals =====
    const payments = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { forMonth: monthStr, status: 'paid' },
    });

    const expenses = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        type: 'monthly',
        date: { gte: new Date(`${year}-${month}-01`) },
      },
    });

    const totalIncome = payments._sum.amount || 0;
    const totalExpense = expenses._sum.amount || 0;

    // ===== 2️⃣ Core Metrics =====
    const netIncome = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

    // ===== 3️⃣ Break-Even Analysis =====
    const fixedCosts = totalExpense * 0.6;
    const variableCosts = totalExpense * 0.4;
    const contributionMargin = totalIncome - variableCosts;
    const contributionMarginRatio = totalIncome > 0
      ? (contributionMargin / totalIncome) * 100
      : 0;
    const breakEvenRevenue = contributionMarginRatio > 0
      ? fixedCosts / (contributionMarginRatio / 100)
      : 0;
    const marginOfSafety = totalIncome > 0
      ? ((totalIncome - breakEvenRevenue) / totalIncome) * 100
      : 0;

    // ===== 4️⃣ YoY & Growth Metrics =====
    const previousYear = parseInt(year) - 1;
    const prevFPA = await prisma.fPA.findFirst({
      where: { month, year: previousYear },
    });

    const prevProfit = prevFPA?.profit || 0;
    const yoyGrowth = prevProfit > 0 ? ((netIncome - prevProfit) / prevProfit) * 100 : 0;
    const netProfitGrowth = prevProfit === 0 ? 100 : yoyGrowth;

    // ===== 5️⃣ Operational Metrics =====
    const totalTenants = await prisma.tenant.count({ where: { status: 'active' } });
    const totalRooms = await prisma.room.count();
    const totalBeds = await prisma.bed.count();

    // Revenue per Available Unit (RevPAU)
    const revPAU = totalBeds > 0 ? totalIncome / totalBeds : 0;

    // Collection Efficiency (Rent Collection Rate)
    const rentDue = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { paymentType: 'rent' },
    });
    const collectedRent = payments._sum.amount || 0;
    const collectionEfficiency =
      rentDue._sum.amount > 0
        ? (collectedRent / rentDue._sum.amount) * 100
        : 0;

    // ===== 6️⃣ Cash Flow =====
    const monthlyCashFlow = netIncome;
    const previousCash = prevFPA?.cashflowRatio || 0;
    const cumulativeCashFlow = previousCash + monthlyCashFlow;
    const cashflowRatio = totalExpense > 0 ? totalIncome / totalExpense : 0;

    // ===== 7️⃣ Save or Update in DB =====
    const fpa = await prisma.fPA.upsert({
      where: { month_year: { month, year: parseInt(year) } },
      update: {
        totalIncome,
        totalExpense,
        profit: netIncome,
        breakeven: breakEvenRevenue,
        cashflowRatio,
        profitMargin,
        expenseRatio,
        fixedCosts,
        variableCosts,
        contributionMargin,
        contributionMarginRatio,
        marginOfSafety,
        netProfitGrowth,
        yoyGrowth,
        collectionEfficiency,
        revPAU,
      },
      create: {
        month,
        year: parseInt(year),
        totalIncome,
        totalExpense,
        profit: netIncome,
        breakeven: breakEvenRevenue,
        cashflowRatio,
        profitMargin,
        expenseRatio,
        fixedCosts,
        variableCosts,
        contributionMargin,
        contributionMarginRatio,
        marginOfSafety,
        netProfitGrowth,
        yoyGrowth,
        collectionEfficiency,
        revPAU,
      },
    });

    return successResponse(res, {
      summary: fpa,
      metrics: {
        totalIncome,
        totalExpense,
        netIncome,
        profitMargin,
        expenseRatio,
        fixedCosts,
        variableCosts,
        contributionMargin,
        contributionMarginRatio,
        breakEvenRevenue,
        marginOfSafety,
        yoyGrowth,
        netProfitGrowth,
        collectionEfficiency,
        revPAU,
        monthlyCashFlow,
        cumulativeCashFlow,
      },
    }, 'FP&A Summary Generated Successfully');
  } catch (error) {
    console.error(error);
    return errorResponse(res, error.message);
  }
};

// ===============================
// 🖨️ Generate FP&A Printable PDF
// ===============================
const printFPAReport = async (req, res) => {
  try {
    const { month, year } = req.query;

    const fpa = await prisma.fPA.findFirst({
      where: { month, year: parseInt(year) },
    });

    if (!fpa) return errorResponse(res, 'No FP&A record found', 404);

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `FPA_Report_${month}_${year}.pdf`;
    const filePath = path.join(__dirname, `../../../uploads/${fileName}`);
    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(18).text('🏨 Hostel Management - FP&A Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Month: ${month} / Year: ${year}`);
    doc.moveDown(2);

    const keyMetrics = [
      ['Total Income', fpa.totalIncome],
      ['Total Expense', fpa.totalExpense],
      ['Profit', fpa.profit],
      ['Profit Margin (%)', fpa.profitMargin],
      ['Expense Ratio (%)', fpa.expenseRatio],
      ['Break-Even Revenue', fpa.breakeven],
      ['Contribution Margin', fpa.contributionMargin],
      ['Contribution Margin Ratio (%)', fpa.contributionMarginRatio],
      ['Margin of Safety (%)', fpa.marginOfSafety],
      ['YoY Growth (%)', fpa.yoyGrowth],
      ['Net Profit Growth (%)', fpa.netProfitGrowth],
      ['Collection Efficiency (%)', fpa.collectionEfficiency],
      ['Revenue per Available Unit', fpa.revPAU],
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

module.exports = { generateFPASummary, printFPAReport };
