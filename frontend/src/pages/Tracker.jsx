import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  ClipboardList, 
  MapPin, 
  Receipt, 
  Calendar, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  BadgeAlert,
  Inbox
} from 'lucide-react';

const Tracker = () => {
  const { id } = useParams(); // orderCode (e.g. DRS-1058)
  const { user } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const STEPS = [
    { key: 'Placed', icon: '📋', name: 'Order Placed', desc: 'Order received by the canteen' },
    { key: 'Confirmed', icon: '✅', name: 'Confirmed', desc: 'Canteen has confirmed your order' },
    { key: 'Preparing', icon: '👨‍🍳', name: 'Preparing', desc: 'Your food is being cooked fresh' },
    { key: 'Ready', icon: '🔔', name: 'Ready for Pickup', desc: 'Collect hot food from counter!' },
    { key: 'Completed', icon: '🎉', name: 'Completed', desc: 'Collected — Enjoy your meal!' }
  ];

  const STATUS_ORDER = ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Completed'];

  const STATUS_INFO = {
    Placed: { title: 'Order Placed!', msg: 'Waiting for canteen to confirm your order.', bg: 'bg-rose-50 border-rose-200 text-rose-700' },
    Confirmed: { title: 'Order Confirmed!', msg: 'Great! The canteen has confirmed your order.', bg: 'bg-blue-50 border-blue-200 text-blue-700' },
    Preparing: { title: 'Food Being Prepared!', msg: 'Your fresh Tamil food is being cooked right now.', bg: 'bg-orange-50 border-orange-200 text-orange-700' },
    Ready: { title: 'Ready for Pickup!', msg: 'Your food is ready at the counter. Please collect it!', bg: 'bg-green-100 border-green-200 text-green-800' },
    Completed: { title: 'Order Completed!', msg: 'Thank you! Enjoy your delicious Tamil food. Come again!', bg: 'bg-gray-100 border-gray-200 text-gray-700' },
    Cancelled: { title: 'Order Cancelled ✕', msg: 'This order was cancelled.', bg: 'bg-red-50 border-red-200 text-red-700' }
  };

  const { socket } = useSocket();

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  useEffect(() => {
    if (!order || !socket) return;

    // Listen to real-time status changed events
    const handleStatusChanged = (payload) => {
      if (payload.orderCode === order.orderCode) {
        console.log('Live status update received:', payload);
        setOrder((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: payload.status,
            paymentStatus: payload.paymentStatus || prev.paymentStatus
          };
        });
      }
    };

    socket.on('order:statusChanged', handleStatusChanged);

    return () => {
      socket.off('order:statusChanged', handleStatusChanged);
    };
  }, [order?.orderCode, socket]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await API.get(`/orders/${id}`);
      if (response.data?.success) {
        setOrder(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to locate order.');
    } finally {
      setLoading(false);
    }
  };

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
  const currentStepIndex = STATUS_ORDER.indexOf(currentStatus);
  const statusInfo = STATUS_INFO[currentStatus] || STATUS_INFO['Placed'];


  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-20">
      <h1 className="font-outfit font-black text-3xl text-primary-dark mb-8 flex items-center gap-2">
        <MapPin className="w-8 h-8 text-primary animate-bounce" /> Live Order Tracking
      </h1>

      {/* Code Header Box */}
      <div className="bg-gradient-to-br from-primary-darker to-primary rounded-3xl p-6 text-white mb-6 shadow-md relative overflow-hidden">
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
          <span className="bg-white/10 text-white/80 rounded-full px-3.5 py-1 text-xs font-bold">
            🍽 {order.items.length} Item(s)
          </span>
          <span className="bg-amber text-primary-darker rounded-full px-3.5 py-1 text-xs font-black">
            ₹{order.total}
          </span>
          <span className={`rounded-full px-3.5 py-1 text-xs font-bold ${
            order.paymentStatus === 'paid' ? 'bg-green-600 text-white' : 'bg-amber-dark text-white'
          }`}>
            {order.paymentStatus === 'paid' ? '✓ Paid Online' : '💵 Cash on Counter'}
          </span>
        </div>
      </div>

      {/* Live Status Message Banner */}
      <div className={`border rounded-2xl p-5 mb-8 flex items-center gap-4 ${statusInfo.bg}`}>
        <span className="text-4xl select-none">
          {currentStatus === 'Placed' ? '📋' : currentStatus === 'Confirmed' ? '✅' : currentStatus === 'Preparing' ? '👨‍🍳' : currentStatus === 'Ready' ? '🔔' : currentStatus === 'Cancelled' ? '✕' : '🎉'}
        </span>
        <div>
          <h3 className="font-outfit font-black text-base">{statusInfo.title}</h3>
          <p className="text-xs opacity-85 leading-relaxed mt-0.5">{statusInfo.msg}</p>
        </div>
        {currentStatus !== 'Completed' && currentStatus !== 'Cancelled' && (
          <span className="w-2.5 h-2.5 bg-amber rounded-full animate-ping ml-auto flex-shrink-0"></span>
        )}
      </div>

      {/* Stepper Timeline Panel */}
      {currentStatus !== 'Cancelled' && (
        <div className="bg-white border border-border p-6 md:p-8 rounded-3xl shadow-sm mb-8">
          <h3 className="font-outfit font-bold text-lg text-primary-dark mb-2">Tracking Progress</h3>
          <p className="text-muted text-xs mb-8">Updates dynamically as canteen updates orders.</p>

          <div className="relative pl-2.5">
            <div className="flex flex-col gap-6">
              {STEPS.map((step, idx) => {
                const done = idx < currentStepIndex;
                const active = idx === currentStepIndex;

                return (
                  <div key={step.key} className="flex items-start gap-4.5 relative">
                    {/* Connecting line to the next step marker (stops cleanly before the final Completed step) */}
                    {idx < STEPS.length - 1 && (
                      <div 
                        className={`absolute left-[17px] w-0.5 z-0 transition-colors duration-500 pointer-events-none ${
                          done ? 'bg-primary' : 'bg-gray-200'
                        }`}
                        style={{ top: '36px', bottom: '-24px' }}
                      />
                    )}

                    <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-500 relative z-10 flex-shrink-0 ${
                      done 
                        ? 'bg-primary border-primary text-white' 
                        : active 
                        ? 'bg-primary-darker border-primary-darker text-white animate-pulse ring-4 ring-primary-darker/10' 
                        : 'bg-white border-gray-200 text-gray-300'
                    }`}>
                      {done ? '✓' : step.icon}
                    </div>
                    <div className="flex-1 pt-1.5">
                      <h4 className={`text-sm font-bold transition-all ${
                        done ? 'text-primary' : active ? 'text-primary-darker' : 'text-gray-300'
                      }`}>
                        {step.name}
                      </h4>
                      <p className={`text-xs transition-all mt-0.5 ${
                        done ? 'text-green-600/70' : active ? 'text-muted' : 'text-gray-200'
                      }`}>
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
      <div className="bg-white border border-border p-6 md:p-8 rounded-3xl shadow-sm mb-8">
        <h3 className="font-outfit font-bold text-lg text-primary-dark mb-4 border-b border-border pb-3">Items Summary</h3>
        <div className="flex flex-col gap-4.5">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="text-xl select-none">{item.emoji}</span>
                <div>
                  <span className="font-bold text-primary-dark block leading-none mb-1">{item.name}</span>
                  <span className="text-[10px] text-muted font-semibold">₹{item.price} each</span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-muted font-bold text-xs">x{item.quantity}</span>
                <span className="font-mono font-bold text-primary-dark">₹{item.price * item.quantity}</span>
              </div>
            </div>
          ))}

          {order.discount > 0 && (
            <div className="flex justify-between text-xs text-primary font-bold pt-3.5 border-t border-border border-dashed">
              <span>🏷️ Coupon Discount</span>
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
      <div className="flex gap-4">
        <Link 
          to={`/bill/${order.orderCode}`}
          className="flex-1 bg-primary-dark hover:bg-primary text-white font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-primary/20 text-center flex items-center justify-center gap-2"
        >
          <Receipt className="w-4 h-4" />
          <span>View Receipt Bill</span>
        </Link>
        <Link 
          to="/menu"
          className="flex-1 bg-white border-2 border-border hover:border-primary text-primary-dark hover:text-primary font-bold py-3.5 rounded-2xl transition-all text-center flex items-center justify-center gap-2"
        >
          <span>Canteen Menu</span>
        </Link>
      </div>
    </div>
  );
};

export default Tracker;
