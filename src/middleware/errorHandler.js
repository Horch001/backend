const { jsonErr } = require('../utils/response');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status || 500;
  res.status(status).json(jsonErr(err.message || 'Server Error', err.code || 'SERVER_ERROR'));
};

module.exports = { errorHandler };


