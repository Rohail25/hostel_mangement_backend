const { prisma } = require('../config/db');

async function writeLog({ userId, action, module, description }) {
  try {
    await prisma.activityLog.create({
      data: { userId: userId || null, action, module, description }
    });
  } catch (_) { /* ignore logging failures */ }
}

module.exports = { writeLog };
