import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  QrCode,
  CheckCircle2,
  Clock,
  Sparkles,
  Receipt,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShoppingBag,
  Bell,
  Check,
  X,
  CreditCard,
  Banknote,
  Tv,
} from 'lucide-react';

const STATUS_CONFIG = {
  Placed: {
    label: 'PLACED',
    message: 'Order received. Kitchen will confirm shortly.',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    indicator: 'bg-amber-500',
  },
  Confirmed: {
    label: 'CONFIRMED',
    message: 'Order accepted by canteen. Queued for cooking.',
    bg: 'bg-blue-50 text-blue-800 border-blue-200',
    indicator: 'bg-blue-500',
  },
  Preparing: {
    label: 'PREPARING',
    message: 'Your food is being prepared. Please wait for the pickup notification.',
    bg: 'bg-orange-50 text-orange-800 border-orange-200',
    indicator: 'bg-orange-500 animate-pulse',
  },
  Ready: {
    label: 'READY FOR PICKUP',
    message: 'Your order is ready! Please collect it at the canteen counter.',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20',
    indicator: 'bg-emerald-500 animate-ping',
  },
  Completed: {
    label: 'COMPLETED',
    message: 'Order collected successfully.',
    bg: 'bg-stone-100 text-stone-700 border-stone-200',
    indicator: 'bg-stone-500',
  },
  Cancelled: {
    label: 'CANCELLED',
    message: 'Order was cancelled.',
    bg: 'bg-red-50 text-red-700 border-red-200',
    indicator: 'bg-red-500',
  },
};

