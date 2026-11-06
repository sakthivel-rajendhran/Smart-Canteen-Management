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
  // Active Navigation Tab: 'archive' | 'founder'
  const [activeTab, setActiveTab] = useState('archive');

  // Archive data & summary (Internal Bills)
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({
    totalBills: 0,
    totalSales: 0,
    cashCollected: 0,
    upiCollected: 0,
    pendingCOD: 0,
    completedHandovers: 0,
    pendingHandovers: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Founder Daily Sales Summary State
  const [founderReport, setFounderReport] = useState({
    totalOrdersReceived: 0,
    totalInternalBills: 0,
    cancelledOrders: 0,
    totalItemsSold: 0,
    grossSales: 0,
    discounts: 0,
    netSales: 0,
    cashSalesCollected: 0,
    upiSalesCollected: 0,
    outstandingPayments: 0,
    dailyBreakdown: [],
  });
  const [founderLoading, setFounderLoading] = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState('today'); // 'today' | 'yesterday' | '7days' | '30days' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderChannel, setOrderChannel] = useState('ALL'); // 'ALL' | 'ONLINE' | 'POS'
  const [paymentMethod, setPaymentMethod] = useState('ALL'); // 'ALL' | 'cash' | 'upi' | 'card' | 'razorpay' | 'cod'
  const [handoverStatus, setHandoverStatus] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'PENDING'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Thermal Receipt Modal State for Reprinting
  const [reprintBill, setReprintBill] = useState(null);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);

  // Retention Settings Modal State
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
  }, [activeTab, dateRange, startDate, endDate, orderChannel, paymentMethod, handoverStatus, page]);

  // Fetch Internal Bills Archive
  const fetchBills = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        dateRange,
        orderChannel,
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
      console.error('Failed to fetch internal bills archive:', err);
      setError(err.response?.data?.message || 'Failed to load internal bills archive.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Founder Daily Sales Summary
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
        setFounderReport(res.data.report || {});
      }
    } catch (err) {
      console.error('Failed to fetch founder report:', err);
      setError(err.response?.data?.message || 'Failed to load founder daily sales report.');
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
    setReprintBill(bill);
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
    if (!window.confirm(`Are you sure you want to purge ${count} expired internal bills? Active orders will NEVER be touched.`)) {
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
        order={reprintBill}
        isOpen={reprintModalOpen}
        onClose={() => {
          setReprintModalOpen(false);
          setReprintBill(null);
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
                  Internal Bill Archive & Founder Sales Proof
                </h1>
                <span className="bg-amber/20 border border-amber/40 text-amber text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Audit Verified
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                Internal accounting sales records • Thermal reprinting • Founder daily reconciliation
              </p>
            </div>
          </div>

          {/* Quick Action Links */}
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
              <span>Internal Bills Archive</span>
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
              <span>Founder Daily Sales Summary</span>
              <span className="bg-amber text-stone-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Audit Proof
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
              <span>Print Founder Audit Sheet</span>
            </button>
          )}
        </div>

        {/* ================= DATE RANGE SELECTOR BAR ================= */}
        <div className="no-print bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-stone-200 space-y-4">
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

          {/* Filters Row (Active for Internal Bills Archive) */}
          {activeTab === 'archive' && (
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1 border-t border-stone-100">
              {/* Search Input */}
              <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Bill # (IB-DRS-XXXX), Token #, Order ID, Customer Name..."
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
                value={orderChannel}
                onChange={(e) => {
                  setOrderChannel(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none focus:border-[#0b3d2e]"
              >
                <option value="ALL">All Channels</option>
                <option value="POS">Walk-in POS</option>
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

              {/* Payment Mode Filter */}
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
                <option value="cod">Cash on Delivery (COD)</option>
                <option value="upi">UPI QR</option>
                <option value="online">Online / Card</option>
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

        {/* ================= TAB 1: INTERNAL BILLS ARCHIVE ================= */}
        {activeTab === 'archive' && (
          <div className="space-y-6">

            {/* Daily Summary Cards (Strict Canteen Accounting) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              
              {/* Bills Generated */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Bills Generated</span>
                  <Receipt className="w-4 h-4 text-[#0b3d2e]" />
                </div>
                <div className="font-outfit font-black text-2xl text-stone-900">
                  {summary.totalBills || 0}
                </div>
                <span className="text-[10px] text-stone-400 font-medium">Internal bills</span>
              </div>

              {/* Total Sales */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total Sales</span>
                  <IndianRupee className="w-4 h-4 text-stone-700" />
                </div>
                <div className="font-outfit font-black text-2xl text-stone-900">
                  ₹{Number(summary.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-stone-400 font-medium">Total billed value</span>
              </div>

              {/* Actual Cash Collected */}
              <div className="bg-white rounded-2xl p-4 border-2 border-emerald-200 shadow-xs flex flex-col justify-between bg-emerald-50/20">
                <div className="flex items-center justify-between text-emerald-800 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Actual Cash Collected</span>
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="font-outfit font-black text-2xl text-emerald-700">
                  ₹{Number(summary.cashCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-emerald-600 font-bold">Physical cash verified</span>
              </div>

              {/* UPI / Digital Collected */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">UPI / Digital</span>
                  <Smartphone className="w-4 h-4 text-blue-600" />
                </div>
                <div className="font-outfit font-black text-2xl text-blue-700">
                  ₹{Number(summary.upiCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-stone-400 font-medium">Bank confirmed</span>
              </div>

              {/* Pending COD */}
              <div className={`rounded-2xl p-4 border shadow-xs flex flex-col justify-between ${
                summary.pendingCOD > 0 ? 'bg-red-50/50 border-red-200' : 'bg-white border-stone-200'
              }`}>
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${summary.pendingCOD > 0 ? 'text-red-700 font-black' : ''}`}>
                    Pending COD
                  </span>
                  <AlertTriangle className={`w-4 h-4 ${summary.pendingCOD > 0 ? 'text-red-600' : 'text-stone-400'}`} />
                </div>
                <div className={`font-outfit font-black text-2xl ${summary.pendingCOD > 0 ? 'text-red-600' : 'text-stone-900'}`}>
                  ₹{Number(summary.pendingCOD || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-stone-400 font-medium">Uncollected counter COD</span>
              </div>

              {/* Completed vs Pending Handovers */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Handover Status</span>
                  <CheckCheck className="w-4 h-4 text-[#0b3d2e]" />
                </div>
                <div className="flex items-baseline gap-1.5 font-outfit font-black text-xl text-stone-900">
                  <span className="text-emerald-700">{summary.completedHandovers || 0}</span>
                  <span className="text-stone-400 font-medium text-xs">done /</span>
                  <span className="text-amber-700">{summary.pendingHandovers || 0}</span>
                  <span className="text-stone-400 font-medium text-xs">pend</span>
                </div>
                <span className="text-[10px] text-stone-400 font-medium">Physical handover count</span>
              </div>

            </div>

            {/* Internal Bills Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h3 className="font-outfit font-black text-base text-stone-900">
                    Internal Sales Records & Accounting Bills ({pagination.total})
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Strictly internal records for college canteen founder verification and accounts proof
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
                    Retrieving internal bills...
                  </span>
                </div>
              ) : bills.length === 0 ? (
                <div className="py-20 text-center p-6">
                  <Receipt className="w-12 h-12 text-stone-300 mx-auto mb-2 stroke-1" />
                  <h4 className="font-outfit font-bold text-stone-800 text-base mb-1">
                    No Internal Bills Found
                  </h4>
                  <p className="text-stone-500 text-xs max-w-sm mx-auto">
                    No internal sales bills match the chosen date range or filter criteria.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Bill Number & Copy</th>
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
                        const isWalkIn = bill.orderChannel === 'POS';
                        const token = bill.pickupToken || bill.orderCode?.replace('DRS-', '');
                        const isHandoverDone = bill.handoverStatus === 'COMPLETED';
                        const printCount = Number(bill.billPrintCount || 1);
                        const isReprint = printCount > 1;

                        const dateObj = new Date(bill.generatedAt || bill.createdAt);
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
                            
                            {/* Bill Number & Copy Count */}
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              <span className="font-outfit font-black text-sm text-[#0b3d2e] block">
                                {bill.billNumber}
                              </span>
                              {isReprint ? (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                  Reprint (#{printCount})
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                  Original Copy
                                </span>
                              )}
                            </td>

                            {/* Token & Code */}
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              <span className="font-outfit font-black text-base text-[#0b3d2e] block">
                                #{token}
                              </span>
                              <span className="text-[10px] text-stone-500 font-semibold">
                                #{bill.orderCode}
                              </span>
                            </td>

                            {/* Date */}
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
                                {bill.customerName || 'Walk-in Customer'}
                              </div>
                              {bill.customerRegNo ? (
                                <div className="text-[10px] font-mono text-indigo-700 font-semibold">
                                  Reg: {bill.customerRegNo}
                                </div>
                              ) : bill.customerStaffId ? (
                                <div className="text-[10px] font-mono text-purple-700 font-semibold">
                                  Staff ID: {bill.customerStaffId}
                                </div>
                              ) : bill.customerPhone ? (
                                <div className="text-[10px] text-stone-400 font-mono">
                                  {bill.customerPhone}
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
                                {bill.paymentStatus === 'paid' ? 'PAID' : 'COLLECT CASH'}
                              </span>
                            </td>

                            {/* Total */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono">
                              <span className="font-outfit font-black text-sm text-stone-900">
                                ₹{Number(bill.grandTotal || 0).toFixed(2)}
                              </span>
                            </td>

                            {/* Action: Reprint Internal Bill */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => openReprint(bill)}
                                className="inline-flex items-center gap-1 bg-stone-100 hover:bg-[#0b3d2e] hover:text-white text-stone-700 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition active:scale-95 shadow-2xs border border-stone-200"
                                title="Reprint internal accounting bill"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Reprint Bill</span>
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

        {/* ================= TAB 2: FOUNDER DAILY SALES SUMMARY ================= */}
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
                    Executive Audit Sheet
                  </span>
                  <h2 className="font-outfit font-black text-xl sm:text-2xl text-stone-900 mt-1">
                    Canteen Founder Daily Sales & Cash Audit
                  </h2>
                  <p className="text-xs text-stone-500">
                    Official financial proof distinguishing billed revenue from actual verified cash in hand
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-stone-400 block">
                  Report Date Range
                </span>
                <span className="font-outfit font-black text-sm text-[#0b3d2e] uppercase">
                  {dateRange === 'today' ? "Today's Audit" : dateRange === 'yesterday' ? "Yesterday's Audit" : `${dateRange} Report`}
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
                  Generating founder sales reconciliation...
                </span>
              </div>
            ) : (
              <>
                {/* 3 Executive Financial Pillar Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Pillar 1: Total Orders & Activity */}
                  <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                      <span className="text-xs font-black uppercase tracking-wider text-stone-500">
                        1. Orders & Volume
                      </span>
                      <Receipt className="w-4 h-4 text-stone-400" />
                    </div>
                    
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-600">Total Orders Received:</span>
                      <span className="font-outfit font-black text-lg text-stone-900">
                        {founderReport.totalOrdersReceived || 0}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-600">Internal Bills Generated:</span>
                      <span className="font-outfit font-black text-lg text-[#0b3d2e]">
                        {founderReport.totalInternalBills || 0}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-600">Total Food Trays/Items Sold:</span>
                      <span className="font-outfit font-black text-lg text-stone-900">
                        {founderReport.totalItemsSold || 0}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline pt-1 border-t border-stone-100">
                      <span className="text-xs text-stone-500">Cancelled Orders:</span>
                      <span className="font-mono font-bold text-xs text-stone-500">
                        {founderReport.cancelledOrders || 0}
                      </span>
                    </div>
                  </div>

                  {/* Pillar 2: Gross Sales & Net Revenue */}
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
                      <span className="text-xs text-stone-600">Total Discounts Granted:</span>
                      <span className="font-outfit font-bold text-base text-red-600">
                        - ₹{Number(founderReport.discounts || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline pt-2 border-t-2 border-stone-100">
                      <span className="text-xs font-black uppercase text-stone-900">Net Sales Revenue:</span>
                      <span className="font-outfit font-black text-2xl text-stone-950">
                        ₹{Number(founderReport.netSales || 0).toFixed(2)}
                      </span>
                    </div>

                    <span className="text-[10px] text-stone-400 block text-right">
                      Subtotal minus applicable discounts
                    </span>
                  </div>

                  {/* Pillar 3: Cash Proof & Payment Settlement */}
                  <div className="bg-white rounded-3xl p-5 border-2 border-emerald-300 shadow-xs space-y-3 bg-emerald-50/20">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                        3. Verified Cash in Hand
                      </span>
                      <Banknote className="w-4 h-4 text-emerald-700" />
                    </div>

                    <div className="flex justify-between items-baseline bg-emerald-100/70 p-2.5 rounded-xl">
                      <span className="text-xs font-black text-emerald-950">
                        Actual Cash Collected:
                      </span>
                      <span className="font-outfit font-black text-xl text-emerald-800">
                        ₹{Number(founderReport.cashSalesCollected || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-stone-700 font-medium">UPI / Digital Bank Sales:</span>
                      <span className="font-outfit font-black text-base text-blue-700">
                        ₹{Number(founderReport.upiSalesCollected || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline pt-1 border-t border-emerald-200">
                      <span className="text-xs text-stone-600">Pending Uncollected COD:</span>
                      <span className={`font-outfit font-black text-base ${
                        founderReport.outstandingPayments > 0 ? 'text-red-600' : 'text-stone-700'
                      }`}>
                        ₹{Number(founderReport.outstandingPayments || 0).toFixed(2)}
                      </span>
                    </div>

                    <p className="text-[9px] text-stone-500 tracking-tight">
                      * Pending COD is NOT counted as cash on hand until physically paid.
                    </p>
                  </div>

                </div>

                {/* Date-Wise Breakdown Table */}
                <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-outfit font-black text-base text-stone-900">
                        Date-Wise Financial Breakdown
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Daily audit logs showing orders, items sold, gross sales, discounts, net sales, cash in hand, and pending amounts
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
                            <th className="py-3 px-4 text-right text-stone-500">Pending COD</th>
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

                  {/* Audit Verification Block for Print and Sign-off */}
                  <div className="p-6 bg-stone-50/80 border-t border-stone-200 mt-2 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-stone-600">
                    <div>
                      <div className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
                        Canteen Accounts Verification
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Certified that the above internal sales figures match counter cash receipts and bank credits.
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
                    Internal Bill Retention & Cleanup
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Configure internal bill archive storage duration and safe automated cleanup
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
