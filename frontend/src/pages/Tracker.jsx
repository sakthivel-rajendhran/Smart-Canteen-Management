import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  MapPin,
  Receipt,
  Tag,
  Check,
  X,
  BadgeAlert,
  Ticket,
  ShoppingBag,
  Clock,
} from 'lucide-react';

const Tracker = () => {
  const { id } = useParams(); // orderCode (e.g. DRS-1058)

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const STEPS = [
    { key: 'Placed', name: 'Order Placed', desc: 'Order received by the canteen' },
    { key: 'Confirmed', name: 'Order Confirmed', desc: 'Canteen has confirmed your order' },
    { key: 'Preparing', name: 'Preparing', desc: 'Your food is being cooked fresh' },
    { key: 'Ready', name: 'Ready for Pickup', desc: 'Your food is ready at the counter' },
    { key: 'Pickup Bill', name: 'Pickup Bill', desc: 'Bill and food ready for counter collection' },
    { key: 'Completed', name: 'Completed', desc: 'Order handed over and collected' },
  ];

  const STATUS_ORDER = ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Pickup Bill', 'Completed'];

  const STATUS_INFO = {
    Placed: { title: 'Order Placed', msg: 'Waiting for canteen to confirm your order.', bg: 'bg-rose-50 border-rose-200 text-rose-800' },
    Confirmed: { title: 'Order Confirmed', msg: 'Great! The canteen has confirmed your order.', bg: 'bg-blue-50 border-blue-200 text-blue-800' },
    Preparing: { title: 'Food Being Prepared', msg: 'Your fresh food is being prepared right now.', bg: 'bg-orange-50 border-orange-200 text-orange-800' },
    Ready: { title: 'Ready for Pickup', msg: 'Your food is ready at the counter. Please collect it.', bg: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
    'Pickup Bill': { title: 'Pickup Bill Ready', msg: 'Your food bill has been generated. Please proceed to the collection counter.', bg: 'bg-amber-50 border-amber-300 text-amber-950' },
    'Handover Bill': { title: 'Order Completed', msg: 'Order handed over and collected successfully. Thank you for dining with DRS Quick Serve.', bg: 'bg-emerald-50 border-emerald-300 text-emerald-950' },
    Completed: { title: 'Order Completed', msg: 'Order collected successfully. Thank you, enjoy your meal.', bg: 'bg-emerald-50 border-emerald-300 text-emerald-950' },
    Cancelled: { title: 'Order Cancelled', msg: 'This order was cancelled.', bg: 'bg-red-50 border-red-200 text-red-700' },
  };

  const { socket } = useSocket();

  const fetchOrderDetails = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
          setError('');
        }
        const response = await API.get(`/orders/${id}`);
        if (response.data?.success) {
          setOrder(response.data.data);
        }
      } catch (err) {
        if (!silent) {
          setError(err.response?.data?.message || 'Failed to locate order.');
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [id]
  );

  useEffect(() => {
    fetchOrderDetails(false);
  }, [fetchOrderDetails]);

  useEffect(() => {
    if (!order || !socket) return;

    const applyPayload = (payload) => {
      const targetCode = payload?.orderCode;
      const targetId = payload?.orderId || payload?._id;
      if (targetCode !== order.orderCode && (!targetId || String(targetId) !== String(order._id))) {
        return;
      }
      setOrder((prev) => {
        if (!prev) return prev;
        if (payload?.order) {
          return { ...prev, ...payload.order };
        }
        return {
          ...prev,
          status: payload.status || prev.status,
          paymentStatus: payload.paymentStatus || prev.paymentStatus,
          statusTimestamps: payload.statusTimestamps || prev.statusTimestamps,
        };
      });
    };

    socket.on('order:statusChanged', applyPayload);
    socket.on('order:updated', applyPayload);

    return () => {
      socket.off('order:statusChanged', applyPayload);
      socket.off('order:updated', applyPayload);
    };
  }, [order?.orderCode, order?._id, socket]);

  // Fallback polling sync while order is still in progress
  useEffect(() => {
    if (!order) return;
    const isTerminal = ['Completed', 'Handover Bill', 'Cancelled'].includes(order.status);
    if (isTerminal) return;

    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchOrderDetails(true);
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [order?.status, fetchOrderDetails]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
        <span className="text-muted text-sm font-semibold">Fetching tracking details...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center bg-white border border-border rounded-3xl mt-10">
        <BadgeAlert className="w-14 h-14 text-red-500 mx-auto mb-4" />
        <h3 className="font-outfit font-bold text-xl text-primary-dark mb-2">Order Not Found</h3>
        <p className="text-muted text-sm mb-6">{error || 'Could not verify code.'}</p>
        <div className="flex gap-4 justify-center">
          <Link to="/orders" className="bg-primary-dark text-white font-bold px-6 py-2.5 rounded-xl hover:bg-primary transition-all text-sm">
            My Orders
          </Link>
          <Link to="/menu" className="bg-gray-100 text-muted font-bold px-6 py-2.5 rounded-xl hover:bg-gray-200 transition-all text-sm">
            Menu
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = order.status;
  const isCancelled = currentStatus === 'Cancelled';
  const isFinalDone = currentStatus === 'Handover Bill' || currentStatus === 'Completed';
  const rawIndex = isFinalDone ? STEPS.length - 1 : STATUS_ORDER.indexOf(currentStatus);
  const currentStepIndex = rawIndex >= 0 ? rawIndex : 0;
  const statusInfo = STATUS_INFO[currentStatus] || STATUS_INFO['Placed'];

  const getStageTimestamp = (stepKey) => {
    const mapObj = order.statusTimestamps || {};
    if (mapObj[stepKey]) return mapObj[stepKey];
    if (stepKey === 'Placed') return order.createdAt || null;
    if (stepKey === 'Pickup Bill') return order.pickupBillNotifiedAt || null;
    if (stepKey === 'Completed') {
      return mapObj['Handover Bill'] || order.completedAt || order.handoverVerifiedAt || null;
    }
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 pb-28 sm:pb-20">
      <h1 className="font-outfit font-black text-2xl sm:text-3xl text-primary-dark mb-6 sm:mb-8 flex items-center gap-2.5">
        <MapPin className="w-7 h-7 text-primary shrink-0" />
        <span>Live Order Tracking</span>
      </h1>

      {/* Code Header Box */}
      <div className="bg-gradient-to-br from-primary-darker to-primary rounded-3xl p-5 sm:p-6 text-white mb-6 shadow-md relative overflow-hidden">
        <div className="absolute w-60 h-60 bg-radial-gradient(circle, rgba(255,_255,_255,_.03)_0%,_transparent_70%) top-[-30px] right-[-30px] pointer-events-none"></div>
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <span className="text-[10px] text-white/50 tracking-wider uppercase block">Order Code</span>
            <span className="font-mono font-black text-amber text-2xl tracking-widest">{order.orderCode}</span>
            <span className="text-xs text-white/60 block mt-1">Ordered by {order.user?.name || 'Student'}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-white/50 tracking-wider uppercase block">Placed At</span>
            <span className="text-xs font-semibold block mt-1">{new Date(order.createdAt).toLocaleTimeString()}</span>
            <span className="text-[9px] text-white/40 block mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 mt-6 border-t border-white/10 pt-4">
          <span className="bg-white/10 text-white/85 rounded-full px-3.5 py-1 text-xs font-bold inline-flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{order.items.length} Item(s)</span>
          </span>
          <span className="bg-amber text-primary-darker rounded-full px-3.5 py-1 text-xs font-black">
            ₹{order.total}
          </span>
          <span className={`rounded-full px-3.5 py-1 text-xs font-bold inline-flex items-center gap-1.5 ${
            order.paymentStatus === 'paid' ? 'bg-green-600 text-white' : 'bg-amber-dark text-white'
          }`}>
            {order.paymentStatus === 'paid' && <Check className="w-3.5 h-3.5 stroke-[2.75]" />}
            <span>{order.paymentStatus === 'paid' ? 'Paid Online' : 'Cash on Counter'}</span>
          </span>
        </div>
      </div>

      {/* Live Status Message Banner */}
      <div className={`border rounded-2xl p-4 sm:p-5 mb-8 flex items-center gap-4 ${statusInfo.bg}`}>
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${
            isCancelled
              ? 'bg-red-100 border-red-400 text-red-700'
              : isFinalDone
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-white border-current'
          }`}
        >
          {isCancelled ? (
            <X className="w-5 h-5 stroke-[2.5]" />
          ) : isFinalDone ? (
            <Check className="w-5 h-5 stroke-[2.75]" />
          ) : (
            <span className="w-3 h-3 rounded-full bg-current" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-outfit font-black text-base">{statusInfo.title}</h3>
          <p className="text-xs opacity-85 leading-relaxed mt-0.5">{statusInfo.msg}</p>
        </div>
      </div>

      {/* Stepper Timeline Panel */}
      {!isCancelled && (
        <div className="bg-white border border-border p-5 sm:p-6 md:p-8 rounded-3xl shadow-sm mb-8">
          <h3 className="font-outfit font-bold text-lg text-primary-dark mb-1">Tracking Progress</h3>
          <p className="text-muted text-xs mb-6 sm:mb-8">Updates automatically as canteen updates your order status.</p>

          <div className="relative pl-1 sm:pl-2">
            <div className="flex flex-col gap-6" data-testid="tracking-timeline">
              {STEPS.map((step, idx) => {
                const completed = isFinalDone ? idx <= currentStepIndex : idx < currentStepIndex;
                const active = !isFinalDone && idx === currentStepIndex;
                const reached = completed || active;
                const ts = reached ? getStageTimestamp(step.key) : null;

                return (
                  <div
                    key={step.key}
                    data-testid={`tracking-step-${step.key}`}
                    data-state={completed ? 'completed' : active ? 'current' : 'pending'}
                    className="flex items-start gap-4 relative"
                  >
                    {/* Connecting line to the next step marker */}
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`absolute left-[17px] w-0.5 z-0 transition-colors duration-300 pointer-events-none ${
                          completed ? 'bg-emerald-600' : 'bg-gray-200'
                        }`}
                        style={{ top: '36px', bottom: '-24px' }}
                      />
                    )}

                    {/* Consistent minimalist stage indicator */}
                    <div
                      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors relative z-10 flex-shrink-0 ${
                        completed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : active
                          ? 'bg-white border-primary-dark text-primary-dark ring-4 ring-primary/15'
                          : 'bg-white border-gray-200 text-gray-300'
                      }`}
                    >
                      {completed ? (
                        <Check className="w-4 h-4 stroke-[2.75]" aria-label="Completed" />
                      ) : active ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-primary-dark" aria-label="Current stage" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent" aria-label="Pending stage" />
                      )}
                    </div>

                    <div className="flex-1 pt-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className={`text-sm font-bold transition-colors ${
                              completed
                                ? 'text-emerald-700'
                                : active
                                ? 'text-primary-dark'
                                : 'text-gray-400'
                            }`}
                          >
                            {step.name}
                          </h4>
                          {active && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary-dark border border-primary/20">
                              In Progress
                            </span>
                          )}
                        </div>
                        {ts && (
                          <span className="text-[11px] font-mono text-muted inline-flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {new Date(ts).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs transition-colors mt-0.5 ${
                          completed
                            ? 'text-emerald-700/80'
                            : active
                            ? 'text-muted'
                            : 'text-gray-300'
                        }`}
                      >
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Items Summary list */}
      <div className="bg-white border border-border p-5 sm:p-6 md:p-8 rounded-3xl shadow-sm mb-8">
        <h3 className="font-outfit font-bold text-lg text-primary-dark mb-4 border-b border-border pb-3">Items Summary</h3>
        <div className="flex flex-col gap-4.5">
          {order.items.map((item, idx) => {
            const isParcel = item.serviceType === 'PARCEL' || Number(item.parcelChargeTotal || 0) > 0;
            const itemParcelTotal = Number(item.parcelChargeTotal || 0);
            const itemLineTotal = Number(item.price) * Number(item.quantity) + itemParcelTotal;
            return (
              <div key={idx} className="flex items-center justify-between text-sm gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-10 h-10 rounded-xl object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-cream border border-border flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4 text-primary-dark/60" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-primary-dark leading-none">{item.name}</span>
                      {item.variantLabel && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream text-primary-dark border border-border">
                          {item.variantLabel}
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${
                          isParcel
                            ? 'bg-amber/20 text-amber-dark border-amber/40'
                            : 'bg-gray-100 text-muted border-gray-200'
                        }`}
                      >
                        {isParcel ? 'Parcel' : 'Normal'}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted font-semibold block mt-0.5">
                      ₹{item.price} each
                      {isParcel && itemParcelTotal > 0 ? ` • +₹${itemParcelTotal} parcel` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-muted font-bold text-xs">x{item.quantity}</span>
                  <span className="font-mono font-bold text-primary-dark">₹{itemLineTotal}</span>
                </div>
              </div>
            );
          })}

          {Number(order.parcelChargeTotal || 0) > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-border border-dashed text-xs font-semibold text-muted">
              <div className="flex justify-between">
                <span>Food Subtotal</span>
                <span className="font-mono text-primary-dark">₹{Number(order.foodSubtotal ?? order.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between text-amber-dark font-bold">
                <span>Parcel Charges</span>
                <span className="font-mono">+₹{Number(order.parcelChargeTotal)}</span>
              </div>
            </div>
          )}

          {order.discount > 0 && (
            <div className="flex justify-between text-xs text-primary font-bold pt-3.5 border-t border-border border-dashed">
              <span className="inline-flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Coupon Discount
              </span>
              <span>−₹{order.discount}</span>
            </div>
          )}

          <div className="flex justify-between items-center gap-3 pt-4 mt-2 border-t border-border">
            <span className="font-outfit font-bold text-base text-primary-dark min-w-0">Grand Total</span>
            <span className="font-outfit font-black text-2xl text-primary-dark flex-shrink-0 whitespace-nowrap text-right">₹{order.total}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link 
          to="/pickup"
          className="flex-1 bg-amber hover:bg-amber-dark text-stone-950 font-black py-3.5 rounded-2xl transition-all shadow-md shadow-amber/20 text-center flex items-center justify-center gap-2"
        >
          <Ticket className="w-4 h-4" />
          <span>View Pickup Token</span>
        </Link>
        <Link 
          to={`/bill/${order.orderCode}`}
          className="flex-1 bg-primary-dark hover:bg-primary text-white font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-primary/20 text-center flex items-center justify-center gap-2"
        >
          <Receipt className="w-4 h-4" />
          <span>View Receipt Bill</span>
        </Link>
      </div>
    </div>
  );
};

export default Tracker;
