const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amountPoints: { type: Number, required: true },
    status: { type: String, enum: ['requested', 'approved', 'rejected', 'paid'], default: 'requested' },
    reviewNote: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Withdrawal', withdrawalSchema);


