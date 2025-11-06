const { prisma } = require('../../config/db');
const { successResponse, errorResponse } = require('../../Helper/helper');

// ---- lightweight cache (uses utils/cache if you added it; otherwise in-memory) ----
let memoryCache = {};
let setCache = async (k, v, ttl = 600) => (memoryCache[k] = { v, exp: Date.now() + ttl * 1000 });
let getCache = async (k) => {
  const hit = memoryCache[k];
  if (!hit) return null;
  if (hit.exp < Date.now()) { delete memoryCache[k]; return null; }
  return hit.v;
};
let delCache = async (k) => { delete memoryCache[k]; };
try {
  // if you created utils/cache.js earlier, we'll use it automatically
  const wired = require('../../utils/cache'); // { setCache, getCache }
  setCache = wired.setCache || setCache;
  getCache = wired.getCache || getCache;
  delCache = wired.delCache || delCache;
} catch(_) {}

const startOfMonth = (y, m) => new Date(y, m - 1, 1, 0, 0, 0, 0);
const startOfNextMonth = (y, m) => (m === 12 ? new Date(y + 1, 0, 1) : new Date(y, m, 1));
const prevMonthPair = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);

// Invalidate from other controllers when payments/allocations/tenants/vendors change
const invalidateDashboardCache = async (hostelId) => {
  const key = `dash_overview_${hostelId || 'all'}`;
  await delCache(key);
};

