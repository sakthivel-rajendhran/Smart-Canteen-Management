import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId && !this.firebaseUid && this.authProvider !== 'google';
      },
      default: '',
    },
    firebaseUid: {
      type: String,
      sparse: true,
      unique: true,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'hybrid'],
      default: 'local',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'STUDENT', 'STAFF', 'ADMIN'],
      default: 'STUDENT',
    },
    accountType: {
      type: String,
      enum: ['STUDENT', 'STAFF', 'ADMIN'],
      default: 'STUDENT',
    },
    studentDetails: {
      registerNumber: { type: String, default: '' },
      department: { type: String, default: '' },
      year: { type: String, default: '' },
    },
    staffDetails: {
      staffId: { type: String, default: '' },
      department: { type: String, default: '' },
    },
    avatar: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
