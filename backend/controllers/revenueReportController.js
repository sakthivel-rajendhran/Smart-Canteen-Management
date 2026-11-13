import Order from '../models/Order.js';
import RevenueReport from '../models/RevenueReport.js';
import { generateRevenueStatementPDF } from '../utils/pdfGenerator.js';
import { uploadReportPDF, getSignedReportUrl } from '../utils/reportStorage.js';

/**
 * Calculate exact date boundaries in Asia/Kolkata (IST: UTC+05:30)
 */
export const getISTDateRange = (dateRange = 'today', startDate, endDate) => {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const [y, m, d] = todayStr.split('-').map(Number);

  let rangeStart = null;
  let rangeEnd = null;
  let filterLabel = 'Today';
  let dateSuffix = todayStr;

  if (dateRange === 'today') {
    filterLabel = 'Today';
    dateSuffix = todayStr;
    rangeStart = new Date(`${todayStr}T00:00:00.000+05:30`);
    rangeEnd = new Date(`${todayStr}T23:59:59.999+05:30`);
  } else if (dateRange === 'yesterday') {
    filterLabel = 'Yesterday';
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    const yestStr = prev.toISOString().slice(0, 10);
    dateSuffix = yestStr;
    rangeStart = new Date(`${yestStr}T00:00:00.000+05:30`);
    rangeEnd = new Date(`${yestStr}T23:59:59.999+05:30`);
  } else if (dateRange === '7days') {
    filterLabel = 'Last 7 Days';
    const prev = new Date(Date.UTC(y, m - 1, d - 6));
    const sStr = prev.toISOString().slice(0, 10);
    dateSuffix = `${sStr}_to_${todayStr}`;
    rangeStart = new Date(`${sStr}T00:00:00.000+05:30`);
    rangeEnd = new Date(`${todayStr}T23:59:59.999+05:30`);
  } else if (dateRange === '30days') {
    filterLabel = 'Last 30 Days';
    const prev = new Date(Date.UTC(y, m - 1, d - 29));
    const sStr = prev.toISOString().slice(0, 10);
    dateSuffix = `${sStr}_to_${todayStr}`;
    rangeStart = new Date(`${sStr}T00:00:00.000+05:30`);
    rangeEnd = new Date(`${todayStr}T23:59:59.999+05:30`);
  } else if (dateRange === '3months') {
    filterLabel = '3 Months';
    // Handle variable calendar month lengths safely
    const targetMonth = m - 1 - 3;
    const prev = new Date(Date.UTC(y, targetMonth, d));
    // If day overflowed month boundary, adjust to end of month
    if (prev.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
      prev.setUTCDate(0);
    }
    const sStr = prev.toISOString().slice(0, 10);
    dateSuffix = `${sStr}_to_${todayStr}`;
    rangeStart = new Date(`${sStr}T00:00:00.000+05:30`);
    rangeEnd = new Date(`${todayStr}T23:59:59.999+05:30`);
  } else if (dateRange === '6months') {
    filterLabel = '6 Months';
    const targetMonth = m - 1 - 6;
    const prev = new Date(Date.UTC(y, targetMonth, d));
    if (prev.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
      prev.setUTCDate(0);
    }
    const sStr = prev.toISOString().slice(0, 10);
    dateSuffix = `${sStr}_to_${todayStr}`;
    rangeStart = new Date(`${sStr}T00:00:00.000+05:30`);
    rangeEnd = new Date(`${todayStr}T23:59:59.999+05:30`);
  } else if (dateRange === 'custom') {
    filterLabel = 'Custom Range';
    let safeStart = startDate || todayStr;
    let safeEnd = endDate || todayStr;

    // Prevent future dates
    if (safeStart > todayStr) safeStart = todayStr;
    if (safeEnd > todayStr) safeEnd = todayStr;

    // Enforce end date >= start date
    if (safeEnd < safeStart) safeEnd = safeStart;

    dateSuffix = `${safeStart}_to_${safeEnd}`;
    rangeStart = new Date(`${safeStart}T00:00:00.000+05:30`);
    rangeEnd = new Date(`${safeEnd}T23:59:59.999+05:30`);
  }

  return { rangeStart, rangeEnd, filterLabel, todayStr, dateSuffix };
};

/**
 * Build MongoDB Query for Eligible Orders & Cancelled/Refunded Orders
 */
const buildDateFilter = (rangeStart, rangeEnd) => {
  const dateCond = {};
  if (rangeStart) dateCond.$gte = rangeStart;
  if (rangeEnd) dateCond.$lte = rangeEnd;
  return dateCond;
};

/**
 * Aggregate All 8 Financial Metrics and Daily Breakdown
 */
