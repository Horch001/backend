const mongoose = require('mongoose');
const { COMPLAINT_STATUS } = require('../utils/constants');

const complaintSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    evidenceUrls: [{ type: String }],
    status: { type: String, enum: Object.values(COMPLAINT_STATUS), default: COMPLAINT_STATUS.PENDING },
    decision: { type: String },
    penaltyPoints: { type: Number, default: 0 },
    resolutionNote: { type: String },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);