const Pickup = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active'); // 'active' | 'ready' | 'completed' | 'all'
  const [selectedQR, setSelectedQR] = useState(null); // Modal for expanded QR view

  const { socket } = useSocket();

  useEffect(() => {
    fetchMyOrders();
  }, []);

  // Real-time synchronization for order status transitions
  useEffect(() => {
    if (!socket) return;

    const handleStatusChanged = (payload) => {
      console.log('⚡ Pickup page received real-time status change:', payload);
      if (!payload || !payload.orderCode) return;

      setOrders((prev) =>
        prev.map((order) => {
          if (order.orderCode === payload.orderCode || order._id === payload.orderId) {
            return {
              ...order,
              status: payload.status,
              paymentStatus: payload.paymentStatus || order.paymentStatus,
              updatedAt: new Date().toISOString(),
            };
          }
          return order;
        })
      );
    };

    socket.on('order:statusChanged', handleStatusChanged);
    return () => socket.off('order:statusChanged', handleStatusChanged);
  }, [socket]);

  const fetchMyOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await API.get('/orders/my');
      if (res.data?.success) {
        setOrders(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load orders for pickup:', err);
      setError(err.response?.data?.message || 'Could not load your orders.');
    } finally {
      setLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filter === 'active') {
        return ['Placed', 'Confirmed', 'Preparing', 'Ready'].includes(o.status);
      }
      if (filter === 'ready') {
        return o.status === 'Ready';
      }
      if (filter === 'completed') {
        return o.status === 'Completed';
      }
      return true; // 'all'
    });
  }, [orders, filter]);

  const readyOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === 'Ready').length;
  }, [orders]);

  const activeOrdersCount = useMemo(() => {
    return orders.filter((o) => ['Placed', 'Confirmed', 'Preparing', 'Ready'].includes(o.status)).length;
  }, [orders]);

  return (
    <div className="min-h-screen bg-stone-100/70 pb-24 font-inter text-text">
      
      {/* Top Banner */}
      <div className="bg-[#0b3d2e] text-white px-4 py-6 shadow-md border-b border-white/10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber text-[#0b3d2e] font-black text-2xl flex items-center justify-center shadow-md">
              🎟️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-outfit font-black text-xl sm:text-2xl tracking-tight text-white">
                  My Food Pickups
                </h1>
                {readyOrdersCount > 0 && (
                  <span className="bg-amber text-[#0b3d2e] font-black text-xs px-2.5 py-0.5 rounded-full animate-bounce shadow-sm">
                    {readyOrdersCount} READY NOW
                  </span>
                )}
              </div>
              <p className="text-xs text-white/70">
                Track your unique pickup tokens and show them at the counter for collection.
              </p>
            </div>
          </div>

          {/* Quick Action: Open Public Counter Display & Refresh */}
          <div className="flex items-center gap-2">
            <Link
              to="/pickup-display"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition border border-white/15"
              title="Open public canteen counter TV screen"
            >
              <Tv className="w-4 h-4 text-amber" />
              <span>Live Counter Screen</span>
              <ExternalLink className="w-3 h-3 text-white/60" />
            </Link>

            <button
              type="button"
              onClick={fetchMyOrders}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-white/15"
              title="Refresh Pickups"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber' : ''}`} />
            </button>
          </div>

        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'active', label: `Active Pickups (${activeOrdersCount})` },
            { id: 'ready', label: `Ready for Pickup (${readyOrdersCount})` },
            { id: 'completed', label: 'Collected Orders' },
            { id: 'all', label: `All Orders (${orders.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                filter === tab.id
                  ? 'bg-[#0b3d2e] text-white shadow-sm'
                  : 'bg-white text-stone-600 hover:bg-stone-200/80 border border-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content State */}
        {loading && orders.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
            <div className="w-10 h-10 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-3" />
            <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
              Loading your pickup tokens...
            </span>
          </div>
        ) : error ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h3 className="font-outfit font-bold text-base text-stone-900 mb-1">
              Error Loading Pickups
            </h3>
            <p className="text-xs text-stone-500 mb-4">{error}</p>
            <button
              type="button"
              onClick={fetchMyOrders}
              className="bg-[#0b3d2e] text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              Retry
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
            <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-3 stroke-1" />
            <h3 className="font-outfit font-bold text-stone-900 text-lg mb-1">
              No orders found
            </h3>
            <p className="text-stone-500 text-xs max-w-sm mx-auto mb-6">
              {filter === 'active'
                ? "You don't have any active orders right now. Order delicious authentic meals from our canteen menu!"
                : 'No orders match this filter.'}
            </p>
            <Link
              to="/menu"
              className="inline-flex items-center gap-1.5 bg-[#0b3d2e] hover:bg-[#1a7a45] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-md"
            >
              <span>Explore Canteen Menu</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const token = order.pickupToken || order.orderCode;
              const formattedToken = String(token).toUpperCase().startsWith('DRS-')
                ? String(token).toUpperCase()
                : `DRS-${token}`;

              const isReady = order.status === 'Ready';
              const isCompleted = order.status === 'Completed';
              const isPreparing = order.status === 'Preparing';
              const isCancelled = order.status === 'Cancelled';

              const statusMeta = STATUS_CONFIG[order.status] || STATUS_CONFIG.Placed;

              const dateObj = new Date(order.createdAt);
              const formattedDate = dateObj.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const formattedTime = dateObj.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });

              // Dynamic QR Code data URL for verification at counter
              const qrVerificationData = JSON.stringify({
                orderCode: order.orderCode,
                token: formattedToken,
                secret: order.pickupSecret || '',
              });
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                qrVerificationData
              )}&color=0b3d2e&bgcolor=ffffff`;

              return (
                <div
                  key={order._id}
                  className={`bg-white rounded-3xl shadow-sm border transition-all overflow-hidden ${
                    isReady
                      ? 'border-2 border-emerald-500 ring-4 ring-emerald-500/15 shadow-xl'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {/* Top Header of Card */}
                  <div
                    className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 border-b ${
                      isReady
                        ? 'bg-emerald-500 text-white border-emerald-600'
                        : 'bg-stone-50/80 text-stone-700 border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Order #{order.orderCode}
                      </span>
                      <span className="text-xs opacity-60">•</span>
                      <span className="text-xs font-medium opacity-80">
                        {formattedDate} at {formattedTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                          isReady
                            ? 'bg-white text-emerald-900 border-white shadow-xs'
                            : statusMeta.bg
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.indicator}`} />
                        <span>{statusMeta.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Main Card Content */}
                  <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    
                    {/* Left: Pickup Token Callout & Status Message */}
                    <div className="space-y-3 flex-1">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-0.5">
                          PICKUP TOKEN NUMBER
                        </span>
                        <div
                          className={`font-outfit font-black tracking-tight flex items-baseline gap-2 ${
                            isReady
                              ? 'text-4xl sm:text-5xl text-emerald-700'
                              : 'text-3xl sm:text-4xl text-[#0b3d2e]'
                          }`}
                        >
                          <span>{formattedToken}</span>
                          {isReady && (
                            <span className="text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md self-center">
                              Ready for Collection
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Banner Message */}
                      <div
                        className={`p-3 rounded-2xl text-xs font-semibold border flex items-start gap-2.5 ${
                          isReady
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                            : isPreparing
                            ? 'bg-orange-50 border-orange-200 text-orange-950'
                            : isCompleted
                            ? 'bg-stone-50 border-stone-200 text-stone-700'
                            : 'bg-stone-50 border-stone-200 text-stone-600'
                        }`}
                      >
                        {isReady ? (
                          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 animate-bounce" />
                        ) : isPreparing ? (
                          <Clock className="w-5 h-5 text-orange-600 shrink-0 mt-0.5 animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-bold">{statusMeta.message}</p>
                          {isReady && (
                            <p className="text-[11px] text-emerald-800 font-normal mt-0.5">
                              Show this token number or scan the QR code at the counter.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Food Items Preview */}
                      <div className="bg-stone-50/70 p-3 rounded-2xl border border-stone-200/80 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
                          Ordered Items ({order.items?.length || 0})
                        </span>
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

                      {/* Financial info */}
                      <div className="flex flex-wrap items-center justify-between text-xs pt-1 border-t border-stone-100">
                        <div className="flex items-center gap-2">
                          <span className="text-stone-500 font-medium">Payment:</span>
                          <span className="font-bold uppercase text-stone-800 font-mono">
                            {order.paymentMethod} ({order.paymentStatus})
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-stone-500 font-medium">Total:</span>
                          <span className="font-outfit font-black text-base text-stone-900">
                            ₹{Number(order.total || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: QR Code for Verification & Quick Links */}
                    <div className="flex flex-col items-center justify-center p-4 bg-stone-50 rounded-2xl border border-stone-200/80 w-full md:w-52 shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5" /> Counter QR Token
                      </span>

                      {/* QR Image */}
                      <div
                        onClick={() => setSelectedQR({ token: formattedToken, url: qrUrl })}
                        className="bg-white p-2 rounded-xl border border-stone-300 shadow-xs cursor-pointer hover:scale-105 transition-transform"
                        title="Click to expand QR Code"
                      >
                        <img
                          src={qrUrl}
                          alt={`QR for ${formattedToken}`}
                          className="w-28 h-28 object-contain"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono mt-1.5">
                        Tap to expand
                      </span>

                      {/* Action Links */}
                      <div className="w-full mt-3 space-y-1.5 pt-2 border-t border-stone-200">
                        <Link
                          to={`/bill/${order.orderCode}`}
                          className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-stone-700 hover:text-[#0b3d2e] bg-white border border-stone-200 hover:border-[#0b3d2e] py-1.5 px-2 rounded-lg transition"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                        </Link>
                        <Link
                          to={`/tracker/${order.orderCode}`}
                          className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-[#0b3d2e] hover:bg-[#0b3d2e]/10 py-1.5 px-2 rounded-lg transition"
                        >
                          <span>Live Progress Tracker</span>
                        </Link>
                      </div>

                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Expanded QR Code Modal */}
      {selectedQR && (
        <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl border border-stone-200 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-stone-100">
              <span className="font-outfit font-black text-sm text-stone-900">
                Token {selectedQR.token}
              </span>
              <button
                type="button"
                onClick={() => setSelectedQR(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-500">
              Show this QR code at the canteen collection counter for instant scan and food handover.
            </p>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 inline-block shadow-inner">
              <img
                src={selectedQR.url}
                alt="Enlarged QR Code"
                className="w-48 h-48 mx-auto object-contain"
              />
            </div>

            <div className="font-outfit font-black text-2xl text-[#0b3d2e] tracking-wider">
              {selectedQR.token}
            </div>

            <button
              type="button"
              onClick={() => setSelectedQR(null)}
              className="w-full bg-[#0b3d2e] text-white text-xs font-bold py-2 rounded-xl hover:bg-[#1a7a45] transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Pickup;
