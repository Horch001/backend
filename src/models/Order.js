const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../utils/constants');

const orderSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amountPoints: { type: Number, required: true },
    feePoints: { type: Number, required: true },
    escrowPoints: { type: Number, required: true },
    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PAID },
    shippedAt: { type: Date },
    completedAt: { type: Date },
    settled: { type: Boolean, default: false },
    settledAt: { type: Date },
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);


