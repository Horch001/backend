const mongoose = require('mongoose');

const connectDb = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    // eslint-disable-next-line no-console
    console.error('Missing MONGO_URI');
    process.exit(1);
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: undefined });
  // eslint-disable-next-line no-console
  console.log('MongoDB connected');
};

module.exports = { connectDb };


