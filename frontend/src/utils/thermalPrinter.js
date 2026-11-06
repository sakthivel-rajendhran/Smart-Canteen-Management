/**
 * DRS QUICK SERVE — Physical Thermal Bill Printing Utility
 * 
 * Supports continuous paper roll printing for standard POS billing printers:
 * - 80mm Standard POS receipt printers (EPSON, TVS, Star, Citizen, Munbyn, etc.)
 * - 58mm Compact POS thermal roll printers
 * 
 * Features:
 * - Direct hidden iframe printing (no screen distortion or background leaks)
 * - Zero extra blank pages (@page margin 0 and height auto)
 * - Itemized billing breakdown with unit prices and totals
 * - Prominent Pickup Token and Bill Number for physical food collection verification
 * - Customer handover instructions
 */

/**
 * Format currency in Indian Rupees style
 */
const formatCurrency = (val) => {
  const num = Number(val || 0);
  return `₹${num.toFixed(2)}`;
};

/**
 * Generate pure HTML markup for the physical thermal bill receipt
 */
export const generateThermalReceiptHtml = (order, options = {}) => {
  const paperWidth = options.paperWidth === '58mm' ? '58mm' : '80mm';
  const is58mm = paperWidth === '58mm';

  const orderDate = new Date(order.billPrintedAt || order.createdAt || Date.now());
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
  const cashierName = order.cashier?.name;

  const subtotal = Number(order.subtotal || order.total || 0);
  const discount = Number(order.discount || 0);
  const total = Number(order.total || 0);

  const paymentMethodUpper = String(order.paymentMethod || 'cash').toUpperCase();
  const paymentStatusUpper = String(order.paymentStatus || 'paid').toUpperCase();
  const isPaid = paymentStatusUpper === 'PAID';

  const pickupToken = order.pickupToken || String(order.orderCode || '').replace('DRS-', '');
  const billNumber = order.billNumber || `BILL-${order.orderCode}`;
  const printCount = Number(order.billPrintCount || 1);
  const isReprint = printCount > 1;

  // Build items rows
  const itemsHtml = (order.items || [])
    .map((item) => {
      const unitPrice = Number(item.price || 0).toFixed(2);
      const qty = Number(item.quantity || 1);
      const lineTotal = (Number(item.price || 0) * qty).toFixed(2);
      return `
        <tr class="item-row">
          <td class="item-col-name">
            <div class="item-name">${item.name || 'Food Item'}</div>
            <div class="item-unit-price">@ ₹${unitPrice}</div>
          </td>
          <td class="item-col-qty">${qty}</td>
          <td class="item-col-amt">₹${lineTotal}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${billNumber} - Token #${pickupToken}</title>
        <style>
          @page {
            size: ${paperWidth} auto;
            margin: 0;
          }

          *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html, body {
            width: ${paperWidth};
            max-width: ${paperWidth};
            margin: 0 auto;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: 'DM Mono', 'Courier New', Courier, monospace, Arial, sans-serif;
            font-size: ${is58mm ? '11px' : '12px'};
            line-height: 1.3;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .thermal-bill-container {
            width: 100%;
            padding: ${is58mm ? '3mm 2mm 5mm 2mm' : '4mm 3mm 6mm 3mm'};
            page-break-after: avoid;
            break-after: avoid;
          }

          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: 700; }
          .font-black { font-weight: 900; }
          .uppercase { text-transform: uppercase; }

          /* Header */
          .canteen-brand {
            font-size: ${is58mm ? '15px' : '17px'};
            font-weight: 900;
            letter-spacing: 0.5px;
            margin-bottom: 1px;
          }
          .canteen-sub {
            font-size: ${is58mm ? '10px' : '11px'};
            font-weight: 700;
          }
          .canteen-college {
            font-size: ${is58mm ? '9px' : '10px'};
            color: #333333;
            margin-bottom: 4px;
          }

          .dashed-divider {
            border-bottom: 1px dashed #000000;
            margin: 5px 0;
          }

          .solid-divider {
            border-bottom: 1px solid #000000;
            margin: 4px 0;
          }

          .double-divider {
            border-bottom: 2px solid #000000;
            margin: 4px 0;
          }

          /* Pickup Token Callout */
          .token-box {
            text-align: center;
            border: 1.5px solid #000000;
            padding: 4px 2px;
            margin: 5px 0;
            background: #fdfdfd;
          }
          .token-label {
            font-size: ${is58mm ? '9px' : '10px'};
            font-weight: 700;
            letter-spacing: 1px;
          }
          .token-number {
            font-size: ${is58mm ? '28px' : '34px'};
            font-weight: 900;
            line-height: 1;
            letter-spacing: 1px;
            margin: 2px 0;
          }
          .token-badge {
            font-size: ${is58mm ? '8px' : '9px'};
            font-weight: 700;
          }

          /* Details Rows */
          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            font-size: ${is58mm ? '10px' : '11px'};
            margin: 1.5px 0;
          }
          .detail-label {
            font-weight: 600;
            white-space: nowrap;
          }
          .detail-val {
            font-weight: 700;
            text-align: right;
            word-break: break-all;
          }

          /* Items Table */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 4px 0;
          }
          .items-table th {
            font-size: ${is58mm ? '10px' : '11px'};
            font-weight: 900;
            padding: 3px 0;
            border-bottom: 1px solid #000000;
          }
          .items-table td {
            padding: 3px 0;
            vertical-align: top;
            border-bottom: 1px dashed #cccccc;
          }
          .item-col-name {
            width: ${is58mm ? '62%' : '65%'};
            text-align: left;
            padding-right: 4px !important;
          }
          .item-name {
            font-weight: 700;
            word-break: break-word;
          }
          .item-unit-price {
            font-size: ${is58mm ? '9px' : '10px'};
            color: #555555;
          }
          .item-col-qty {
            width: ${is58mm ? '14%' : '13%'};
            text-align: center;
            font-weight: 700;
          }
          .item-col-amt {
            width: ${is58mm ? '24%' : '22%'};
            text-align: right;
            font-weight: 900;
          }

          /* Totals */
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: ${is58mm ? '10px' : '11px'};
            margin: 2px 0;
          }
          .grand-total-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: ${is58mm ? '13px' : '15px'};
            font-weight: 900;
            padding: 2px 0;
          }
          .grand-total-amt {
            font-size: ${is58mm ? '17px' : '20px'};
            font-weight: 900;
          }

          /* Footer Handover Instructions */
          .instructions-box {
            text-align: center;
            margin-top: 6px;
            padding-top: 4px;
          }
          .instruction-title {
            font-size: ${is58mm ? '10px' : '11px'};
            font-weight: 900;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .instruction-body {
            font-size: ${is58mm ? '8.5px' : '9.5px'};
            color: #333333;
            line-height: 1.25;
            margin-bottom: 4px;
          }
          .instruction-thanks {
            font-size: ${is58mm ? '9px' : '10px'};
            font-weight: 900;
            margin-top: 2px;
          }
          .instruction-footer-note {
            font-size: ${is58mm ? '7.5px' : '8.5px'};
            color: #555555;
            margin-top: 2px;
          }

          .reprint-banner {
            border: 1px solid #000000;
            text-align: center;
            font-size: 9px;
            font-weight: 900;
            padding: 2px 0;
            margin: 3px 0;
          }
        </style>
      </head>
      <body>
        <div class="thermal-bill-container">
          
          <!-- Canteen Header -->
          <div class="text-center">
            <div style="font-size: 18px; margin-bottom: 2px;">🍛</div>
            <div class="canteen-brand">DRS QUICK SERVE</div>
            <div class="canteen-sub">DRS COLLEGE CANTEEN</div>
            <div class="canteen-college">DRS College of Engg & Tech</div>
          </div>

          <div class="dashed-divider"></div>

          <!-- Prominent Pickup Token Box -->
          <div class="token-box">
            <div class="token-label">PICKUP TOKEN</div>
            <div class="token-number">#${pickupToken}</div>
            <div class="token-badge">${isWalkIn ? '★ DIRECT COUNTER SALE ★' : '★ ONLINE APP ORDER ★'}</div>
          </div>

          <!-- Bill Identification Details -->
          <div class="detail-row">
            <span class="detail-label">BILL NO:</span>
            <span class="detail-val">${billNumber}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">ORDER ID:</span>
            <span class="detail-val">#${order.orderCode}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">DATE & TIME:</span>
            <span class="detail-val">${formattedDate} ${formattedTime}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">CUSTOMER:</span>
            <span class="detail-val">${customerName}</span>
          </div>

          ${customerPhone ? `
          <div class="detail-row">
            <span class="detail-label">PHONE:</span>
            <span class="detail-val">${customerPhone}</span>
          </div>` : ''}

          ${customerReg ? `
          <div class="detail-row">
            <span class="detail-label">REG NO:</span>
            <span class="detail-val">${customerReg}</span>
          </div>` : ''}

          ${customerStaffId ? `
          <div class="detail-row">
            <span class="detail-label">STAFF ID:</span>
            <span class="detail-val">${customerStaffId}</span>
          </div>` : ''}

          ${cashierName ? `
          <div class="detail-row">
            <span class="detail-label">CASHIER:</span>
            <span class="detail-val">${cashierName}</span>
          </div>` : ''}

          <div class="detail-row" style="margin-top: 3px;">
            <span class="detail-label">PAY METHOD:</span>
            <span class="detail-val">${paymentMethodUpper}</span>
          </div>

          <div class="detail-row">
            <span class="detail-label">PAY STATUS:</span>
            <span class="detail-val" style="text-decoration: underline;">
              ${isPaid ? 'PAID / COLLECTED' : 'PENDING'}
            </span>
          </div>

          ${isReprint ? `
          <div class="reprint-banner">
            *** REPRINT COPY #${printCount} ***
          </div>` : ''}

          <div class="dashed-divider"></div>

          <!-- Itemized Food Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th class="item-col-name">ITEM</th>
                <th class="item-col-qty">QTY</th>
                <th class="item-col-amt">AMT</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="dashed-divider"></div>

          <!-- Financial Breakdown -->
          <div class="total-row">
            <span>Subtotal:</span>
            <span class="font-bold">₹${subtotal.toFixed(2)}</span>
          </div>

          ${discount > 0 ? `
          <div class="total-row">
            <span>Discount:</span>
            <span class="font-bold">-₹${discount.toFixed(2)}</span>
          </div>` : ''}

          <div class="double-divider"></div>

          <div class="grand-total-row">
            <span class="uppercase">GRAND TOTAL:</span>
            <span class="grand-total-amt">₹${total.toFixed(2)}</span>
          </div>

          <div class="double-divider"></div>

          <!-- Physical Collection Instructions -->
          <div class="instructions-box">
            <div class="instruction-title">PRESENT THIS BILL AT FOOD COUNTER</div>
            <div class="instruction-body">
              Please hand over this physical bill to the counter staff when token #${pickupToken} is called to collect your food trays.
            </div>
            <div class="instruction-thanks">
              DRS QUICK SERVE • THANK YOU!
            </div>
            <div class="instruction-footer-note">
              *** PHYSICAL BILL VERIFICATION COPY ***
            </div>
          </div>

        </div>
      </body>
    </html>
  `;
};

/**
 * Direct Physical Thermal Printer Action
 * Injects a hidden iframe, loads the continuous thermal bill, and opens the system print dialog.
 * 
 * @param {Object} order - Complete order object
 * @param {Object} options - { paperWidth: '80mm' | '58mm' }
 * @returns {Promise<boolean>}
 */
export const printPhysicalThermalReceipt = (order, options = {}) => {
  return new Promise((resolve) => {
    if (!order) {
      console.warn('printPhysicalThermalReceipt: No order provided.');
      resolve(false);
      return;
    }

    const iframeId = '__drs_thermal_print_iframe__';
    let iframe = document.getElementById(iframeId);

    // Remove prior iframe if any
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }

    // Create fresh invisible iframe
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    iframe.setAttribute('aria-hidden', 'true');

    document.body.appendChild(iframe);

    const receiptHtml = generateThermalReceiptHtml(order, options);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      console.error('Cannot access iframe document for printing');
      // Fallback to window.print
      window.print();
      resolve(true);
      return;
    }

    doc.open();
    doc.write(receiptHtml);
    doc.close();

    // Allow browser small rendering tick to layout before invoking print dialog
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        // Listen for afterprint or schedule removal
        const cleanup = () => {
          setTimeout(() => {
            if (iframe && iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }, 1000);
        };

        if (iframe.contentWindow) {
          iframe.contentWindow.onafterprint = cleanup;
        }

        // Failsafe cleanup in case onafterprint doesn't fire
        setTimeout(cleanup, 60000);

        resolve(true);
      } catch (err) {
        console.error('Error invoking iframe print:', err);
        window.print();
        resolve(false);
      }
    }, 200);
  });
};

export default printPhysicalThermalReceipt;
