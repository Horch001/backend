const cron = require('node-cron');
const { autoConfirmShippedOrders } = require('./tradeRules');

function startSchedulers() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const num = await autoConfirmShippedOrders();
      if (num) {
        // eslint-disable-next-line no-console
        console.log(`[scheduler] auto confirmed ${num} orders`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[scheduler] error', e.message);
    }
  });
}

module.exports = { startSchedulers };


