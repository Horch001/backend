const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    pricePoints: { type: Number, required: true },
    stock: { type: Number, required: true, min: 0 },
    soldCount: { type: Number, default: 0 },
    favoritesCount: { type: Number, default: 0 },
    images: [{ type: String }],
    category: { type: String, index: true },
    deliveryMethod: { type: String, default: '网盘发货' },
    isActive: { type: Boolean, default: true },
    approved: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);


