import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SYSh7FU8tidKTo',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_secret_here',
});

export default razorpay;
