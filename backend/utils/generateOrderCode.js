import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order.js';

// Alphabet without ambiguous characters: no 0, O, 1, I, L (31 characters)
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ACTIVE_STATUSES = ['Placed', 'Confirmed', 'Preparing', 'Ready'];

/**
 * Generate a 4-character random token using crypto.randomInt (not Math.random).
 * No prefix, no date.
 */
export const generateToken = () => {
  let token = '';
  const len = ALPHABET.length;
  for (let i = 0; i < 4; i++) {
    token += ALPHABET[crypto.randomInt(0, len)];
  }
  return token;
};

/**
 * Generate a short 4-character order pickup token (e.g. K7P2).
 * - Alphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' (no 0, O, 1, I, L).
 * - Collision check only against ACTIVE orders: ['Placed', 'Confirmed', 'Preparing', 'Ready'].
 * - Retry up to 10 times, then throw a clear error (never loop forever).
 */
const generateOrderCode = async () => {
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const code = generateToken();

    // Collision check against active orders if MongoDB is connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const exists = await Order.exists({
        orderCode: code,
        status: { $in: ACTIVE_STATUSES },
      });
      if (!exists) {
        return code;
      }
    } else {
      return code;
    }
  }

  throw new Error(
    `Failed to generate a unique 4-character order token after ${maxRetries} attempts due to active order collisions.`
  );
};

export default generateOrderCode;
