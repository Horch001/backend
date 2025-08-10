const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    roomId: { type: String, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    read: { type: Boolean, default: false }, // 消息是否已读
    product: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      title: String,
      subtitle: String,
      price: Number,
      image: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);


