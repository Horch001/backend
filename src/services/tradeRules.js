const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Deposit = require('../models/Deposit');
const Violation = require('../models/Violation');
const { ORDER_STATUS, ROLES } = require('../utils/constants');

const POINTS_PER_PI = parseInt(process.env.POINTS_PER_PI || '1', 10);
const FEE_PERCENT = parseInt(process.env.FEE_PERCENT || '10', 10);
const SELLER_DEPOSIT_PI = parseInt(process.env.SELLER_DEPOSIT_PI || '1000', 10);

const toPoints = (piAmount) => Math.round(piAmount * POINTS_PER_PI);
const toPi = (points) => (points / POINTS_PER_PI).toFixed(2);

function signToken(user) {
  return jwt.sign({ uid: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function ensureAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD; // 仅用于初次创建占位（不做密码校验存储）
  if (!username || !password) return;
  let admin = await User.findOne({ username, role: ROLES.ADMIN });
  if (!admin) {
    admin = await User.create({ piUserId: `admin:${username}`, username, role: ROLES.ADMIN, isAdminSeed: true });
  }
}

function calcOrderFees(pricePoints) {
  const feePoints = Math.round((pricePoints * FEE_PERCENT) / 100);
  const escrowPoints = pricePoints - feePoints;
  return { feePoints, escrowPoints };
}

async function createOrderAfterPayment({ productId, buyerId }) {
  const product = await Product.findById(productId);
  if (!product || !product.isActive || !product.approved) throw new Error('商品不可用');
  const buyer = await User.findById(buyerId);
  if (!buyer) throw new Error('买家不存在');
  const seller = await User.findById(product.seller);
  if (!seller) throw new Error('卖家不存在');
  const { feePoints, escrowPoints } = calcOrderFees(product.pricePoints);
  const order = await Order.create({
    product: product._id,
    buyer: buyer._id,
    seller: seller._id,
    amountPoints: product.pricePoints,
    feePoints,
    escrowPoints,
    status: ORDER_STATUS.PAID
  });
  await Product.findByIdAndUpdate(product._id, { $inc: { soldCount: 1 } });
  return order;
}

async function requireSellerDeposit(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('用户不存在');
  const needPoints = toPoints(SELLER_DEPOSIT_PI);
  if (user.depositPoints < needPoints) {
    throw new Error(`需先缴纳押金 ${SELLER_DEPOSIT_PI}π`);
  }
}

async function paySellerDeposit(userId) {
  const user = await User.findById(userId);
  const requiredPoints = toPoints(SELLER_DEPOSIT_PI);
  // 已有押金达到或超过标准时，不重复扣款，仅保证角色为卖家
  if (user.depositPoints >= requiredPoints) {
    if (user.role !== ROLES.SELLER) {
      user.role = ROLES.SELLER;
      await user.save();
    }
    return user;
  }
  // 未达标则一次性补足到标准
  const toAdd = requiredPoints - user.depositPoints;
  user.depositPoints = requiredPoints;
  user.role = ROLES.SELLER;
  await user.save();
  await Deposit.create({ user: user._id, amountPoints: toAdd, status: 'paid' });
  return user;
}

async function shipOrder(orderId, sellerId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('订单不存在');
  if (String(order.seller) !== String(sellerId)) throw new Error('无权操作');
  order.status = ORDER_STATUS.SHIPPED;
  order.shippedAt = new Date();
  await order.save();
  return order;
}

async function confirmOrder(orderId, buyerId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('订单不存在');
  if (String(order.buyer) !== String(buyerId)) throw new Error('无权操作');
  order.status = ORDER_STATUS.COMPLETED;
  order.completedAt = new Date();
  await order.save();
  return order;
}

async function autoConfirmShippedOrders() {
  const fortyEightHoursAgo = dayjs().subtract(48, 'hour').toDate();
  const orders = await Order.find({ status: ORDER_STATUS.SHIPPED, shippedAt: { $lte: fortyEightHoursAgo } });
  for (const order of orders) {
    order.status = ORDER_STATUS.COMPLETED;
    order.completedAt = new Date();
    await order.save();
  }
  return orders.length;
}

async function recordViolation(userId, type, pointsDeducted = 0, note = '') {
  await Violation.create({ user: userId, type, pointsDeducted, note });
  await User.findByIdAndUpdate(userId, { $inc: { violations: 1 } });
}

module.exports = {
  POINTS_PER_PI,
  SELLER_DEPOSIT_PI,
  toPoints,
  toPi,
  signToken,
  ensureAdmin,
  createOrderAfterPayment,
  requireSellerDeposit,
  paySellerDeposit,
  shipOrder,
  confirmOrder,
  autoConfirmShippedOrders,
  recordViolation
};


