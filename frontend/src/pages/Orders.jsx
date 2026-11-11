import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import OrderSkeleton from '../components/skeletons/OrderSkeleton';
import { 
  ClipboardList, 
  MapPin, 
  Receipt, 
  Calendar, 
  Tag, 
  BadgeAlert, 
  ShoppingBag,
  Inbox
} from 'lucide-react';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed', 'cancelled'

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await API.get('/orders/my');
      if (response.data?.success) {
        setOrders(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch order history.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Placed': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Confirmed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Preparing': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'Completed': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'Cancelled': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const isOrderActive = (status) => {
    return ['Placed', 'Confirmed', 'Preparing', 'Ready'].includes(status);
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'active') return isOrderActive(order.status);
    if (filter === 'completed') return order.status === 'Completed';
    if (filter === 'cancelled') return order.status === 'Cancelled';
    return true; // 'all'
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 pb-20">
      <h1 className="font-outfit font-black text-3xl text-primary-dark mb-2">My Orders 📦</h1>
      <p className="text-muted text-sm mb-8">Track your active orders and view past billing receipts.</p>

      {/* Filter Tabs */}
      <div className="flex border-b border-border mb-8 gap-2 overflow-x-auto no-scrollbar">
        {[
          { key: 'all', label: 'All Orders' },
          { key: 'active', label: 'Active ⏰' },
          { key: 'completed', label: 'Completed ✓' },
          { key: 'cancelled', label: 'Cancelled ✕' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`pb-3.5 px-4 font-outfit font-bold text-sm border-b-2 transition-all whitespace-nowrap ${
              filter === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-primary-dark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <OrderSkeleton count={3} />
      ) : error ? (
        <div className="text-center py-16 bg-white border border-border rounded-3xl">
          <BadgeAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-outfit font-bold text-lg text-primary-dark mb-2">Error Loading Orders</h3>
          <p className="text-muted text-sm mb-6">{error}</p>
          <button onClick={fetchOrders} className="bg-primary-dark text-white font-bold px-6 py-2.5 rounded-xl hover:bg-primary transition-all">
            Retry
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white border border-border rounded-3xl">
          <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="font-outfit font-bold text-xl text-primary-dark mb-1">No orders found</h2>
          <p className="text-muted text-sm mb-6">You don't have any orders listed in this category.</p>
          <Link to="/menu" className="bg-primary-dark hover:bg-primary text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-primary/20">
            Browse Canteen Menu
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {filteredOrders.map((order) => (
            <div 
              key={order._id}
              className="bg-white border border-border rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
              {/* Card Header */}
              <div className="bg-primary-darker/90 px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-white">
                <div>
                  <span className="text-[10px] text-white/50 tracking-wider uppercase block">Pickup Token / Order</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-outfit font-black text-amber text-lg">
                      {order.pickupToken ? (String(order.pickupToken).startsWith('DRS-') ? order.pickupToken : `DRS-${order.pickupToken}`) : order.orderCode}
                    </span>
                    <span className="text-xs text-white/50 font-mono">({order.orderCode})</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/50 tracking-wider uppercase block">Order Date</span>
                  <span className="text-xs text-white/80 font-medium flex items-center gap-1.5 justify-end">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6">
                {/* Items List Summary */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {order.items.map((item, idx) => {
                    const isParcel = item.serviceType === 'PARCEL' || Number(item.parcelChargeTotal || 0) > 0;
                    return (
                      <span 
                        key={idx}
                        className={`border rounded-full pl-1.5 pr-3 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-2xs ${
                          isParcel
                            ? 'bg-amber-50 border-amber-200 text-stone-900'
                            : 'bg-gray-100 border-gray-200 text-text'
                        }`}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-5 h-5 rounded-full object-cover border border-border" />
                        ) : (
                          <span>{item.emoji}</span>
                        )}
                        <span>{item.name}</span>
                        <span className="text-muted font-bold ml-0.5">x{item.quantity}</span>
                        {isParcel && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded-full bg-amber text-stone-950">
                            Parcel{Number(item.parcelChargeTotal || 0) > 0 ? ` +₹${Number(item.parcelChargeTotal)}` : ''}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* Info row */}
                <div className="flex flex-wrap items-center justify-between border-t border-b border-border py-4.5 mb-6 gap-4">
                  <div>
                    <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-0.5">Amount Paid</span>
                    <span className="font-outfit font-black text-2xl text-primary-dark">₹{order.total}</span>
                    {Number(order.parcelChargeTotal || 0) > 0 && (
                      <span className="text-[10px] text-amber-dark font-bold block mt-0.5">
                        Includes ₹{Number(order.parcelChargeTotal)} parcel charge
                      </span>
                    )}
                    {order.discount > 0 && (
                      <span className="text-[10px] text-primary font-bold flex items-center gap-0.5 mt-0.5">
                        <Tag className="w-3 h-3" /> Saved ₹{order.discount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Status</span>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${getStatusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">Payment</span>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                        order.paymentStatus === 'paid'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : order.paymentStatus === 'cod'
                          ? 'bg-amber-light text-amber-dark border-amber-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        {order.paymentStatus === 'paid' ? 'Paid ✓' : order.paymentStatus === 'cod' ? 'Cash Counter' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Button */}
                <div className="flex flex-wrap gap-2.5">
                  <Link
                    to="/pickup"
                    className="flex-1 min-w-[140px] bg-amber hover:bg-amber-dark text-stone-950 text-xs font-black py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <span>🎟️ Pickup Token</span>
                  </Link>
                  {isOrderActive(order.status) && (
                    <Link
                      to={`/tracker/${order.orderCode}`}
                      className="flex-1 min-w-[130px] bg-primary-dark hover:bg-primary text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Track Status</span>
                    </Link>
                  )}
                  <Link
                    to={`/bill/${order.orderCode}`}
                    className="flex-1 min-w-[110px] bg-white border border-border hover:border-primary-dark text-primary-dark text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>View Bill</span>
                  </Link>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
