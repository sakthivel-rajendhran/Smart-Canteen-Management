import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import ThermalReceiptModal from '../components/common/ThermalReceiptModal';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
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
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Settings,
  X,
  FileDown,
  TrendingUp,
  BarChart3,
  CalendarRange,
  ChevronDown,
  Eye,
  History,
  ArrowDownToLine,
  CreditCard,
  Percent,
  Package,
  RotateCcw,
  Check,
  Download,
} from 'lucide-react';

const DATE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7days', label: 'Last 7 Days' },
  { id: '30days', label: 'Last 30 Days' },
  { id: '3months', label: '3 Months' },
  { id: '6months', label: '6 Months' },
  { id: 'custom', label: 'Custom Range' },
];

/**
 * Format Indian Rupee currency
 */
const formatINR = (val) => {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Format IST Date for labels
 */
const formatISTShort = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
  }).format(d);
};

const formatISTFull = (dateVal, includeTime = true) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  const options = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }
  return new Intl.DateTimeFormat('en-IN', options).format(d);
};

const RevenueReports = () => {
  // Current calendar date in Asia/Kolkata (IST: UTC+05:30)
  const todayIST = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  }, []);

  // Filter State
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customRangeError, setCustomRangeError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Analytics & Summary State (All 8 Metrics)
  const [summary, setSummary] = useState({
    grossSales: 0,
    netRevenue: 0,
    totalOrders: 0,
    cashRevenue: 0,
    onlineRevenue: 0,
    totalDiscounts: 0,
    parcelCharges: 0,
    refunds: 0,
    refundedOrdersCount: 0,
    avgOrderValue: 0,
    posWalkInOrders: 0,
    customerOnlineOrders: 0,
  });
  const [dailyTrends, setDailyTrends] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filterInfo, setFilterInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Report History State
  const [reportHistory, setReportHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);

  // PDF Action States
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [activeReportName, setActiveReportName] = useState('');

  // Thermal Receipt Reprint Modal State
  const [reprintOrder, setReprintOrder] = useState(null);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);

  // Retention Settings State
  const [retentionModalOpen, setRetentionModalOpen] = useState(false);
  const [retentionSettings, setRetentionSettings] = useState({
    billRetentionMonths: 6,
    lastCleanupAt: null,
    lastCleanupCount: 0,
  });
  const [cleanupPreview, setCleanupPreview] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState('');

  // Active Tab for Analytics / Daily Table / History
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'daily' | 'transactions' | 'history'

  // Fetch Revenue Analytics on filter change
  useEffect(() => {
    if (dateRange === 'custom') {
      if (startDate && endDate && endDate >= startDate) {
        fetchAnalytics();
      }
    } else {
      fetchAnalytics();
    }
  }, [dateRange, page]);

  // Fetch Report History on mount
  useEffect(() => {
    fetchReportHistory();
    fetchRetentionSettings();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      setCustomRangeError('');

      const params = {
        dateRange,
        search: search.trim(),
        page,
        limit: 20,
      };

      if (dateRange === 'custom') {
        if (!startDate || !endDate) {
          setLoading(false);
          return;
        }
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const res = await API.get('/admin/revenue/analytics', { params });
      if (res.data?.success) {
        setSummary(res.data.summary || {});
        setDailyTrends(res.data.dailyTrends || []);
        setTransactions(res.data.transactions || []);
        setPagination(res.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
        setFilterInfo(res.data.filterInfo || {});
      }
    } catch (err) {
      console.error('Failed to fetch revenue analytics:', err);
      setError(err.response?.data?.message || 'Failed to load revenue analytics.');
    } finally {
      setLoading(false);
    }
  };

  const fetchReportHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await API.get('/admin/revenue/reports?limit=10');
      if (res.data?.success) {
        setReportHistory(res.data.data || []);
        setHistoryTotal(res.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load report history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchRetentionSettings = async () => {
    try {
      const res = await API.get('/admin/settings/bill-retention');
      if (res.data?.success) {
        setRetentionSettings(res.data.data);
      }
    } catch (e) {
      // Optional settings endpoint
    }
  };

  const handleApplyCustomRange = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setCustomRangeError('Please choose both start date and end date.');
      return;
    }
    if (endDate < startDate) {
      setCustomRangeError('End date cannot be earlier than start date.');
      return;
    }
    if (startDate > todayIST || endDate > todayIST) {
      setCustomRangeError('Future dates cannot be selected.');
      return;
    }

    setCustomRangeError('');
    setPage(1);
    fetchAnalytics();
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAnalytics();
  };

  // 1. DIRECT PDF DOWNLOAD (Triggers real file download to user's device)
  const handleDownloadPDF = async () => {
    try {
      setDownloadingPdf(true);
      const token = localStorage.getItem('token');
      const baseURL = API.defaults.baseURL || '/api';
      const url = `${baseURL}/admin/revenue/reports/generate?download=true`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dateRange,
          startDate: dateRange === 'custom' ? startDate : undefined,
          endDate: dateRange === 'custom' ? endDate : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Read standardized filename from response header
      const disposition = response.headers.get('content-disposition');
      let filename = `DRS_Revenue_${dateRange}_${todayIST}.pdf`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      fetchReportHistory();
    } catch (err) {
      console.error('Download PDF error:', err);
      alert('Failed to generate and download PDF: ' + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // 2. VIEW PDF INLINE IN MODAL
  const handleViewPDF = async (reportId = null, reportName = '') => {
    try {
      setViewLoading(true);
      setPdfModalOpen(true);
      setActiveReportName(reportName || `Revenue Statement (${filterInfo.filterLabel || dateRange})`);

      const token = localStorage.getItem('token');
      const baseURL = API.defaults.baseURL || '/api';

      let fetchUrl = '';
      if (reportId) {
        fetchUrl = `${baseURL}/admin/revenue/reports/${reportId}/view`;
      } else {
        // Generate on the fly
        const res = await API.post('/admin/revenue/reports/generate', {
          dateRange,
          startDate: dateRange === 'custom' ? startDate : undefined,
          endDate: dateRange === 'custom' ? endDate : undefined,
        });

        if (res.data?.success && res.data.data?._id) {
          fetchUrl = `${baseURL}/admin/revenue/reports/${res.data.data._id}/view`;
          setActiveReportName(res.data.data.reportName);
          fetchReportHistory();
        } else {
          throw new Error('Failed to generate report snapshot');
        }
      }

      const response = await fetch(fetchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load PDF preview');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPdfPreviewUrl(blobUrl);
    } catch (err) {
      console.error('View PDF error:', err);
      alert('Failed to view PDF: ' + err.message);
      setPdfModalOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  // 3. DOWNLOAD REPORT FROM HISTORY
  const handleDownloadHistoryReport = async (report) => {
    try {
      const token = localStorage.getItem('token');
      const baseURL = API.defaults.baseURL || '/api';
      const url = `${baseURL}/admin/revenue/reports/${report._id}/download`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = report.reportName || `${report.reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  };

  // Reprint Receipt Modal Handler
  const openReprint = (bill) => {
    setReprintOrder(bill);
    setReprintModalOpen(true);
  };

  // Retention Settings & Safe Cleanup handlers
  const handlePreviewRetention = async () => {
    try {
      setCleanupLoading(true);
      const res = await API.get('/admin/settings/bill-retention/preview');
      if (res.data?.success) setCleanupPreview(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to preview cleanup.');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleExecuteCleanup = async () => {
    if (!window.confirm('Are you sure you want to clean up eligible expired records?')) return;
    try {
      setCleanupLoading(true);
      const res = await API.post('/admin/settings/bill-retention/cleanup');
      if (res.data?.success) {
        setCleanupSuccessMessage(res.data.message);
        setCleanupPreview(null);
        fetchAnalytics();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Cleanup execution failed.');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleUpdatePolicy = async (months) => {
    try {
      const res = await API.put('/admin/settings/bill-retention', { billRetentionMonths: months });
      if (res.data?.success) {
        setRetentionSettings(res.data.data);
        alert(`Policy updated: Records older than ${months} months will be archived.`);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update policy.');
    }
  };

  // Chart data formatting
  const chartData = useMemo(() => {
    return dailyTrends.map((d) => ({
      ...d,
      displayDate: formatISTShort(d._id),
    }));
  }, [dailyTrends]);

  // Selected Option Object
  const currentOption = DATE_OPTIONS.find((o) => o.id === dateRange) || DATE_OPTIONS[0];

  return (
    <div className="min-h-screen bg-stone-100/70 pb-20 font-inter text-stone-900">
      
      {/* Thermal Receipt Reprint Modal */}
      <ThermalReceiptModal
        order={reprintOrder}
        isOpen={reprintModalOpen}
        onClose={() => setReprintModalOpen(false)}
        autoPrint={false}
      />

      {/* PDF View Modal */}
      {pdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-[#0b3d2e] text-white px-5 py-3.5 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber text-primary-dark font-black flex items-center justify-center text-sm">
                  📄
                </div>
                <div>
                  <h3 className="font-outfit font-black text-sm sm:text-base tracking-tight truncate max-w-md sm:max-w-xl">
                    {activeReportName || 'Official Canteen Financial Statement'}
                  </h3>
                  <p className="text-[10px] text-white/70">
                    A4 Official Statement • Asia/Kolkata (IST) Audit Trail
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {pdfPreviewUrl && (
                  <a
                    href={pdfPreviewUrl}
                    download={activeReportName.endsWith('.pdf') ? activeReportName : `${activeReportName}.pdf`}
                    className="flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-stone-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Save PDF</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPdfModalOpen(false);
                    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
                    setPdfPreviewUrl('');
                  }}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / PDF Viewer */}
            <div className="flex-1 bg-stone-100 p-2 sm:p-4 overflow-hidden relative flex flex-col items-center justify-center">
              {viewLoading ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 border-4 border-stone-300 border-t-[#0b3d2e] rounded-full animate-spin" />
                  <p className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                    Rendering High-Resolution Financial Statement...
                  </p>
                </div>
              ) : pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  title="PDF Preview"
                  className="w-full h-full rounded-2xl border border-stone-300 bg-white shadow-inner"
                />
              ) : (
                <div className="text-stone-500 text-xs">Failed to load preview document.</div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Top Banner / Title Bar */}
      <div className="bg-[#0b3d2e] text-white px-4 py-4 shadow-md border-b border-white/10 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber flex items-center justify-center text-primary-dark font-black text-xl shadow-sm">
              🧾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-outfit font-black text-base sm:text-xl tracking-tight">
                  Revenue Reports
                </h1>
                <span className="bg-amber/20 border border-amber/40 text-amber text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Official Statement
                </span>
              </div>
              <p className="text-[11px] text-white/80 max-w-xl">
                Monitor canteen revenue, analyse transactions, and export professional financial statements.
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            
            {/* View PDF Button */}
            <button
              type="button"
              onClick={() => handleViewPDF()}
              disabled={viewLoading || loading}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition border border-white/15 active:scale-95 disabled:opacity-50"
              title="Preview official financial statement PDF in browser"
            >
              <Eye className="w-3.5 h-3.5 text-amber" />
              <span>{viewLoading ? 'Generating...' : 'View PDF'}</span>
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloadingPdf || loading}
              className="flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-stone-950 font-black text-xs px-3.5 py-2 rounded-xl transition shadow-sm active:scale-95 disabled:opacity-50"
              title="Generate and download official financial statement PDF to your device"
            >
              <FileDown className={`w-3.5 h-3.5 ${downloadingPdf ? 'animate-bounce' : ''}`} />
              <span>{downloadingPdf ? 'Downloading...' : 'Download PDF Report'}</span>
            </button>

            {/* Retention Settings */}
            <button
              type="button"
              onClick={() => setRetentionModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-xl transition border border-white/10"
              title="Retention Policy & Safe Cleanup"
            >
              <Settings className="w-3.5 h-3.5 text-amber" />
              <span>Retention ({retentionSettings.billRetentionMonths}M)</span>
            </button>

            <Link
              to="/admin/pos"
              className="hidden md:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-xl transition border border-white/10"
            >
              <span>+ POS Sale</span>
            </Link>

          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ================= EXACT DATE FILTER CONTROL BAR ================= */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-stone-200 space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* Exact dropdown / segmented selector labeled "Date: [Today ▼]" */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              
              {/* Dropdown Selector */}
              <div className="relative inline-flex items-center">
                <span className="text-xs font-black text-[#0b3d2e] uppercase tracking-wider mr-2 flex items-center gap-1.5 bg-stone-100 px-2.5 py-1.5 rounded-xl border border-stone-200">
                  <Calendar className="w-3.5 h-3.5 text-[#0b3d2e]" /> Date:
                </span>

                <div className="relative">
                  <select
                    value={dateRange}
                    onChange={(e) => {
                      setDateRange(e.target.value);
                      setPage(1);
                    }}
                    className="appearance-none bg-stone-50 hover:bg-stone-100 border border-stone-300 text-stone-900 font-black text-xs px-3.5 py-1.5 pr-8 rounded-xl focus:outline-none focus:border-[#0b3d2e] cursor-pointer shadow-2xs"
                  >
                    {DATE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Quick Segmented Selector Pills */}
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto scrollbar-none pl-2">
                {DATE_OPTIONS.map((opt) => {
                  const isActive = dateRange === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setDateRange(opt.id);
                        setPage(1);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all active:scale-95 ${
                        isActive
                          ? 'bg-[#0b3d2e] text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Active Range & Refresh */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-stone-600 bg-stone-50 border border-stone-200 px-3 py-1 rounded-xl">
                Active Period: <strong className="text-[#0b3d2e] font-sans">{currentOption.label}</strong>
              </span>

              <button
                type="button"
                onClick={fetchAnalytics}
                disabled={loading}
                className="p-2 text-stone-500 hover:text-[#0b3d2e] hover:bg-stone-100 rounded-xl transition border border-stone-200"
                title="Refresh revenue metrics"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

          </div>

          {/* Custom Date Pickers (visible only when 'custom' is selected) */}
          {dateRange === 'custom' && (
            <form
              onSubmit={handleApplyCustomRange}
              className="flex flex-wrap items-center gap-3 bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs animate-in fade-in"
            >
              <div className="flex items-center gap-1.5 font-bold text-[#0b3d2e]">
                <CalendarRange className="w-4 h-4 text-amber-dark" />
                <span>Custom Range:</span>
              </div>

              {/* Start Date */}
              <div className="flex items-center gap-1.5">
                <label className="font-semibold text-stone-600">Start Date:</label>
                <input
                  type="date"
                  value={startDate}
                  max={todayIST}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCustomRangeError('');
                  }}
                  className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#0b3d2e]"
                  required
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-1.5">
                <label className="font-semibold text-stone-600">End Date:</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={todayIST}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCustomRangeError('');
                  }}
                  className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#0b3d2e]"
                  required
                />
              </div>

              {/* Apply Button */}
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-[#0b3d2e] hover:bg-[#1a7a45] text-white text-xs font-bold rounded-lg transition active:scale-95 shadow-2xs"
              >
                Apply Range
              </button>

              <span className="text-[10px] text-stone-400">
                (Asia/Kolkata IST up to today: {todayIST})
              </span>

              {customRangeError && (
                <div className="w-full text-red-600 font-bold text-[11px] flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{customRangeError}</span>
                </div>
              )}
            </form>
          )}

        </div>

        {/* ================= 8 REVENUE SUMMARY CARDS ================= */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-stone-500">
              Financial Summary — {currentOption.label}
            </h2>
            <span className="text-[11px] text-stone-400">
              All amounts in Indian Rupees (₹)
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            
            {/* 1. Gross Sales */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Gross Sales</span>
                <IndianRupee className="w-4 h-4 text-stone-400" />
              </div>
              <div className="font-outfit font-black text-2xl sm:text-3xl text-stone-900 font-mono">
                {formatINR(summary.grossSales)}
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                Before discounts & refunds
              </span>
            </div>

            {/* 2. Net Revenue (Highlighted Key Metric) */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border-2 border-emerald-500/80 shadow-sm flex flex-col justify-between hover:shadow-md transition bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-xl tracking-wider">
                Actual Earnings
              </div>
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">Net Revenue</span>
                <Sparkles className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="font-outfit font-black text-2xl sm:text-3xl text-emerald-700 font-mono">
                {formatINR(summary.netRevenue)}
              </div>
              <span className="text-[10px] text-emerald-700/80 font-bold">
                Gross - Discounts - Refunds
              </span>
            </div>

            {/* 3. Total Orders */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
                <Receipt className="w-4 h-4 text-[#0b3d2e]" />
              </div>
              <div className="font-outfit font-black text-2xl sm:text-3xl text-stone-900 font-mono">
                {summary.totalOrders || 0}
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                Avg Value: ₹{Number(summary.avgOrderValue || 0).toFixed(2)}
              </span>
            </div>

            {/* 4. Cash Revenue */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Cash Revenue</span>
                <Banknote className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="font-outfit font-black text-2xl sm:text-3xl text-stone-900 font-mono">
                {formatINR(summary.cashRevenue)}
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                Counter cash receipts
              </span>
            </div>

            {/* 5. Online Payment Revenue */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Online Revenue</span>
                <CreditCard className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="font-outfit font-black text-2xl sm:text-3xl text-stone-900 font-mono">
                {formatINR(summary.onlineRevenue)}
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                UPI / Razorpay / Cards
              </span>
            </div>

            {/* 6. Total Discounts */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Discounts</span>
                <Percent className="w-4 h-4 text-amber-500" />
              </div>
              <div className="font-outfit font-black text-2xl sm:text-3xl text-amber-600 font-mono">
                {formatINR(summary.totalDiscounts)}
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                Coupons & promotional off
              </span>
            </div>

            {/* 7. Parcel Charges */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Parcel Charges</span>
                <Package className="w-4 h-4 text-teal-600" />
              </div>
              <div className="font-outfit font-black text-2xl sm:text-3xl text-stone-900 font-mono">
                {formatINR(summary.parcelCharges)}
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                Packaging fees collected
              </span>
            </div>

            {/* 8. Refunds */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Refunds</span>
                <RotateCcw className="w-4 h-4 text-rose-500" />
              </div>
              <div className="font-outfit font-black text-2xl sm:text-3xl text-rose-600 font-mono">
                {formatINR(summary.refunds)}
              </div>
              <span className="text-[10px] text-stone-400 font-medium">
                {summary.refundedOrdersCount || 0} order(s) cancelled/refunded
              </span>
            </div>

          </div>
        </div>

        {/* ================= REVENUE ANALYTICS: CHARTS & BREAKDOWNS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Daily Revenue Trend Area Chart */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-outfit font-black text-base text-stone-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Daily Revenue Trend ({currentOption.label})
                </h3>
                <p className="text-[11px] text-stone-500">
                  Daily net sales aggregation in Asia/Kolkata (IST)
                </p>
              </div>
              <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                Net: {formatINR(summary.netRevenue)}
              </span>
            </div>

            <div className="h-64 w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 text-xs gap-1">
                  <span className="text-2xl">📊</span>
                  <span>No completed sales data in this selected period.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueTrendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0b3d2e" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#1A7A45" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="displayDate"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: '#78716c', fontWeight: 600 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: '#78716c', fontWeight: 600 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#0b3d2e] text-white p-3 rounded-2xl shadow-xl text-xs border border-white/10">
                              <p className="text-[10px] text-amber font-bold uppercase tracking-wider mb-1">
                                {label}
                              </p>
                              <div className="space-y-0.5">
                                <p className="font-mono font-black text-sm text-white">
                                  Revenue: ₹{Number(data.revenue || 0).toFixed(2)}
                                </p>
                                <p className="text-stone-300 text-[11px]">
                                  Orders: <span className="font-bold text-white">{data.orders || 0}</span>
                                </p>
                                <div className="pt-1 mt-1 border-t border-white/10 text-[10px] text-stone-300 flex gap-2">
                                  <span>Cash: ₹{Number(data.cash || 0).toFixed(2)}</span>
                                  <span>Digital: ₹{Number(data.digital || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0b3d2e"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#revenueTrendGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Interactive Visual Ratio Cards */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-outfit font-black text-base text-stone-900 mb-1 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-amber-600" />
                Revenue Analytics & Splits
              </h3>
              <p className="text-[11px] text-stone-500 mb-4">
                Channel and payment mode proportions
              </p>

              <div className="space-y-4 text-xs">
                
                {/* 1. Cash vs Online Payment Split */}
                <div>
                  <div className="flex justify-between text-stone-600 mb-1">
                    <span className="font-bold">Cash vs Online Split:</span>
                    <span className="font-mono font-bold text-stone-900">
                      {summary.netRevenue > 0
                        ? Math.round((summary.cashRevenue / summary.netRevenue) * 100)
                        : 0}% Cash
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-600 h-full transition-all"
                      style={{
                        width: `${summary.netRevenue > 0 ? (summary.cashRevenue / summary.netRevenue) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="bg-indigo-600 h-full transition-all"
                      style={{
                        width: `${summary.netRevenue > 0 ? (summary.onlineRevenue / summary.netRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-400 mt-1 font-mono">
                    <span>Cash: {formatINR(summary.cashRevenue)}</span>
                    <span>Online: {formatINR(summary.onlineRevenue)}</span>
                  </div>
                </div>

                {/* 2. Walk-in POS vs Customer Online Order Split */}
                <div>
                  <div className="flex justify-between text-stone-600 mb-1">
                    <span className="font-bold">Walk-in vs Online Orders:</span>
                    <span className="font-mono font-bold text-stone-900">
                      {summary.totalOrders > 0
                        ? Math.round((summary.posWalkInOrders / summary.totalOrders) * 100)
                        : 0}% Walk-in
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-amber-500 h-full transition-all"
                      style={{
                        width: `${summary.totalOrders > 0 ? (summary.posWalkInOrders / summary.totalOrders) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="bg-sky-600 h-full transition-all"
                      style={{
                        width: `${summary.totalOrders > 0 ? (summary.customerOnlineOrders / summary.totalOrders) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                    <span>Walk-in: {summary.posWalkInOrders} orders</span>
                    <span>Online: {summary.customerOnlineOrders} orders</span>
                  </div>
                </div>

                {/* 3. Completed vs Refunded Orders */}
                <div>
                  <div className="flex justify-between text-stone-600 mb-1">
                    <span className="font-bold">Completed vs Refunded:</span>
                    <span className="font-mono font-bold text-stone-900">
                      {summary.totalOrders + (summary.refundedOrdersCount || 0) > 0
                        ? Math.round((summary.totalOrders / (summary.totalOrders + (summary.refundedOrdersCount || 0))) * 100)
                        : 100}% Completed
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-600 h-full transition-all"
                      style={{
                        width: `${summary.totalOrders + (summary.refundedOrdersCount || 0) > 0 ? (summary.totalOrders / (summary.totalOrders + (summary.refundedOrdersCount || 0))) * 100 : 100}%`,
                      }}
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{
                        width: `${summary.totalOrders + (summary.refundedOrdersCount || 0) > 0 ? ((summary.refundedOrdersCount || 0) / (summary.totalOrders + (summary.refundedOrdersCount || 0))) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                    <span>{summary.totalOrders} Completed</span>
                    <span className="text-rose-600 font-semibold">{summary.refundedOrdersCount || 0} Refunded ({formatINR(summary.refunds)})</span>
                  </div>
                </div>

                {/* 4. Average Order Value */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Average Order Value:</span>
                  <span className="font-outfit font-black text-stone-900 text-sm font-mono">
                    ₹{Number(summary.avgOrderValue || 0).toFixed(2)}
                  </span>
                </div>

              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleViewPDF()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold py-2 px-3 rounded-xl transition"
              >
                <Eye className="w-3.5 h-3.5 text-[#0b3d2e]" />
                <span>View PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#0b3d2e] hover:bg-[#1a7a45] text-white text-xs font-bold py-2 px-3 rounded-xl transition"
              >
                <FileDown className="w-3.5 h-3.5 text-amber" />
                <span>Download PDF</span>
              </button>
            </div>

          </div>

        </div>

        {/* ================= DAILY SUMMARY TABLE (For multi-day ranges) ================= */}
        {dailyTrends.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-2">
                <h3 className="font-outfit font-black text-sm sm:text-base text-stone-900">
                  Daily Revenue Statement ({dailyTrends.length} Days)
                </h3>
                <span className="text-xs bg-stone-100 text-stone-600 font-bold px-2 py-0.5 rounded-full">
                  IST Breakdown
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Date (IST)</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-right">Gross Sales</th>
                    <th className="py-3 px-4 text-right">Discounts</th>
                    <th className="py-3 px-4 text-right">Refunds</th>
                    <th className="py-3 px-4 text-right font-black text-[#0b3d2e]">Net Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {dailyTrends.map((d) => (
                    <tr key={d._id} className="hover:bg-stone-50/70 transition">
                      <td className="py-3 px-4 font-sans font-bold text-stone-900">
                        {formatISTShort(d._id)}
                        <span className="text-[10px] text-stone-400 font-mono ml-2">({d._id})</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">{d.orders}</td>
                      <td className="py-3 px-4 text-right">{formatINR((d.revenue || 0) + (d.discount || 0))}</td>
                      <td className="py-3 px-4 text-right text-amber-700">{formatINR(d.discount || 0)}</td>
                      <td className="py-3 px-4 text-right text-rose-600">₹0.00</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {formatINR(d.revenue || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-100/70 border-t-2 border-stone-300 font-black text-xs font-mono">
                    <td className="py-3 px-4 font-sans text-stone-900">Total Period Summary</td>
                    <td className="py-3 px-4 text-center">{summary.totalOrders}</td>
                    <td className="py-3 px-4 text-right">{formatINR(summary.grossSales)}</td>
                    <td className="py-3 px-4 text-right text-amber-700">{formatINR(summary.totalDiscounts)}</td>
                    <td className="py-3 px-4 text-right text-rose-600">{formatINR(summary.refunds)}</td>
                    <td className="py-3 px-4 text-right text-emerald-800 text-sm font-black">
                      {formatINR(summary.netRevenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ================= DETAILED TRANSACTION STATEMENT ================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
          
          <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-outfit font-black text-base text-stone-900 flex items-center gap-2">
                <span>Detailed Transaction Statement</span>
                <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  {pagination.total} Records
                </span>
              </h3>
              <p className="text-[11px] text-stone-500">
                Audited transaction list for {currentOption.label}
              </p>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Token, DRS-Code, Customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-16 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
              />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-stone-200 hover:bg-[#0b3d2e] hover:text-white text-stone-700 px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
              >
                Search
              </button>
            </form>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-2" />
              <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                Loading transactions...
              </span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center p-6">
              <Receipt className="w-10 h-10 text-stone-300 mx-auto mb-2 stroke-1" />
              <h4 className="font-outfit font-bold text-stone-800 text-sm mb-1">
                No Transactions Found
              </h4>
              <p className="text-stone-400 text-xs">
                No orders match the selected range ({currentOption.label}) or search query.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 text-center w-12">S.No</th>
                    <th className="py-3 px-4">Order ID & Token</th>
                    <th className="py-3 px-4">Date & Time (IST)</th>
                    <th className="py-3 px-4">Order Source</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {transactions.map((t, idx) => {
                    const isWalkIn = t.orderType === 'WALK_IN';
                    const token = t.pickupToken || t.orderCode?.replace('DRS-', '');
                    const customerName = isWalkIn
                      ? (t.walkInCustomer?.name || 'Walk-in')
                      : (t.user?.name || 'Student');
                    const serialNumber = (pagination.page - 1) * pagination.limit + idx + 1;

                    return (
                      <tr key={t._id} className="hover:bg-stone-50/70 transition">
                        
                        {/* S.No */}
                        <td className="py-3 px-4 text-center font-mono text-stone-400 font-semibold">
                          {serialNumber}
                        </td>

                        {/* Order ID & Token */}
                        <td className="py-3 px-4 font-mono">
                          <span className="font-outfit font-black text-sm text-[#0b3d2e] block">
                            #{token}
                          </span>
                          <span className="text-[10px] text-stone-500 font-semibold">
                            {t.orderCode}
                          </span>
                        </td>

                        {/* Date & Time (IST) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {formatISTFull(t.completedAt || t.createdAt, true)}
                        </td>

                        {/* Order Source */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isWalkIn
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {isWalkIn ? 'Walk-in POS' : 'Customer Online'}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-stone-900 truncate max-w-[130px]">
                            {customerName}
                          </div>
                        </td>

                        {/* Payment Method */}
                        <td className="py-3 px-4 whitespace-nowrap font-bold uppercase text-[11px] text-stone-700">
                          {t.paymentMethod}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-stone-900">
                          {formatINR(t.total)}
                        </td>

                        {/* Payment Status */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {t.paymentStatus || 'paid'}
                          </span>
                        </td>

                        {/* Action: Reprint */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openReprint(t)}
                            className="inline-flex items-center gap-1 bg-stone-100 hover:bg-[#0b3d2e] hover:text-white text-stone-700 font-bold text-[10px] px-2 py-1 rounded-lg transition"
                            title="Reprint receipt"
                          >
                            <Printer className="w-3 h-3" />
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

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-5 py-3 border-t border-stone-200 bg-stone-50/70 flex items-center justify-between">
              <span className="text-xs text-stone-500 font-medium">
                Showing {transactions.length} of {pagination.total} transactions
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

        {/* ================= PREVIOUSLY GENERATED REPORTS (REPORT HISTORY) ================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
          
          <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-amber/20 flex items-center justify-center text-[#0b3d2e]">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-outfit font-black text-sm sm:text-base text-stone-900">
                  Previously Generated Reports ({historyTotal})
                </h3>
                <p className="text-[11px] text-stone-500">
                  Secure cloud archive of official PDF financial statements
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchReportHistory}
              disabled={historyLoading}
              className="p-2 text-stone-500 hover:text-[#0b3d2e] rounded-xl hover:bg-stone-100 transition"
              title="Refresh history"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {historyLoading ? (
            <div className="py-12 text-center text-xs text-stone-400">
              Loading report history archive...
            </div>
          ) : reportHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400 p-4">
              No previous financial reports found in archive. Click <strong>Download PDF Report</strong> above to generate the first official statement!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Report ID</th>
                    <th className="py-3 px-4">Date Range</th>
                    <th className="py-3 px-4">Period Dates (IST)</th>
                    <th className="py-3 px-4 text-right">Net Revenue</th>
                    <th className="py-3 px-4">Generated At (IST)</th>
                    <th className="py-3 px-4">Generated By</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reportHistory.map((rep) => (
                    <tr key={rep._id} className="hover:bg-stone-50/70 transition">
                      
                      {/* Report ID */}
                      <td className="py-3 px-4 font-mono font-bold text-[#0b3d2e]">
                        {rep.reportId}
                      </td>

                      {/* Date Range */}
                      <td className="py-3 px-4 font-bold text-stone-900">
                        <span className="bg-stone-100 px-2 py-0.5 rounded text-[11px]">
                          {rep.filterLabel || rep.dateRange}
                        </span>
                      </td>

                      {/* Period Dates */}
                      <td className="py-3 px-4 text-stone-600 text-[11px] whitespace-nowrap">
                        {formatISTShort(rep.startDate)} — {formatISTShort(rep.endDate)}
                      </td>

                      {/* Net Revenue */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatINR(rep.summary?.netRevenue || 0)}
                      </td>

                      {/* Generated At */}
                      <td className="py-3 px-4 text-stone-500 text-[11px] whitespace-nowrap">
                        {formatISTFull(rep.generatedAt, true)}
                      </td>

                      {/* Generated By */}
                      <td className="py-3 px-4 text-stone-700 font-medium">
                        {rep.generatedByName || 'Admin'}
                      </td>

                      {/* Actions: View & Download */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewPDF(rep._id, rep.reportName)}
                            className="inline-flex items-center gap-1 bg-stone-100 hover:bg-[#0b3d2e] hover:text-white text-stone-700 font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
                            title="View PDF"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadHistoryReport(rep)}
                            className="inline-flex items-center gap-1 bg-amber/20 hover:bg-amber text-stone-900 font-bold text-[10px] px-2.5 py-1 rounded-lg transition"
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </div>

      {/* ================= RETENTION SETTINGS & CLEANUP MODAL ================= */}
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
              <div className="grid grid-cols-4 gap-2">
                {[3, 6, 12, 24].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleUpdatePolicy(m)}
                    className={`py-2 rounded-xl text-xs font-bold transition ${
                      retentionSettings.billRetentionMonths === m
                        ? 'bg-[#0b3d2e] text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {m} Months
                  </button>
                ))}
              </div>
            </div>

            {/* Cleanup Preview Button */}
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePreviewRetention}
                disabled={cleanupLoading}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition"
              >
                Preview Cleanup Records
              </button>

              {cleanupPreview && (
                <button
                  type="button"
                  onClick={handleExecuteCleanup}
                  disabled={cleanupLoading || cleanupPreview.eligibleCount === 0}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                >
                  Confirm Cleanup ({cleanupPreview.eligibleCount})
                </button>
              )}
            </div>

            {cleanupSuccessMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold">
                {cleanupSuccessMessage}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default RevenueReports;

