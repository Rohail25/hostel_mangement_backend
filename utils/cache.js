const redis = require('../config/redis');

let memoryCache = {};

const setCache = async (key, data, ttl = 600) => {
  try {
    if (redis) await redis.setex(key, ttl, JSON.stringify(data));
    else memoryCache[key] = { data, expires: Date.now() + ttl * 1000 };
  } catch (err) {
    console.warn('⚠️ Cache set failed:', err.message);
  }
};

const getCache = async (key) => {
  try {
    if (redis) {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } else {
      const cached = memoryCache[key];
      if (!cached) return null;
      if (cached.expires < Date.now()) {
        delete memoryCache[key];
        return null;
      }
      return cached.data;
    }
  } catch (err) {
    console.warn('⚠️ Cache get failed:', err.message);
    return null;
  }
};

module.exports = { setCache, getCache };
