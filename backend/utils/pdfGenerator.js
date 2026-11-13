import PDFDocument from 'pdfkit';

/**
 * Format Indian Rupee currency string
 */
export const formatINR = (val) => {
  const num = Number(val || 0);
  return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Format date in Asia/Kolkata (IST: UTC+05:30)
 */
export const formatISTDate = (dateVal, includeTime = false) => {
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

/**
 * Generate a formal, professional A4 financial revenue statement PDF
 * Returns a Promise that resolves with a Buffer
 */
export const generateRevenueStatementPDF = async ({
  reportId,
  reportName,
  filterLabel,
  startDate,
  endDate,
  generatedAt = new Date(),
  adminName = 'Authorized Admin',
  summary = {},
  dailyTrends = [],
  transactions = [],
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        resolve(fullBuffer);
      });
      doc.on('error', (err) => reject(err));

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // 523.28 pt

      // Colors
      const C_PRIMARY = '#0b3d2e';
      const C_PRIMARY_LIGHT = '#1A7A45';
      const C_AMBER = '#D97706';
      const C_AMBER_LIGHT = '#F59E0B';
      const C_BG_LIGHT = '#F8FAF9';
      const C_BORDER = '#E2E8F0';
      const C_TEXT = '#1E293B';
      const C_MUTED = '#64748B';

      // ================= 1. HEADER BANNER =================
      doc.rect(margin, margin, contentWidth, 54).fill(C_PRIMARY);

      // Accent orange bar
      doc.rect(margin, margin + 51, contentWidth, 3).fill(C_AMBER_LIGHT);

      // Title & Subtitle
      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
        .text('DRS QUICK SERVE', margin + 14, margin + 10, { width: contentWidth - 28 });
      doc.fontSize(10).font('Helvetica')
        .text('CANTEEN REVENUE STATEMENT — OFFICIAL FINANCIAL REPORT', margin + 14, margin + 30, { width: contentWidth - 28 });

      // Reporting period badge
      const badgeText = String(filterLabel || 'Period Report').toUpperCase();
      doc.fontSize(9).font('Helvetica-Bold');
      const badgeW = doc.widthOfString(badgeText) + 16;
      const badgeH = 18;
      const badgeX = margin + contentWidth - badgeW - 14;
      const badgeY = margin + 17;
      doc.rect(badgeX, badgeY, badgeW, badgeH).fill(C_AMBER);
      doc.fillColor('#FFFFFF').text(badgeText, badgeX, badgeY + 4, { width: badgeW, align: 'center' });

      let currentY = margin + 66;

      // ================= 2. METADATA BLOCK =================
      doc.rect(margin, currentY, contentWidth, 56).fillAndStroke(C_BG_LIGHT, C_BORDER);

      const colW = contentWidth / 4;
      const metaRows = [
        [
          { label: 'REPORT ID', val: reportId },
          { label: 'REPORTING PERIOD', val: filterLabel },
          { label: 'EXACT START DATE', val: formatISTDate(startDate) },
          { label: 'EXACT END DATE', val: formatISTDate(endDate) },
        ],
        [
          { label: 'GENERATED (IST)', val: formatISTDate(generatedAt, true) },
          { label: 'AUTHORIZED ADMIN', val: adminName },
          { label: 'ACCOUNTING STATUS', val: 'Verified Sales Audit' },
          { label: 'CURRENCY', val: 'INR (Indian Rupee)' },
        ],
      ];

      metaRows.forEach((row, rIdx) => {
        const rowY = currentY + 6 + rIdx * 24;
        row.forEach((item, cIdx) => {
          const x = margin + cIdx * colW + 8;
          doc.fillColor(C_MUTED).fontSize(6.5).font('Helvetica-Bold')
            .text(item.label, x, rowY, { width: colW - 12 });
          doc.fillColor(C_TEXT).fontSize(8.5).font('Helvetica')
            .text(String(item.val), x, rowY + 9, { width: colW - 12, ellipsis: true });
        });
      });

      currentY += 66;

      // ================= 3. EXECUTIVE FINANCIAL SUMMARY =================
      doc.fillColor(C_PRIMARY).fontSize(10.5).font('Helvetica-Bold')
        .text('1. EXECUTIVE FINANCIAL SUMMARY', margin, currentY);
      doc.rect(margin, currentY + 14, contentWidth, 1).fill(C_PRIMARY);
      currentY += 20;

      // 2-column layout: Summary Table (left) & Operations Metrics (right)
      const leftColW = 280;
      const rightColW = contentWidth - leftColW - 12;

      // Summary Table Left
      const finRows = [
        { label: 'Gross Sales (Item Sales + Parcel)', val: formatINR(summary.grossSales), bold: false },
        { label: 'Total Discounts (Coupons Applied)', val: '-' + formatINR(summary.totalDiscounts), bold: false, color: '#DC2626' },
        { label: 'Parcel Charges (Packaging)', val: formatINR(summary.parcelCharges), bold: false },
        { label: 'Refunds / Cancelled Paid Orders', val: '-' + formatINR(summary.refunds), bold: false, color: '#DC2626' },
        { label: 'NET REVENUE (Eligible Collections)', val: formatINR(summary.netRevenue), bold: true, highlight: true },
        { label: 'Cash Revenue (Counter / COD)', val: formatINR(summary.cashRevenue), bold: false },
        { label: 'Online Payment Revenue (Razorpay / UPI)', val: formatINR(summary.onlineRevenue), bold: false },
      ];

      finRows.forEach((r, idx) => {
        const rowY = currentY + idx * 16;
        if (r.highlight) {
          doc.rect(margin, rowY - 2, leftColW, 16).fill('#ECFDF5');
        } else if (idx % 2 === 1) {
          doc.rect(margin, rowY - 2, leftColW, 16).fill('#F8FAF9');
        }
        doc.fillColor(r.bold ? C_PRIMARY : C_TEXT).fontSize(8).font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(r.label, margin + 6, rowY + 2, { width: leftColW - 100 });
        doc.fillColor(r.color || (r.bold ? C_PRIMARY : C_TEXT)).fontSize(8).font(r.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(r.val, margin + leftColW - 90, rowY + 2, { width: 84, align: 'right' });
      });

      // Operations Metrics Right Box
      const rightX = margin + leftColW + 12;
      doc.rect(rightX, currentY - 2, rightColW, 16 * finRows.length).fillAndStroke('#FAFAFA', C_BORDER);
      doc.fillColor(C_PRIMARY).fontSize(8.5).font('Helvetica-Bold')
        .text('Operational Key Metrics', rightX + 10, currentY + 4, { width: rightColW - 20 });

      const opRows = [
        { label: 'Total Eligible Completed Orders', val: String(summary.totalOrders || 0) },
        { label: 'POS Counter Walk-in Orders', val: String(summary.posWalkInOrders || 0) },
        { label: 'Customer Online Orders', val: String(summary.customerOnlineOrders || 0) },
        { label: 'Refunded / Cancelled Orders', val: String(summary.refundedOrdersCount || 0) },
        { label: 'Average Order Value (AOV)', val: formatINR(summary.avgOrderValue) },
        { label: 'Tax Status', val: 'Inclusive (All Menu Items)' },
      ];

      opRows.forEach((op, idx) => {
        const opY = currentY + 22 + idx * 14.5;
        doc.fillColor(C_MUTED).fontSize(7.5).font('Helvetica')
          .text(op.label, rightX + 10, opY, { width: rightColW - 70 });
        doc.fillColor(C_TEXT).fontSize(7.5).font('Helvetica-Bold')
          .text(op.val, rightX + rightColW - 65, opY, { width: 55, align: 'right' });
      });

      currentY += 16 * finRows.length + 14;

      // ================= 4. PAYMENT RECONCILIATION =================
      doc.fillColor(C_PRIMARY).fontSize(10.5).font('Helvetica-Bold')
        .text('2. PAYMENT RECONCILIATION & CHANNEL AUDIT', margin, currentY);
      doc.rect(margin, currentY + 14, contentWidth, 1).fill(C_PRIMARY);
      currentY += 20;

      // 4 audit metric pill boxes across width
      const reconBoxW = (contentWidth - 18) / 4;
      const reconBoxes = [
        { title: 'Cash Collected', amt: formatINR(summary.cashRevenue), sub: 'Physical Cash Drawer' },
        { title: 'Digital / UPI', amt: formatINR(summary.onlineRevenue), sub: 'Razorpay / Gateway' },
        { title: 'Refunds Issued', amt: formatINR(summary.refunds), sub: 'Cancelled Transactions' },
        { title: 'Net Reconciled', amt: formatINR(summary.netRevenue), sub: 'Audited Final Canteen Revenue', primary: true },
      ];

      reconBoxes.forEach((b, idx) => {
        const bX = margin + idx * (reconBoxW + 6);
        doc.rect(bX, currentY, reconBoxW, 36).fillAndStroke(b.primary ? '#ECFDF5' : '#F8FAF9', b.primary ? '#A7F3D0' : C_BORDER);
        doc.fillColor(b.primary ? '#065F46' : C_MUTED).fontSize(6.5).font('Helvetica-Bold')
          .text(b.title.toUpperCase(), bX + 6, currentY + 4, { width: reconBoxW - 12 });
        doc.fillColor(b.primary ? C_PRIMARY : C_TEXT).fontSize(10).font('Helvetica-Bold')
          .text(b.amt, bX + 6, currentY + 14, { width: reconBoxW - 12 });
        doc.fillColor(C_MUTED).fontSize(6.5).font('Helvetica')
          .text(b.sub, bX + 6, currentY + 26, { width: reconBoxW - 12 });
      });

      currentY += 46;

      // ================= 5. DAILY REVENUE SUMMARY STATEMENT =================
      if (dailyTrends && dailyTrends.length > 0) {
        doc.fillColor(C_PRIMARY).fontSize(10.5).font('Helvetica-Bold')
          .text('3. DAILY REVENUE STATEMENT (IST)', margin, currentY);
        doc.rect(margin, currentY + 14, contentWidth, 1).fill(C_PRIMARY);
        currentY += 20;

        // Daily table headers
        const dCols = [
          { label: 'Date (IST)', w: 110, align: 'left' },
          { label: 'Total Orders', w: 75, align: 'center' },
          { label: 'Cash Revenue', w: 110, align: 'right' },
          { label: 'Online Revenue', w: 110, align: 'right' },
          { label: 'Net Revenue', w: 118, align: 'right' },
        ];

        // Draw header row
        doc.rect(margin, currentY, contentWidth, 15).fill(C_PRIMARY);
        let curX = margin;
        dCols.forEach((c) => {
          doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold')
            .text(c.label, curX + 4, currentY + 3.5, { width: c.w - 8, align: c.align });
          curX += c.w;
        });
        currentY += 15;

        dailyTrends.forEach((dItem, idx) => {
          if (idx % 2 === 1) doc.rect(margin, currentY, contentWidth, 14).fill('#F8FAF9');
          curX = margin;
          const vals = [
            formatISTDate(dItem._id),
            String(dItem.orders || 0),
            formatINR(dItem.cash),
            formatINR(dItem.digital),
            formatINR(dItem.revenue),
          ];

          dCols.forEach((c, cIdx) => {
            const isBold = cIdx === 0 || cIdx === 4;
            doc.fillColor(cIdx === 4 ? C_PRIMARY : C_TEXT).fontSize(7.5).font(isBold ? 'Helvetica-Bold' : 'Helvetica')
              .text(vals[cIdx], curX + 4, currentY + 3, { width: c.w - 8, align: c.align });
            curX += c.w;
          });
          currentY += 14;
        });

        currentY += 12;
      }

      // ================= 6. DETAILED TRANSACTION STATEMENT =================
      // Check if we need to start transactions on a new page or continue
      if (currentY > 620) {
        doc.addPage();
        currentY = margin;
      }

      doc.fillColor(C_PRIMARY).fontSize(10.5).font('Helvetica-Bold')
        .text('4. DETAILED TRANSACTION STATEMENT', margin, currentY);
      doc.rect(margin, currentY + 14, contentWidth, 1).fill(C_PRIMARY);
      currentY += 20;

      const tCols = [
        { label: 'S.No', w: 26, align: 'center' },
        { label: 'Order ID / Token', w: 90, align: 'left' },
        { label: 'Date & Time (IST)', w: 100, align: 'left' },
        { label: 'Channel', w: 58, align: 'center' },
        { label: 'Customer Name', w: 95, align: 'left' },
        { label: 'Payment', w: 60, align: 'center' },
        { label: 'Amount', w: 55, align: 'right' },
        { label: 'Status', w: 39, align: 'center' },
      ];

      const drawTxHeader = (yPos) => {
        doc.rect(margin, yPos, contentWidth, 15).fill(C_PRIMARY);
        let hX = margin;
        tCols.forEach((c) => {
          doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold')
            .text(c.label, hX + 2, yPos + 4, { width: c.w - 4, align: c.align });
          hX += c.w;
        });
      };

      drawTxHeader(currentY);
      currentY += 15;

      if (!transactions || transactions.length === 0) {
        doc.rect(margin, currentY, contentWidth, 24).fill('#F8FAF9');
        doc.fillColor(C_MUTED).fontSize(8).font('Helvetica')
          .text('No completed transactions recorded for this reporting period.', margin, currentY + 7, { width: contentWidth, align: 'center' });
        currentY += 28;
      } else {
        transactions.forEach((tx, idx) => {
          // Page overflow check
          if (currentY > pageHeight - margin - 40) {
            doc.addPage();
            currentY = margin;
            doc.fillColor(C_PRIMARY).fontSize(9).font('Helvetica-Bold')
              .text('4. DETAILED TRANSACTION STATEMENT (Continued)', margin, currentY);
            currentY += 14;
            drawTxHeader(currentY);
            currentY += 15;
          }

          if (idx % 2 === 1) doc.rect(margin, currentY, contentWidth, 13).fill('#F8FAF9');

          const isWalkIn = tx.orderType === 'WALK_IN';
          const token = tx.pickupToken || tx.orderCode?.replace('DRS-', '');
          const customer = isWalkIn
            ? (tx.walkInCustomer?.name || 'Walk-in')
            : (tx.user?.name || 'Student');

          const rowVals = [
            String(idx + 1),
            `#${token} (${tx.orderCode || '—'})`,
            formatISTDate(tx.completedAt || tx.createdAt, true),
            isWalkIn ? 'Walk-in' : 'Online',
            customer,
            String(tx.paymentMethod || 'cash').toUpperCase(),
            formatINR(tx.total),
            String(tx.paymentStatus || 'paid').toUpperCase(),
          ];

          let rX = margin;
          tCols.forEach((c, cIdx) => {
            const isBold = cIdx === 1 || cIdx === 6;
            doc.fillColor(cIdx === 6 ? C_PRIMARY : C_TEXT).fontSize(6.8).font(isBold ? 'Helvetica-Bold' : 'Helvetica')
              .text(rowVals[cIdx], rX + 2, currentY + 2.5, { width: c.w - 4, align: c.align, ellipsis: true });
            rX += c.w;
          });

          currentY += 13;
        });
      }

      // ================= 7. FOOTER PASS (ALL PAGES) =================
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = range.start; i < range.start + totalPages; i++) {
        doc.switchToPage(i);
        const footerY = pageHeight - margin - 18;

        // Thin separator rule
        doc.rect(margin, footerY - 4, contentWidth, 0.75).fill(C_BORDER);

        // Top footer row: Title | Report ID | Page X of Y
        doc.fillColor(C_MUTED).fontSize(7).font('Helvetica-Bold')
          .text('DRS QUICK SERVE • Internal Canteen Financial Statement', margin, footerY, { width: contentWidth / 2 });
        doc.fillColor(C_MUTED).fontSize(7).font('Helvetica')
          .text(`Report ID: ${reportId}   |   Generated: ${formatISTDate(generatedAt, true)}`, margin + contentWidth / 2, footerY, { width: contentWidth / 2 - 60, align: 'right' });
        doc.fillColor(C_PRIMARY).fontSize(7).font('Helvetica-Bold')
          .text(`Page ${i + 1} of ${totalPages}`, margin + contentWidth - 55, footerY, { width: 55, align: 'right' });

        // Bottom footer row: Confidentiality statement
        doc.fillColor('#94A3B8').fontSize(6.2).font('Helvetica-Oblique')
          .text('Confidential — For authorized canteen management and accounting use only.', margin, footerY + 10, { width: contentWidth, align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

