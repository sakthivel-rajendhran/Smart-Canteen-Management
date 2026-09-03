import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import { 
  Trash2, 
  ShoppingCart, 
  Tag, 
  CreditCard, 
  Wallet, 
  AlertCircle, 
  X, 
  CheckCircle2, 
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

const Cart = () => {
  const { 
    cart, 
    coupon, 
    couponError, 
    subtotal, 
    discount, 
    total, 
    changeQuantity, 
    removeFromCart, 
    clearCart,
    applyCouponCode,
    removeCoupon,
    validateCartStock
  } = useCart();

  const { user } = useAuth();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' or 'razorpay'
  
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [successOrderCode, setSuccessOrderCode] = useState('');

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    try {
      await applyCouponCode(couponInput.trim());
      setCouponInput('');
    } catch (e) {
      // Handled by context state
    }
  };

  const handlePlaceOrder = async () => {
    setCheckoutError('');
    setCheckoutLoading(true);

    try {
      // 1. Validate items are still in stock
      const stockCheck = await validateCartStock();
      if (!stockCheck.valid) {
        setCheckoutError(stockCheck.message);
        setCheckoutLoading(false);
        return;
      }

      // 2. Create order record on backend
      const orderData = {
        items: cart,
        couponCode: coupon ? coupon.code : '',
        paymentMethod: paymentMethod
      };

      const orderResponse = await API.post('/orders', orderData);
      if (!orderResponse.data?.success) {
        throw new Error(orderResponse.data?.message || 'Failed to place order.');
      }

      const createdOrder = orderResponse.data.data;

      // 3. Handle Cash vs. Online Checkout
      if (paymentMethod === 'cod') {
        setSuccessOrderCode(createdOrder.orderCode);
        clearCart();
      } else {
        // Razorpay integration flow
        await handleRazorpayPayment(createdOrder);
      }
    } catch (err) {
      setCheckoutError(err.message || 'An error occurred during checkout.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleRazorpayPayment = async (order) => {
    try {
      // Generate Razorpay transaction order
      const rpOrderRes = await API.post('/payments/create-order', {
        amount: order.total,
        receipt: `receipt_${order.orderCode}`
      });

      if (!rpOrderRes.data?.success) {
        throw new Error('Failed to generate Razorpay transaction ID');
      }

      const rpOrder = rpOrderRes.data.data;

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_SYSh7FU8tidKTo',
        amount: rpOrder.amount,
        currency: rpOrder.currency,
        name: 'DRS Quick Serve',
        description: `Canteen Order Payment - Code: ${order.orderCode}`,
        order_id: rpOrder.id,
        image: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍛</text></svg>',
        handler: async function (response) {
          try {
            setCheckoutLoading(true);
            // Verify payment signature
            const verifyRes = await API.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderCode: order.orderCode
            });

            if (verifyRes.data?.success) {
              setSuccessOrderCode(order.orderCode);
              clearCart();
            } else {
              setCheckoutError('Payment signature verification failed.');
            }
          } catch (e) {
            setCheckoutError('Failed to verify payment with server.');
          } finally {
            setCheckoutLoading(false);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#1a7a45'
        },
        modal: {
          ondismiss: function () {
            setCheckoutError('Payment window was closed by the user.');
            setCheckoutLoading(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      setCheckoutError(e.message || 'Razorpay initialization failed.');
      setCheckoutLoading(false);
    }
  };

  if (cart.length === 0 && !successOrderCode) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="font-outfit font-black text-2xl text-primary-dark mb-1">Your Cart is Empty!</h2>
        <p className="text-muted text-sm mb-8">Browse our canteen menu and add something delicious to get started.</p>
        <Link 
          to="/menu" 
          className="bg-primary-dark hover:bg-primary text-white font-bold px-8 py-3.5 rounded-full transition-all shadow-md shadow-primary/20"
        >
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 pb-20 relative">
      <h1 className="font-outfit font-black text-3xl text-primary-dark mb-8">My Cart 🛒</h1>

      {checkoutError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-2xl mb-6 font-semibold">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{checkoutError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Cart Items */}
        <div className="lg:col-span-2 bg-white border border-border p-6 md:p-8 rounded-3xl shadow-sm">
          <h2 className="font-outfit font-bold text-lg text-primary-dark mb-6 border-b border-border pb-3">
            {cart.length} Item(s) Selected
          </h2>

          <div className="flex flex-col gap-4">
            {cart.map((item) => (
              <div 
                key={item.menuItem} 
                className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-border shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="text-3xl w-14 h-14 bg-cream rounded-2xl flex items-center justify-center select-none flex-shrink-0">
                    {item.emoji || '🍛'}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-outfit font-bold text-sm text-primary-dark">{item.name}</h3>
                  <span className="text-xs text-amber font-bold">₹{item.price} each</span>
                </div>
                
                {/* Quantity Controls */}
                <div className="flex items-center border border-border rounded-full p-0.5">
                  <button 
                    onClick={() => changeQuantity(item.menuItem, -1)}
                    className="w-8 h-8 bg-gray-50 hover:bg-primary-light text-primary-dark rounded-full font-bold flex items-center justify-center transition-all"
                  >
                    −
                  </button>
                  <span className="font-bold text-xs px-3 text-primary-dark">{item.quantity}</span>
                  <button 
                    onClick={() => changeQuantity(item.menuItem, 1)}
                    className="w-8 h-8 bg-gray-50 hover:bg-primary-light text-primary-dark rounded-full font-bold flex items-center justify-center transition-all"
                  >
                    +
                  </button>
                </div>

                <span className="font-outfit font-black text-sm text-primary-dark min-w-[50px] text-right">
                  ₹{item.price * item.quantity}
                </span>

                <button 
                  onClick={() => removeFromCart(item.menuItem)}
                  className="text-gray-300 hover:text-red-500 p-1 rounded-lg transition-all"
                  title="Remove Item"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Bill Summary & Checkout */}
        <div className="bg-white border border-border p-6 md:p-8 rounded-3xl shadow-sm lg:sticky lg:top-24">
          <h2 className="font-outfit font-bold text-lg text-primary-dark mb-6">Order Summary</h2>

          {/* Pricing breakdown */}
          <div className="flex flex-col gap-3 text-sm border-b border-border pb-4 mb-4">
            <div className="flex justify-between text-muted font-medium">
              <span>Subtotal</span>
              <span className="text-primary-dark font-semibold">₹{subtotal}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-primary font-bold">
                <span>Coupon Discount ({coupon?.code})</span>
                <span>−₹{discount}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mb-6">
            <span className="font-outfit font-black text-lg text-primary-dark">Total</span>
            <span className="font-outfit font-black text-2xl text-primary-dark">₹{total}</span>
          </div>

          {/* Coupons Section */}
          <div className="border-t border-b border-border py-4 mb-6">
            <label className="block text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" /> Apply Coupon Code
            </label>
            
            {coupon ? (
              <div className="flex items-center justify-between bg-primary-light border border-primary/20 rounded-xl px-4 py-2 text-xs text-primary-dark font-bold">
                <span>🏷️ {coupon.code} applied</span>
                <button onClick={removeCoupon} className="text-primary hover:text-red-500 focus:outline-none">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="COUPON CODE"
                  className="flex-1 bg-cream border-2 border-border focus:border-primary rounded-xl py-2 px-3 text-xs font-mono tracking-wider focus:outline-none transition-all uppercase"
                />
                <button 
                  type="submit" 
                  className="bg-primary-dark hover:bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                >
                  Apply
                </button>
              </form>
            )}

            {couponError && (
              <span className="text-[10px] text-red-500 font-bold block mt-2">{couponError}</span>
            )}
            {!coupon && (
              <span className="text-[9px] text-muted font-medium block mt-1.5">Try codes: DRS10, DRS20, or WELCOME</span>
            )}
          </div>

          {/* Payment Method selectors */}
          <div className="mb-8">
            <label className="block text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" /> Payment Method
            </label>
            <div className="bg-primary-light border border-primary/10 rounded-2xl p-4 flex items-center gap-3">
              <Wallet className="w-5 h-5 text-primary-dark" />
              <div>
                <span className="text-xs font-bold text-primary-dark block">Cash on Counter</span>
                <span className="text-[10px] text-primary-dark/60">Pay at the counter when collecting food</span>
              </div>
            </div>
          </div>

          {/* Place order trigger */}
          <button
            onClick={handlePlaceOrder}
            disabled={checkoutLoading}
            className="w-full bg-primary-dark hover:bg-primary text-white font-bold py-4 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 transform hover:-translate-y-0.5 disabled:bg-gray-400 disabled:transform-none disabled:shadow-none"
          >
            <span>{checkoutLoading ? 'Processing Checkout...' : 'Place Order →'}</span>
          </button>
        </div>
      </div>

      {/* SUCCESS MODAL POPUP */}
      {successOrderCode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-border w-full max-w-md rounded-3xl p-8 text-center animate-[scalePop_0.35s_cubic-bezier(.34,_1.56,_.64,_1)] shadow-2xl">
            <span className="text-6xl block mb-4 animate-bounce">🎉</span>
            <h2 className="font-outfit font-black text-2xl text-primary-dark mb-2">Order Placed!</h2>
            <p className="text-muted text-sm leading-relaxed mb-6">
              Your canteen food is being freshly prepared.<br />Save this code to track your order:
            </p>
            
            <div className="bg-primary-light border-2 border-dashed border-primary rounded-2xl p-5 mb-4">
              <span className="text-[10px] text-primary font-black tracking-widest uppercase block mb-1">Your Order Code</span>
              <span className="font-mono font-bold text-primary-darker text-3xl tracking-widest">{successOrderCode}</span>
            </div>

            <p className="text-[10px] text-muted mb-6">Admin can see your order live right now!</p>

            <button
              onClick={() => navigate(`/tracker/${successOrderCode}`)}
              className="w-full bg-primary-dark hover:bg-primary text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 mb-3"
            >
              Track My Order →
            </button>
            <button
              onClick={() => navigate(`/bill/${successOrderCode}`)}
              className="text-xs text-muted hover:text-primary-dark font-bold py-2 focus:outline-none"
            >
              View Digital Bill
            </button>
          </div>
        </div>
      )}

      {/* CSS Anim scalePop */}
      <style>{`
        @keyframes scalePop {
          from { transform: scale(0.85); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Cart;
