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

  // ================= LIVE PICKUP TOKEN & ORDER SEARCH =================
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchHasQueried, setSearchHasQueried] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchAbortRef = useRef(null);
  const searchDebounceRef = useRef(null);

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

    const handleOrderUpdate = (data) => {
      // Refresh list smoothly without full spinner to preserve counter operator focus
      fetchOrders(false);

      // If a specific order was handed over, update it in searchResults too
      if (data?.orderId) {
        setSearchResults((prev) =>
          prev.map((ord) => {
            if (ord._id === data.orderId) {
              return {
                ...ord,
                status: 'Handover Bill',
                handoverVerified: true,
                eligibility: 'already_handed_over',
                eligibilityMessage: 'Food already handed over. Do not hand over food again.',
              };
            }
            return ord;
          })
        );
      }
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

  // ================= LIVE SEARCH LOGIC =================
  const executeLiveSearch = useCallback(async (query) => {
    const clean = query.trim().replace(/^#/, '');
    if (!clean) {
      setSearchResults([]);
      setSearchHasQueried(false);
      setIsSearching(false);
      setSearchError('');
      return;
    }

    // Cancel prior in-flight search request
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    try {
      setIsSearching(true);
      setSearchError('');

      const res = await API.get('/admin/pos/handover-search', {
        params: { q: clean },
        signal: controller.signal,
      });

      if (res.data?.success) {
        const results = res.data.data || [];
        setSearchResults(results);
        setSearchHasQueried(true);

        // Sound chime for exact 1 match if eligible
        if (results.length === 1 && results[0].eligibility === 'eligible') {
          playSound(true);
        } else if (results.length === 1 && results[0].eligibility === 'already_handed_over') {
          playSound(false);
        }
      }
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.message === 'canceled') {
        return;
      }
      console.error('Handover live search error:', err);
      setSearchError(err.response?.data?.message || 'Search failed. Please try again.');
      setSearchResults([]);
      setSearchHasQueried(true);
    } finally {
      setIsSearching(false);
    }
  }, [playSound]);

  // Debounced search input handler (250ms)
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      setSearchResults([]);
      setSearchHasQueried(false);
      setIsSearching(false);
      setSearchError('');
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      executeLiveSearch(value);
    }, 250);
  };

  const handleClearSearch = () => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    setSearchInput('');
    setSearchResults([]);
    setSearchHasQueried(false);
    setIsSearching(false);
    setSearchError('');
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      executeLiveSearch(searchInput);
    }
  };

  // Cleanup debounce & abort on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, []);

  // Open confirmation modal for handover
  const handleStartHandover = (order) => {
    if (!order) return;
    setConfirmModal({
      isOpen: true,
      order,
    });
  };

  // Confirm handover (Status -> 'Handover Bill')
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

        // Update matching search result in state if live search is active
        setSearchResults((prevResults) =>
          prevResults.map((ord) => {
            if (ord._id === targetOrder._id) {
              return {
                ...ord,
                ...updatedOrder,
                status: 'Handover Bill',
                handoverVerified: true,
                handoverVerifiedAt: updatedOrder.handoverVerifiedAt || new Date().toISOString(),
                completedAt: updatedOrder.completedAt || new Date().toISOString(),
                eligibility: 'already_handed_over',
                eligibilityMessage: `Food already handed over. Order #${updatedOrder.orderCode} (Token #${updatedOrder.pickupToken || updatedOrder.orderCode}) has been collected.`,
              };
            }
            return ord;
          })
        );

        // Refresh orders list and stats
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

  // ================= REUSABLE ORDER CARD RENDERER =================
  const renderOrderCard = (order, isSearchResult = false) => {
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

    // Determine eligibility banner for search results
    const eligibility = order.eligibility || (
      isHandoverCompleted ? 'already_handed_over' :
      isCancelled ? 'cancelled' :
      isEligibleForHandover ? 'eligible' :
      'not_ready'
    );

    return (
      <div
        key={order._id}
        className={`bg-white rounded-2xl border-2 transition-all p-4 flex flex-col justify-between gap-3.5 relative overflow-hidden shadow-xs hover:shadow-md ${
          isHandoverCompleted
            ? 'border-emerald-200 bg-emerald-50/15'
            : isCancelled
            ? 'border-stone-300 bg-stone-50 opacity-75'
            : isEligibleForHandover
            ? 'border-emerald-400/90 hover:border-emerald-600 bg-white'
            : 'border-stone-200 hover:border-[#0b3d2e]'
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

            {/* Status Badge (Default Tab View) */}
            {!isSearchResult && (
              isHandoverCompleted ? (
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
              )
            )}
          </div>
        </div>

        {/* PROMINENT ELIGIBILITY STATUS BANNER (FOR SEARCH RESULTS) */}
        {isSearchResult && (
          <div>
            {eligibility === 'already_handed_over' && (
              <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 text-red-950">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="bg-red-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                      ⛔ ALREADY COLLECTED
                    </span>
                    <h4 className="font-outfit font-black text-sm text-red-900 mt-1">
                      Food Already Collected
                    </h4>
                    <p className="text-[11px] text-red-800 font-semibold mt-0.5">
                      {order.eligibilityMessage || 'This pickup token has already been marked as collected.'}
                    </p>
                    <p className="text-[10px] text-red-700 font-bold mt-1">
                      ⛔ DO NOT HAND OVER FOOD AGAIN.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {eligibility === 'cancelled' && (
              <div className="bg-stone-100 border-2 border-stone-400 rounded-xl p-3 text-stone-900">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-stone-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="bg-stone-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                      ⚠ ORDER CANCELLED
                    </span>
                    <h4 className="font-outfit font-black text-sm text-stone-900 mt-1">
                      Order Cannot Be Handed Over
                    </h4>
                    <p className="text-[11px] text-stone-700 mt-0.5">
                      {order.eligibilityMessage || 'This order was cancelled.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {eligibility === 'not_ready' && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 text-amber-950">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="bg-amber-500 text-stone-950 font-black text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                      ⏳ KITCHEN IN PROGRESS
                    </span>
                    <h4 className="font-outfit font-black text-sm text-amber-950 mt-1">
                      Food Still Being Prepared
                    </h4>
                    <p className="text-[11px] text-amber-900 mt-0.5">
                      {order.eligibilityMessage || `Current status: "${order.status}". Waiting for kitchen to finish preparation.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {eligibility === 'eligible' && (
              <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3 text-emerald-950">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="bg-emerald-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                      ✓ READY FOR PICKUP
                    </span>
                    <h4 className="font-outfit font-black text-sm text-emerald-950 mt-1">
                      Food Ready For Collection
                    </h4>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      {order.eligibilityMessage || 'Verified and ready for physical food handover.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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

        {/* COD Unpaid Warning Alert */}
        {isCodUnpaid && (
          <div className="bg-red-50 border-2 border-red-500 rounded-xl p-2.5 text-red-900 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-black text-xs">COLLECT CASH PAYMENT</strong>
              <span className="text-[11px]">
                Collect <strong>₹{Number(order.total || 0).toFixed(2)}</strong> in cash before handing over food trays!
              </span>
            </div>
          </div>
        )}

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

        {/* Handover Completed Metadata Box */}
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
        <div className="pt-1 flex items-center gap-2">
          {/* Always Available: Reprint Thermal Bill */}
          <button
            type="button"
            onClick={() => setReceiptModal({ isOpen: true, order, autoPrint: false })}
            className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs py-2.5 px-3 rounded-xl transition border border-stone-300 min-h-[44px]"
            title="Reprint thermal receipt bill"
          >
            <Printer className="w-3.5 h-3.5 text-stone-600" />
            <span>Reprint Thermal Bill</span>
          </button>

          {/* Handover Food action or status badge */}
          {isEligibleForHandover ? (
            <button
              type="button"
              onClick={() => handleStartHandover(order)}
              className="flex-1 flex items-center justify-center gap-2 bg-[#0b3d2e] hover:bg-[#135943] active:scale-95 text-white font-black text-xs py-2.5 px-3 rounded-xl shadow-xs transition min-h-[44px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Handover Food</span>
            </button>
          ) : isHandoverCompleted ? (
            <div className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-100/70 border border-emerald-300 text-emerald-800 font-bold text-xs py-2.5 px-3 rounded-xl min-h-[44px]">
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Handed Over</span>
            </div>
          ) : isCancelled ? (
            <div className="flex-1 flex items-center justify-center bg-stone-200 text-stone-500 font-bold text-xs py-2.5 px-3 rounded-xl min-h-[44px]">
              <span>Cancelled</span>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-amber-100/70 text-amber-800 font-bold text-xs py-2.5 px-3 rounded-xl min-h-[44px]">
              <span>In Kitchen</span>
            </div>
          )}
        </div>

      </div>
    );
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

        {/* ================= SECTION 1: PHYSICAL BILL & TOKEN VERIFICATION WORKFLOW ================= */}
        <section aria-labelledby="verification-heading" className="bg-white rounded-3xl shadow-xs border border-stone-200 p-5 sm:p-7">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0b3d2e] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Physical Bill & Token Verification
              </span>
              <h2 id="verification-heading" className="font-outfit font-black text-xl sm:text-2xl text-stone-900 mt-1.5">
                Live Pickup Token Search
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Type or scan customer token # (e.g. <strong>K7P2</strong>), order ID, or customer details. Results update instantly.
              </p>
            </div>

            {/* Verification Search Bar (Live Debounced Input with No Submit Button) */}
            <div className="relative w-full mt-4">
              <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Enter 4-character token (e.g. K7P2), order ID, or customer name..."
                value={searchInput}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-12 pr-12 py-3.5 bg-stone-50 border-2 border-stone-200 rounded-2xl text-sm sm:text-base font-bold font-mono tracking-wider focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
                autoFocus
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {isSearching && (
                  <div className="w-4 h-4 border-2 border-[#0b3d2e] border-t-transparent rounded-full animate-spin" />
                )}
                {searchInput && !isSearching && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-stone-400 hover:text-stone-600 p-1"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ================= LIVE SEARCH RESULTS (Immediately below search input, above Tabs) ================= */}
          {searchInput.trim().length > 0 && (
            <div className="mt-6 pt-5 border-t border-stone-200 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-[#0b3d2e] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-emerald-700" />
                    Live Search Results
                  </span>
                  {isSearching && (
                    <span className="text-xs text-stone-500 font-medium flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-[#0b3d2e] border-t-transparent rounded-full animate-spin" />
                      Searching database...
                    </span>
                  )}
                  {!isSearching && searchHasQueried && (
                    <span className="text-xs text-stone-500 font-bold">
                      {searchResults.length} match{searchResults.length === 1 ? '' : 'es'} found for "{searchInput}"
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-xs font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-stone-100 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Results</span>
                </button>
              </div>

              {searchError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-900 text-xs flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {searchHasQueried && !isSearching && searchResults.length === 0 ? (
                <div className="bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 p-8 text-center max-w-xl mx-auto">
                  <div className="w-12 h-12 rounded-full bg-stone-200/70 text-stone-500 flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                    🔍
                  </div>
                  <h4 className="font-outfit font-black text-stone-800 text-sm">
                    No matching pickup token or order found
                  </h4>
                  <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                    No active or completed orders match "{searchInput}". Please double-check the customer's token or receipt.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {searchResults.map((order) => renderOrderCard(order, true))}
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
              {orders.map((order) => renderOrderCard(order, false))}
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