const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amountPoints: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'refund_requested', 'refunded', 'denied'], default: 'paid' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Deposit', depositSchema);


