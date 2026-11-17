import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { useSocket } from '../context/SocketContext';
import ThermalReceiptModal from '../components/common/ThermalReceiptModal';
import {
  CheckCircle2,
  AlertCircle,
  Search,
  Clock,
  User,
  Phone,
  GraduationCap,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Check,
  Volume2,
  VolumeX,
  CreditCard,
  Banknote,
  Receipt,
  Printer,
  X,
  Briefcase,
  AlertTriangle,
  History,
  CheckCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

const FoodHandover = () => {
  // Active Tab: 'pending' | 'completed' | 'all'
  const [activeTab, setActiveTab] = useState('pending');

  // Order lists & statistics
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ pending: 0, completed: 0, total: 0 });

  // Verification Search Bar (Non-mutating lookup)
  const [lookupInput, setLookupInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState(null); // { order, eligibility, message, type }

  // All Orders Tab Filters & Pagination
  const [allSearchTerm, setAllSearchTerm] = useState('');
  const [allDateRange, setAllDateRange] = useState('today'); // 'today' | 'yesterday' | '7days' | '30days' | 'all'
  const [allStatusFilter, setAllStatusFilter] = useState('all'); // 'all' | 'pending' | 'completed' | 'cancelled' | 'preparing'
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Action & Modal States
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [actionAlert, setActionAlert] = useState(null); // { type: 'success' | 'duplicate' | 'error', message }
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, order: null });
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ isOpen: false, order: null, autoPrint: false });

  // Audio Context Ref
  const audioCtxRef = useRef(null);
  const { socket, isConnected } = useSocket();

  // Play audio chime (success vs alert)
  const playSound = useCallback((isSuccess) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        // High bright dual chime
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        // Low double alert buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch {
      // Audio autoplay restrictions or unsupported
    }
  }, [soundEnabled]);

  // Fetch orders from API
  const fetchOrders = useCallback(async (showSpinner = true, customPage = pagination.page) => {
    try {
      if (showSpinner) setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.append('filter', activeTab);
      params.append('page', String(customPage));
      params.append('limit', activeTab === 'all' ? '25' : '50');

      if (activeTab === 'all') {
        if (allSearchTerm.trim()) params.append('search', allSearchTerm.trim());
        if (allDateRange) params.append('dateRange', allDateRange);
        if (allStatusFilter) params.append('status', allStatusFilter);
      }

      const res = await API.get(`/admin/pos/handover-orders?${params.toString()}`);
      if (res.data?.success) {
        setOrders(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch handover orders:', err);
      setError(err.response?.data?.message || 'Failed to fetch handover orders. Please try refreshing.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeTab, allSearchTerm, allDateRange, allStatusFilter, pagination.page]);

  // Initial load and tab change
  useEffect(() => {
    fetchOrders(true, 1);
  }, [activeTab, allDateRange, allStatusFilter]);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleOrderUpdate = () => {
      // Refresh list smoothly without full spinner to preserve counter operator focus
      fetchOrders(false);
    };

    socket.on('order:created', handleOrderUpdate);
    socket.on('order:updated', handleOrderUpdate);
    socket.on('order:statusChanged', handleOrderUpdate);
    socket.on('pickup:readyTokensChanged', handleOrderUpdate);
    socket.on('pos:orderHandedOver', handleOrderUpdate);

    return () => {
      socket.off('order:created', handleOrderUpdate);
      socket.off('order:updated', handleOrderUpdate);
      socket.off('order:statusChanged', handleOrderUpdate);
      socket.off('pickup:readyTokensChanged', handleOrderUpdate);
      socket.off('pos:orderHandedOver', handleOrderUpdate);
    };
  }, [socket, fetchOrders]);

  // 1. NON-MUTATING VERIFICATION LOOKUP
  const handleVerifyLookup = async (e) => {
    e?.preventDefault();
    const query = lookupInput.trim();
    if (!query) return;

    try {
      setLookingUp(true);
      setActionAlert(null);

      const res = await API.get('/admin/pos/verify-lookup', {
        params: { token: query },
      });

      if (res.data?.success) {
        const { data: orderData, eligibility, message } = res.data;
        setLookupResult({
          order: orderData,
          eligibility,
          message,
        });

        if (eligibility === 'eligible') {
          playSound(true);
        } else {
          playSound(false);
        }
      }
    } catch (err) {
      playSound(false);
      setLookupResult({
        order: err.response?.data?.order || null,
        eligibility: 'error',
        message: err.response?.data?.message || `No order found matching "${query}". Please check the token.`,
      });
    } finally {
      setLookingUp(false);
    }
  };

  // 2. OPEN CONFIRMATION MODAL FOR HANDOVER
  const handleStartHandover = (order) => {
    if (!order) return;
    setConfirmModal({
      isOpen: true,
      order,
    });
  };

  // 3. CONFIRM HANDOVER (STATUS -> 'Handover Bill')
  const handleConfirmHandover = async () => {
    const targetOrder = confirmModal.order;
    if (!targetOrder || isSubmittingHandover) return;

    try {
      setIsSubmittingHandover(true);
      const res = await API.post('/admin/pos/verify-pickup', {
        token: targetOrder.pickupToken || targetOrder.orderCode,
        orderId: targetOrder._id,
      });

      if (res.data?.success) {
        playSound(true);
        const updatedOrder = res.data.data || targetOrder;

        setActionAlert({
          type: 'success',
          message: `Food physically handed over! Order #${updatedOrder.orderCode} (Token #${updatedOrder.pickupToken || updatedOrder.orderCode}) updated to Handover Bill.`,
        });

        // Close confirmation modal
        setConfirmModal({ isOpen: false, order: null });

        // If the verified lookup card was showing this order, update its status
        if (lookupResult?.order?._id === targetOrder._id) {
          setLookupResult({
            order: updatedOrder,
            eligibility: 'already_handed_over',
            message: `Order #${updatedOrder.orderCode} (Token #${updatedOrder.pickupToken || updatedOrder.orderCode}) has been handed over successfully.`,
          });
        }

        // Refresh orders list
        fetchOrders(false);
      }
    } catch (err) {
      playSound(false);
      const isDuplicate = err.response?.status === 409 || err.response?.data?.alreadyCollected;
      setActionAlert({
        type: isDuplicate ? 'duplicate' : 'error',
        message: err.response?.data?.message || 'Handover confirmation failed.',
      });
      setConfirmModal({ isOpen: false, order: null });
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  // Format Helper: IST Date & Time
  const formatDateTime = (dateVal) => {
    if (!dateVal) return { date: '—', time: '—' };
    const d = new Date(dateVal);
    const date = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return { date, time };
  };

  return (
    <div className="min-h-screen bg-stone-100/70 pb-20 font-inter text-stone-900">
      
      {/* ================= TOP BRAND HEADER ================= */}
      <header className="bg-[#0b3d2e] text-white px-4 py-3.5 shadow-md border-b border-white/10 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-stone-950 font-black text-xl shadow-xs">
              🍛
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-outfit font-black text-base sm:text-lg tracking-tight">
                  Handover & Bill Verification Counter
                </h1>
                <span
                  className={`border text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1.5 transition-colors ${
                    isConnected
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                      : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {isConnected ? 'Real-Time Sync' : 'Connecting...'}
                </span>
              </div>
              <p className="text-[11px] text-white/75 font-medium">
                Verify customer pickup bills and record completed physical food handovers.
              </p>
            </div>
          </div>

          {/* Quick Counter Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition border border-white/10 text-xs min-w-[40px] min-h-[40px] flex items-center justify-center"
              title={soundEnabled ? 'Mute alert chime' : 'Enable alert chime'}
              aria-label="Toggle Sound"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-white/40" />}
            </button>

            <button
              type="button"
              onClick={() => fetchOrders(true)}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition border border-white/10 min-h-[40px]"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              to="/admin/pos"
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-black text-xs px-3.5 py-2.5 rounded-xl transition shadow-xs min-h-[40px]"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>POS Billing</span>
            </Link>

            <Link
              to="/admin/bills"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition border border-white/10 min-h-[40px]"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bill Archive</span>
            </Link>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ================= SECTION 1: PHYSICAL BILL VERIFICATION WORKFLOW ================= */}
        <section aria-labelledby="verification-heading" className="bg-white rounded-3xl shadow-xs border border-stone-200 p-5 sm:p-7">
          <form onSubmit={handleVerifyLookup} className="max-w-3xl mx-auto">
            <div className="text-center mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0b3d2e] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Physical Bill & Token Verification
              </span>
              <h2 id="verification-heading" className="font-outfit font-black text-xl sm:text-2xl text-stone-900 mt-1.5">
                Verify Customer Pickup Bill
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Enter or scan customer token # (e.g. <strong>K7P2</strong>) or order ID to verify eligibility before handing over food.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-4">
              <div className="relative flex-1 w-full">
                <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Enter 4-character token (e.g. K7P2) or order ID..."
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  className="w-full pl-12 pr-10 py-3.5 bg-stone-50 border-2 border-stone-200 rounded-2xl text-sm sm:text-base font-bold font-mono tracking-wider focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
                  autoFocus
                />
                {lookupInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setLookupInput('');
                      setLookupResult(null);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!lookupInput.trim() || lookingUp}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#0b3d2e] hover:bg-[#135943] active:scale-95 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 min-h-[48px]"
              >
                {lookingUp ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                    <span>Verify Bill / Token</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ================= VERIFIED ORDER DETAILS CARD ================= */}
          {lookupResult && (
            <div className="mt-6 max-w-3xl mx-auto border-2 rounded-2xl p-5 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 bg-stone-50/50 border-stone-200">
              
              {/* Lookup Card Top Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">
                    VERIFIED PICKUP TOKEN
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-outfit font-black text-3xl sm:text-4xl text-[#0b3d2e] tracking-tight">
                      #{lookupResult.order?.orderCode || lookupResult.order?.pickupToken || lookupInput.toUpperCase()}
                    </span>
                  </div>
                  {lookupResult.order && (
                    <div className="text-[11px] font-mono text-stone-500 font-bold mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Order #{lookupResult.order.orderCode}</span>
                      <span>•</span>
                      <span>{formatDateTime(lookupResult.order.createdAt).date}, {formatDateTime(lookupResult.order.createdAt).time}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {lookupResult.order?.orderType === 'WALK_IN' ? (
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      ★ WALK-IN POS
                    </span>
                  ) : lookupResult.order ? (
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                      ★ ONLINE APP
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setLookupResult(null)}
                    className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-200/50 transition"
                    title="Dismiss"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Status & Eligibility Banner */}
              <div className="my-4">
                {/* 1. DUPLICATE HANDOVER WARNING */}
                {lookupResult.eligibility === 'already_handed_over' && (
                  <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 text-red-900">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-7 h-7 text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                          WARNING: DUPLICATE HANDOVER
                        </span>
                        <h3 className="font-outfit font-black text-base sm:text-lg text-red-900 mt-1">
                          Food Already Collected!
                        </h3>
                        <p className="text-xs sm:text-sm text-red-800 font-semibold mt-0.5">
                          {lookupResult.message}
                        </p>
                        <p className="text-xs text-red-700 mt-1 font-bold">
                          ⛔ DO NOT HAND OVER FOOD AGAIN. This token has already been marked as collected.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. CANCELLED ORDER */}
                {lookupResult.eligibility === 'cancelled' && (
                  <div className="bg-stone-100 border-2 border-stone-400 rounded-xl p-4 text-stone-900">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-stone-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="bg-stone-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                          ORDER CANCELLED
                        </span>
                        <h3 className="font-outfit font-black text-base text-stone-900 mt-1">
                          Order Cannot Be Handed Over
                        </h3>
                        <p className="text-xs text-stone-700 mt-0.5">{lookupResult.message}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. NOT READY YET */}
                {lookupResult.eligibility === 'not_ready' && (
                  <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 text-amber-950">
                    <div className="flex items-start gap-3">
                      <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="bg-amber-500 text-stone-950 font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                          KITCHEN IN PROGRESS
                        </span>
                        <h3 className="font-outfit font-black text-base text-amber-950 mt-1">
                          Food Is Still Being Prepared
                        </h3>
                        <p className="text-xs text-amber-900 mt-0.5">{lookupResult.message}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. READY & ELIGIBLE */}
                {lookupResult.eligibility === 'eligible' && (
                  <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 text-emerald-950">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                          ✓ VERIFIED & READY FOR PICKUP
                        </span>
                        <h3 className="font-outfit font-black text-base text-emerald-950 mt-1">
                          Food Is Prepared & Awaiting Collection
                        </h3>
                        <p className="text-xs text-emerald-800 mt-0.5">{lookupResult.message}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. ERROR / NOT FOUND */}
                {lookupResult.eligibility === 'error' && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-amber-900 flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-black text-sm">Order Not Found</h4>
                      <p className="text-xs text-amber-800 mt-0.5">{lookupResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Data Breakdown (if order object exists) */}
              {lookupResult.order && (
                <div className="space-y-3.5">
                  
                  {/* Customer Identification Box */}
                  <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 font-black text-stone-900">
                        <User className="w-4 h-4 text-stone-400" />
                        <span className="text-sm">
                          {lookupResult.order.orderType === 'WALK_IN'
                            ? lookupResult.order.walkInCustomer?.name || 'Walk-in Customer'
                            : lookupResult.order.user?.name || 'Student / Faculty'}
                        </span>
                      </div>

                      {/* Customer Role Badge */}
                      {lookupResult.order.orderType === 'WALK_IN' ? (
                        <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                          Walk-in
                        </span>
                      ) : lookupResult.order.user?.studentDetails?.registerNumber ? (
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" /> Student ({lookupResult.order.user?.studentDetails?.registerNumber})
                        </span>
                      ) : lookupResult.order.user?.staffDetails?.staffId ? (
                        <span className="text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> Staff ({lookupResult.order.user?.staffDetails?.staffId})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
                          Customer
                        </span>
                      )}
                    </div>

                    {(lookupResult.order.walkInCustomer?.phone || lookupResult.order.user?.phone) && (
                      <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{lookupResult.order.walkInCustomer?.phone || lookupResult.order.user?.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* COD Cash Collection Warning if unpaid */}
                  {lookupResult.order.paymentMethod === 'cod' && lookupResult.order.paymentStatus !== 'paid' && (
                    <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 text-red-900 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black text-sm">COLLECT CASH PAYMENT</strong>
                        <span>Please collect <strong>₹{Number(lookupResult.order.total || 0).toFixed(2)}</strong> in cash before handing over food trays!</span>
                      </div>
                    </div>
                  )}

                  {/* Food Items Breakdown */}
                  <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
                      <span>Items to Handover ({lookupResult.order.items?.length || 0})</span>
                      <span>Quantity</span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {lookupResult.order.items?.map((item, idx) => {
                        const isParcel = item.serviceType === 'PARCEL' || Number(item.parcelChargeTotal || 0) > 0;
                        return (
                          <div key={idx} className="flex justify-between items-center text-stone-800 gap-2 py-0.5">
                            <div className="truncate font-semibold flex items-center gap-1.5 min-w-0">
                              <span className="truncate">
                                {item.name}
                                {item.variantLabel ? ` (${item.variantLabel})` : ''}
                              </span>
                              {isParcel && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                  Parcel{Number(item.parcelChargeTotal || 0) > 0 ? ` +₹${Number(item.parcelChargeTotal)}` : ''}
                                </span>
                              )}
                              <span className="text-[10px] text-stone-400 shrink-0">@ ₹{item.price}</span>
                            </div>
                            <span className="font-black font-mono text-stone-900 bg-stone-100 px-2.5 py-0.5 rounded border border-stone-200 text-xs shrink-0">
                              ×{item.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Total & Payment Summary */}
                  <div className="bg-stone-100 p-3 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">
                        Payment: {String(lookupResult.order.paymentMethod || 'cash').toUpperCase()}
                      </span>
                      {lookupResult.order.paymentMethod === 'cod' && lookupResult.order.paymentStatus !== 'paid' ? (
                        <span className="text-[11px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded inline-block mt-0.5">
                          PENDING CASH COLLECTION
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                          <Check className="w-3.5 h-3.5" /> PAID
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">
                        Grand Total
                      </span>
                      <span className="font-outfit font-black text-xl text-stone-900 block leading-tight">
                        ₹{Number(lookupResult.order.total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Actions for Verified Order */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setReceiptModal({ isOpen: true, order: lookupResult.order, autoPrint: false })}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs py-3 px-3 rounded-xl transition border border-stone-300 min-h-[44px]"
                    >
                      <Printer className="w-4 h-4 text-stone-600" />
                      <span>Reprint Thermal Bill</span>
                    </button>

                    {lookupResult.eligibility === 'eligible' && (
                      <button
                        type="button"
                        onClick={() => handleStartHandover(lookupResult.order)}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#0b3d2e] hover:bg-[#135943] active:scale-95 text-white font-black text-xs py-3 px-3 rounded-xl shadow transition min-h-[44px]"
                      >
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Handover Food</span>
                      </button>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}

          {/* Action Alert Banner (from Handover Confirmation) */}
          {actionAlert && (
            <div className="mt-5 max-w-3xl mx-auto animate-in fade-in slide-in-from-top-2">
              {actionAlert.type === 'success' && (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 text-emerald-950 flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-black text-sm">Food Handover Successful</h4>
                    <p className="text-xs text-emerald-800 mt-0.5">{actionAlert.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionAlert(null)}
                    className="text-emerald-500 hover:text-emerald-800 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {actionAlert.type === 'duplicate' && (
                <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 text-red-950 flex items-start gap-3">
                  <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-black text-sm">Duplicate Handover Blocked</h4>
                    <p className="text-xs text-red-800 mt-0.5">{actionAlert.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionAlert(null)}
                    className="text-red-500 hover:text-red-800 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {actionAlert.type === 'error' && (
                <div className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-4 text-amber-950 flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-black text-sm">Notice</h4>
                    <p className="text-xs text-amber-800 mt-0.5">{actionAlert.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionAlert(null)}
                    className="text-amber-500 hover:text-amber-800 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

        </section>

        {/* ================= SECTION 2: TABS NAVIGATION ================= */}
        <section aria-labelledby="tabs-heading" className="space-y-4">
          <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all min-h-[44px] ${
                  activeTab === 'pending'
                    ? 'bg-[#0b3d2e] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <span>Pending Handovers</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'pending' ? 'bg-amber-400 text-stone-950' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {stats.pending}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('completed')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all min-h-[44px] ${
                  activeTab === 'completed'
                    ? 'bg-[#0b3d2e] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <span>Completed Handovers</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'completed' ? 'bg-amber-400 text-stone-950' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {stats.completed}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all min-h-[44px] ${
                  activeTab === 'all'
                    ? 'bg-[#0b3d2e] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <span>All Orders</span>
              </button>
            </div>

            {/* Quick Status Notice */}
            <div className="text-xs text-stone-500 font-medium hidden md:block">
              {activeTab === 'pending' && 'Showing ready orders waiting for pickup (oldest ready first)'}
              {activeTab === 'completed' && 'Showing completed handovers (newest completed first)'}
              {activeTab === 'all' && `Comprehensive history (${pagination.total} orders found)`}
            </div>

          </div>

          {/* ================= ALL ORDERS TAB: EXTENDED FILTERS BAR ================= */}
          {activeTab === 'all' && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                
                {/* Search Term Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search token, name, phone, ID..."
                    value={allSearchTerm}
                    onChange={(e) => setAllSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        fetchOrders(true, 1);
                      }
                    }}
                    className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
                  />
                  {allSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setAllSearchTerm('');
                        fetchOrders(true, 1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Date Filter Dropdown */}
                <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1">
                  <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                  <select
                    value={allDateRange}
                    onChange={(e) => setAllDateRange(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-stone-700 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value="today">Today (IST)</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="all">All Dates</option>
                  </select>
                </div>

                {/* Status Filter Dropdown */}
                <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1">
                  <Filter className="w-4 h-4 text-stone-400 shrink-0" />
                  <select
                    value={allStatusFilter}
                    onChange={(e) => setAllStatusFilter(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-stone-700 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Pickup</option>
                    <option value="completed">Completed Handover</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="preparing">Preparing / Placed</option>
                  </select>
                </div>

                {/* Apply / Refresh Filter Button */}
                <button
                  type="button"
                  onClick={() => fetchOrders(true, 1)}
                  className="bg-[#0b3d2e] hover:bg-[#135943] active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5 text-amber-400" />
                  <span>Filter Orders</span>
                </button>

              </div>
            </div>
          )}

          {/* ================= ORDER CARDS GRID ================= */}
          {loading ? (
            <div className="py-24 text-center bg-white rounded-3xl border border-stone-200 shadow-xs">
              <div className="w-10 h-10 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-3" />
              <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                Loading orders...
              </span>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-stone-200 p-8 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-2xl font-black">
                ✓
              </div>
              <h3 className="font-outfit font-black text-stone-900 text-lg mb-1">
                {activeTab === 'pending'
                  ? 'All Clear! No Pending Handovers'
                  : activeTab === 'completed'
                  ? 'No Completed Handovers Found'
                  : 'No Orders Matching Filters'}
              </h3>
              <p className="text-stone-500 text-xs max-w-md mx-auto">
                {activeTab === 'pending'
                  ? 'When the kitchen marks food as "Pickup Bill" or "Ready", it will automatically appear here for physical counter collection and thermal bill printing.'
                  : 'Try selecting a different filter tab or clearing your search criteria.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {orders.map((order) => {
                const isWalkIn = order.orderType === 'WALK_IN';
                const token = order.orderCode || order.pickupToken;
                
                // Customer details
                const customerName = isWalkIn
                  ? (order.walkInCustomer?.name || 'Walk-in Customer')
                  : (order.user?.name || 'Student / Staff');
                const customerPhone = isWalkIn
                  ? order.walkInCustomer?.phone
                  : order.user?.phone;
                const customerReg = isWalkIn
                  ? order.walkInCustomer?.registerNumber
                  : order.user?.studentDetails?.registerNumber;
                const customerStaffId = isWalkIn
                  ? order.walkInCustomer?.staffId
                  : order.user?.staffDetails?.staffId;
                const customerDept = isWalkIn
                  ? ''
                  : (order.user?.studentDetails?.department || order.user?.staffDetails?.department || '');

                const isHandoverCompleted = order.status === 'Handover Bill' || order.status === 'Completed' || order.handoverVerified;
                const isCodUnpaid = order.paymentMethod === 'cod' && order.paymentStatus !== 'paid';
                const isCancelled = order.status === 'Cancelled';
                const isEligibleForHandover = (order.status === 'Pickup Bill' || order.status === 'Ready') && !order.handoverVerified;

                const { date: formattedDate, time: formattedTime } = formatDateTime(order.createdAt);
                const handoverTimeInfo = order.completedAt || order.handoverVerifiedAt
                  ? formatDateTime(order.completedAt || order.handoverVerifiedAt)
                  : null;

                return (
                  <div
                    key={order._id}
                    className={`bg-white rounded-2xl border-2 transition-all p-4 flex flex-col justify-between gap-3.5 relative overflow-hidden ${
                      isHandoverCompleted
                        ? 'border-emerald-200 bg-emerald-50/15'
                        : isCancelled
                        ? 'border-stone-300 bg-stone-50 opacity-75'
                        : 'border-stone-200 hover:border-[#0b3d2e] shadow-xs hover:shadow-md'
                    }`}
                  >
                    {/* Top Callout: Big Token & Badges */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-stone-100">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">
                          PICKUP TOKEN
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="font-outfit font-black text-3xl sm:text-4xl text-[#0b3d2e] tracking-tight">
                            #{token}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-stone-500 font-bold mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>Order #{order.orderCode}</span>
                          <span>•</span>
                          <span className="text-stone-400 font-sans font-medium text-[10px]">
                            {formattedDate}, {formattedTime}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        {/* Channel Badge */}
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            isWalkIn
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {isWalkIn ? '★ WALK-IN POS' : '★ ONLINE APP'}
                        </span>

                        {/* Status Badge */}
                        {isHandoverCompleted ? (
                          <span className="text-[10px] font-black uppercase bg-emerald-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                            <CheckCheck className="w-3 h-3" /> HANDOVER BILL
                          </span>
                        ) : isCancelled ? (
                          <span className="text-[10px] font-black uppercase bg-stone-500 text-white px-2 py-0.5 rounded-md">
                            CANCELLED
                          </span>
                        ) : order.status === 'Pickup Bill' ? (
                          <span className="text-[10px] font-black uppercase bg-amber-500 text-stone-950 px-2 py-0.5 rounded-md shadow-2xs">
                            PICKUP BILL
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                            READY FOR PICKUP
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer Identification Badge */}
                    <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 font-black text-stone-900">
                          <User className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                          <span className="truncate max-w-[160px]">{customerName}</span>
                        </div>
                        
                        {/* Role Badge */}
                        {isWalkIn ? (
                          <span className="text-[10px] font-bold text-stone-600 bg-stone-200 px-1.5 py-0.5 rounded">
                            Walk-in
                          </span>
                        ) : customerReg ? (
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" /> Student
                          </span>
                        ) : customerStaffId ? (
                          <span className="text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> Staff
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-stone-600 bg-stone-200 px-1.5 py-0.5 rounded">
                            Customer
                          </span>
                        )}
                      </div>

                      {customerReg && (
                        <div className="text-[11px] text-stone-600 flex items-center justify-between">
                          <span className="font-medium">Reg Number:</span>
                          <span className="font-mono font-bold text-stone-900 bg-white px-1.5 py-0.2 rounded border border-stone-200">
                            {customerReg}
                          </span>
                        </div>
                      )}

                      {customerStaffId && (
                        <div className="text-[11px] text-stone-600 flex items-center justify-between">
                          <span className="font-medium">Staff ID:</span>
                          <span className="font-mono font-bold text-stone-900 bg-white px-1.5 py-0.2 rounded border border-stone-200">
                            {customerStaffId}
                          </span>
                        </div>
                      )}

                      {customerDept && (
                        <div className="text-[10px] text-stone-500">
                          Dept: <strong className="text-stone-700">{customerDept}</strong>
                        </div>
                      )}

                      {customerPhone && (
                        <div className="flex items-center gap-1 text-[11px] text-stone-500 pt-0.5">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{customerPhone}</span>
                        </div>
                      )}
                    </div>

                    {/* Food Items & Quantities */}
                    <div className="bg-stone-50/70 p-2.5 rounded-xl border border-stone-200/80 text-xs">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                        <span>Items ({order.items?.length || 0})</span>
                        <span>Qty</span>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {order.items?.map((item, idx) => {
                          const isParcel = item.serviceType === 'PARCEL' || Number(item.parcelChargeTotal || 0) > 0;
                          return (
                            <div key={idx} className="flex justify-between items-center text-stone-800 gap-2">
                              <div className="truncate font-semibold flex items-center gap-1.5 min-w-0">
                                <span className="truncate">
                                  {item.name}
                                  {item.variantLabel ? ` (${item.variantLabel})` : ''}
                                </span>
                                {isParcel && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                    Parcel{Number(item.parcelChargeTotal || 0) > 0 ? ` +₹${Number(item.parcelChargeTotal)}` : ''}
                                  </span>
                                )}
                                <span className="text-[10px] text-stone-400 shrink-0">@ ₹{item.price}</span>
                              </div>
                              <span className="font-black font-mono text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200 text-xs shrink-0">
                                ×{item.quantity}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Handover Completed Metadata Box (for Completed Tab) */}
                    {isHandoverCompleted && handoverTimeInfo && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-950 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-emerald-800">Handed Over:</span>
                          <span className="font-bold font-mono">{handoverTimeInfo.date}, {handoverTimeInfo.time}</span>
                        </div>
                        {order.handoverVerifiedBy?.name && (
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-emerald-800">Confirmed By:</span>
                            <span className="font-bold">{order.handoverVerifiedBy.name}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Total & Payment Method */}
                    <div className="bg-stone-100 p-2.5 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-500 block">
                          Payment: {String(order.paymentMethod || 'cash').toUpperCase()}
                        </span>
                        {isCodUnpaid ? (
                          <span className="text-[11px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded inline-block mt-0.5">
                            COLLECT CASH
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                            <Check className="w-3.5 h-3.5" /> PAID
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-stone-500 block">
                          Grand Total
                        </span>
                        <span className="font-outfit font-black text-lg text-stone-900 block leading-tight">
                          ₹{Number(order.total || 0).toFixed(2)}
                        </span>
                        {Number(order.parcelChargeTotal || 0) > 0 && (
                          <span className="text-[10px] font-bold text-amber-700">
                            incl. ₹{Number(order.parcelChargeTotal).toFixed(2)} parcel
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-1">
                      {isHandoverCompleted ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReceiptModal({ isOpen: true, order, autoPrint: false })}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs py-2.5 px-3 rounded-xl transition border border-stone-300 min-h-[44px]"
                          >
                            <Printer className="w-3.5 h-3.5 text-stone-600" />
                            <span>Reprint Thermal Bill</span>
                          </button>
                        </div>
                      ) : isEligibleForHandover ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReceiptModal({ isOpen: true, order, autoPrint: false })}
                            className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition border border-stone-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Reprint / Preview Bill"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartHandover(order)}
                            className="flex-1 flex items-center justify-center gap-2 bg-[#0b3d2e] hover:bg-[#135943] active:scale-95 text-white font-black text-xs py-2.5 px-3 rounded-xl shadow-xs transition min-h-[44px]"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Handover Food</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReceiptModal({ isOpen: true, order, autoPrint: false })}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs py-2.5 px-3 rounded-xl transition border border-stone-300 min-h-[44px]"
                          >
                            <Printer className="w-3.5 h-3.5 text-stone-600" />
                            <span>Print / View Bill</span>
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* ================= PAGINATION CONTROLS (ALL ORDERS TAB) ================= */}
          {activeTab === 'all' && pagination.totalPages > 1 && (
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <span className="text-xs text-stone-500 font-medium">
                Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} orders total)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchOrders(true, pagination.page - 1)}
                  className="flex items-center gap-1 px-3 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 rounded-xl text-xs font-bold transition min-h-[40px]"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="text-xs font-black font-mono px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl">
                  {pagination.page} / {pagination.totalPages}
                </div>

                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => fetchOrders(true, pagination.page + 1)}
                  className="flex items-center gap-1 px-3 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-700 rounded-xl text-xs font-bold transition min-h-[40px]"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </section>

      </main>

      {/* ================= HANDOVER CONFIRMATION MODAL ================= */}
      {confirmModal.isOpen && confirmModal.order && (
        <div className="fixed inset-0 z-50 bg-stone-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-md w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-stone-950 font-black text-xl shadow-xs">
                  🍛
                </div>
                <div>
                  <h3 className="font-outfit font-black text-lg text-stone-900 leading-tight">
                    Confirm Physical Handover
                  </h3>
                  <p className="text-xs text-stone-500 font-medium">
                    Order #{confirmModal.order.orderCode}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, order: null })}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Token Callout Box */}
            <div className="bg-[#0b3d2e] text-white p-4 rounded-2xl text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                CUSTOMER PICKUP TOKEN
              </span>
              <span className="font-outfit font-black text-4xl tracking-tight text-white">
                #{confirmModal.order.orderCode || confirmModal.order.pickupToken}
              </span>
              <div className="text-xs text-white/80 font-semibold">
                {confirmModal.order.orderType === 'WALK_IN'
                  ? confirmModal.order.walkInCustomer?.name || 'Walk-in Customer'
                  : confirmModal.order.user?.name || 'Student / Faculty'}
              </div>
            </div>

            {/* Unpaid COD Warning */}
            {confirmModal.order.paymentMethod === 'cod' && confirmModal.order.paymentStatus !== 'paid' && (
              <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 text-red-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-black">COLLECT CASH PAYMENT</strong>
                  <span>Please collect <strong>₹{Number(confirmModal.order.total || 0).toFixed(2)}</strong> in cash from the customer before handing over the food trays!</span>
                </div>
              </div>
            )}

            {/* Items checklist */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs space-y-1.5 max-h-40 overflow-y-auto">
              <span className="text-[10px] font-bold uppercase text-stone-400 block mb-1">
                Verify Handover Items ({confirmModal.order.items?.length || 0})
              </span>
              {confirmModal.order.items?.map((item, idx) => {
                const isParcel = item.serviceType === 'PARCEL' || Number(item.parcelChargeTotal || 0) > 0;
                return (
                  <div key={idx} className="flex justify-between items-center text-stone-800 gap-2">
                    <span className="truncate flex items-center gap-1.5">
                      <span className="truncate">{item.name}</span>
                      {isParcel && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                          Parcel
                        </span>
                      )}
                    </span>
                    <span className="font-black font-mono shrink-0">×{item.quantity}</span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-stone-500 text-center">
              Has the customer arrived at the counter and physically received all food items?
            </p>

            {/* Modal Actions */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isSubmittingHandover}
                onClick={handleConfirmHandover}
                className="w-full flex items-center justify-center gap-2 bg-[#0b3d2e] hover:bg-[#135943] active:scale-95 text-white font-black text-sm py-3 px-4 rounded-xl shadow-md transition disabled:opacity-50 min-h-[48px]"
              >
                {isSubmittingHandover ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                )}
                <span>✓ Confirm Food Handed Over</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReceiptModal({
                      isOpen: true,
                      order: confirmModal.order,
                      autoPrint: false,
                    });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs py-2.5 px-3 rounded-xl border border-stone-300 transition min-h-[40px]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Reprint Bill</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false, order: null })}
                  className="flex-1 text-stone-600 hover:text-stone-900 font-bold text-xs py-2.5 px-3 rounded-xl hover:bg-stone-100 transition text-center min-h-[40px]"
                >
                  Cancel
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= POS THERMAL RECEIPT MODAL ================= */}
      <ThermalReceiptModal
        isOpen={receiptModal.isOpen}
        order={receiptModal.order}
        autoPrint={receiptModal.autoPrint}
        onClose={() => setReceiptModal({ isOpen: false, order: null, autoPrint: false })}
      />

    </div>
  );
};

export default FoodHandover;
