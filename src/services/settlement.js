const Order = require('../models/Order');
const User = require('../models/User');
const { ORDER_STATUS } = require('../utils/constants');

async function settleOrderPayout(orderId, adminId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== ORDER_STATUS.COMPLETED) throw new Error('订单未完成');
  if (order.settled) return order;
  const seller = await User.findById(order.seller);
  seller.balancePoints += order.escrowPoints;
  await seller.save();
  order.settled = true;
  order.settledAt = new Date();
  await order.save();
  return order;
}

async function refundOrder(orderId, adminId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status === ORDER_STATUS.REFUNDED) return order;
  // 若已结算给卖家，暂不支持直接退款（需额外回收流程）。这里简单限制：仅在非结算状态下可退款。
  if (order.settled) throw new Error('已结算订单不可直接退款');
  const buyer = await User.findById(order.buyer);
  // 简化：退款全额（包含手续费），实际业务可按需调整
  buyer.balancePoints += order.amountPoints;
  await buyer.save();
  order.status = ORDER_STATUS.REFUNDED;
  await order.save();
  return order;
}

module.exports = { settleOrderPayout };
module.exports.refundOrder = refundOrder;


