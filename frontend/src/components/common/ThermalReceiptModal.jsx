import React, { useState, useEffect } from 'react';
import { Printer, X, Receipt } from 'lucide-react';

const ThermalReceiptModal = ({ order, isOpen, onClose, autoPrint = false }) => {
  const [paperWidth, setPaperWidth] = useState('80mm'); // '80mm' | '58mm'

  const is58mm = paperWidth === '58mm';
  const pickupToken = order?.pickupToken || String(order?.orderCode || '').replace('DRS-', '');

  const handlePrint = () => {
    const receiptElement = document.getElementById('thermal-receipt');
    const targetWidth = is58mm ? '58mm' : '80mm';

    if (!receiptElement) {
      window.print();
      return;
    }

    const iframeId = '__drs_receipt_print_iframe__';
    let iframe = document.getElementById(iframeId);
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }

    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = targetWidth;
    iframe.style.height = '600px';
    iframe.style.border = '0';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    // Collect all stylesheets from main document
    let stylesHtml = '';
    const styleTags = document.querySelectorAll('link[rel="stylesheet"], style');
    styleTags.forEach((tag) => {
      if (!tag.innerText || !tag.innerText.includes('thermal-receipt-modal-box')) {
        stylesHtml += tag.outerHTML + '\n';
      }
    });

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt - Token #${pickupToken}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&display=swap" rel="stylesheet">
          ${stylesHtml}
          <style>
            @page {
              size: ${targetWidth} auto;
              margin: 0mm;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
            }
            html, body {
              width: ${targetWidth} !important;
              max-width: ${targetWidth} !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: 'DM Mono', 'Courier New', Courier, monospace, Arial, sans-serif !important;
              font-size: ${is58mm ? '11px' : '12px'} !important;
              line-height: 1.3 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              overflow: visible !important;
            }
            .thermal-receipt-root {
              width: ${targetWidth} !important;
              max-width: ${targetWidth} !important;
              margin: 0 auto !important;
              padding: ${is58mm ? '2.5mm 1.5mm 4mm 1.5mm' : '3.5mm 2.5mm 5mm 2.5mm'} !important;
              background: #ffffff !important;
              color: #000000 !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
              page-break-before: avoid !important;
              break-before: avoid !important;
              height: auto !important;
              overflow: visible !important;
            }
            * {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            /* Self-contained POS layout primitives */
            .flex { display: flex !important; }
            .items-center { align-items: center !important; }
            .items-start { align-items: flex-start !important; }
            .items-baseline { align-items: baseline !important; }
            .justify-between { justify-content: space-between !important; }
            .flex-1 { flex: 1 1 0% !important; }
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .text-left { text-align: left !important; }
            .font-bold { font-weight: 700 !important; }
            .font-semibold { font-weight: 600 !important; }
            .font-black { font-weight: 900 !important; }
            .font-medium { font-weight: 500 !important; }
            .uppercase { text-transform: uppercase !important; }
            .w-9 { width: 2.25rem !important; }
            .w-16 { width: 4rem !important; }
            .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .border-b { border-bottom: 1px solid #000 !important; }
            .border-b-2 { border-bottom: 2px solid #000 !important; }
            .border-dashed { border-style: dashed !important; }
          </style>
        </head>
        <body>
          ${receiptElement.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        const cleanup = () => {
          setTimeout(() => {
            if (iframe && iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }, 1500);
        };

        if (iframe.contentWindow) {
          iframe.contentWindow.onafterprint = cleanup;
        }
        setTimeout(cleanup, 60000);
      } catch (err) {
        console.error('Iframe print error, falling back:', err);
        window.print();
      }
    };

    if (doc.readyState === 'complete') {
      setTimeout(triggerPrint, 200);
    } else {
      iframe.onload = () => setTimeout(triggerPrint, 200);
      setTimeout(triggerPrint, 350);
    }
  };

  // Intercept Ctrl+P / Cmd+P while modal is open to ensure clean isolated continuous print
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, paperWidth, order]);

  // Handle auto-print if requested
  useEffect(() => {
    if (isOpen && autoPrint && order) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, order, paperWidth]);

  if (!isOpen || !order) return null;

  const orderDate = new Date(order.createdAt || Date.now());
  const formattedDate = orderDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = orderDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const isWalkIn = order.orderType === 'WALK_IN';
  const customerName = isWalkIn
    ? (order.walkInCustomer?.name || 'Walk-in Customer')
    : (order.user?.name || 'Student / Faculty');
  const customerPhone = isWalkIn
    ? order.walkInCustomer?.phone
    : order.user?.phone;
  const customerReg = isWalkIn
    ? order.walkInCustomer?.registerNumber
    : order.user?.studentDetails?.registerNumber;
  const customerStaffId = isWalkIn
    ? order.walkInCustomer?.staffId
    : order.user?.staffDetails?.staffId;

  const subtotal = Number(order.subtotal || order.total || 0);
  const discount = Number(order.discount || 0);
  const total = Number(order.total || 0);

  const paymentMethodUpper = String(order.paymentMethod || 'cash').toUpperCase();
  const paymentStatusUpper = String(order.paymentStatus || 'paid').toUpperCase();
  const isPaid = paymentStatusUpper === 'PAID';

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-stone-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white print:static">
      
      {/* Injected Dynamic Thermal Print Stylesheet (Dual defense for direct print / Ctrl+P) */}
      <style>{`
        @media print {
          @page {
            size: ${is58mm ? '58mm auto' : '80mm auto'};
            margin: 0;
          }

          html, body {
            width: ${is58mm ? '58mm' : '80mm'} !important;
            max-width: ${is58mm ? '58mm' : '80mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide ALL other elements on the entire page */
          body * {
            visibility: hidden !important;
          }

          /* Make ONLY the thermal receipt and its descendants visible */
          #thermal-receipt, #thermal-receipt * {
            visibility: visible !important;
          }

          /* Position the receipt at the top-left of the page so no background space is reserved */
          #thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${is58mm ? '58mm' : '80mm'} !important;
            max-width: ${is58mm ? '58mm' : '80mm'} !important;
            margin: 0 !important;
            padding: ${is58mm ? '2.5mm 1.5mm 4mm 1.5mm' : '3.5mm 2.5mm 5mm 2.5mm'} !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            height: auto !important;
            overflow: visible !important;
          }

          .thermal-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Modal Dialog Box */}
      <div className="thermal-receipt-modal-box bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none">
        
        {/* Modal Controls Header (Hidden on Print) */}
        <div className="no-print bg-stone-50 border-b border-stone-200 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#0b3d2e]/10 text-[#0b3d2e] flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-outfit font-black text-sm text-stone-900 leading-tight">
                Thermal POS Receipt
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                Token #{pickupToken} • Order #{order.orderCode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Paper Width Switcher */}
            <div className="flex bg-stone-200/80 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  paperWidth === '80mm'
                    ? 'bg-[#0b3d2e] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="80mm POS Billing Paper"
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  paperWidth === '58mm'
                    ? 'bg-[#0b3d2e] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="58mm Compact Mobile Paper"
              >
                58mm
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Scroll Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex items-center justify-center bg-stone-100/60 print:bg-white print:p-0">
          
          <div
            id="thermal-receipt"
            className={`thermal-receipt-root bg-white text-black border border-stone-300 shadow-md print:shadow-none print:border-none print:m-0 print:p-0 ${
              is58mm
                ? 'w-[260px] max-w-[260px] p-3 text-[11px]'
                : 'w-[340px] max-w-[340px] p-5 text-[12px]'
            }`}
            style={{
              fontFamily: "'DM Mono', 'Courier New', Courier, monospace, Arial, sans-serif",
              lineHeight: 1.3,
            }}
          >
            {/* Header */}
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
              
              <div className="my-2 border-b border-dashed border-black" />
            </div>

            {/* Big Token Number Callout */}
            <div className="thermal-avoid-break text-center py-1 my-1 bg-stone-50 border border-black/20 rounded">
              <span className="text-[10px] font-bold uppercase tracking-wider block">PICKUP TOKEN</span>
              <span className={`font-black tracking-widest ${is58mm ? 'text-2xl' : 'text-3xl'} leading-none`}>
                #{pickupToken}
              </span>
              <span className="text-[9px] font-medium text-stone-600 block mt-0.5">
                {isWalkIn ? '★ DIRECT COUNTER SALE ★' : '★ ONLINE WEB ORDER ★'}
              </span>
            </div>

            {/* Metadata */}
            <div className="thermal-avoid-break text-[11px] space-y-1 py-1.5">
              <div className="flex justify-between">
                <span className="font-semibold">ORDER ID:</span>
                <span className="font-mono font-bold">#{order.orderCode}</span>
              </div>

              <div className="flex justify-between">
                <span className="font-semibold">DATE & TIME:</span>
                <span className="text-right font-medium">{formattedDate} {formattedTime}</span>
              </div>

              <div className="flex justify-between">
                <span className="font-semibold">CHANNEL:</span>
                <span className="font-black uppercase">{isWalkIn ? 'WALK-IN POS' : 'ONLINE APP'}</span>
              </div>

              <div className="flex justify-between">
                <span className="font-semibold">CUSTOMER:</span>
                <span className="font-bold text-right truncate max-w-[170px]">
                  {customerName}
                </span>
              </div>

              {customerPhone && (
                <div className="flex justify-between text-[10px]">
                  <span className="font-semibold">PHONE:</span>
                  <span className="font-mono">{customerPhone}</span>
                </div>
              )}

              {customerReg && (
                <div className="flex justify-between text-[10px]">
                  <span className="font-semibold">REG NO:</span>
                  <span className="font-bold font-mono">{customerReg}</span>
                </div>
              )}

              {customerStaffId && (
                <div className="flex justify-between text-[10px]">
                  <span className="font-semibold">STAFF ID:</span>
                  <span className="font-bold font-mono">{customerStaffId}</span>
                </div>
              )}

              {order.cashier?.name && (
                <div className="flex justify-between text-[10px]">
                  <span className="font-semibold">CASHIER:</span>
                  <span className="font-medium">{order.cashier.name}</span>
                </div>
              )}

              <div className="flex justify-between text-[10px] pt-0.5">
                <span className="font-semibold">PAY METHOD:</span>
                <span className="font-bold">{paymentMethodUpper}</span>
              </div>

              <div className="flex justify-between text-[10px]">
                <span className="font-semibold">PAY STATUS:</span>
                <span className={`font-black ${isPaid ? 'underline' : ''}`}>
                  {isPaid ? 'PAID / COLLECTED' : 'PENDING'}
                </span>
              </div>

              <div className="my-2 border-b border-dashed border-black" />
            </div>

            {/* Items Table */}
            <div className="thermal-avoid-break pb-1">
              <div className="flex justify-between items-center font-black pb-1 border-b border-black text-[11px] tracking-wider">
                <span className="flex-1 text-left">ITEM</span>
                <span className="w-9 text-center">QTY</span>
                <span className="w-16 text-right">AMT</span>
              </div>

              <div className="divide-y divide-dashed divide-stone-300">
                {order.items?.map((item, idx) => {
                  const lineTotal = (Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2);
                  return (
                    <div key={idx} className="thermal-avoid-break py-1 flex items-start text-[11px]">
                      <div className="flex-1 pr-1">
                        <div className="font-bold leading-tight break-words">{item.name}</div>
                        <div className="text-[10px] text-stone-600">@ ₹{Number(item.price || 0).toFixed(2)}</div>
                      </div>
                      <div className="w-9 text-center font-bold pt-0.5">{item.quantity}</div>
                      <div className="w-16 text-right font-black pt-0.5">₹{lineTotal}</div>
                    </div>
                  );
                })}
              </div>

              <div className="my-2 border-b border-dashed border-black" />
            </div>

            {/* Totals */}
            <div className="thermal-avoid-break space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="font-semibold">Subtotal</span>
                <span className="font-bold">₹{subtotal.toFixed(2)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-stone-700">
                  <span className="font-semibold">Discount</span>
                  <span className="font-bold">−₹{discount.toFixed(2)}</span>
                </div>
              )}

              <div className="my-1 border-b-2 border-black" />

              <div className="flex justify-between items-baseline py-1">
                <span className={`font-black uppercase tracking-wider ${is58mm ? 'text-[13px]' : 'text-[15px]'}`}>
                  GRAND TOTAL:
                </span>
                <span className={`font-black text-right ${is58mm ? 'text-[18px]' : 'text-[21px]'}`}>
                  ₹{total.toFixed(2)}
                </span>
              </div>

              <div className="my-1 border-b-2 border-black" />
            </div>

            {/* Footer */}
            <div className="thermal-avoid-break text-center pt-2 text-[10px] space-y-1 leading-snug">
              <p className="font-black uppercase tracking-wider">THANK YOU FOR YOUR VISIT!</p>
              <p className="text-stone-700 text-[9px]">Please collect food when your token #{pickupToken} is called.</p>
              <div className="pt-1.5 font-black tracking-tight text-[10px]">DRS QUICK SERVE</div>
              <div className="pt-1 text-[8px] text-stone-500 font-mono">*** END OF RECEIPT ***</div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar (Hidden on Print) */}
        <div className="no-print bg-stone-50 border-t border-stone-200 p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="text-[11px] text-stone-500">
            Thermal print ready for 80mm & 58mm POS receipt printers.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:text-stone-900 font-bold text-xs rounded-xl hover:bg-stone-200 transition"
            >
              Done
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-[#0b3d2e] hover:bg-[#1a7a45] text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md transition active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bill Now</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ThermalReceiptModal;
