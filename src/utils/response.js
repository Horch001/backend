const jsonOk = (data = null, message = 'ok') => ({ success: true, message, data });
const jsonErr = (message = 'error', code = 'BAD_REQUEST', details = null) => ({ success: false, message, code, details });

module.exports = { jsonOk, jsonErr };


