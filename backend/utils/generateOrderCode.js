import crypto from 'crypto';

/**
 * Generate a DRS order code formatted as DRS-YYMMDD-XXXX
 * - YYMMDD: Current calendar date in Asia/Kolkata timezone (IST)
 * - XXXX: 4 random uppercase alphanumeric characters (0-9, A-Z)
 */
const generateOrderCode = () => {
  const now = new Date();
  const istDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const yymmdd = istDateParts.replace(/-/g, '');

  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomPart = '';
  const randomBytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    randomPart += chars[randomBytes[i] % chars.length];
  }

  return `DRS-${yymmdd}-${randomPart}`;
};

export default generateOrderCode;
