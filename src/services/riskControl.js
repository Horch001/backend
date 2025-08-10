const User = require('../models/User');
const { recordViolation } = require('./tradeRules');

async function penalizeSellerDeposit(userId, penaltyPoints, reason) {
  const user = await User.findById(userId);
  if (!user) throw new Error('用户不存在');
  const deducted = Math.min(user.depositPoints, penaltyPoints);
  user.depositPoints -= deducted;
  await user.save();
  await recordViolation(userId, reason || 'penalty', deducted, '押金扣除');
  return deducted;
}

module.exports = { penalizeSellerDeposit };


