import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import { 
  Printer, 
  ChevronRight, 
  BadgeAlert, 
  Receipt,
  MapPin,
  UtensilsCrossed
} from 'lucide-react';

const Bill = () => {
  const { id } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await API.get(`/orders/${id}`);
      if (response.data?.success) {
        setOrder(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invoice failed to load.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-24 text-center print:hidden">
        <div className="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
        <span className="text-muted text-sm font-semibold">Generating invoice receipt...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center bg-white border border-border rounded-3xl mt-10 print:hidden">
        <BadgeAlert className="w-14 h-14 text-red-500 mx-auto mb-4" />
        <h3 className="font-outfit font-bold text-xl text-primary-dark mb-2">Invoice Error</h3>
        <p className="text-muted text-sm mb-6">{error || 'Could not verify billing details.'}</p>
        <Link to="/orders" className="bg-primary-dark text-white font-bold px-6 py-2.5 rounded-xl hover:bg-primary transition-all text-sm">
          My Orders
        </Link>
      </div>
    );
  }

  const isUPI = order.paymentMethod === 'razorpay' || order.paymentStatus === 'paid';

  return (
    <div className="max-w-xl mx-auto px-4 py-10 pb-20 print:p-0 print:my-0">
      
      {/* Print Page Header - Hidden on Print */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6 print:hidden">
        <span className="font-outfit font-black text-xl text-primary-dark flex items-center gap-1.5">
          <Receipt className="w-5 h-5 text-primary" /> Order Invoice
        </span>
        <button
          onClick={handlePrint}
          className="bg-amber hover:bg-amber-dark text-primary-darker font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 focus:outline-none"
        >
          <Printer className="w-4 h-4" />
          <span>Print Bill</span>
        </button>
      </div>

      {/* Bill Card Wrapper */}
      <div className="bg-white border border-border rounded-3xl shadow-lg overflow-hidden print:border-none print:shadow-none print:rounded-none">
        
        {/* Receipt Header Banner */}
        <div className="bg-gradient-to-br from-primary-darker to-primary px-8 py-8 text-center text-white relative">
          <span className="text-5xl block mb-2 select-none">🍛</span>
          <h2 className="font-outfit font-black text-2xl tracking-wide mb-0.5">DRS Canteen</h2>
          <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-4">DRS College of Engineering & Tech</p>
          
          <div className="inline-block bg-white/10 border border-white/20 font-mono font-bold text-amber text-2xl tracking-widest px-6 py-2 rounded-2xl mb-3">
            {order.orderCode}
          </div>
          
          <div className="block">
            <span className="bg-amber text-primary-darker rounded-full px-3.5 py-1 text-[11px] font-bold">
              {order.status}
            </span>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-8">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-y-4 gap-x-6 border-b border-border pb-6 mb-6 text-xs">
            <div>
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-0.5">Customer</span>
              <span className="font-bold text-primary-dark">{order.user?.name || 'Student'}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-0.5">Contact</span>
              <span className="font-medium text-primary-dark">{order.user?.email || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-0.5">Order Date</span>
              <span className="font-medium text-primary-dark">{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-0.5">Payment Method</span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold inline-block border ${
                isUPI
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-light text-amber-dark border-amber-200'
              }`}>
                {isUPI ? '✓ Paid Online' : '💵 Cash on Counter'}
              </span>
            </div>
          </div>

          {/* Items Table Header */}
          <h3 className="font-outfit font-bold text-sm text-primary-dark mb-3 flex items-center gap-1">
            <UtensilsCrossed className="w-4 h-4 text-primary" /> Order Details
          </h3>
          <div className="flex bg-cream px-4 py-2.5 rounded-xl text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
            <span className="flex-1">Item</span>
            <span className="w-12 text-center">Qty</span>
            <span className="w-16 text-right">Rate</span>
            <span className="w-18 text-right">Amount</span>
          </div>

          {/* Items Rows */}
          <div className="border border-border rounded-2xl overflow-hidden mb-6 divide-y divide-gray-100">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center px-4 py-3.5 text-xs">
                <span className="mr-2 text-lg select-none">{item.emoji}</span>
                <span className="flex-1 font-bold text-primary-dark">{item.name}</span>
                <span className="w-12 text-center text-muted font-bold">x{item.quantity}</span>
                <span className="w-16 text-right text-muted">₹{item.price}</span>
                <span className="w-18 text-right font-mono font-bold text-primary-dark">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          {/* Totals Calculations */}
          <div className="flex flex-col gap-2.5 text-xs pb-4 border-b border-border mb-4">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="font-semibold text-primary-dark">₹{order.subtotal || order.total}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-primary font-bold">
                <span>🏷️ Coupon Discount ({order.coupon})</span>
                <span>−₹{order.discount}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mb-6">
            <span className="font-outfit font-bold text-sm text-primary-dark">Grand Total</span>
            <span className="font-outfit font-black text-3xl text-primary-dark">₹{order.total}</span>
          </div>

          {/* Online transaction records details */}
          {order.paymentId && (
            <div className="bg-cream border border-border rounded-2xl p-4.5 mb-6 text-xs text-muted leading-relaxed font-medium">
              <span className="block font-bold text-primary-dark mb-1">💳 Razorpay Online Transaction</span>
              <div>Transaction ID: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-border">{order.paymentId}</span></div>
            </div>
          )}

          {/* Receipt Footer */}
          <div className="border-t-2 border-dashed border-border pt-6 text-center">
            <h4 className="font-outfit font-bold text-primary-dark text-base">Thank You! 🙏</h4>
            <p className="text-muted text-xs mt-1">Come again for more authentic Tamil food</p>
            <span className="text-[10px] text-gray-300 block mt-4 font-mono select-none">© DRS Smart Canteen</span>
          </div>

        </div>

      </div>

      {/* Action links back - Hidden on Print */}
      <div className="mt-6 flex gap-4 print:hidden">
        <Link 
          to={`/tracker/${order.orderCode}`}
          className="flex-1 bg-white border-2 border-border hover:border-primary-dark text-primary-dark hover:text-primary-dark font-bold text-xs py-3 px-4 rounded-xl transition-all text-center flex items-center justify-center gap-1"
        >
          <span>📍 Track Order</span>
        </Link>
        <Link 
          to="/menu"
          className="flex-1 bg-primary-dark hover:bg-primary text-white font-bold text-xs py-3 px-4 rounded-xl transition-all text-center flex items-center justify-center gap-1"
        >
          <span>🍽 Order Again</span>
        </Link>
      </div>

    </div>
  );
};

export default Bill;
