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
  console.log(`🚀 API 服务器启动成功`);
  console.log(`📍 监听端口: ${PORT}`);
  console.log(`🌐 环境变量:`, {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    PI_SANDBOX: process.env.PI_SANDBOX,
    MOCK_PAY: process.env.MOCK_PAY
  });
});