const calculateFinancialMetrics = async (rangeStart, rangeEnd) => {
  const dateCond = buildDateFilter(rangeStart, rangeEnd);

  // Eligible completed sales query (exclude unpaid, pending, failed, cancelled)
  const eligibleQuery = {
    status: { $in: ['Handover Bill', 'Completed'] },
    $or: [
      { completedAt: dateCond },
      { completedAt: null, createdAt: dateCond },
    ],
  };

  // Refunded / Cancelled paid orders query
  const refundQuery = {
    status: 'Cancelled',
    paymentStatus: { $in: ['paid', 'cod'] },
    createdAt: dateCond,
  };

  const [eligibleOrders, refundOrders, dailyAgg] = await Promise.all([
    Order.find(eligibleQuery)
      .populate('user', 'name email phone studentDetails staffDetails')
      .populate('cashier', 'name')
      .sort({ completedAt: -1, createdAt: -1 })
      .lean(),
    Order.find(refundQuery).lean(),
    Order.aggregate([
      { $match: eligibleQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $ifNull: ['$completedAt', '$createdAt'] },
              timezone: '+05:30',
            },
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          cash: {
            $sum: { $cond: [{ $in: ['$paymentMethod', ['cash', 'cod']] }, '$total', 0] },
          },
          digital: {
            $sum: { $cond: [{ $in: ['$paymentMethod', ['razorpay', 'upi', 'card']] }, '$total', 0] },
          },
          parcel: { $sum: { $ifNull: ['$parcelChargeTotal', 0] } },
          discount: { $sum: { $ifNull: ['$discount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  let grossSales = 0;
  let totalDiscounts = 0;
  let parcelCharges = 0;
  let cashRevenue = 0;
  let onlineRevenue = 0;
  let totalCollected = 0;
  let posWalkInOrders = 0;
  let customerOnlineOrders = 0;

  for (const o of eligibleOrders) {
    const tot = Number(o.total || 0);
    const disc = Number(o.discount || 0);
    const parc = Number(o.parcelChargeTotal || 0);

    grossSales += (tot + disc);
    totalDiscounts += disc;
    parcelCharges += parc;
    totalCollected += tot;

    if (['cash', 'cod'].includes(o.paymentMethod)) {
      cashRevenue += tot;
    } else {
      onlineRevenue += tot;
    }

    if (o.orderType === 'WALK_IN') {
      posWalkInOrders++;
    } else {
      customerOnlineOrders++;
    }
  }

  let refunds = 0;
  for (const ro of refundOrders) {
    refunds += Number(ro.total || 0);
  }

  const netRevenue = Math.max(0, totalCollected - refunds);
  const totalOrders = eligibleOrders.length;
  const avgOrderValue = totalOrders > 0 ? Number((netRevenue / totalOrders).toFixed(2)) : 0;

  return {
    summary: {
      grossSales,
      netRevenue,
      totalOrders,
      cashRevenue,
      onlineRevenue,
      totalDiscounts,
      parcelCharges,
      refunds,
      refundedOrdersCount: refundOrders.length,
      avgOrderValue,
      posWalkInOrders,
      customerOnlineOrders,
    },
    dailyTrends: dailyAgg,
    transactions: eligibleOrders,
    refundOrders,
  };
};

// @desc    Get complete revenue analytics and financial summary
// @route   GET /api/admin/revenue/analytics
// @access  Private/Admin
export const getRevenueAnalytics = async (req, res) => {
  try {
    const {
      dateRange = 'today',
      startDate,
      endDate,
      search = '',
      page = 1,
      limit = 20,
    } = req.query;

    const { rangeStart, rangeEnd, filterLabel, todayStr, dateSuffix } = getISTDateRange(
      dateRange,
      startDate,
      endDate
    );

    const { summary, dailyTrends, transactions, refundOrders } = await calculateFinancialMetrics(
      rangeStart,
      rangeEnd
    );

    // Filter transactions by search term if provided
    let filteredTransactions = transactions;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredTransactions = transactions.filter((t) => {
        const orderCode = String(t.orderCode || '').toLowerCase();
        const token = String(t.pickupToken || '').toLowerCase();
        const customer = String(
          t.orderType === 'WALK_IN' ? t.walkInCustomer?.name : t.user?.name
        ).toLowerCase();
        const phone = String(
          t.orderType === 'WALK_IN' ? t.walkInCustomer?.phone : t.user?.phone
        ).toLowerCase();
        return (
          orderCode.includes(q) ||
          token.includes(q) ||
          customer.includes(q) ||
          phone.includes(q)
        );
      });
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const totalCount = filteredTransactions.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      summary,
      dailyTrends,
      channelBreakdown: {
        walkInSales: summary.cashRevenue,
        onlineSales: summary.onlineRevenue,
        walkInPercent: summary.netRevenue > 0 ? Math.round((summary.cashRevenue / summary.netRevenue) * 100) : 0,
        onlinePercent: summary.netRevenue > 0 ? Math.round((summary.onlineRevenue / summary.netRevenue) * 100) : 0,
      },
      paymentBreakdown: {
        cash: summary.cashRevenue,
        digital: summary.onlineRevenue,
        refunds: summary.refunds,
      },
      transactions: paginatedTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
      filterInfo: {
        dateRange,
        filterLabel,
        todayStr,
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('getRevenueAnalytics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate professional financial A4 PDF statement and persist report metadata
// @route   POST /api/admin/revenue/reports/generate
// @access  Private/Admin
export const generateRevenueReport = async (req, res) => {
  try {
    const {
      dateRange = 'today',
      startDate,
      endDate,
    } = req.body;

    const { rangeStart, rangeEnd, filterLabel, dateSuffix } = getISTDateRange(
      dateRange,
      startDate,
      endDate
    );

    const { summary, dailyTrends, transactions } = await calculateFinancialMetrics(
      rangeStart,
      rangeEnd
    );

    // Generate unique Report ID: DRS-REV-YYYYMMDD-XXXX
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const cleanDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).replace(/-/g, '');
    const reportId = `DRS-REV-${cleanDateStr}-${randomSuffix}`;

    // Standardized filename per specifications:
    // e.g. DRS_Revenue_Today_2026-11-13.pdf, DRS_Revenue_Last_7_Days_2026-11-07_to_2026-11-13.pdf
    const cleanFilterName = filterLabel.replace(/\s+/g, '_');
    const reportName = `DRS_Revenue_${cleanFilterName}_${dateSuffix}.pdf`;

    const adminName = req.user?.name || 'Authorized Admin';

    // 1. Generate real A4 PDF buffer with PDFKit
    const pdfBuffer = await generateRevenueStatementPDF({
      reportId,
      reportName,
      filterLabel,
      startDate: rangeStart,
      endDate: rangeEnd,
      generatedAt: new Date(),
      adminName,
      summary,
      dailyTrends,
      transactions,
    });

    // 2. Upload to Cloudinary private storage
    const uploadResult = await uploadReportPDF(pdfBuffer, reportName.replace('.pdf', ''));

    // 3. Store Report Metadata in MongoDB
    const reportDoc = await RevenueReport.create({
      reportId,
      reportName,
      dateRange,
      filterLabel,
      startDate: rangeStart,
      endDate: rangeEnd,
      summary,
      fileStorage: uploadResult,
      generatedBy: req.user?._id,
      generatedByName: adminName,
      generatedAt: new Date(),
      status: 'generated',
    });

    // If client requested direct file download via Accept header or query
    if (req.query.download === 'true' || req.headers.accept === 'application/pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${reportName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    }

    res.status(201).json({
      success: true,
      message: 'Financial revenue statement generated successfully',
      data: reportDoc,
      downloadUrl: `/api/admin/revenue/reports/${reportDoc._id}/download`,
      viewUrl: `/api/admin/revenue/reports/${reportDoc._id}/view`,
    });
  } catch (error) {
    console.error('generateRevenueReport error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get previously generated report history
// @route   GET /api/admin/revenue/reports
// @access  Private/Admin
export const getReportHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const query = {};

    if (search && search.trim()) {
      const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { reportId: new RegExp(q, 'i') },
        { reportName: new RegExp(q, 'i') },
        { filterLabel: new RegExp(q, 'i') },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [reports, totalCount] = await Promise.all([
      RevenueReport.find(query)
        .populate('generatedBy', 'name email')
        .sort({ generatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      RevenueReport.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: reports.length,
      data: reports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('getReportHistory error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Download previously generated report by ID
// @route   GET /api/admin/revenue/reports/:id/download
// @access  Private/Admin
export const downloadReportById = async (req, res) => {
  try {
    const report = await RevenueReport.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { reportId: req.params.id }],
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report record not found' });
    }

    // Re-generate fresh PDF buffer using report's stored snapshot & date boundaries
    const { summary, dailyTrends, transactions } = await calculateFinancialMetrics(
      report.startDate,
      report.endDate
    );

    const pdfBuffer = await generateRevenueStatementPDF({
      reportId: report.reportId,
      reportName: report.reportName,
      filterLabel: report.filterLabel,
      startDate: report.startDate,
      endDate: report.endDate,
      generatedAt: report.generatedAt,
      adminName: report.generatedByName,
      summary: report.summary || summary,
      dailyTrends,
      transactions,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.reportName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('downloadReportById error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    View report PDF inline in browser
// @route   GET /api/admin/revenue/reports/:id/view
// @access  Private/Admin
export const viewReportById = async (req, res) => {
  try {
    const report = await RevenueReport.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { reportId: req.params.id }],
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report record not found' });
    }

    const { summary, dailyTrends, transactions } = await calculateFinancialMetrics(
      report.startDate,
      report.endDate
    );

    const pdfBuffer = await generateRevenueStatementPDF({
      reportId: report.reportId,
      reportName: report.reportName,
      filterLabel: report.filterLabel,
      startDate: report.startDate,
      endDate: report.endDate,
      generatedAt: report.generatedAt,
      adminName: report.generatedByName,
      summary: report.summary || summary,
      dailyTrends,
      transactions,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${report.reportName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('viewReportById error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

