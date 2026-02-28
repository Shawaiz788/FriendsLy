// User model for account management
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: false, unique: true },
  phone: { type: String, required: false, unique: true },
  name: { type: String, required: true },
  photo: { type: String },
  interests: [{ type: String }],
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  sessionTokens: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);