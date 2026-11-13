import React, { useRef } from 'react';
import { Printer, Download, X, Calendar, FileText, CheckCircle2, IndianRupee, Smartphone, Banknote, ShieldCheck } from 'lucide-react';

/**
 * Format date in Asia/Kolkata (IST: UTC+05:30)
 */
const formatIST = (dateVal, includeTime = false) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';
  const options = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
    options.hour12 = true;
  }
  const str = new Intl.DateTimeFormat('en-IN', options).format(d);
  return includeTime ? `${str} IST` : str;
};

const RevenueReportPDFModal = ({
  isOpen,
  onClose,
  filterInfo = {},
  summary = {},
  dailyTrends = [],
  bills = [],
}) => {
  const printAreaRef = useRef(null);

  if (!isOpen) return null;

  const filterLabel = filterInfo.filterLabel || 'Period Report';
  const startDateStr = formatIST(filterInfo.startDate);
  const endDateStr = formatIST(filterInfo.endDate);
  const generatedAtStr = formatIST(filterInfo.generatedAt || new Date(), true);

  const totalOrders = summary.totalCompletedOrders || 0;
  const totalSales = summary.totalSales || 0;
  const onlineSales = summary.onlineSales || 0;
  const walkInSales = summary.walkInSales || 0;
  const cashSales = summary.cashSales || 0;
  const digitalSales = summary.digitalSales || 0;
  const avgOrderValue = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : '0.00';

  const handlePrint = () => {
    const printContent = printAreaRef.current;
    if (!printContent) {
      window.print();
      return;
    }

    const iframeId = '__drs_revenue_pdf_iframe__';
    let iframe = document.getElementById(iframeId);
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }

    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = '0';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>DRS_Quick_Serve_Revenue_Report_${filterLabel.replace(/\s+/g, '_')}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 10mm 12mm 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1c1917;
              background: #ffffff;
              font-size: 11px;
              line-height: 1.35;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .header-banner {
              background: #0b3d2e !important;
              color: #ffffff !important;
              padding: 16px 20px;
              border-radius: 8px;
              margin-bottom: 14px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .header-title {
              font-size: 18px;
              font-weight: 800;
              letter-spacing: -0.5px;
            }
            .header-sub {
              font-size: 10px;
              color: rgba(255, 255, 255, 0.85);
              margin-top: 2px;
            }
            .badge-amber {
              background: #f59e0b !important;
              color: #052e16 !important;
              font-weight: 800;
              padding: 4px 10px;
              border-radius: 9999px;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-box {
              background: #fbfbfb;
              border: 1px solid #e7e5e4;
              border-radius: 8px;
              padding: 12px 14px;
              margin-bottom: 14px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
            }
            .meta-item-label {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #78716c;
              margin-bottom: 2px;
            }
            .meta-item-val {
              font-size: 11px;
              font-weight: 700;
              color: #0c0a09;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 14px;
            }
            .summary-card {
              border: 1px solid #e7e5e4;
              border-radius: 6px;
              padding: 10px;
              background: #fafaf9;
            }
            .summary-card.primary {
              background: #ecfdf5 !important;
              border-color: #a7f3d0 !important;
            }
            .summary-title {
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              color: #57534e;
              margin-bottom: 4px;
            }
            .summary-val {
              font-size: 16px;
              font-weight: 800;
              color: #0b3d2e;
              font-family: monospace, sans-serif;
            }
            .summary-sub {
              font-size: 9px;
              color: #78716c;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 10px;
            }
            th {
              background: #f5f5f4 !important;
              color: #44403c;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 8.5px;
              letter-spacing: 0.5px;
              padding: 6px 8px;
              text-align: left;
              border-bottom: 1px solid #d6d3d1;
            }
            td {
              padding: 6px 8px;
              border-bottom: 1px solid #f0eeee;
              color: #292524;
              vertical-align: middle;
            }
            tr:nth-child(even) td {
              background: #fafaf9;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-mono { font-family: monospace; }
            .font-bold { font-weight: 700; }
            .pill {
              display: inline-block;
              padding: 1px 6px;
              border-radius: 4px;
              font-size: 8px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .pill-walkin {
              background: #fef3c7 !important;
              color: #92400e !important;
              border: 1px solid #fde68a;
            }
            .pill-online {
              background: #d1fae5 !important;
              color: #065f46 !important;
              border: 1px solid #a7f3d0;
            }
            .audit-footer {
              margin-top: 20px;
              padding-top: 12px;
              border-top: 1px solid #e7e5e4;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              color: #78716c;
              font-size: 8.5px;
            }
            .signature-box {
              border-top: 1px dashed #a8a29e;
              padding-top: 4px;
              width: 160px;
              text-align: center;
              font-size: 9px;
              color: #44403c;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Iframe print error:', err);
        window.print();
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Top Modal Control Bar */}
        <div className="bg-[#0b3d2e] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber flex items-center justify-center text-stone-950 font-black text-sm">
              📄
            </div>
            <div>
              <h3 className="font-outfit font-black text-sm sm:text-base">
                Revenue & Sales Audit Report
              </h3>
              <p className="text-[11px] text-white/70">
                Print preview & downloadable PDF formatted for A4
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-stone-950 font-black text-xs px-3.5 py-2 rounded-xl transition shadow-sm active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Download PDF / Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable A4 Document Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-100/80">
          <div
            ref={printAreaRef}
            className="bg-white max-w-[210mm] mx-auto p-6 sm:p-8 rounded-2xl shadow-md border border-stone-200 text-stone-800"
          >
            
            {/* Header Banner */}
            <div className="header-banner bg-[#0b3d2e] text-white p-5 rounded-2xl flex items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-outfit font-black text-xs text-amber tracking-wider uppercase">
                    DRS Quick Serve Canteen
                  </span>
                  <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full font-bold">
                    Official Audit Report
                  </span>
                </div>
                <h1 className="header-title font-outfit font-black text-xl sm:text-2xl tracking-tight text-white">
                  Revenue & Sales Audit Report
                </h1>
                <p className="header-sub text-xs text-white/75 mt-0.5">
                  Verified sales snapshots, daily trends, channel splits & transactions
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="badge-amber bg-amber text-stone-950 font-black text-xs px-3 py-1.5 rounded-full uppercase tracking-wider inline-block">
                  {filterLabel}
                </span>
              </div>
            </div>

            {/* Exact Date & Audit Metadata Box (Required by Prompt) */}
            <div className="meta-box bg-stone-50 border border-stone-200 rounded-2xl p-4 mb-4">
              <div className="meta-grid grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="meta-item-label text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Selected Filter
                  </div>
                  <div className="meta-item-val font-outfit font-black text-stone-900 text-sm">
                    {filterLabel}
                  </div>
                </div>

                <div>
                  <div className="meta-item-label text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Exact Start Date
                  </div>
                  <div className="meta-item-val font-mono font-bold text-stone-900 text-sm">
                    {startDateStr}
                  </div>
                </div>

                <div>
                  <div className="meta-item-label text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Exact End Date
                  </div>
                  <div className="meta-item-val font-mono font-bold text-stone-900 text-sm">
                    {endDateStr}
                  </div>
                </div>

                <div>
                  <div className="meta-item-label text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Generated In IST
                  </div>
                  <div className="meta-item-val font-mono font-semibold text-stone-800 text-[11px]">
                    {generatedAtStr}
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue Summary KPI Cards (Matching Dashboard & Top Cards) */}
            <div className="summary-grid grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              
              <div className="summary-card bg-stone-50 border border-stone-200 rounded-xl p-3.5">
                <div className="summary-title text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Completed Orders
                </div>
                <div className="summary-val font-outfit font-black text-xl text-stone-900 font-mono">
                  {totalOrders}
                </div>
                <div className="summary-sub text-[10px] text-stone-400">
                  Avg: ₹{avgOrderValue} / bill
                </div>
              </div>

              <div className="summary-card primary bg-emerald-50/80 border border-emerald-300 rounded-xl p-3.5">
                <div className="summary-title text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Gross Revenue
                </div>
                <div className="summary-val font-outfit font-black text-xl text-emerald-700 font-mono">
                  ₹{Number(totalSales).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="summary-sub text-[10px] text-emerald-600 font-medium">
                  Matches period dashboard
                </div>
              </div>

              <div className="summary-card bg-stone-50 border border-stone-200 rounded-xl p-3.5">
                <div className="summary-title text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Sales Channel
                </div>
                <div className="text-xs space-y-0.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-stone-500 font-sans">Walk-in:</span>
                    <span className="font-bold text-stone-900">₹{Number(walkInSales).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-600 font-sans">Online:</span>
                    <span className="font-bold text-stone-900">₹{Number(onlineSales).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="summary-card bg-stone-50 border border-stone-200 rounded-xl p-3.5">
                <div className="summary-title text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Payment Mode
                </div>
                <div className="text-xs space-y-0.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-emerald-700 font-sans">Cash:</span>
                    <span className="font-bold text-stone-900">₹{Number(cashSales).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700 font-sans">Digital/UPI:</span>
                    <span className="font-bold text-stone-900">₹{Number(digitalSales).toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Daily Revenue Breakdown Table (if multiple days) */}
            {dailyTrends.length > 0 && (
              <div className="mb-5">
                <h4 className="font-outfit font-black text-xs uppercase tracking-wider text-stone-700 mb-2">
                  Daily Period Breakdown (IST)
                </h4>
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-stone-100 text-stone-600">
                        <th className="py-2 px-3">Date (IST)</th>
                        <th className="py-2 px-3 text-center">Orders</th>
                        <th className="py-2 px-3 text-right">Cash (₹)</th>
                        <th className="py-2 px-3 text-right">Digital (₹)</th>
                        <th className="py-2 px-3 text-right">Daily Revenue (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-mono">
                      {dailyTrends.map((d, idx) => (
                        <tr key={idx} className="hover:bg-stone-50">
                          <td className="py-1.5 px-3 font-sans font-bold text-stone-800">
                            {formatIST(d._id)}
                          </td>
                          <td className="py-1.5 px-3 text-center">{d.orders || 0}</td>
                          <td className="py-1.5 px-3 text-right">₹{Number(d.cash || 0).toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right">₹{Number(d.digital || 0).toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-[#0b3d2e]">
                            ₹{Number(d.revenue || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Completed Transactions Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-outfit font-black text-xs uppercase tracking-wider text-stone-700">
                  Transactions In Period ({bills.length} Records)
                </h4>
                <span className="text-[10px] text-stone-500 font-mono">
                  Status: Completed Sales
                </span>
              </div>

              {bills.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400 bg-stone-50 rounded-xl border border-stone-200">
                  No transaction records registered inside this period.
                </div>
              ) : (
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="bg-stone-100 text-stone-600">
                        <th className="py-2 px-2.5">Token & Order</th>
                        <th className="py-2 px-2.5">Time (IST)</th>
                        <th className="py-2 px-2.5">Channel</th>
                        <th className="py-2 px-2.5">Customer</th>
                        <th className="py-2 px-2.5">Items Purchased</th>
                        <th className="py-2 px-2.5">Payment</th>
                        <th className="py-2 px-2.5 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {bills.map((b) => {
                        const isWalkIn = b.orderType === 'WALK_IN';
                        const token = b.pickupToken || b.orderCode?.replace('DRS-', '');
                        const customer = isWalkIn
                          ? (b.walkInCustomer?.name || 'Walk-in')
                          : (b.user?.name || 'Student');
                        const timeStr = formatIST(b.completedAt || b.createdAt, true);

                        return (
                          <tr key={b._id} className="hover:bg-stone-50/70">
                            <td className="py-2 px-2.5 font-mono">
                              <span className="font-bold text-[#0b3d2e] block">#{token}</span>
                              <span className="text-[9px] text-stone-400 font-normal">#{b.orderCode}</span>
                            </td>
                            <td className="py-2 px-2.5 font-mono text-stone-600 whitespace-nowrap">
                              {timeStr}
                            </td>
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <span className={`pill ${isWalkIn ? 'pill-walkin' : 'pill-online'}`}>
                                {isWalkIn ? 'Walk-in' : 'Online'}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-semibold text-stone-800 max-w-[120px] truncate">
                              {customer}
                            </td>
                            <td className="py-2 px-2.5 text-stone-600 max-w-[200px] truncate">
                              {b.items?.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                            </td>
                            <td className="py-2 px-2.5 font-mono uppercase text-stone-700">
                              {b.paymentMethod}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                              ₹{Number(b.total || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Audit Certification Footer */}
            <div className="audit-footer mt-6 pt-4 border-t border-stone-200 flex items-end justify-between text-[10px] text-stone-500">
              <div>
                <p className="font-bold text-stone-700">
                  DRS Quick Serve Smart Canteen System
                </p>
                <p className="text-[9px]">
                  Generated on {generatedAtStr} • Certified system audit log
                </p>
              </div>

              <div className="signature-box border-t border-dashed border-stone-400 pt-1 text-center w-40 text-stone-700 font-bold text-[10px]">
                Authorized Signatory / Cashier
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default RevenueReportPDFModal;

