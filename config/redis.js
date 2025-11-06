const Redis = require('ioredis');

let redis;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
  });

  redis.on('connect', () => console.log('✅ Redis connected'));
  redis.on('error', (err) => console.warn('⚠️ Redis error:', err.message));
} catch (err) {
  console.warn('⚠️ Redis init failed, fallback to in-memory cache');
  redis = null;
}

module.exports = redis;
