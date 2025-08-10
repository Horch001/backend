const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    pointsDeducted: { type: Number, default: 0 },
    note: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Violation', violationSchema);


