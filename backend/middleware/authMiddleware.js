import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeydrsquickserve12345');
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      return next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
};

export { protect };
