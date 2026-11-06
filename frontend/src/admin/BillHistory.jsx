import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import ThermalReceiptModal from '../components/common/ThermalReceiptModal';
import {
  Receipt,
  Search,
  Calendar,
  Filter,
  Printer,
  Sparkles,
  RefreshCw,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  IndianRupee,
  Smartphone,
  Banknote,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Check,
  Award,
  TrendingUp,
  User,
  GraduationCap,
  Briefcase,
} from 'lucide-react';

const BillHistory = () => {
  // Navigation View: 'archive' | 'founder'
  const [activeTab, setActiveTab] = useState('archive');

  // Archive data & summary
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({
    totalBillsPrinted: 0,
    totalOrders: 0,
    totalSales: 0,
    cashCollections: 0,
    upiCollections: 0,
    pendingPayments: 0,
    completedHandovers: 0,
    pendingHandovers: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Daily Founder Report State
  const [founderReport, setFounderReport] = useState({
    totalOrders: 0,
    totalBillsPrinted: 0,
    totalItemsSold: 0,
    grossSales: 0,
    discounts: 0,
    netSales: 0,
    cashCollections: 0,
    upiCollections: 0,
    pendingPayments: 0,
    completedHandovers: 0,
    pendingHandovers: 0,
    dailyBreakdown: [],
  });
  const [founderLoading, setFounderLoading] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState('today'); // 'today' | 'yesterday' | '7days' | '30days' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderType, setOrderType] = useState('ALL'); // 'ALL' | 'ONLINE' | 'WALK_IN'
  const [paymentMethod, setPaymentMethod] = useState('ALL'); // 'ALL' | 'cash' | 'upi' | 'card' | 'razorpay' | 'cod'
  const [handoverStatus, setHandoverStatus] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'PENDING'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Thermal Receipt Modal State for Reprinting
  const [reprintOrder, setReprintOrder] = useState(null);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);

  // Retention Settings & Cleanup Modal State
  const [retentionModalOpen, setRetentionModalOpen] = useState(false);
  const [retentionSettings, setRetentionSettings] = useState({
    billRetentionMonths: 6,
    lastCleanupAt: null,
    lastCleanupCount: 0,
  });
  const [cleanupPreview, setCleanupPreview] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState('');

  useEffect(() => {
    if (activeTab === 'archive') {
      fetchBills();
    } else {
      fetchFounderReport();
    }
  }, [activeTab, dateRange, startDate, endDate, orderType, paymentMethod, handoverStatus, page]);

  // Fetch Bill Archive
  const fetchBills = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        dateRange,
        orderType,
        paymentMethod,
        handoverStatus,
        search: search.trim(),
        page,
        limit: 20,
      };

      if (dateRange === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await API.get('/admin/bills', { params });
      if (res.data?.success) {
        setBills(res.data.data || []);
        if (res.data.summary) setSummary(res.data.summary);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch bill archive:', err);
      setError(err.response?.data?.message || 'Failed to load bill archive.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Daily Founder Report
  const fetchFounderReport = async () => {
    try {
      setFounderLoading(true);
      setError('');

      const params = { dateRange };
      if (dateRange === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await API.get('/admin/bills/founder-report', { params });
      if (res.data?.success) {
        setFounderReport(res.data.data || {});
      }
    } catch (err) {
      console.error('Failed to fetch founder report:', err);
      setError(err.response?.data?.message || 'Failed to load founder report.');
    } finally {
      setFounderLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBills();
  };

  const openReprint = (bill) => {
    setReprintOrder(bill);
    setReprintModalOpen(true);
  };

  const handlePrintFounderReport = () => {
    window.print();
  };

  // Retention Settings
  const openRetentionModal = async () => {
    try {
      setRetentionModalOpen(true);
      setCleanupPreview(null);
      setCleanupSuccessMessage('');
      const res = await API.get('/admin/settings/bill-retention');
      if (res.data?.success) {
        setRetentionSettings(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load retention settings:', err);
    }
  };

  const handleUpdateRetention = async (months) => {
    try {
      setCleanupLoading(true);
      const res = await API.put('/admin/settings/bill-retention', { billRetentionMonths: months });
      if (res.data?.success) {
        setRetentionSettings(res.data.data);
        setCleanupPreview(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update retention policy.');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handlePreviewCleanup = async () => {
    try {
      setCleanupLoading(true);
      setCleanupSuccessMessage('');
      const res = await API.post('/admin/settings/bill-retention/cleanup', { preview: true });
      if (res.data?.success) {
        setCleanupPreview(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to preview cleanup.');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleExecuteCleanup = async () => {
    const count = cleanupPreview?.eligibleCount || 0;
    if (!window.confirm(`Are you sure you want to delete ${count} expired completed bills? Active and pending orders will NEVER be touched.`)) {
      return;
    }

    try {
      setCleanupLoading(true);
      const res = await API.post('/admin/settings/bill-retention/cleanup', { preview: false });
      if (res.data?.success) {
        setCleanupSuccessMessage(res.data.message);
        setCleanupPreview(null);
        fetchBills();
        const setRes = await API.get('/admin/settings/bill-retention');
        if (setRes.data?.success) setRetentionSettings(setRes.data.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Cleanup execution failed.');
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/70 pb-20 font-inter text-text">
      
      {/* Dynamic Founder Report Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
          }
          .no-print, nav, footer, header, #pwa-installer, .fixed {
            display: none !important;
          }
          .founder-print-sheet {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Thermal Receipt Reprint Modal */}
      <ThermalReceiptModal
        order={reprintOrder}
        isOpen={reprintModalOpen}
        onClose={() => {
          setReprintModalOpen(false);
          setReprintOrder(null);
        }}
        autoPrint={false}
      />

      {/* ================= TOP HEADER ================= */}
      <div className="no-print bg-[#0b3d2e] text-white px-4 py-3 shadow-md border-b border-white/10 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber flex items-center justify-center text-stone-950 font-black text-xl shadow-xs">
              🧾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-outfit font-black text-base sm:text-lg tracking-tight">
                  Bill History & Daily Founder Report
                </h1>
                <span className="bg-amber/20 border border-amber/40 text-amber text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Canteen Records
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                Search generated bills • Thermal reprinting • Founder daily sales reconciliation
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openRetentionModal}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-xl transition border border-white/10"
              title="Retention Settings & Safe Cleanup"
            >
              <Settings className="w-3.5 h-3.5 text-amber" />
              <span>Retention ({retentionSettings.billRetentionMonths}M)</span>
            </button>

            <Link
              to="/admin/pos"
              className="flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-stone-950 font-bold text-xs px-3 py-2 rounded-xl transition shadow-xs"
            >
              <span>+ POS Sale</span>
            </Link>

            <Link
              to="/admin/handover"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-xl transition border border-white/10"
            >
              <span>Handover Queue</span>
            </Link>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ================= VIEW MODE TOGGLE BUTTONS ================= */}
        <div className="no-print bg-white p-2 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'archive'
                  ? 'bg-[#0b3d2e] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Receipt className="w-4 h-4 text-amber" />
              <span>Bill Archive</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeTab === 'archive' ? 'bg-amber text-stone-950' : 'bg-stone-200 text-stone-700'
              }`}>
                {pagination.total || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('founder')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'founder'
                  ? 'bg-[#0b3d2e] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Award className="w-4 h-4 text-amber" />
              <span>Daily Founder Report</span>
              <span className="bg-amber text-stone-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Audit
              </span>
            </button>
          </div>

          {activeTab === 'founder' && (
            <button
              type="button"
              onClick={handlePrintFounderReport}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber hover:bg-amber-dark text-stone-950 font-black text-xs px-4 py-2.5 rounded-xl transition shadow-xs active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Founder Report</span>
            </button>
          )}
        </div>

        {/* ================= DATE RANGE & SEARCH FILTER CONTROL BAR ================= */}
        <div className="no-print bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-stone-200 space-y-4">
          
          {/* Row 1: Date Range Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Date:
            </span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setDateRange(tab.id);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  dateRange === tab.id
                    ? 'bg-[#0b3d2e] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {dateRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-stone-600">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#0b3d2e]"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-stone-600">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#0b3d2e]"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  if (activeTab === 'archive') fetchBills();
                  else fetchFounderReport();
                }}
                className="px-3.5 py-1.5 bg-[#0b3d2e] text-white text-xs font-bold rounded-lg hover:bg-[#1a7a45] transition"
              >
                Apply Range
              </button>
            </div>
          )}

          {/* Search & Dropdown Filters (for Bill Archive) */}
          {activeTab === 'archive' && (
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1 border-t border-stone-100">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Bill # (BILL-DRS-XXXX), Order ID (DRS-XXXX), Token #, Customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-20 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-stone-200 hover:bg-[#0b3d2e] hover:text-white text-stone-700 px-3 py-1 rounded-lg text-xs font-bold transition"
                >
                  Search
                </button>
              </form>

              {/* Channel Filter */}
              <select
                value={orderType}
                onChange={(e) => {
                  setOrderType(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none focus:border-[#0b3d2e]"
              >
                <option value="ALL">All Channels</option>
                <option value="WALK_IN">Walk-in POS</option>
                <option value="ONLINE">Online App</option>
              </select>

              {/* Handover Status Filter */}
              <select
                value={handoverStatus}
                onChange={(e) => {
                  setHandoverStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none focus:border-[#0b3d2e]"
              >
                <option value="ALL">All Handover States</option>
                <option value="COMPLETED">Completed Handover</option>
                <option value="PENDING">Pending Handover</option>
              </select>

              {/* Payment Method Filter */}
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none focus:border-[#0b3d2e]"
              >
                <option value="ALL">All Payments</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI QR</option>
                <option value="card">Card</option>
                <option value="cod">Cash on Delivery (COD)</option>
                <option value="razorpay">Online (Razorpay)</option>
              </select>

              {/* Refresh */}
              <button
                type="button"
                onClick={fetchBills}
                disabled={loading}
                className="p-2.5 text-stone-500 hover:text-[#0b3d2e] hover:bg-stone-100 rounded-xl transition border border-stone-200"
                title="Refresh bills"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

        </div>

        {/* ================= TAB 1: BILL ARCHIVE ================= */}
        {activeTab === 'archive' && (
          <div className="space-y-6">

            {/* Daily Founder Report KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              
              {/* Bills Printed */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Bills Printed</span>
                  <Receipt className="w-4 h-4 text-[#0b3d2e]" />
                </div>
                <div className="font-outfit font-black text-2xl text-stone-900">
                  {summary.totalBillsPrinted || 0}
                </div>
                <span className="text-[10px] text-stone-400 font-medium">Physical receipts</span>
              </div>

              {/* Total Orders */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total Orders</span>
                  <ShoppingBag className="w-4 h-4 text-stone-600" />
                </div>
                <div className="font-outfit font-black text-2xl text-stone-900">
                  {summary.totalOrders || 0}
                </div>
                <span className="text-[10px] text-stone-400 font-medium">In selected date filter</span>
              </div>

              {/* Total Sales (Collected only) */}
              <div className="bg-white rounded-2xl p-4 border-2 border-emerald-200 shadow-xs flex flex-col justify-between bg-emerald-50/20">
                <div className="flex items-center justify-between text-emerald-800 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Collected Revenue</span>
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="font-outfit font-black text-2xl text-emerald-700">
                  ₹{Number(summary.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-emerald-600 font-bold">Paid sales confirmed</span>
              </div>

              {/* Cash Collections */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Cash in Hand</span>
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="font-outfit font-black text-2xl text-emerald-700">
                  ₹{Number(summary.cashCollections || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-stone-400 font-medium">Counter cash</span>
              </div>

              {/* UPI / Digital Collections */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">UPI / Digital</span>
                  <Smartphone className="w-4 h-4 text-blue-600" />
                </div>
                <div className="font-outfit font-black text-2xl text-blue-700">
                  ₹{Number(summary.upiCollections || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-stone-400 font-medium">Bank confirmed</span>
              </div>

              {/* Pending Payments / Handovers */}
              <div className={`rounded-2xl p-4 border shadow-xs flex flex-col justify-between ${
                summary.pendingPayments > 0 ? 'bg-red-50/50 border-red-200' : 'bg-white border-stone-200'
              }`}>
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${summary.pendingPayments > 0 ? 'text-red-700 font-black' : ''}`}>
                    Pending Payments
                  </span>
                  <AlertTriangle className={`w-4 h-4 ${summary.pendingPayments > 0 ? 'text-red-600' : 'text-stone-400'}`} />
                </div>
                <div className={`font-outfit font-black text-2xl ${summary.pendingPayments > 0 ? 'text-red-600' : 'text-stone-900'}`}>
                  ₹{Number(summary.pendingPayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-stone-400 font-medium">
                  {summary.pendingHandovers} pending handover
                </span>
              </div>

            </div>

            {/* Bill Archive Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h3 className="font-outfit font-black text-base text-stone-900">
                    Generated Customer Bills ({pagination.total})
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Physical bills generated at counter, handover states, and transaction snapshots
                  </p>
                </div>
                <span className="text-xs text-stone-500 font-medium">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
              </div>

              {loading ? (
                <div className="py-24 text-center">
                  <div className="w-10 h-10 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-3" />
                  <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                    Retrieving bill archive...
                  </span>
                </div>
              ) : bills.length === 0 ? (
                <div className="py-20 text-center p-6">
                  <Receipt className="w-12 h-12 text-stone-300 mx-auto mb-2 stroke-1" />
                  <h4 className="font-outfit font-bold text-stone-800 text-base mb-1">
                    No Bills Found
                  </h4>
                  <p className="text-stone-500 text-xs max-w-sm mx-auto">
                    No generated bills match the chosen date range or filter criteria.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Bill Number</th>
                        <th className="py-3 px-4">Token & Order ID</th>
                        <th className="py-3 px-4">Date / Time</th>
                        <th className="py-3 px-4">Channel</th>
                        <th className="py-3 px-4">Customer Details</th>
                        <th className="py-3 px-4">Items Summary</th>
                        <th className="py-3 px-4">Handover</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {bills.map((bill) => {
                        const isWalkIn = bill.orderType === 'WALK_IN';
                        const token = bill.pickupToken || bill.orderCode?.replace('DRS-', '');
                        const billNum = bill.billNumber || `BILL-${bill.orderCode}`;
                        const isHandoverDone =
                          bill.handoverStatus === 'COMPLETED' ||
                          bill.status === 'Handover Bill' ||
                          bill.status === 'Completed' ||
                          bill.handoverVerified;

                        const customerName = isWalkIn
                          ? bill.walkInCustomer?.name || 'Walk-in'
                          : bill.user?.name || 'Student';
                        const customerReg = isWalkIn
                          ? bill.walkInCustomer?.registerNumber
                          : bill.user?.studentDetails?.registerNumber;
                        const customerPhone = isWalkIn
                          ? bill.walkInCustomer?.phone
                          : bill.user?.phone;

                        const dateObj = new Date(bill.billPrintedAt || bill.createdAt);
                        const formattedDate = dateObj.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        });
                        const formattedTime = dateObj.toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        });

                        return (
                          <tr key={bill._id} className="hover:bg-stone-50/70 transition">
                            
                            {/* Bill Number */}
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              <span className="font-outfit font-black text-sm text-[#0b3d2e] block">
                                {billNum}
                              </span>
                              {bill.billPrintCount > 1 ? (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                  Reprinted ({bill.billPrintCount}x)
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                  Original Bill
                                </span>
                              )}
                            </td>

                            {/* Token & Order Code */}
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              <span className="font-outfit font-black text-base text-[#0b3d2e] block">
                                #{token}
                              </span>
                              <span className="text-[10px] text-stone-500 font-semibold">
                                #{bill.orderCode}
                              </span>
                            </td>

                            {/* Date & Time */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-bold text-stone-800">{formattedDate}</div>
                              <div className="text-[10px] text-stone-500">{formattedTime}</div>
                            </td>

                            {/* Channel */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  isWalkIn
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                {isWalkIn ? '★ POS Walk-in' : '★ Online App'}
                              </span>
                            </td>

                            {/* Customer Details */}
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-stone-900 truncate max-w-[140px]">
                                {customerName}
                              </div>
                              {customerReg ? (
                                <div className="text-[10px] font-mono text-indigo-700 font-semibold">
                                  Reg: {customerReg}
                                </div>
                              ) : customerPhone ? (
                                <div className="text-[10px] text-stone-400 font-mono">
                                  {customerPhone}
                                </div>
                              ) : null}
                            </td>

                            {/* Items Summary */}
                            <td className="py-3.5 px-4">
                              <div className="text-stone-700 font-medium line-clamp-1 max-w-[200px]" title={bill.items?.map(i => `${i.name} (x${i.quantity})`).join(', ')}>
                                {bill.items?.map((item, idx) => (
                                  <span key={idx}>
                                    {item.name} ×{item.quantity}{idx < bill.items.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </div>
                              <span className="text-[10px] text-stone-400">
                                {bill.items?.length || 0} item(s)
                              </span>
                            </td>

                            {/* Handover Status */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {isHandoverDone ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md">
                                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Handed Over</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Pending</span>
                                </span>
                              )}
                            </td>

                            {/* Payment */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-bold uppercase text-[11px] text-stone-800">
                                {bill.paymentMethod}
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5 ${
                                bill.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {bill.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                              </span>
                            </td>

                            {/* Amount */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono">
                              <span className="font-outfit font-black text-sm text-stone-900">
                                ₹{Number(bill.total || 0).toFixed(2)}
                              </span>
                            </td>

                            {/* Action: Reprint */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => openReprint(bill)}
                                className="inline-flex items-center gap-1 bg-stone-100 hover:bg-[#0b3d2e] hover:text-white text-stone-700 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition active:scale-95 shadow-2xs border border-stone-200"
                                title="Reprint thermal customer bill"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Reprint</span>
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="px-5 py-3 border-t border-stone-200 bg-stone-50/70 flex items-center justify-between">
                  <span className="text-xs text-stone-500 font-medium">
                    Showing {bills.length} of {pagination.total} records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-40 transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-stone-700 font-mono px-2">
                      {page} / {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage(page + 1)}
                      className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-40 transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

        {/* ================= TAB 2: DAILY FOUNDER REPORT ================= */}
        {activeTab === 'founder' && (
          <div className="founder-print-sheet space-y-6">

            {/* Founder Report Header */}
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber flex items-center justify-center text-stone-950 font-black text-2xl shadow-xs">
                  👑
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Canteen Management Audit
                  </span>
                  <h2 className="font-outfit font-black text-xl sm:text-2xl text-stone-900 mt-1">
                    Daily Founder Sales & Cash Reconciliation
                  </h2>
                  <p className="text-xs text-stone-500">
                    Daily sales audit, physical cash verification, and collected revenue proof for founder review
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-stone-400 block">
                  Report Date Range
                </span>
                <span className="font-outfit font-black text-sm text-[#0b3d2e] uppercase">
                  {dateRange === 'today' ? "Today's Report" : dateRange === 'yesterday' ? "Yesterday's Report" : `${dateRange} Report`}
                </span>
                <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                  Generated: {new Date().toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {founderLoading ? (
              <div className="py-24 text-center bg-white rounded-3xl border border-stone-200">
                <div className="w-10 h-10 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-3" />
                <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                  Generating founder daily sales report...
                </span>
              </div>
            ) : (
              <>
                {/* 3 Executive Reconciliation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Card 1: Orders & Physical Bills */}
                  <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                      <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                        1. Orders & Bills Printed
                      </span>
                      <Receipt className="w-4 h-4 text-stone-400" />
                    </div>
                    
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-600">Total Orders Received:</span>
                      <span className="font-outfit font-black text-lg text-stone-900">
                        {founderReport.totalOrders || 0}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-600">Total Bills Printed:</span>
                      <span className="font-outfit font-black text-lg text-[#0b3d2e]">
                        {founderReport.totalBillsPrinted || 0}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-600">Total Items / Trays Sold:</span>
                      <span className="font-outfit font-black text-lg text-stone-900">
                        {founderReport.totalItemsSold || 0}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline pt-1 border-t border-stone-100">
                      <span className="text-xs text-stone-500">Completed Handovers:</span>
                      <span className="font-mono font-bold text-xs text-emerald-700">
                        {founderReport.completedHandovers || 0} completed
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Sales Valuation */}
                  <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                      <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                        2. Sales Valuation
                      </span>
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-600">Gross Sales Value:</span>
                      <span className="font-outfit font-bold text-base text-stone-800">
                        ₹{Number(founderReport.grossSales || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-600">Discounts Allowed:</span>
                      <span className="font-outfit font-bold text-base text-red-600">
                        - ₹{Number(founderReport.discounts || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline pt-2 border-t-2 border-stone-100">
                      <span className="text-xs font-black uppercase text-stone-900">Net Paid Sales:</span>
                      <span className="font-outfit font-black text-2xl text-stone-950">
                        ₹{Number(founderReport.netSales || 0).toFixed(2)}
                      </span>
                    </div>

                    <span className="text-[10px] text-stone-400 block text-right">
                      * Excludes uncollected pending orders
                    </span>
                  </div>

                  {/* Card 3: Actual Cash Collections */}
                  <div className="bg-white rounded-3xl p-5 border-2 border-emerald-300 shadow-xs space-y-3 bg-emerald-50/20">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                        3. Cash & Payment Breakdown
                      </span>
                      <Banknote className="w-4 h-4 text-emerald-700" />
                    </div>

                    <div className="flex justify-between items-baseline bg-emerald-100/70 p-2.5 rounded-xl">
                      <span className="text-xs font-black text-emerald-950">
                        Actual Cash in Hand:
                      </span>
                      <span className="font-outfit font-black text-xl text-emerald-800">
                        ₹{Number(founderReport.cashCollections || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-700 font-medium">UPI / Digital Collections:</span>
                      <span className="font-outfit font-black text-base text-blue-700">
                        ₹{Number(founderReport.upiCollections || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline pt-1 border-t border-emerald-200">
                      <span className="text-xs text-stone-600">Pending Unpaid Orders:</span>
                      <span className={`font-outfit font-black text-base ${
                        founderReport.pendingPayments > 0 ? 'text-red-600' : 'text-stone-700'
                      }`}>
                        ₹{Number(founderReport.pendingPayments || 0).toFixed(2)}
                      </span>
                    </div>

                    <p className="text-[9px] text-stone-500 tracking-tight">
                      * Unpaid orders are not counted as collected revenue until verified.
                    </p>
                  </div>

                </div>

                {/* Date-Wise Breakdown Table */}
                <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-outfit font-black text-base text-stone-900">
                        Daily Sales & Collection Log
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Date-wise breakdown of orders, items, gross sales, discounts, collected cash, and digital payments
                      </p>
                    </div>
                  </div>

                  {(!founderReport.dailyBreakdown || founderReport.dailyBreakdown.length === 0) ? (
                    <div className="py-12 text-center text-stone-400 text-xs">
                      No sales data available for this range.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4 text-center">Orders</th>
                            <th className="py-3 px-4 text-center">Items Sold</th>
                            <th className="py-3 px-4 text-right">Gross Sales</th>
                            <th className="py-3 px-4 text-right">Discounts</th>
                            <th className="py-3 px-4 text-right">Net Sales</th>
                            <th className="py-3 px-4 text-right text-emerald-800">Cash in Hand</th>
                            <th className="py-3 px-4 text-right text-blue-800">UPI / Digital</th>
                            <th className="py-3 px-4 text-right text-stone-500">Pending</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 font-mono">
                          {founderReport.dailyBreakdown.map((row) => (
                            <tr key={row.date} className="hover:bg-stone-50/70 transition">
                              <td className="py-3.5 px-4 font-bold text-stone-900 font-sans">
                                {new Date(row.date).toLocaleDateString('en-IN', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold text-stone-800">
                                {row.ordersCount}
                              </td>
                              <td className="py-3.5 px-4 text-center text-stone-700">
                                {row.itemsCount}
                              </td>
                              <td className="py-3.5 px-4 text-right text-stone-700">
                                ₹{Number(row.grossSales || 0).toFixed(2)}
                              </td>
                              <td className="py-3.5 px-4 text-right text-red-600">
                                -₹{Number(row.discounts || 0).toFixed(2)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-black text-stone-950 font-outfit text-sm">
                                ₹{Number(row.netSales || 0).toFixed(2)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-black text-emerald-700 bg-emerald-50/40">
                                ₹{Number(row.cashCollected || 0).toFixed(2)}
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-blue-700">
                                ₹{Number(row.upiCollected || 0).toFixed(2)}
                              </td>
                              <td className="py-3.5 px-4 text-right text-stone-500">
                                ₹{Number(row.pendingAmount || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Founder & Cashier Verification Sign-off Block */}
                  <div className="p-6 bg-stone-50/80 border-t border-stone-200 mt-2 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-stone-600">
                    <div>
                      <div className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
                        Canteen Accounts & Physical Cash Verification
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Certified that the physical cash in drawer matches counter receipts and bank credits for this audit period.
                      </p>
                    </div>

                    <div className="flex items-center gap-8 shrink-0">
                      <div className="text-center">
                        <div className="w-32 border-b border-stone-400 mb-1" />
                        <span className="text-[10px] uppercase font-bold text-stone-500">
                          Cashier / Counter Staff
                        </span>
                      </div>
                      <div className="text-center">
                        <div className="w-32 border-b border-stone-400 mb-1" />
                        <span className="text-[10px] uppercase font-bold text-stone-500">
                          Canteen Founder Sign-off
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </>
            )}

          </div>
        )}

      </div>

      {/* ================= RETENTION SETTINGS & SAFE CLEANUP MODAL ================= */}
      {retentionModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber/20 text-[#0b3d2e] flex items-center justify-center font-bold">
                  <Settings className="w-4 h-4 text-[#0b3d2e]" />
                </div>
                <div>
                  <h3 className="font-outfit font-black text-base text-stone-900">
                    Bill Retention & Cleanup
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Configure bill archive storage duration and safe automated cleanup
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRetentionModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Policy Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
                Archive Retention Period
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdateRetention(3)}
                  disabled={cleanupLoading}
                  className={`p-3.5 rounded-2xl border-2 text-left transition ${
                    retentionSettings.billRetentionMonths === 3
                      ? 'border-[#0b3d2e] bg-[#0b3d2e]/5'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <span className="font-outfit font-black text-sm text-stone-900 block">
                    3 Months Retention
                  </span>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    For high-volume canteens needing compact database storage.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateRetention(6)}
                  disabled={cleanupLoading}
                  className={`p-3.5 rounded-2xl border-2 text-left transition ${
                    retentionSettings.billRetentionMonths === 6
                      ? 'border-[#0b3d2e] bg-[#0b3d2e]/5'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <span className="font-outfit font-black text-sm text-stone-900 block">
                    6 Months Retention (Recommended)
                  </span>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    Covers full college semester audit requirements.
                  </span>
                </button>
              </div>
            </div>

            {/* Last cleanup info */}
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs text-stone-600 space-y-1">
              <div className="flex justify-between">
                <span>Last Safe Cleanup:</span>
                <span className="font-bold text-stone-900">
                  {retentionSettings.lastCleanupAt
                    ? new Date(retentionSettings.lastCleanupAt).toLocaleString('en-IN')
                    : 'Never run'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bills Purged in Last Run:</span>
                <span className="font-mono font-bold text-stone-900">
                  {retentionSettings.lastCleanupCount || 0}
                </span>
              </div>
            </div>

            {/* Preview Banner */}
            {cleanupPreview && (
              <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-2xl text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Cleanup Preview Results</span>
                </div>
                <p className="text-amber-800">
                  Cutoff date: <strong>{new Date(cleanupPreview.cutoffDate).toLocaleDateString()}</strong> (older than {cleanupPreview.retentionMonths} months).
                </p>
                <div className="font-mono font-bold text-amber-950">
                  {cleanupPreview.eligibleCount} expired bills ready to safely purge.
                </div>
              </div>
            )}

            {/* Success Message */}
            {cleanupSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{cleanupSuccessMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handlePreviewCleanup}
                disabled={cleanupLoading}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs py-2.5 px-3 rounded-xl border border-stone-300 transition"
              >
                {cleanupLoading ? 'Checking...' : 'Preview Expired Bills'}
              </button>

              {cleanupPreview && cleanupPreview.eligibleCount > 0 && (
                <button
                  type="button"
                  onClick={handleExecuteCleanup}
                  disabled={cleanupLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition shadow-xs"
                >
                  {cleanupLoading ? 'Purging...' : `Purge ${cleanupPreview.eligibleCount} Bills`}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default BillHistory;
