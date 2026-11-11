import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  Receipt,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ShoppingBag,
  CreditCard,
  Banknote,
  MapPin,
} from 'lucide-react';

const STATUS_CONFIG = {
  Placed: {
    label: 'ORDER PLACED',
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
  'Pickup Bill': {
    label: 'PICKUP BILL',
    message: 'Your food bill is ready! Please proceed to the canteen counter to collect your bill and meal.',
    bg: 'bg-amber-100 text-amber-950 border-amber-400 ring-2 ring-amber-500/25',
    indicator: 'bg-amber-500 animate-bounce',
  },
  'Handover Bill': {
    label: 'HANDOVER BILL',
    message: 'Food handed over and bill collected successfully. Thank you, enjoy your meal!',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    indicator: 'bg-emerald-600',
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
        return ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Pickup Bill'].includes(o.status);
      }
      if (filter === 'ready') {
        return o.status === 'Ready' || o.status === 'Pickup Bill';
      }
      if (filter === 'completed') {
        return o.status === 'Handover Bill' || o.status === 'Completed';
      }
      return true; // 'all'
    });
  }, [orders, filter]);

  const readyOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === 'Ready' || o.status === 'Pickup Bill').length;
  }, [orders]);

  const activeOrdersCount = useMemo(() => {
    return orders.filter((o) => ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Pickup Bill'].includes(o.status)).length;
  }, [orders]);

  return (
    <div className="min-h-screen bg-stone-100/70 pb-24 font-inter text-text">
      
      {/* Top Banner (No Live Counter Screen button as required) */}
      <div className="bg-[#0b3d2e] text-white px-4 py-6 shadow-md border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          
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
                    {readyOrdersCount} READY AT COUNTER
                  </span>
                )}
              </div>
              <p className="text-xs text-white/70">
                Show your unique pickup token at the counter for meal collection and bill receipt.
              </p>
            </div>
          </div>

          {/* Quick Refresh Button */}
          <button
            type="button"
            onClick={fetchMyOrders}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-white/15"
            title="Refresh Pickups"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber' : ''}`} />
          </button>

        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'active', label: `Active Pickups (${activeOrdersCount})` },
            { id: 'ready', label: `Ready for Pickup (${readyOrdersCount})` },
            { id: 'completed', label: 'Collected / Handover' },
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
                ? "You don't have any active orders right now. Order fresh meals from our canteen menu!"
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
              const isPickupBill = order.status === 'Pickup Bill';
              const isHandoverBill = order.status === 'Handover Bill';
              const isCompleted = order.status === 'Completed' || isHandoverBill;
              const isPreparing = order.status === 'Preparing';

              const isHighlighted = isReady || isPickupBill;

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

              return (
                <div
                  key={order._id}
                  className={`bg-white rounded-3xl shadow-sm border transition-all overflow-hidden ${
                    isHighlighted
                      ? 'border-2 border-amber-500 ring-4 ring-amber-500/15 shadow-xl'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {/* Card Header */}
                  <div
                    className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 border-b ${
                      isHighlighted
                        ? 'bg-amber-500 text-stone-950 font-bold border-amber-600'
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
                          isHighlighted
                            ? 'bg-[#072419] text-amber border-[#072419] shadow-xs'
                            : statusMeta.bg
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.indicator}`} />
                        <span>{statusMeta.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Main Card Content (Clean professional layout without QR code) */}
                  <div className="p-5 sm:p-6 flex flex-col md:flex-row items-stretch justify-between gap-6">
                    
                    {/* Left: Prominent Pickup Token & Order Details */}
                    <div className="space-y-4 flex-1">
                      
                      {/* Prominent Pickup Token Highlight */}
                      <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-0.5">
                            YOUR UNIQUE PICKUP TOKEN
                          </span>
                          <div
                            className={`font-outfit font-black tracking-tight ${
                              isHighlighted
                                ? 'text-4xl sm:text-5xl text-[#0b3d2e]'
                                : 'text-3xl sm:text-4xl text-stone-800'
                            }`}
                          >
                            {formattedToken}
                          </div>
                        </div>

                        {isHighlighted && (
                          <div className="bg-amber-100 border border-amber-300 text-amber-950 px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 self-start sm:self-center shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                            <span>Collect Meal at Counter</span>
                          </div>
                        )}
                      </div>

                      {/* Status Message Banner */}
                      <div
                        className={`p-3.5 rounded-2xl text-xs font-semibold border flex items-start gap-2.5 ${
                          isHighlighted
                            ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                            : isPreparing
                            ? 'bg-orange-50 border-orange-200 text-orange-950'
                            : isCompleted
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                            : 'bg-stone-50 border-stone-200 text-stone-700'
                        }`}
                      >
                        {isHighlighted ? (
                          <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                        ) : isPreparing ? (
                          <Clock className="w-5 h-5 text-orange-600 shrink-0 mt-0.5 animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-bold">{statusMeta.message}</p>
                          {isHighlighted && (
                            <p className="text-[11px] text-amber-900 font-normal mt-0.5">
                              Present token <strong>#{formattedToken}</strong> to the canteen staff at the collection counter.
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
                          {order.items?.map((item, idx) => {
                            const isParcel = item.serviceType === 'PARCEL' || Number(item.parcelChargeTotal || 0) > 0;
                            return (
                              <div key={idx} className="flex justify-between items-center text-stone-800 gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-semibold truncate">
                                    {item.name}
                                  </span>
                                  {isParcel && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber/20 text-amber-dark shrink-0">
                                      Parcel{Number(item.parcelChargeTotal || 0) > 0 ? ` +₹${Number(item.parcelChargeTotal)}` : ''}
                                    </span>
                                  )}
                                </div>
                                <span className="font-black font-mono text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200 text-[11px] shrink-0">
                                  ×{item.quantity}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Payment & Financial Row */}
                      <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-stone-100 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-stone-500 font-medium">Payment Mode:</span>
                          <span className="font-bold uppercase text-stone-800 font-mono">
                            {order.paymentMethod} ({order.paymentStatus})
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          {Number(order.parcelChargeTotal || 0) > 0 && (
                            <span className="text-[11px] font-bold text-amber-dark">
                              (Parcel ₹{Number(order.parcelChargeTotal).toFixed(2)})
                            </span>
                          )}
                          <span className="text-stone-500 font-medium">Total:</span>
                          <span className="font-outfit font-black text-base text-stone-900">
                            ₹{Number(order.total || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Right: Actions Column (Receipt & Live Tracker) */}
                    <div className="flex flex-col justify-center gap-2.5 w-full md:w-56 shrink-0 border-t md:border-t-0 md:border-l border-stone-200 md:pl-6 pt-4 md:pt-0">
                      
                      <Link
                        to={`/bill/${order.orderCode}`}
                        className="w-full flex items-center justify-center gap-2 bg-[#0b3d2e] hover:bg-[#1a7a45] text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition active:scale-95"
                      >
                        <Receipt className="w-4 h-4 text-amber" />
                        <span>View Receipt Bill</span>
                      </Link>

                      <Link
                        to={`/tracker/${order.orderCode}`}
                        className="w-full flex items-center justify-center gap-2 bg-white hover:bg-stone-100 text-stone-700 font-bold text-xs py-2.5 px-4 rounded-xl border border-stone-200 transition"
                      >
                        <MapPin className="w-4 h-4 text-[#0b3d2e]" />
                        <span>Track Live Progress</span>
                      </Link>

                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
};

export default Pickup;
