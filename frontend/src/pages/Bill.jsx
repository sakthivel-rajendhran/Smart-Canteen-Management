import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import { 
  Printer, 
  Receipt, 
  BadgeAlert, 
  ArrowLeft, 
  Check, 
  Clock, 
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';

const Bill = () => {
  const { id } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paperWidth, setPaperWidth] = useState('80mm'); // '80mm' or '58mm'

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
        <div className="w-12 h-12 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-4" />
        <span className="text-stone-600 text-sm font-semibold">Generating thermal receipt...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center bg-white border border-stone-200 rounded-2xl mt-10 print:hidden shadow-sm">
        <BadgeAlert className="w-14 h-14 text-red-500 mx-auto mb-4" />
        <h3 className="font-outfit font-bold text-xl text-stone-900 mb-2">Receipt Not Found</h3>
        <p className="text-stone-600 text-sm mb-6">{error || 'Could not verify billing details.'}</p>
        <Link 
          to="/orders" 
          className="inline-flex items-center gap-1.5 bg-[#0b3d2e] text-white font-bold px-6 py-2.5 rounded-xl hover:bg-[#1a7a45] transition-all text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>My Orders</span>
        </Link>
      </div>
    );
  }

  // Payment status calculation adhering strictly to security rules
  const isRazorpay = order.paymentMethod === 'razorpay';
  const isPaidOnline = isRazorpay && (order.paymentStatus === 'paid' || Boolean(order.paymentId));
  const isPaidCash = order.paymentMethod === 'cod' && order.paymentStatus === 'paid';
  const isPaid = isPaidOnline || isPaidCash;

  const paymentMethodLabel = isRazorpay ? 'ONLINE (RAZORPAY)' : 'CASH ON COUNTER (COD)';
  const paymentStatusLabel = isPaid 
    ? (isPaidOnline ? 'PAID — ONLINE VERIFIED' : 'PAID — CASH COLLECTED')
    : (order.paymentMethod === 'cod' ? 'UNPAID — COLLECT CASH AT PICKUP' : 'PENDING PAYMENT');

  const orderDate = new Date(order.createdAt);
  const formattedDate = orderDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const formattedTime = orderDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const is58mm = paperWidth === '58mm';
  const parcelChargeAmount = Number(
    order.parcelChargeTotal ??
      order.items?.reduce((sum, item) => sum + Number(item.parcelChargeTotal || 0), 0) ??
      0
  );
  const discountAmount = Number(order.discount || 0);
  const totalAmount = Number(order.total || 0);
  const subtotalAmount = Number(
    order.foodSubtotal ??
      order.subtotal ??
      Math.max(0, totalAmount + discountAmount - parcelChargeAmount)
  );

  return (
    <div className="min-h-screen bg-stone-100 py-6 px-3 sm:px-6 print:min-h-0 print:bg-white print:p-0 print:m-0">
      
      {/* Injected Dynamic Thermal Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: ${is58mm ? '58mm auto' : '80mm auto'};
            margin: 1.5mm 1mm;
          }

          html, body {
            width: ${is58mm ? '58mm' : '80mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide all non-receipt elements */
          nav, footer, header, .no-print, [role="alert"], #pwa-installer {
            display: none !important;
          }

          main {
            margin: 0 !important;
            padding: 0 !important;
          }

          .thermal-receipt-root {
            width: ${is58mm ? '58mm' : '80mm'} !important;
            max-width: ${is58mm ? '58mm' : '80mm'} !important;
            margin: 0 auto !important;
            padding: ${is58mm ? '2mm 1.5mm' : '3mm 2.5mm'} !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .thermal-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Screen Controls Header (Hidden during Print) */}
      <div className="no-print max-w-xl mx-auto mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-2">
            <Link 
              to="/orders" 
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
              title="Back to Orders"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-stone-900 flex items-center gap-1.5 font-outfit">
                <Receipt className="w-4 h-4 text-[#0b3d2e]" />
                POS Thermal Receipt
              </h1>
              <p className="text-[11px] text-stone-500 font-medium">
                Order #{order.orderCode} • {order.items?.length || 0} item(s)
              </p>
            </div>
          </div>

          {/* Width Selection & Print Trigger */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Paper Width Selector */}
            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  paperWidth === '80mm'
                    ? 'bg-[#0b3d2e] text-white shadow-xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Standard 3-inch POS Billing Machine paper"
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  paperWidth === '58mm'
                    ? 'bg-[#0b3d2e] text-white shadow-xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Compact 2-inch Mobile / Bus Conductor roll"
              >
                58mm
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bill</span>
            </button>
          </div>
        </div>
      </div>

      {/* Screen Preview Frame */}
      <div className="flex flex-col items-center justify-center">
        
        {/* Receipt Container */}
        <div
          id="thermal-receipt"
          className={`thermal-receipt-root bg-white text-black border border-stone-300 shadow-xl print:shadow-none print:border-none print:m-0 print:p-0 transition-all duration-200 ${
            is58mm 
              ? 'w-[260px] max-w-[260px] p-3 text-[11px]' 
              : 'w-[340px] max-w-[340px] p-5 text-[12px]'
          }`}
          style={{
            fontFamily: "'DM Mono', 'Courier New', Courier, monospace, Arial, sans-serif",
            lineHeight: 1.3
          }}
        >

          {/* ================= HEADER SECTION ================= */}
          <div className="thermal-avoid-break text-center pb-2">
            <div className="text-xl mb-1 select-none">🍛</div>
            <h2 className={`font-black uppercase tracking-wider ${is58mm ? 'text-[15px]' : 'text-[17px]'}`}>
              DRS QUICK SERVE
            </h2>
            <p className="font-bold uppercase tracking-tight text-[11px]">
              DRS COLLEGE CANTEEN
            </p>
            <p className="text-[10px] text-stone-700 tracking-tight">
              DRS College of Engg & Tech
            </p>
            
            {/* Dashed Divider */}
            <div className="my-2 border-b border-dashed border-black" />
          </div>

          {/* ================= ORDER METADATA ================= */}
          <div className="thermal-avoid-break text-[11px] space-y-1 pb-2">
            <div className="flex justify-between items-baseline">
              <span className="font-bold">TOKEN / ORDER:</span>
              <span className={`font-black tracking-wider ${is58mm ? 'text-[14px]' : 'text-[16px]'}`}>
                #{order.orderCode}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="font-semibold">DATE & TIME:</span>
              <span className="text-right font-medium">{formattedDate} {formattedTime}</span>
            </div>

            <div className="flex justify-between">
              <span className="font-semibold">ORDER STATUS:</span>
              <span className="font-black uppercase tracking-wide">[{order.status}]</span>
            </div>

            <div className="flex justify-between">
              <span className="font-semibold">CUSTOMER:</span>
              <span className="font-bold text-right truncate max-w-[150px]">
                {order.user?.name || 'Student / Guest'}
              </span>
            </div>

            {/* Academic details if student */}
            {order.user?.studentDetails?.registerNumber && (
              <div className="flex justify-between text-[10px]">
                <span className="font-semibold">REG NO:</span>
                <span className="font-bold">{order.user.studentDetails.registerNumber}</span>
              </div>
            )}
            {order.user?.studentDetails?.department && (
              <div className="flex justify-between text-[10px]">
                <span className="font-semibold">DEPT:</span>
                <span className="font-medium">{order.user.studentDetails.department}</span>
              </div>
            )}

            {/* Staff ID if staff */}
            {order.user?.staffDetails?.staffId && (
              <div className="flex justify-between text-[10px]">
                <span className="font-semibold">STAFF ID:</span>
                <span className="font-bold">{order.user.staffDetails.staffId}</span>
              </div>
            )}

            <div className="flex justify-between text-[10px]">
              <span className="font-semibold">PAY METHOD:</span>
              <span className="font-bold text-right">{paymentMethodLabel}</span>
            </div>

            <div className="flex justify-between text-[10px]">
              <span className="font-semibold">PAY STATUS:</span>
              <span className={`font-black text-right ${isPaid ? 'underline' : ''}`}>
                {paymentStatusLabel}
              </span>
            </div>

            {order.paymentId && (
              <div className="flex justify-between text-[9px] pt-0.5">
                <span className="font-semibold">TXN ID:</span>
                <span className="font-mono">{order.paymentId}</span>
              </div>
            )}

            {/* Dashed Divider */}
            <div className="my-2 border-b border-dashed border-black" />
          </div>

          {/* ================= FOOD ITEMS TABLE ================= */}
          <div className="thermal-avoid-break pb-2">
            {/* Table Header */}
            <div className="flex justify-between items-center font-black pb-1 border-b border-black text-[11px] tracking-wider">
              <span className="flex-1 text-left">ITEM</span>
              <span className="w-10 text-center">QTY</span>
              <span className="w-16 text-right">AMOUNT</span>
            </div>

            {/* Items List */}
            <div className="divide-y divide-dashed divide-stone-300">
              {order.items?.map((item, index) => {
                const unitPrice = Number(item.price || 0);
                const qty = Number(item.quantity || 1);
                const foodLineTotal = Number((unitPrice * qty).toFixed(2));
                const parcelPerUnit = Number(item.parcelChargePerUnit || 0);
                const itemParcelTotal = Number(
                  item.parcelChargeTotal ?? (item.serviceType === 'PARCEL' ? parcelPerUnit * qty : 0)
                );
                const isParcel = item.serviceType === 'PARCEL' || itemParcelTotal > 0;

                return (
                  <div key={index} className="thermal-avoid-break py-1.5 text-[11px]">
                    <div className="flex items-start">
                      <div className="flex-1 pr-1">
                        <div className="font-bold leading-tight break-words">
                          {item.name}
                          {isParcel && (
                            <span className="text-[9px] font-black uppercase ml-1">[PARCEL]</span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-600">
                          @ ₹{unitPrice.toFixed(2)} {!isParcel ? '• Normal' : ''}
                        </div>
                      </div>
                      <div className="w-10 text-center font-bold pt-0.5">
                        {qty}
                      </div>
                      <div className="w-16 text-right font-black pt-0.5">
                        ₹{foodLineTotal.toFixed(2)}
                      </div>
                    </div>
                    {isParcel && itemParcelTotal > 0 && (
                      <div className="flex justify-between items-center mt-0.5 text-[10px] text-stone-700">
                        <span>
                          Parcel ({qty} × ₹{(parcelPerUnit || itemParcelTotal / qty).toFixed(2)})
                        </span>
                        <span className="font-bold">+₹{itemParcelTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dashed Divider */}
            <div className="my-2 border-b border-dashed border-black" />
          </div>

          {/* ================= PAYMENT SUMMARY ================= */}
          <div className="thermal-avoid-break space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="font-semibold">Food Subtotal</span>
              <span className="font-bold">₹{subtotalAmount.toFixed(2)}</span>
            </div>

            {parcelChargeAmount > 0 && (
              <div className="flex justify-between">
                <span className="font-semibold">Parcel Charges</span>
                <span className="font-bold">+₹{parcelChargeAmount.toFixed(2)}</span>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="font-semibold">
                  Discount {order.coupon ? `(${order.coupon})` : ''}
                </span>
                <span className="font-bold">−₹{discountAmount.toFixed(2)}</span>
              </div>
            )}

            {/* Double Solid / Heavy Separator for Grand Total */}
            <div className="my-1.5 border-b-2 border-black" />

            <div className="flex justify-between items-baseline py-1">
              <span className={`font-black uppercase tracking-wider ${is58mm ? 'text-[13px]' : 'text-[15px]'}`}>
                GRAND TOTAL:
              </span>
              <span className={`font-black text-right ${is58mm ? 'text-[18px]' : 'text-[21px]'}`}>
                ₹{totalAmount.toFixed(2)}
              </span>
            </div>

            <div className="my-1.5 border-b-2 border-black" />
          </div>

          {/* ================= FOOTER SECTION ================= */}
          <div className="thermal-avoid-break text-center pt-2 text-[10px] space-y-1 leading-snug">
            <p className="font-black uppercase tracking-wider">
              THANK YOU FOR YOUR ORDER!
            </p>
            <p className="text-stone-700">
              Visit again for more authentic Tamil food.
            </p>
            <div className="pt-2 font-black tracking-tight text-[11px]">
              DRS QUICK SERVE
            </div>
            <p className="text-[9px] text-stone-600">
              Smart Ordering. Faster Serving.
            </p>
            <div className="pt-2 text-[8px] text-stone-500 font-mono">
              *** END OF RECEIPT ***
            </div>
          </div>

        </div>

        {/* Screen Action Links (Hidden on Print) */}
        <div className="no-print mt-6 flex items-center justify-center gap-3">
          <Link
            to={`/tracker/${order.orderCode}`}
            className="inline-flex items-center gap-1.5 bg-white border border-stone-300 hover:border-[#0b3d2e] text-[#0b3d2e] font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition"
          >
            <span>📍 Live Status</span>
          </Link>

          <Link
            to="/menu"
            className="inline-flex items-center gap-1.5 bg-[#0b3d2e] hover:bg-[#1a7a45] text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition"
          >
            <span>🍽 Order Again</span>
          </Link>
        </div>

      </div>

    </div>
  );
};

export default Bill;
