const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');
const { ensureAdmin } = require('./services/tradeRules');
const { startSchedulers } = require('./services/scheduler');

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, async () => {
  await ensureAdmin();
  startSchedulers();
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});


