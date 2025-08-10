const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Complaint = require('../models/Complaint');
const Order = require('../models/Order');
const { jsonOk, jsonErr } = require('../utils/response');

router.post(
  '/',
  auth,
  body('orderId').isString().notEmpty(),
  body('reason').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(jsonErr('参数错误', 'VALIDATION_ERROR', errors.array()));
    const { orderId, reason, evidenceUrls = [] } = req.body;
    const order = await Order.findById(orderId);
    if (!order || String(order.buyer) !== String(req.user._id)) return res.status(400).json(jsonErr('无效订单'));
    const complaint = await Complaint.create({ order: order._id, buyer: order.buyer, seller: order.seller, reason, evidenceUrls });
    order.complaint = complaint._id;
    await order.save();
    res.json(jsonOk({ complaint }));
  }
);

router.get('/my', auth, async (req, res) => {
  const complaints = await Complaint.find({ buyer: req.user._id }).sort({ createdAt: -1 });
  res.json(jsonOk({ complaints }));
});

module.exports = router;


