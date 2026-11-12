import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

const resolveAccountType = (user) =>
  user.accountType ||
  (user.role === 'admin' || user.role === 'ADMIN'
    ? 'ADMIN'
    : user.role === 'STAFF'
    ? 'STAFF'
    : 'STUDENT');

const buildAuthPayload = (user, token = null) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  accountType: resolveAccountType(user),
  phone: user.phone || '',
  avatar: user.avatar || '',
  studentDetails: user.studentDetails,
  staffDetails: user.staffDetails,
  ...(token ? { token } : {}),
});

// @desc    Register a new customer user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !String(name).trim() || !email || !password) {
      res.status(400);
      throw new Error('Please fill in your full name, email address, and password');
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      res.status(400);
      throw new Error('Please provide a valid email address');
    }

    if (String(password).length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters long');
    }

    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists with this email');
    }

    // Strictly assign normal customer role; Admin/Employee cannot be created via public signup
    const user = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      password,
      phone: phone ? String(phone).replace(/\D/g, '') : '',
      role: 'STUDENT',
      accountType: 'STUDENT',
    });

    if (user) {
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: buildAuthPayload(user, generateToken(user._id)),
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please enter email and password');
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (user && (await user.matchPassword(password))) {
      if (user.isActive === false) {
        res.status(403);
        throw new Error('Your account has been disabled.');
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: buildAuthPayload(user, generateToken(user._id)),
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (user) {
      res.json({
        success: true,
        data: buildAuthPayload(user),
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone !== undefined ? req.body.phone : user.phone;

      // Email change checking
      if (req.body.email && req.body.email !== user.email) {
        const cleanEmail = String(req.body.email).trim().toLowerCase();
        const emailExists = await User.findOne({ email: cleanEmail });
        if (emailExists) {
          res.status(400);
          throw new Error('Email already in use');
        }
        user.email = cleanEmail;
      }

      if (req.body.studentDetails && user.role === 'STUDENT') {
        user.studentDetails = {
          ...user.studentDetails,
          ...req.body.studentDetails,
        };
      }

      if (req.body.staffDetails && user.role === 'STAFF') {
        user.staffDetails = {
          ...user.staffDetails,
          ...req.body.staffDetails,
        };
      }

      const updatedUser = await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: buildAuthPayload(updatedUser, generateToken(updatedUser._id)),
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400);
      throw new Error('Please fill in both password fields');
    }

    if (String(newPassword).length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters long');
    }

    const user = await User.findById(req.user._id);

    if (user && (await user.matchPassword(oldPassword))) {
      user.password = newPassword;
      await user.save();
      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } else {
      res.status(401);
      throw new Error('Invalid current password');
    }
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    res.json({ success: false, message: error.message });
  }
};

export {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
};
