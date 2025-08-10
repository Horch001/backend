const mongoose = require('mongoose');

const priceModificationSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    oldPrice: { type: Number, required: true },
    newPrice: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PriceModification', priceModificationSchema);
