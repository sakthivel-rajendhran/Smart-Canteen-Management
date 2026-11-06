import React, { useState, useEffect, useMemo } from 'react';
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
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  IndianRupee,
  ShoppingBag,
  Smartphone,
  Banknote,
  QrCode,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Settings,
  X,
} from 'lucide-react';

const BillHistory = () => {
  // Archive data & summary
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState({
    totalCompletedOrders: 0,
    totalSales: 0,
    onlineSales: 0,
    walkInSales: 0,
    cashSales: 0,
    digitalSales: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [dateRange, setDateRange] = useState('today'); // 'today' | 'yesterday' | '7days' | '30days' | '3months' | '6months' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderType, setOrderType] = useState('ALL'); // 'ALL' | 'ONLINE' | 'WALK_IN'
  const [paymentMethod, setPaymentMethod] = useState('ALL'); // 'ALL' | 'cash' | 'upi' | 'card' | 'razorpay'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Reprint Receipt Modal State
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
    fetchBills();
  }, [dateRange, startDate, endDate, orderType, paymentMethod, page]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        dateRange,
        orderType,
        paymentMethod,
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBills();
  };

  const openReprint = (bill) => {
    setReprintOrder(bill);
    setReprintModalOpen(true);
  };

  // Retention Settings fetch & save
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
        // Update local settings display
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
      
      {/* Thermal Receipt Reprint Modal */}
      <ThermalReceiptModal
        order={reprintOrder}
        isOpen={reprintModalOpen}
        onClose={() => setReprintModalOpen(false)}
        autoPrint={false}
      />

      {/* Top Header */}
      <div className="bg-[#0b3d2e] text-white px-4 py-3 shadow-md border-b border-white/10 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber flex items-center justify-center text-primary-dark font-black text-lg shadow-sm">
              🧾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-outfit font-black text-base sm:text-lg tracking-tight">
                  Bill History & Sales Archive
                </h1>
                <span className="bg-amber/20 border border-amber/40 text-amber text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  3–6 Months Archive
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                Read-only sales snapshots • Thermal reprinting • Retention management
              </p>
            </div>
          </div>

          {/* Quick links & Retention button */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openRetentionModal}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition border border-white/10"
              title="Retention Settings & Safe Cleanup"
            >
              <Settings className="w-3.5 h-3.5 text-amber" />
              <span>Retention ({retentionSettings.billRetentionMonths}M)</span>
            </button>

            <Link
              to="/admin/pos"
              className="flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-stone-950 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-sm"
            >
              <span>+ POS Sale</span>
            </Link>

            <Link
              to="/admin/handover"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition border border-white/10"
            >
              <span>Handover Queue</span>
            </Link>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        
        {/* ================= REAL-TIME KPI SUMMARY METRICS ================= */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Total Completed Orders */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Completed Orders</span>
              <Receipt className="w-4 h-4 text-[#0b3d2e]" />
            </div>
            <div className="font-outfit font-black text-2xl sm:text-3xl text-stone-900">
              {summary.totalCompletedOrders || 0}
            </div>
            <span className="text-[10px] text-stone-400 font-medium">In selected date filter</span>
          </div>

          {/* Total Sales Revenue */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Revenue</span>
              <IndianRupee className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-outfit font-black text-2xl sm:text-3xl text-emerald-600">
              ₹{(summary.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-stone-400 font-medium">Gross canteen sales</span>
          </div>

          {/* Online vs Walk-in Split */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Sales Channel</span>
              <Smartphone className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold text-stone-600">Online:</span>
              <span className="font-outfit font-black text-stone-900">₹{(summary.onlineSales || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs mt-0.5">
              <span className="font-bold text-amber-700">Walk-in:</span>
              <span className="font-outfit font-black text-stone-900">₹{(summary.walkInSales || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Cash vs Digital Split */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Payment Mode</span>
              <Banknote className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold text-emerald-700">Cash:</span>
              <span className="font-outfit font-black text-stone-900">₹{(summary.cashSales || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs mt-0.5">
              <span className="font-bold text-blue-700">Digital / UPI:</span>
              <span className="font-outfit font-black text-stone-900">₹{(summary.digitalSales || 0).toFixed(2)}</span>
            </div>
          </div>

        </div>

        {/* ================= FILTER & SEARCH CONTROL BAR ================= */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-stone-200 space-y-4">
          
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
              { id: '3months', label: '3 Months' },
              { id: '6months', label: '6 Months' },
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

          {/* Custom Date Pickers (visible when custom selected) */}
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
                  fetchBills();
                }}
                className="px-3.5 py-1.5 bg-[#0b3d2e] text-white text-xs font-bold rounded-lg hover:bg-[#1a7a45] transition"
              >
                Apply Range
              </button>
            </div>
          )}

          {/* Row 2: Search Input & Dropdown Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Token #, Order DRS-XXXX, Customer Name, Phone, Reg No..."
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

            {/* Order Type Filter */}
            <select
              value={orderType}
              onChange={(e) => {
                setOrderType(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-auto px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none focus:border-[#0b3d2e]"
            >
              <option value="ALL">All Channels</option>
              <option value="ONLINE">Online Orders</option>
              <option value="WALK_IN">Walk-in Counter</option>
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
              <option value="ALL">All Payment Modes</option>
              <option value="cash">Cash / Counter</option>
              <option value="upi">UPI QR</option>
              <option value="card">Card</option>
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

        </div>

        {/* ================= BILL ARCHIVE TABLE ================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
          
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-outfit font-black text-base text-stone-900">
              Completed Sales Records ({pagination.total})
            </h3>
            <span className="text-xs text-stone-500">
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
                No completed orders match the chosen date range or filter criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Token & Order ID</th>
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Customer Details</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {bills.map((bill) => {
                    const isWalkIn = bill.orderType === 'WALK_IN';
                    const token = bill.pickupToken || bill.orderCode?.replace('DRS-', '');
                    const customerName = isWalkIn
                      ? (bill.walkInCustomer?.name || 'Walk-in')
                      : (bill.user?.name || 'Student');
                    const customerReg = isWalkIn
                      ? bill.walkInCustomer?.registerNumber
                      : bill.user?.studentDetails?.registerNumber;
                    const customerPhone = isWalkIn
                      ? bill.walkInCustomer?.phone
                      : bill.user?.phone;

                    const dateObj = new Date(bill.completedAt || bill.createdAt);
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
                        
                        {/* Token & Code */}
                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-outfit font-black text-sm text-[#0b3d2e] block">
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
                            {isWalkIn ? 'Walk-in' : 'Online'}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-stone-900 truncate max-w-[140px]">
                            {customerName}
                          </div>
                          {customerReg ? (
                            <div className="text-[10px] font-mono text-stone-500">
                              Reg: {customerReg}
                            </div>
                          ) : customerPhone ? (
                            <div className="text-[10px] text-stone-400 font-mono">
                              {customerPhone}
                            </div>
                          ) : null}
                        </td>

                        {/* Items */}
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

                        {/* Payment */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold uppercase text-[11px] text-stone-800">
                            {bill.paymentMethod}
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {bill.paymentStatus}
                          </span>
                        </td>

                        {/* Total */}
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
                            className="inline-flex items-center gap-1 bg-stone-100 hover:bg-[#0b3d2e] hover:text-white text-stone-700 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition active:scale-95 shadow-2xs"
                            title="Reprint thermal receipt"
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
                    Configure archive storage duration and safe automated cleanup
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
                <p className="text-amber-900 font-black text-sm">
                  Found {cleanupPreview.eligibleCount} expired completed bills eligible for purge.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExecuteCleanup}
                    disabled={cleanupLoading || cleanupPreview.eligibleCount === 0}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs py-2 px-3 rounded-xl transition"
                  >
                    Execute Purge ({cleanupPreview.eligibleCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCleanupPreview(null)}
                    className="px-3 py-2 bg-stone-200 text-stone-700 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Cleanup Success Banner */}
            {cleanupSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-400 p-3 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{cleanupSuccessMessage}</span>
              </div>
            )}

            {/* Action buttons */}
            {!cleanupPreview && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-stone-500 italic">
                  * Active and pending orders are never purged.
                </span>
                <button
                  type="button"
                  onClick={handlePreviewCleanup}
                  disabled={cleanupLoading}
                  className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs py-2 px-4 rounded-xl transition shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber" />
                  <span>Preview Expired Bills</span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default BillHistory;

