import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Activity,
  ClipboardList,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  Eye,
  Receipt,
  Trash2,
  ChevronRight,
  ArrowRight,
  User,
  Mail,
  Phone,
  CreditCard,
  Tag,
  Sparkles,
  Inbox,
  Filter,
  Check,
  Flame,
  ChefHat,
  BellRing,
  ExternalLink,
} from 'lucide-react';

const STATUS_PIPELINE = ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Pickup Bill'];

const LiveTracking = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Socket connection status: 'connected' | 'reconnecting' | 'disconnected'
  const [socketStatus, setSocketStatus] = useState('connecting');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'Placed', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled', 'all'
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all', 'cod', 'razorpay'

  // Audio & Toast alerts
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Selected Order for Details Drawer / Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Updating action state
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Audio Context Ref
  const audioCtxRef = useRef(null);

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    setSocketStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  useEffect(() => {
    fetchActiveOrders();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Real-time: New Order Created
    const handleCreated = (newOrder) => {
      console.log('Incoming live order event:', newOrder?.orderCode);
      if (!newOrder || !newOrder._id) return;
      // Only active online orders belong in the Kitchen Live Queue
      if (newOrder.orderType === 'WALK_IN' || newOrder.status === 'Completed') return;

      setOrders((prev) => {
        if (prev.some((o) => o._id === newOrder._id || o.orderCode === newOrder.orderCode)) {
          return prev;
        }
        return [newOrder, ...prev];
      });

      playChime();
      showToast(`🔔 New Order #${newOrder.orderCode} received! (₹${newOrder.total})`);
    };

    // Real-time: Order Status Updated
    const handleUpdated = (updatedOrder) => {
      if (!updatedOrder) return;
      setOrders((prev) =>
        prev.map((o) => (o.orderCode === updatedOrder.orderCode ? updatedOrder : o))
      );
      setSelectedOrder((prev) =>
        prev && prev.orderCode === updatedOrder.orderCode ? updatedOrder : prev
      );
    };

    const handleStatusChanged = (payload) => {
      if (!payload || !payload.orderCode) return;
      setOrders((prev) =>
        prev.map((o) => {
          if (o.orderCode === payload.orderCode) {
            return {
              ...o,
              status: payload.status,
              paymentStatus: payload.paymentStatus || o.paymentStatus,
              ...(payload.order || {}),
            };
          }
          return o;
        })
      );
    };

    socket.on('order:created', handleCreated);
    socket.on('order:updated', handleUpdated);
    socket.on('order:statusChanged', handleStatusChanged);

    return () => {
      socket.off('order:created', handleCreated);
      socket.off('order:updated', handleUpdated);
      socket.off('order:statusChanged', handleStatusChanged);
    };
  }, [socket]);

  const fetchActiveOrders = async () => {
    try {
      setLoading(true);
      setError('');
      // Request active orders first; fallback to all orders if active filter endpoint fails
      const res = await API.get('/orders/active');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setOrders(res.data.data);
      } else {
        // Fallback to /orders
        const fallbackRes = await API.get('/orders?limit=100');
        if (fallbackRes.data?.success && Array.isArray(fallbackRes.data.data)) {
          setOrders(fallbackRes.data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching live orders:', err);
      // Try fallback endpoint
      try {
        const fallbackRes = await API.get('/orders/admin/list?limit=100');
        if (fallbackRes.data?.success && Array.isArray(fallbackRes.data.data)) {
          setOrders(fallbackRes.data.data);
          return;
        }
      } catch (fErr) {
        setError(err.response?.data?.message || 'Unable to synchronize active orders.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Safe sound synthesizer
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn('Audio playback not allowed without user interaction:', e);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Live order pipeline counts
  const pipelineCounts = useMemo(() => {
    const counts = {
      Placed: 0,
      Confirmed: 0,
      Preparing: 0,
      Ready: 0,
      Completed: 0,
      Cancelled: 0,
      activeTotal: 0,
    };

    orders.forEach((o) => {
      if (counts[o.status] !== undefined) {
        counts[o.status] += 1;
      }
      if (['Placed', 'Confirmed', 'Preparing', 'Ready'].includes(o.status)) {
        counts.activeTotal += 1;
      }
    });

    return counts;
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Status Filter
      if (statusFilter === 'active') {
        if (!['Placed', 'Confirmed', 'Preparing', 'Ready'].includes(order.status)) {
          return false;
        }
      } else if (statusFilter !== 'all') {
        if (order.status !== statusFilter) return false;
      }

      // 2. Payment Filter
      if (paymentFilter !== 'all') {
        if (order.paymentMethod !== paymentFilter) return false;
      }

      // 3. Search Query (orderCode, customer name, email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = order.orderCode?.toLowerCase().includes(q);
        const nameMatch = order.user?.name?.toLowerCase().includes(q);
        const emailMatch = order.user?.email?.toLowerCase().includes(q);
        const itemMatch = order.items?.some((i) => i.name?.toLowerCase().includes(q));

        if (!codeMatch && !nameMatch && !emailMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, paymentFilter, searchQuery]);

  // Advance to next stage in pipeline
  const getNextStage = (currentStatus) => {
    switch (currentStatus) {
      case 'Placed':
        return { stage: 'Confirmed', label: 'Confirm Order', color: 'bg-blue-600 hover:bg-blue-700' };
      case 'Confirmed':
        return { stage: 'Preparing', label: 'Start Preparing', color: 'bg-amber-600 hover:bg-amber-700' };
      case 'Preparing':
        return { stage: 'Ready', label: 'Mark as Ready', color: 'bg-green-600 hover:bg-green-700' };
      case 'Ready':
        return { stage: 'Pickup Bill', label: 'Move to Pickup Bill', color: 'bg-[#0b3d2e] hover:bg-[#1a7a45]' };
      default:
        return null;
    }
  };

  const handleUpdateStatus = async (orderCode, newStatus) => {
    setActionLoadingId(orderCode);
    try {
      const res = await API.patch(`/orders/${orderCode}/status`, { status: newStatus });
      if (res.data?.success) {
        setOrders((prev) =>
          prev.map((o) => (o.orderCode === orderCode ? { ...o, status: newStatus } : o))
        );
        if (newStatus === 'Pickup Bill') {
          showToast(`✓ Order #${orderCode} moved to Pickup Bill (Available in Handover Queue)`);
        } else {
          showToast(`✓ Order #${orderCode} moved to ${newStatus}`);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelOrder = async (orderCode) => {
    if (!confirm(`Are you sure you want to cancel order ${orderCode}?`)) return;
    setActionLoadingId(orderCode);
    try {
      const res = await API.patch(`/orders/${orderCode}/cancel`);
      if (res.data?.success) {
        setOrders((prev) =>
          prev.map((o) => (o.orderCode === orderCode ? { ...o, status: 'Cancelled' } : o))
        );
        showToast(`✓ Order ${orderCode} was cancelled.`);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Format relative time helper
  const formatOrderTime = (dateStr) => {
    if (!dateStr) return 'Just now';
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Placed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Confirmed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Preparing':
        return 'bg-amber-light text-amber-dark border-amber-300';
      case 'Ready':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Pickup Bill':
        return 'bg-amber-100 text-amber-900 border-amber-400 font-extrabold';
      case 'Handover Bill':
      case 'Completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
      case 'Cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-28 font-inter text-text">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-primary-darker text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <BellRing className="w-5 h-5 text-amber animate-bounce flex-shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Connection Indicator (Section 5 & Section 20) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="bg-primary/10 border border-primary/25 text-primary text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Kitchen Operations Hub
            </span>

            {/* Section 20: Real-Time Connection Indicator */}
            {socketStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-0.5 rounded-full text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>🟢 Live Connected</span>
              </span>
            ) : socketStatus === 'reconnecting' ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-0.5 rounded-full text-[10px] font-bold">
                <RefreshCw className="w-3 h-3 text-amber animate-spin" />
                <span>🟡 Reconnecting...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-0.5 rounded-full text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>🔴 Offline</span>
              </span>
            )}
          </div>

          <h1 className="font-outfit font-black text-3xl md:text-4xl text-primary-dark tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-9 h-9 text-primary" /> Live Order Tracking
          </h1>
          <p className="text-muted text-xs md:text-sm mt-0.5">
            Monitor incoming orders, transition preparation stages, and dispatch food in real time.
          </p>
        </div>

        {/* Action Controls Header */}
        <div className="flex items-center gap-2.5">
          {/* Sound alert toggle button */}
          <button
            onClick={() => {
              setSoundEnabled((prev) => !prev);
              if (!soundEnabled) playChime();
            }}
            className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
              soundEnabled
                ? 'bg-amber-light/60 border-amber text-primary-darker'
                : 'bg-white border-border text-muted hover:text-primary-dark'
            }`}
            title={soundEnabled ? 'Chime sound is ON' : 'Chime sound is MUTED'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-dark" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Alerts ON' : 'Muted'}</span>
          </button>

          <Link
            to="/pickup-display"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2.5 rounded-2xl bg-primary-dark hover:bg-primary text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            title="Open Public Counter Pickup Screen in new tab"
          >
            <span>📺 Counter TV</span>
            <ExternalLink className="w-3.5 h-3.5 text-amber" />
          </Link>

          <button
            onClick={fetchActiveOrders}
            className="p-2.5 bg-white hover:bg-gray-50 border border-border text-primary-dark rounded-2xl transition-all shadow-sm"
            title="Refresh order list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Section 21: Live Order Pipeline Statistics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mb-8">
        {[
          {
            key: 'Placed',
            label: '1. Placed',
            count: pipelineCounts.Placed,
            bg: 'bg-rose-50/60 border-rose-200/80',
            text: 'text-rose-700',
            icon: <ClipboardList className="w-4 h-4 text-rose-600" />,
          },
          {
            key: 'Confirmed',
            label: '2. Confirmed',
            count: pipelineCounts.Confirmed,
            bg: 'bg-blue-50/60 border-blue-200/80',
            text: 'text-blue-700',
            icon: <Check className="w-4 h-4 text-blue-600" />,
          },
          {
            key: 'Preparing',
            label: '3. Preparing',
            count: pipelineCounts.Preparing,
            bg: 'bg-amber-light/40 border-amber-200',
            text: 'text-amber-dark',
            icon: <ChefHat className="w-4 h-4 text-amber" />,
          },
          {
            key: 'Ready',
            label: '4. Ready for Pickup',
            count: pipelineCounts.Ready,
            bg: 'bg-green-50/70 border-green-200',
            text: 'text-green-700',
            icon: <BellRing className="w-4 h-4 text-green-600" />,
          },
          {
            key: 'active',
            label: 'Total Active Queue',
            count: pipelineCounts.activeTotal,
            bg: 'bg-primary-dark text-white border-primary-dark',
            text: 'text-amber',
            icon: <Flame className="w-4 h-4 text-amber" />,
          },
        ].map((item, idx) => (
          <div
            key={idx}
            onClick={() => setStatusFilter(item.key)}
            className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${item.bg} ${
              statusFilter === item.key ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-75">
                {item.label}
              </span>
              {item.icon}
            </div>
            <span className={`font-outfit font-black text-2xl md:text-3xl leading-none ${item.text}`}>
              {item.count}
            </span>
          </div>
        ))}
      </div>

      {/* Section 22 & 23: Search and Filter Bar */}
      <div className="bg-white border border-border p-4 md:p-5 rounded-3xl shadow-sm mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code (e.g. DRS-3420), customer, email..."
            className="w-full bg-cream border border-border focus:border-primary rounded-xl py-2.5 pl-10 pr-8 text-xs focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-cream border border-border rounded-xl py-2 px-3 text-xs font-bold text-primary-dark focus:outline-none focus:border-primary"
          >
            <option value="active">Active Orders (Queue)</option>
            <option value="Placed">Placed Orders Only</option>
            <option value="Confirmed">Confirmed Orders Only</option>
            <option value="Preparing">Preparing Orders Only</option>
            <option value="Ready">Ready for Collection</option>
            <option value="Completed">Completed Orders</option>
            <option value="Cancelled">Cancelled Orders</option>
            <option value="all">All Orders History</option>
          </select>

          {/* Payment method selector */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-cream border border-border rounded-xl py-2 px-3 text-xs font-bold text-primary-dark focus:outline-none focus:border-primary"
          >
            <option value="all">All Payments</option>
            <option value="cod">Cash on Pickup (COD)</option>
            <option value="razorpay">Online Razorpay</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        /* Section 17: Safe Loading State */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white border border-border rounded-3xl p-6 shadow-sm flex flex-col gap-4 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 w-24 bg-gray-200 rounded-lg" />
                <div className="h-4 w-16 bg-gray-200 rounded-lg" />
              </div>
              <div className="h-10 w-full bg-gray-100 rounded-xl" />
              <div className="h-20 w-full bg-gray-100 rounded-xl" />
              <div className="h-8 w-full bg-gray-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Section 19: Error State with Retry Button */
        <div className="bg-white border border-border rounded-3xl p-10 text-center max-w-lg mx-auto shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="font-outfit font-bold text-lg text-primary-dark mb-1">
            Unable to Synchronize Live Orders
          </h3>
          <p className="text-muted text-xs mb-5">{error}</p>
          <button
            onClick={fetchActiveOrders}
            className="bg-primary hover:bg-primary-dark text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        /* Section 18: Safe Empty State (No ReferenceError, safely imported icons) */
        <div className="bg-white border border-border rounded-3xl p-12 text-center max-w-md mx-auto shadow-sm">
          <div className="w-16 h-16 bg-cream rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🛵
          </div>
          <h2 className="font-outfit font-bold text-lg text-primary-dark mb-1">
            No Active Orders
          </h2>
          <p className="text-muted text-xs leading-relaxed mb-4">
            There are currently no orders matching your selected filters.
            <br />
            New orders placed by students will appear here automatically in real time.
          </p>
          {(statusFilter !== 'active' || searchQuery || paymentFilter !== 'all') && (
            <button
              onClick={() => {
                setStatusFilter('active');
                setSearchQuery('');
                setPaymentFilter('all');
              }}
              className="text-primary font-bold text-xs underline"
            >
              Reset to Active Orders Queue
            </button>
          )}
        </div>
      ) : (
        /* Section 8: Active Order Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
            const nextStage = getNextStage(order.status);
            const customerName = order.user?.name || 'Customer';
            const customerEmail = order.user?.email || 'Student Account';
            const customerPhone = order.user?.phone || '';
            const relativeTime = formatOrderTime(order.createdAt);
            const isProcessing = actionLoadingId === order.orderCode;

            return (
              <div
                key={order._id}
                className={`bg-white border-2 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col ${
                  order.status === 'Placed'
                    ? 'border-rose-300'
                    : order.status === 'Confirmed'
                    ? 'border-blue-300'
                    : order.status === 'Preparing'
                    ? 'border-amber-300'
                    : order.status === 'Ready'
                    ? 'border-green-400'
                    : 'border-border'
                }`}
              >
                {/* Card Top Header */}
                <div className="bg-primary-darker px-5 py-3.5 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber text-base tracking-wider">
                      #{order.orderCode}
                    </span>
                    <span className="bg-amber/20 border border-amber/40 text-amber text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                      TOKEN: {order.pickupToken ? (String(order.pickupToken).startsWith('DRS-') ? order.pickupToken : `DRS-${order.pickupToken}`) : order.orderCode}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber animate-ping" />
                  </div>
                  <div className="flex items-center gap-1.5 text-white/60 text-[10px] font-bold">
                    <Clock className="w-3 h-3 text-amber" />
                    <span>{relativeTime}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  {/* Customer row */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-light text-primary-dark font-black text-xs flex items-center justify-center shadow-xs">
                        {customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-xs font-bold text-primary-dark block leading-tight">
                            {customerName}
                          </strong>
                          {order.user?.accountType === 'STAFF' || order.user?.role === 'STAFF' ? (
                            <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md border border-blue-200">
                              💼 Staff {order.user.staffDetails?.staffId ? `(${order.user.staffDetails.staffId})` : ''}
                            </span>
                          ) : (
                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md border border-emerald-200">
                              🎓 Student {order.user?.studentDetails?.department ? `• ${order.user.studentDetails.department}` : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted block leading-tight mt-0.5">
                          {customerEmail}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  {/* Line Items List with Thumbnails */}
                  <div className="flex flex-col gap-1.5 mb-4">
                    {order.items?.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2.5 bg-cream/70 rounded-xl border border-border/50"
                      >
                        <div className="flex items-center gap-2">
                          {it.image ? (
                            <img
                              src={it.image}
                              alt={it.name}
                              className="w-6 h-6 rounded-lg object-cover border border-border"
                            />
                          ) : (
                            <span className="text-sm">{it.emoji || '🍛'}</span>
                          )}
                          <span className="font-bold text-primary-dark line-clamp-1 max-w-[150px]">
                            {it.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-amber-dark font-black text-[11px]">
                            x{it.quantity}
                          </span>
                          <span className="font-outfit font-bold text-primary-dark text-xs">
                            ₹{it.price * it.quantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total & Payment Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 mb-4 text-xs font-semibold">
                    <div>
                      <span className="text-[9px] text-muted uppercase font-bold tracking-wider block">
                        Total Amount
                      </span>
                      <span className="font-outfit font-black text-lg text-primary-dark">
                        ₹{order.total}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-muted uppercase font-bold tracking-wider block">
                        Payment
                      </span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          order.paymentStatus === 'paid'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-amber-light text-amber-dark border-amber-300'
                        }`}
                      >
                        {order.paymentMethod === 'cod' ? 'Cash Counter' : 'Online Razorpay'} (
                        {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'})
                      </span>
                    </div>
                  </div>

                  {/* Section 9: Next Stage Progress Button */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                    {nextStage ? (
                      <button
                        onClick={() => handleUpdateStatus(order.orderCode, nextStage.stage)}
                        disabled={isProcessing}
                        className={`w-full text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50 ${nextStage.color}`}
                      >
                        <span>{nextStage.label}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-center text-[11px] font-bold text-muted py-1 bg-gray-100 rounded-xl">
                        Order Process Completed
                      </span>
                    )}

                    {/* Secondary Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-primary hover:text-primary-dark font-bold text-[11px] flex items-center gap-1 py-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Details
                      </button>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/bill/${order.orderCode}`}
                          target="_blank"
                          className="text-muted hover:text-primary-dark font-bold text-[11px] flex items-center gap-0.5"
                        >
                          <Receipt className="w-3 h-3" /> Bill
                        </Link>

                        {order.status !== 'Completed' && order.status !== 'Cancelled' && (
                          <button
                            onClick={() => handleCancelOrder(order.orderCode)}
                            className="text-red-500 hover:text-red-700 font-bold text-[11px]"
                            title="Cancel this order"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section 24: Order Details Modal / Drawer with Visual Status Timeline */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="bg-primary-darker px-6 py-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-white/50 uppercase tracking-wider block">
                  Order Details
                </span>
                <h3 className="font-mono font-bold text-amber text-xl">
                  #{selectedOrder.orderCode}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              {/* Visual Status Timeline */}
              <div>
                <span className="text-[10px] font-extrabold uppercase text-muted tracking-wider block mb-3">
                  Progress Timeline
                </span>
                <div className="flex items-center justify-between relative px-2">
                  <div className="absolute left-6 right-6 top-3 h-0.5 bg-gray-200 -z-0" />
                  {STATUS_PIPELINE.map((step, idx) => {
                    const currentIndex = (selectedOrder.status === 'Handover Bill' || selectedOrder.status === 'Completed')
                      ? 5
                      : STATUS_PIPELINE.indexOf(selectedOrder.status);
                    const isDone = currentIndex >= idx;
                    const isCurrent = selectedOrder.status === step;

                    return (
                      <div key={step} className="flex flex-col items-center relative z-10">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                            isCurrent
                              ? 'bg-primary text-white ring-4 ring-primary-light scale-110'
                              : isDone
                              ? 'bg-primary text-white'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span
                          className={`text-[9px] mt-1 font-bold ${
                            isCurrent ? 'text-primary' : isDone ? 'text-primary-dark' : 'text-gray-400'
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Customer Info Card */}
              <div className="bg-cream/70 border border-border p-4 rounded-2xl flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span className="font-bold text-primary-dark">
                    {selectedOrder.user?.name || 'Walkin Student'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <span>{selectedOrder.user?.email || 'N/A'}</span>
                </div>
                {selectedOrder.user?.phone && (
                  <div className="flex items-center gap-2 text-muted">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    <span>{selectedOrder.user?.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted pt-1 border-t border-border/50 text-[10px]">
                  <Clock className="w-3 h-3 text-primary" />
                  <span>
                    Placed on: {new Date(selectedOrder.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <span className="text-[10px] font-extrabold uppercase text-muted tracking-wider block mb-2">
                  Ordered Items ({selectedOrder.items?.length || 0})
                </span>
                <div className="flex flex-col gap-2">
                  {selectedOrder.items?.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        {it.image ? (
                          <img
                            src={it.image}
                            alt={it.name}
                            className="w-8 h-8 rounded-lg object-cover border border-border"
                          />
                        ) : (
                          <span className="text-xl">{it.emoji || '🍛'}</span>
                        )}
                        <div>
                          <strong className="block text-primary-dark leading-tight">
                            {it.name}
                          </strong>
                          <span className="text-[10px] text-muted">
                            ₹{it.price} each
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-dark mr-2">
                          x{it.quantity}
                        </span>
                        <span className="font-outfit font-black text-primary-dark">
                          ₹{it.price * it.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bill Financials */}
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col gap-2 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{selectedOrder.subtotal}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-primary font-bold">
                    <span>Coupon Discount ({selectedOrder.coupon || 'PROMO'}):</span>
                    <span className="font-mono">-₹{selectedOrder.discount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-sm font-bold text-primary-dark">
                  <span>Total Amount Paid:</span>
                  <span className="font-outfit font-black text-lg text-primary">
                    ₹{selectedOrder.total}
                  </span>
                </div>
              </div>

              {/* Status Change Buttons */}
              <div>
                <span className="text-[10px] font-extrabold uppercase text-muted tracking-wider block mb-2">
                  Transition Status Directly
                </span>
                <div className="flex flex-wrap gap-2">
                  {STATUS_PIPELINE.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleUpdateStatus(selectedOrder.orderCode, s)}
                      disabled={selectedOrder.status === s}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        selectedOrder.status === s
                          ? 'bg-primary-dark text-white border-primary-dark'
                          : 'bg-white text-muted border-border hover:border-primary hover:text-primary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-border flex items-center justify-between">
              <Link
                to={`/bill/${selectedOrder.orderCode}`}
                target="_blank"
                className="bg-amber hover:bg-amber-dark text-primary-darker font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Open Tax Invoice Bill</span>
              </Link>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-xs font-bold text-muted hover:text-primary-dark px-3 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTracking;
