import React, { useState, useEffect, useRef } from 'react';
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
  ShoppingBag,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Check,
  Volume2,
  VolumeX,
  CreditCard,
  Banknote,
  Utensils,
  Receipt,
  Printer,
  X,
  Briefcase,
  AlertTriangle,
  History,
  CheckCheck,
} from 'lucide-react';

const FoodHandover = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter tabs: 'pending' | 'completed' | 'all'
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ pending: 0, completed: 0 });

  // Quick Verification Form Input at the top
  const [quickVerifyInput, setQuickVerifyInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Result Banner / Alert State
  const [handoverResult, setHandoverResult] = useState(null); // { type: 'success' | 'duplicate' | 'error', message, order }
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modals
  const [receiptModal, setReceiptModal] = useState({ isOpen: false, order: null, autoPrint: false });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, order: null });

  // Audio Context Ref
  const audioCtxRef = useRef(null);
  const { socket, isConnected } = useSocket();

  // Load orders when activeTab or searchTerm changes (debounced search handled via submit/effect)
  useEffect(() => {
    fetchOrders(true);
  }, [activeTab]);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleOrderEvent = (order) => {
      if (!order) return;
      // Refresh list to keep counts and states perfectly synchronized
      fetchOrders(false);
    };

    socket.on('order:created', handleOrderEvent);
    socket.on('order:updated', handleOrderEvent);
    socket.on('order:statusChanged', handleOrderEvent);
    socket.on('pickup:readyTokensChanged', handleOrderEvent);

    return () => {
      socket.off('order:created', handleOrderEvent);
      socket.off('order:updated', handleOrderEvent);
      socket.off('order:statusChanged', handleOrderEvent);
      socket.off('pickup:readyTokensChanged', handleOrderEvent);
    };
  }, [socket, activeTab, searchTerm]);

  // Audio chimes
  const playSound = (isSuccess) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        // High pleasant dual chime
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        // Low double buzz alert
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      // Audio not supported or blocked
    }
  };

  const fetchOrders = async (showSpinner = true, customSearch = searchTerm) => {
    try {
      if (showSpinner) setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.append('filter', activeTab);
      if (customSearch && customSearch.trim()) {
        params.append('search', customSearch.trim());
      }

      const res = await API.get(`/admin/pos/handover-orders?${params.toString()}`);
      if (res.data?.success) {
        setOrders(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch handover orders:', err);
      setError(err.response?.data?.message || 'Failed to fetch handover orders.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders(true, searchTerm);
  };

  // Perform quick verification directly from top bar
  const handleQuickVerifySubmit = async (e) => {
    e.preventDefault();
    const query = quickVerifyInput.trim();
    if (!query) return;

    try {
      setVerifying(true);
      setHandoverResult(null);

      const res = await API.post('/admin/pos/verify-pickup', { token: query });

      if (res.data?.success) {
        playSound(true);
        const orderData = res.data.data;
        setHandoverResult({
          type: 'success',
          message: res.data.message || `Order verified & handed over successfully!`,
          order: orderData,
        });
        setQuickVerifyInput('');

        // Automatically open thermal receipt print for the verified order
        if (orderData) {
          setReceiptModal({
            isOpen: true,
            order: orderData,
            autoPrint: true,
          });
        }

        fetchOrders(false);
      }
    } catch (err) {
      playSound(false);
      const isDuplicate = err.response?.status === 409 || err.response?.data?.alreadyCollected;
      setHandoverResult({
        type: isDuplicate ? 'duplicate' : 'error',
        message:
          err.response?.data?.message ||
          'Order verification failed. Please check the token number.',
        order: err.response?.data?.order,
      });
    } finally {
      setVerifying(false);
    }
  };

  // Click Handover button on a card:
  // Step 1: Open Thermal Bill Print
  // Step 2: Show Physical Handover Confirmation Dialog
  const handleStartHandover = (order) => {
    // 1. Trigger receipt print
    setReceiptModal({
      isOpen: true,
      order,
      autoPrint: true,
    });

    // 2. Open confirmation prompt
    setConfirmModal({
      isOpen: true,
      order,
    });
  };

  // Click "Confirm Food Handed Over" inside Confirmation Dialog
  const handleConfirmHandover = async () => {
    const targetOrder = confirmModal.order;
    if (!targetOrder) return;

    try {
      setVerifying(true);
      const res = await API.post('/admin/pos/verify-pickup', {
        token: targetOrder.pickupToken || targetOrder.orderCode,
        orderId: targetOrder._id,
      });

      if (res.data?.success) {
        playSound(true);
        setHandoverResult({
          type: 'success',
          message: `Food physically handed over! Order #${targetOrder.orderCode} (Token #${targetOrder.pickupToken}) marked as Handover Bill.`,
          order: res.data.data || targetOrder,
        });
        setConfirmModal({ isOpen: false, order: null });
        fetchOrders(false);
      }
    } catch (err) {
      playSound(false);
      const isDuplicate = err.response?.status === 409 || err.response?.data?.alreadyCollected;
      setHandoverResult({
        type: isDuplicate ? 'duplicate' : 'error',
        message: err.response?.data?.message || 'Handover confirmation failed.',
        order: err.response?.data?.order || targetOrder,
      });
      setConfirmModal({ isOpen: false, order: null });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/70 pb-20 font-inter text-text">
      
      {/* ================= TOP NAVBAR HEADER ================= */}
      <div className="bg-[#0b3d2e] text-white px-4 py-3 shadow-md border-b border-white/10 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber flex items-center justify-center text-stone-950 font-black text-xl shadow-sm">
              🍛
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-outfit font-black text-base sm:text-lg tracking-tight">
                  Handover & Bill Printing Counter
                </h1>
                <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isConnected ? 'Real-Time Sync' : 'Connecting...'}
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                Print POS thermal bills • Physical food collection confirmation • Anti-duplicate validation
              </p>
            </div>
          </div>

          {/* Quick Counter Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition border border-white/10 text-xs"
              title={soundEnabled ? 'Mute alert chime' : 'Enable alert chime'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber" /> : <VolumeX className="w-4 h-4 text-white/40" />}
            </button>

            <button
              type="button"
              onClick={() => fetchOrders(true)}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-xl transition border border-white/10"
              title="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              to="/admin/pos"
              className="flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-stone-950 font-bold text-xs px-3 py-2 rounded-xl transition shadow-xs"
            >
              <span>POS Billing</span>
            </Link>

            <Link
              to="/admin/live-tracking"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-xl transition border border-white/10"
            >
              <span>Kitchen Queue</span>
            </Link>

            <Link
              to="/admin/bills"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-xl transition border border-white/10"
            >
              <span>Bill Archive</span>
            </Link>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ================= TOP VERIFICATION / SEARCH BAR ================= */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-5 sm:p-6">
          <form onSubmit={handleQuickVerifySubmit} className="max-w-3xl mx-auto">
            <div className="text-center mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Direct Counter Pickup & Bill Verification
              </span>
              <h2 className="font-outfit font-black text-xl sm:text-2xl text-stone-900 mt-1">
                Enter Pickup Token to Verify & Print Bill
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Token # (e.g. 1025) or Order ID (DRS-1025)..."
                  value={quickVerifyInput}
                  onChange={(e) => setQuickVerifyInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border-2 border-stone-200 rounded-2xl text-sm sm:text-base font-bold font-mono tracking-wider focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!quickVerifyInput.trim() || verifying}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#0b3d2e] hover:bg-[#1a7a45] disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
              >
                {verifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-amber" />
                    <span>Verify & Print Bill</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ================= RESULT ALERT BANNER ================= */}
          {handoverResult && (
            <div className="mt-5 max-w-3xl mx-auto animate-in fade-in slide-in-from-top-2">
              
              {/* DUPLICATE HANDOVER WARNING */}
              {handoverResult.type === 'duplicate' && (
                <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 sm:p-5 text-red-900 shadow-md">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-8 h-8 text-red-600 shrink-0 mt-0.5 animate-bounce" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded uppercase tracking-wider">
                          WARNING: DUPLICATE HANDOVER
                        </span>
                      </div>
                      <h3 className="font-outfit font-black text-lg text-red-900 mt-1">
                        Order Already Collected!
                      </h3>
                      <p className="text-xs sm:text-sm text-red-800 font-semibold mt-1">
                        {handoverResult.message}
                      </p>
                      <p className="text-xs text-red-700 mt-1.5 font-bold">
                        ⛔ DO NOT HAND OVER FOOD AGAIN. This token has already been marked as collected.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHandoverResult(null)}
                      className="text-red-400 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* SUCCESSFUL HANDOVER CONFIRMATION */}
              {handoverResult.type === 'success' && (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 text-emerald-950 shadow-md">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-600 text-white font-black text-xs px-2 py-0.5 rounded uppercase tracking-wider">
                          ✓ FOOD HANDED OVER & COMPLETED
                        </span>
                      </div>
                      <h3 className="font-outfit font-black text-lg text-emerald-950 mt-1">
                        Order #{handoverResult.order?.orderCode} (Token #{handoverResult.order?.pickupToken})
                      </h3>
                      <p className="text-xs sm:text-sm text-emerald-800 font-semibold mt-1">
                        {handoverResult.message}
                      </p>
                      <p className="text-xs text-emerald-700 mt-1">
                        Physical food handed over. Status updated to <strong>Handover Bill</strong>. Customer tracker and live pickup display updated in real time.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHandoverResult(null)}
                      className="text-emerald-500 hover:text-emerald-800 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* GENERAL ERROR */}
              {handoverResult.type === 'error' && (
                <div className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-4 text-amber-900 shadow-md flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">Notice</h4>
                    <p className="text-xs text-amber-800 mt-0.5">{handoverResult.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHandoverResult(null)}
                    className="text-amber-500 hover:text-amber-800 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ================= FILTER TABS & SEARCH BAR ================= */}
        <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'pending'
                  ? 'bg-[#0b3d2e] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>Pending Handovers</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'pending' ? 'bg-amber text-stone-950' : 'bg-stone-200 text-stone-700'
              }`}>
                {stats.pending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'completed'
                  ? 'bg-[#0b3d2e] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>Completed Handovers</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'completed' ? 'bg-amber text-stone-950' : 'bg-stone-200 text-stone-700'
              }`}>
                {stats.completed}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'all'
                  ? 'bg-[#0b3d2e] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>All Orders</span>
            </button>
          </div>

          {/* Search Input for Grid */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by token, name, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-16 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  fetchOrders(true, '');
                }}
                className="absolute right-9 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#0b3d2e] hover:bg-[#1a7a45] text-white text-[11px] font-bold px-2 py-1 rounded-lg"
            >
              Find
            </button>
          </form>

        </div>

        {/* ================= ORDER CARDS GRID ================= */}
        <div>
          {loading ? (
            <div className="py-24 text-center bg-white rounded-3xl border border-stone-200">
              <div className="w-10 h-10 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-3" />
              <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                Loading orders...
              </span>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-2xl font-black">
                ✓
              </div>
              <h3 className="font-outfit font-black text-stone-900 text-lg mb-1">
                {activeTab === 'pending'
                  ? 'All Clear! No Pending Handovers'
                  : 'No Orders Found'}
              </h3>
              <p className="text-stone-500 text-xs max-w-md mx-auto">
                {activeTab === 'pending'
                  ? 'When the kitchen marks food as "Pickup Bill" or "Ready", it will automatically appear here for collection and thermal bill printing.'
                  : 'Try selecting a different filter tab or clearing your search filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {orders.map((order) => {
                const isWalkIn = order.orderType === 'WALK_IN';
                const token = order.pickupToken || order.orderCode?.replace('DRS-', '');
                
                // Customer identification
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

                const orderDate = new Date(order.createdAt || Date.now());
                const formattedTime = orderDate.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });
                const formattedDate = orderDate.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                });

                return (
                  <div
                    key={order._id}
                    className={`bg-white rounded-2xl border-2 transition-all p-4 flex flex-col justify-between gap-3.5 relative overflow-hidden ${
                      isHandoverCompleted
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-stone-200 hover:border-[#0b3d2e] shadow-sm hover:shadow-md'
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
                        <div className="text-[11px] font-mono text-stone-500 font-bold mt-0.5 flex items-center gap-1.5">
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
                          <User className="w-3.5 h-3.5 text-stone-500" />
                          <span className="truncate max-w-[170px]">{customerName}</span>
                        </div>
                        
                        {/* Role / Type Badge */}
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
                            <Briefcase className="w-3 h-3" /> Faculty/Staff
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
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-stone-800">
                            <div className="truncate mr-2 font-semibold">
                              <span>{item.name}</span>
                              <span className="text-[10px] text-stone-400 ml-1.5">@ ₹{item.price}</span>
                            </div>
                            <span className="font-black font-mono text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200 text-xs shrink-0">
                              ×{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

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
                        <span className="font-outfit font-black text-lg text-stone-900">
                          ₹{Number(order.total || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-1">
                      {isHandoverCompleted ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReceiptModal({ isOpen: true, order, autoPrint: false })}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs py-2.5 px-3 rounded-xl transition border border-stone-300"
                          >
                            <Printer className="w-3.5 h-3.5 text-stone-600" />
                            <span>Reprint Thermal Bill</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {/* Print Bill preview button */}
                          <button
                            type="button"
                            onClick={() => setReceiptModal({ isOpen: true, order, autoPrint: false })}
                            className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition border border-stone-300"
                            title="Preview / Print Bill Only"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Primary Handover & Print Button */}
                          <button
                            type="button"
                            disabled={verifying}
                            onClick={() => handleStartHandover(order)}
                            className="flex-1 flex items-center justify-center gap-2 bg-[#0b3d2e] hover:bg-[#1a7a45] active:scale-95 text-white font-black text-xs py-2.5 px-3 rounded-xl shadow transition"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber" />
                            <span>Handover Food & Print Bill</span>
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ================= PHYSICAL HANDOVER CONFIRMATION MODAL ================= */}
      {confirmModal.isOpen && confirmModal.order && (
        <div className="fixed inset-0 z-50 bg-stone-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-md w-full overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber flex items-center justify-center text-stone-950 font-black text-xl shadow-xs">
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
              <span className="text-[10px] font-black uppercase tracking-wider text-amber block">
                CUSTOMER PICKUP TOKEN
              </span>
              <span className="font-outfit font-black text-4xl tracking-tight text-white">
                #{confirmModal.order.pickupToken || confirmModal.order.orderCode?.replace('DRS-', '')}
              </span>
              <div className="text-xs text-white/80 font-semibold">
                {confirmModal.order.orderType === 'WALK_IN'
                  ? confirmModal.order.walkInCustomer?.name || 'Walk-in Customer'
                  : confirmModal.order.user?.name || 'Student / Faculty'}
              </div>
            </div>

            {/* Unpaid Warning if applicable */}
            {confirmModal.order.paymentMethod === 'cod' && confirmModal.order.paymentStatus !== 'paid' && (
              <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 text-red-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-black">COLLECT CASH PAYMENT</strong>
                  <span>Please collect <strong>₹{confirmModal.order.total}</strong> in cash from the customer before handing over the food trays!</span>
                </div>
              </div>
            )}

            {/* Items summary */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs space-y-1 max-h-36 overflow-y-auto">
              <span className="text-[10px] font-bold uppercase text-stone-400 block mb-1">
                Handover Items ({confirmModal.order.items?.length || 0})
              </span>
              {confirmModal.order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-stone-800">
                  <span className="truncate">{item.name}</span>
                  <span className="font-black font-mono">×{item.quantity}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-stone-500 text-center">
              Has the customer arrived at the counter and physically received all food items?
            </p>

            {/* Modal Actions */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={verifying}
                onClick={handleConfirmHandover}
                className="w-full flex items-center justify-center gap-2 bg-[#0b3d2e] hover:bg-[#1a7a45] active:scale-95 text-white font-black text-sm py-3 px-4 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {verifying ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-amber" />
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
                      autoPrint: true,
                    });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs py-2.5 px-3 rounded-xl border border-stone-300 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Reprint Bill</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: false, order: null })}
                  className="flex-1 text-stone-600 hover:text-stone-900 font-bold text-xs py-2.5 px-3 rounded-xl hover:bg-stone-100 transition text-center"
                >
                  Cancel / Not Yet
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
