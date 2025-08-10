const ORDER_STATUS = Object.freeze({
  PAID: 'paid',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  CANCELED: 'canceled'
});

const COMPLAINT_STATUS = Object.freeze({
  PENDING: 'pending',
  RESOLVED: 'resolved',
  REJECTED: 'rejected'
});

const ROLES = Object.freeze({
  BUYER: 'buyer',
  SELLER: 'seller',
  ADMIN: 'admin'
});

module.exports = { ORDER_STATUS, COMPLAINT_STATUS, ROLES };


