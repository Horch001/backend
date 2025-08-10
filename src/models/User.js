const mongoose = require('mongoose');
const { ROLES } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    piUserId: { type: String, index: true, unique: true },
    username: { type: String },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.BUYER },
    balancePoints: { type: Number, default: 0 },
    frozenPoints: { type: Number, default: 0 },
    depositPoints: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    violations: { type: Number, default: 0 },
    banned: { type: Boolean, default: false },
    isAdminSeed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);


