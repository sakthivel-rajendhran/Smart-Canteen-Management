import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

// @desc    Register a new user (Student or College Staff)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      accountType,
      studentDetails,
      staffDetails,
    } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Please fill all required fields');
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

    // STRICT SECURITY: Public registration can ONLY create STUDENT or STAFF accounts
    // Admin accounts can NEVER be created through public registration
    const targetAccountType = accountType === 'STAFF' ? 'STAFF' : 'STUDENT';
    const targetRole = targetAccountType;

    const userData = {
      name: String(name).trim(),
      email: cleanEmail,
      password,
      phone: phone ? String(phone).replace(/\D/g, '') : '',
      role: targetRole,
      accountType: targetAccountType,
    };

    if (targetAccountType === 'STUDENT') {
      userData.studentDetails = {
        registerNumber: studentDetails?.registerNumber ? String(studentDetails.registerNumber).trim() : '',
        department: studentDetails?.department ? String(studentDetails.department).trim() : '',
        year: studentDetails?.year ? String(studentDetails.year).trim() : '',
      };
      userData.staffDetails = null;
    } else {
      userData.staffDetails = {
        staffId: staffDetails?.staffId ? String(staffDetails.staffId).trim() : '',
        department: staffDetails?.department ? String(staffDetails.department).trim() : '',
      };
      userData.studentDetails = null;
    }

    const user = await User.create(userData);

    if (user) {
      res.status(201).json({
        success: true,
        message: `${targetAccountType === 'STAFF' ? 'College Staff' : 'Student'} registration successful`,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          accountType: user.accountType,
          phone: user.phone,
          studentDetails: user.studentDetails,
          staffDetails: user.staffDetails,
          token: generateToken(user._id),
        },
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
      // Safe fallback account type for existing accounts
      const resolvedAccountType =
        user.accountType ||
        (user.role === 'admin' || user.role === 'ADMIN'
          ? 'ADMIN'
          : user.role === 'STAFF'
          ? 'STAFF'
          : 'STUDENT');

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          accountType: resolvedAccountType,
          phone: user.phone,
          studentDetails: user.studentDetails,
          staffDetails: user.staffDetails,
          token: generateToken(user._id),
        },
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
        data: user,
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
        const emailExists = await User.findOne({ email: req.body.email });
        if (emailExists) {
          res.status(400);
          throw new Error('Email already in use');
        }
        user.email = req.body.email;
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
        data: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          accountType: updatedUser.accountType || updatedUser.role,
          phone: updatedUser.phone,
          studentDetails: updatedUser.studentDetails,
          staffDetails: updatedUser.staffDetails,
          token: generateToken(updatedUser._id),
        },
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

export { registerUser, loginUser, getUserProfile, updateUserProfile, changePassword };
