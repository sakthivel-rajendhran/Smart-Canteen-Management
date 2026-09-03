import Order from '../models/Order.js';

const generateOrderCode = async () => {
  let isUnique = false;
  let code = '';

  while (!isUnique) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    code = `DRS-${randomNum}`;

    const existingOrder = await Order.findOne({ orderCode: code });
    if (!existingOrder) {
      isUnique = true;
    }
  }

  return code;
};

export default generateOrderCode;