const getDashboardOverview = async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const { hostelId } = req.query;               // optional filter
    const cacheKey = `dash_overview_${hostelId || 'all'}`;

    const cached = await getCache(cacheKey);
    if (cached) return successResponse(res, cached, 'Dashboard data (cached)');

    const currFrom = startOfMonth(year, month);
    const currTo   = startOfNextMonth(year, month);
    const [py, pm] = prevMonthPair(year, month);
    const prevFrom = startOfMonth(py, pm);
    const prevTo   = startOfNextMonth(py, pm);

    // ---------- Filters ----------
    const hostelf = hostelId ? { hostelId: Number(hostelId) } : {};

    // 1) OCCUPANCY (prefer Beds; fallback Rooms)
    const totalUnits = prisma.bed?.count
      ? await prisma.bed.count(hostelId ? { where: hostelf } : {})
      : await prisma.room.count(hostelId ? { where: hostelf } : {});

    const occupiedUnits = await prisma.allocation.count({
      where: { status: 'active', ...(hostelId && hostelf) }
    });

    const occupancyRate = totalUnits ? (occupiedUnits / totalUnits) * 100 : 0;

    // last month occupancy proxy = new active allocations created last month / totalUnits
    const lastMonthAllocs = await prisma.allocation.count({
      where: { createdAt: { gte: prevFrom, lt: prevTo }, ...(hostelId && hostelf) }
    });
    const lastMonthOcc = totalUnits ? (lastMonthAllocs / totalUnits) * 100 : 0;
    const occGrowth = lastMonthOcc > 0 ? ((occupancyRate - lastMonthOcc) / lastMonthOcc) * 100
                                       : (occupancyRate > 0 ? 100 : 0);

    // 2) MONTHLY REVENUE (current vs last month)
    const [currentRevenue, lastRevenue] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'paid', paymentDate: { gte: currFrom, lt: currTo }, ...(hostelId && hostelf) }
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'paid', paymentDate: { gte: prevFrom, lt: prevTo }, ...(hostelId && hostelf) }
      })
    ]);
    const currRev = currentRevenue._sum.amount || 0;
    const prevRev = lastRevenue._sum.amount || 0;
    const revenueGrowth = prevRev > 0 ? ((currRev - prevRev) / prevRev) * 100 : (currRev > 0 ? 100 : 0);

    // 3) ACTIVE TENANTS / VENDORS / OPEN ALERTS / PENDING PAYMENTS
    const [
      activeTenants, lastTenants,
      activeVendors, lastVendors,
      openAlerts,    lastAlerts,
      pendingPayments, lastPendingPayments
    ] = await Promise.all([
      prisma.tenant.count({ where: { status: 'active', ...(hostelId && { allocations: { some: { status: 'active', ...hostelf } } }) } }),
      prisma.tenant.count({ where: { status: 'active', createdAt: { lt: currFrom } } }),
      prisma.vendor.count({ where: { status: 'active' } }),
      prisma.vendor.count({ where: { status: 'active', createdAt: { lt: currFrom } } }),
      prisma.alert.count({ where: { status: 'open', ...(hostelId && hostelf) } }),
      prisma.alert.count({ where: { status: 'open', createdAt: { lt: currFrom } } }),
      prisma.payment.count({ where: { status: 'pending', ...(hostelId && hostelf) } }),
      prisma.payment.count({ where: { status: 'pending', createdAt: { lt: currFrom } } })
    ]);

    const growth = (c, p) => (p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0));
    const tenantGrowth  = growth(activeTenants,  lastTenants);
    const vendorGrowth  = growth(activeVendors,  lastVendors);
    const alertGrowth   = growth(openAlerts,     lastAlerts);
    const pendingGrowth = growth(pendingPayments, lastPendingPayments);

    // 4) PROFIT & LOSS (last 3 FPA rows)
    const fpaRecords = await prisma.fPA.findMany({
      where: hostelId ? hostelf : {},
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 3
    });
    const profitLoss = fpaRecords.reverse().map(f => ({
      label: `${f.month}-${f.year}`,
      revenue: f.totalIncome || 0,
      expenses: f.totalExpense || 0,
      netIncome: f.profit || 0
    }));
    const totalNetIncome = profitLoss.reduce((a, r) => a + r.netIncome, 0);

    // 5) RENTAL APPLICATIONS (last 30 days)
    const since30 = new Date(); since30.setDate(since30.getDate() - 30);
    const appStats = await prisma.rentalApplication.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { createdAt: { gte: since30 }, ...(hostelId && hostelf) }
    });
    const totalApps = appStats.reduce((a, s) => a + s._count._all, 0);
    const rentalApplications = {
      total: totalApps,
      breakdown: appStats.map(s => ({
        status: s.status,
        count: s._count._all,
        percent: totalApps ? ((s._count._all / totalApps) * 100).toFixed(2) : '0.00'
      }))
    };

    // 6) RECENT TENANT REQUESTS
    const recentRequests = await prisma.maintenanceRequest.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: hostelId ? hostelf : {},
      select: { id: true, title: true, status: true, createdAt: true, room: { select: { name: true } } }
    });

    // 7) UNPAID RENT BUCKETS
    const unpaid = await prisma.payment.findMany({
      where: { status: 'pending', ...(hostelId && hostelf) },
      select: { amount: true, paymentDate: true, createdAt: true }
    });
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '91+': 0 };
    const today = Date.now();
    for (const p of unpaid) {
      const base = p.paymentDate || p.createdAt;
      const days = Math.floor((today - new Date(base).getTime()) / 86_400_000);
      if (days <= 30) buckets['0-30'] += p.amount;
      else if (days <= 60) buckets['31-60'] += p.amount;
      else if (days <= 90) buckets['61-90'] += p.amount;
      else buckets['91+'] += p.amount;
    }
    const totalUnpaid = Object.values(buckets).reduce((a, b) => a + b, 0);

    // 8) RECENT PAYMENTS
    const recentPayments = await prisma.payment.findMany({
      take: 5,
      orderBy: { paymentDate: 'desc' },
      where: hostelId ? hostelf : {},
      include: { tenant: { select: { name: true } }, hostel: { select: { name: true } } }
    });

    const dashboard = {
      overview: {
        occupancy: {
          occupied: occupancyRate.toFixed(2),
          vacant: (100 - occupancyRate).toFixed(2),
          growth: `${occGrowth.toFixed(2)}%`,
          totalUnits, occupiedUnits
        },
        monthlyRevenue: { current: currRev, growth: `${revenueGrowth.toFixed(2)}%` },
        activeTenants: { count: activeTenants, growth: `${tenantGrowth.toFixed(2)}%` },
        activeVendors: { count: activeVendors, growth: `${vendorGrowth.toFixed(2)}%` },
        openAlerts:    { count: openAlerts,    growth: `${alertGrowth.toFixed(2)}%` },
        pendingPayments:{ count: pendingPayments, growth: `${pendingGrowth.toFixed(2)}%` }
      },
      profitLoss: { totalNetIncome, lastThreeMonths: profitLoss },
      rentalApplications,
      recentRequests,
      unpaidRent: { total: totalUnpaid, breakdown: buckets },
      recentPayments
    };

    await setCache(cacheKey, dashboard, 600);  // 10 min
    return successResponse(res, dashboard, 'Dashboard data fetched successfully');
  } catch (err) {
    console.error('Dashboard Error:', err);
    return errorResponse(res, err.message);
  }
};

module.exports = { getDashboardOverview, invalidateDashboardCache };
