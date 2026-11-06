import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { useSocket } from '../context/SocketContext';
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
  QrCode,
} from 'lucide-react';

const FoodHandover = () => {
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Verification search input (token or order code)
  const [verificationInput, setVerificationInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Result Banner / Modal State
  const [handoverResult, setHandoverResult] = useState(null); // { type: 'success' | 'duplicate' | 'error', message, order }
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Audio Context Ref
  const audioCtxRef = useRef(null);

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    fetchReadyOrders();
  }, []);

  // Real-time socket listeners for order status transitions
  useEffect(() => {
    if (!socket) return;

    const handleOrderEvent = (order) => {
      if (!order) return;
      // Refresh list to maintain true backend order
      fetchReadyOrders(false);
    };

    socket.on('order:created', handleOrderEvent);
    socket.on('order:updated', handleOrderEvent);
    socket.on('order:statusChanged', handleOrderEvent);

    return () => {
      socket.off('order:created', handleOrderEvent);
      socket.off('order:updated', handleOrderEvent);
      socket.off('order:statusChanged', handleOrderEvent);
    };
  }, [socket]);

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
        // High pleasant ding
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        // Low double buzz warning
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

  const fetchReadyOrders = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      setError('');
      const res = await API.get('/admin/pos/ready-orders');
      if (res.data?.success) {
        setReadyOrders(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch ready orders:', err);
      setError(err.response?.data?.message || 'Failed to fetch ready orders.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Perform Handover Verification
  const executeHandover = async (term) => {
    const query = String(term || verificationInput).trim();
    if (!query) return;

    try {
      setVerifying(true);
      setHandoverResult(null);

      const res = await API.post('/admin/pos/verify-pickup', { token: query });

      if (res.data?.success) {
        playSound(true);
        setHandoverResult({
          type: 'success',
          message: res.data.message || `Food handed over successfully!`,
          order: res.data.data,
        });
        setVerificationInput('');
        // Remove from local ready queue
        setReadyOrders((prev) =>
          prev.filter(
            (o) =>
              o.pickupToken !== query &&
              o.orderCode !== query &&
              o._id !== res.data.data?._id
          )
        );
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeHandover(verificationInput);
  };

  return (
    <div className="min-h-screen bg-stone-100/70 pb-20 font-inter text-text">
      
      {/* Top Header */}
      <div className="bg-[#0b3d2e] text-white px-4 py-3 shadow-md border-b border-white/10 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber flex items-center justify-center text-primary-dark font-black text-lg shadow-sm">
              🍛
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-outfit font-black text-base sm:text-lg tracking-tight">
                  Food Handover Counter
                </h1>
                <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isConnected ? 'Real-Time Queue' : 'Connecting...'}
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                Token & QR verification • Strict duplicate collection prevention
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition border border-white/10 text-xs"
              title={soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber" /> : <VolumeX className="w-4 h-4 text-white/40" />}
            </button>

            <button
              type="button"
              onClick={() => fetchReadyOrders(true)}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3 py-2 rounded-xl transition border border-white/10"
              title="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              to="/admin/pos"
              className="flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-stone-950 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-sm"
            >
              <span>POS Billing</span>
            </Link>

            <Link
              to="/admin/bills"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition border border-white/10"
            >
              <span>Bill Archive</span>
            </Link>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        
        {/* ================= PROMINENT TOKEN VERIFICATION FORM ================= */}
        <div className="bg-white rounded-3xl shadow-md border border-stone-200 p-5 sm:p-6">
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto">
            <div className="text-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Instant Verification
              </span>
              <h2 className="font-outfit font-black text-xl sm:text-2xl text-stone-900">
                Verify Customer Pickup Token
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Token # (e.g. 1025) or Order Code (DRS-1025)..."
                  value={verificationInput}
                  onChange={(e) => setVerificationInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border-2 border-stone-200 rounded-2xl text-sm sm:text-base font-bold font-mono tracking-wider focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!verificationInput.trim() || verifying}
                className="w-full sm:w-auto px-7 py-3.5 bg-[#0b3d2e] hover:bg-[#1a7a45] disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0"
              >
                {verifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-amber" />
                    <span>Verify & Hand Over</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ================= VERIFICATION RESULT CALLOUT BANNER ================= */}
          {handoverResult && (
            <div className="mt-5 max-w-2xl mx-auto animate-in fade-in slide-in-from-top-2">
              
              {/* 1. DUPLICATE HANDOVER ALERT (CRITICAL SECURITY) */}
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
                      <p className="text-xs text-red-700 mt-1">
                        ⛔ <strong>DO NOT HAND OVER FOOD AGAIN.</strong> This token has already been marked as collected.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. SUCCESSFUL HANDOVER CONFIRMATION */}
              {handoverResult.type === 'success' && (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 text-emerald-900 shadow-md">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-600 text-white font-black text-xs px-2 py-0.5 rounded uppercase tracking-wider">
                          ✓ HANDOVER VERIFIED & COMPLETED
                        </span>
                      </div>
                      <h3 className="font-outfit font-black text-lg text-emerald-950 mt-1">
                        Order #{handoverResult.order?.orderCode} (Token #{handoverResult.order?.pickupToken}) Handed Over
                      </h3>
                      <p className="text-xs sm:text-sm text-emerald-800 font-semibold mt-1">
                        {handoverResult.message}
                      </p>
                      <p className="text-xs text-emerald-700 mt-1">
                        Student / Customer has collected their food. Status set to Completed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. GENERAL ERROR */}
              {handoverResult.type === 'error' && (
                <div className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-4 text-amber-900 shadow-md flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm">Verification Notice</h4>
                    <p className="text-xs text-amber-800 mt-0.5">{handoverResult.message}</p>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ================= ACTIVE READY FOR PICKUP QUEUE ================= */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-outfit font-black text-lg sm:text-xl text-stone-900">
                Ready for Pickup Queue
              </h2>
              <span className="bg-[#0b3d2e] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {readyOrders.length}
              </span>
            </div>
            <span className="text-xs text-stone-500">
              Sorted oldest ready order first
            </span>
          </div>

          {loading ? (
            <div className="py-24 text-center bg-white rounded-3xl border border-stone-200">
              <div className="w-10 h-10 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-3" />
              <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                Loading ready orders...
              </span>
            </div>
          ) : readyOrders.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-2xl">
                ✓
              </div>
              <h3 className="font-outfit font-bold text-stone-900 text-lg mb-1">
                Queue is Clear!
              </h3>
              <p className="text-stone-500 text-xs max-w-md mx-auto">
                No orders are currently waiting at the handover counter. When the kitchen marks orders as "Ready", they will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyOrders.map((order) => {
                const isWalkIn = order.orderType === 'WALK_IN';
                const token = order.pickupToken || order.orderCode?.replace('DRS-', '');
                const customerName = isWalkIn
                  ? (order.walkInCustomer?.name || 'Walk-in Customer')
                  : (order.user?.name || 'Student');
                const customerPhone = isWalkIn
                  ? order.walkInCustomer?.phone
                  : order.user?.phone;
                const customerReg = isWalkIn
                  ? order.walkInCustomer?.registerNumber
                  : order.user?.studentDetails?.registerNumber;
                const customerStaffId = isWalkIn
                  ? order.walkInCustomer?.staffId
                  : order.user?.staffDetails?.staffId;

                const isCodUnpaid = order.paymentMethod === 'cod' && order.paymentStatus !== 'paid';

                return (
                  <div
                    key={order._id}
                    className="bg-white rounded-2xl border-2 border-stone-200 hover:border-[#0b3d2e] shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between gap-3 relative overflow-hidden"
                  >
                    {/* Top Callout: Big Token & Channel Badge */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-stone-100">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                          TOKEN NUMBER
                        </span>
                        <span className="font-outfit font-black text-3xl text-[#0b3d2e] tracking-tight">
                          #{token}
                        </span>
                        <div className="text-[11px] font-mono text-stone-500 font-semibold">
                          Order #{order.orderCode}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                            isWalkIn
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {isWalkIn ? '★ WALK-IN' : '★ ONLINE'}
                        </span>

                        {isCodUnpaid ? (
                          <span className="text-[10px] font-black uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Collect ₹{order.total} Cash
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Paid ₹{order.total}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-stone-900">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        <span className="truncate">{customerName}</span>
                      </div>

                      {customerReg && (
                        <div className="flex items-center gap-1.5 text-stone-600 text-[11px]">
                          <GraduationCap className="w-3.5 h-3.5 text-stone-400" />
                          <span>Reg No: <strong className="font-mono">{customerReg}</strong></span>
                        </div>
                      )}

                      {customerStaffId && (
                        <div className="flex items-center gap-1.5 text-stone-600 text-[11px]">
                          <GraduationCap className="w-3.5 h-3.5 text-stone-400" />
                          <span>Staff ID: <strong className="font-mono">{customerStaffId}</strong></span>
                        </div>
                      )}

                      {customerPhone && (
                        <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{customerPhone}</span>
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 text-xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                        Items ({order.items?.length || 0})
                      </div>
                      <div className="space-y-1">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-stone-800">
                            <span className="font-semibold truncate mr-2">
                              {item.name}
                            </span>
                            <span className="font-black font-mono text-stone-900 bg-white px-1.5 py-0.5 rounded border border-stone-200 text-[11px]">
                              ×{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Handover Action Button */}
                    <button
                      type="button"
                      disabled={verifying}
                      onClick={() => executeHandover(order.pickupToken || order.orderCode)}
                      className="w-full flex items-center justify-center gap-2 bg-[#0b3d2e] hover:bg-[#1a7a45] active:scale-95 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow transition"
                    >
                      <CheckCircle2 className="w-4 h-4 text-amber" />
                      <span>Hand Over Food & Complete</span>
                    </button>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default FoodHandover;
