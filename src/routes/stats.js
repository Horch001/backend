const router = require('express').Router();
const Order = require('../models/Order');
const Violation = require('../models/Violation');
const Product = require('../models/Product');
const { jsonOk } = require('../utils/response');

router.get('/sold/:productId', async (req, res) => {
  const count = await Order.countDocuments({ product: req.params.productId });
  res.json(jsonOk({ soldCount: count }));
});

router.get('/fees', async (req, res) => {
  const ret = await Order.aggregate([{ $group: { _id: null, feePoints: { $sum: '$feePoints' } } }]);
  res.json(jsonOk({ feePoints: ret[0]?.feePoints || 0 }));
});

router.get('/violations/:userId', async (req, res) => {
  const count = await Violation.countDocuments({ user: req.params.userId });
  res.json(jsonOk({ count }));
});

router.get('/top-products', async (req, res) => {
  const items = await Product.find({ isActive: true, approved: true }).sort({ soldCount: -1 }).limit(10).lean();
  res.json(jsonOk({ items }));
});

module.exports = router;


