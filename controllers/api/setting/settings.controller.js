const bcrypt = require('bcryptjs');
const { prisma } = require('../../../config/db');
const { successResponse, errorResponse } = require('../../../Helper/helper');
const { writeLog } = require('../../../Helper/audit.helper');

const DEFAULT_MANAGER_PERMISSIONS = [
  { key: 'approve_refunds', label: 'Approve Refunds', description: 'Process and approve tenant refund requests', enabled: true },
  { key: 'edit_hostels', label: 'Edit Hostels', description: 'Create, edit, and delete hostel properties', enabled: true },
  { key: 'invite_vendors', label: 'Invite Vendors', description: 'Add new vendors to the system', enabled: true },
  { key: 'manage_employees', label: 'Manage Employees', description: 'Add, edit, and remove employee records', enabled: true },
  { key: 'view_financials', label: 'View Financials', description: 'Access financial reports and analytics', enabled: true },
  { key: 'send_messages', label: 'Send Messages', description: 'Send communications to tenants, employees, and vendors', enabled: true },
];

const DEFAULT_NOTIFICATION_PREFS = {
  email: {
    alerts: true,
    payments: true,
    updates: true,
  },
  sms: {
    alerts: false,
    payments: true,
  },
  push: {
    maintenance: true,
    communication: true,
  },
};

const getSettingValue = async (key, fallback) => {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch (err) {
    return fallback;
  }
};

const upsertSettingValue = async (key, value) => {
  await prisma.setting.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  });
};

const sanitizePermissions = (input) => {
  if (!Array.isArray(input)) return DEFAULT_MANAGER_PERMISSIONS;
  return input.map((item) => ({
    key: String(item.key || ''),
    label: String(item.label || item.key || ''),
    description: item.description ? String(item.description) : '',
    enabled: Boolean(item.enabled),
  }));
};

const sanitizeNotifications = (input) => {
  if (!input || typeof input !== 'object') return DEFAULT_NOTIFICATION_PREFS;
  const mergeSection = (section, defaults) => {
    const result = { ...defaults };
    if (section && typeof section === 'object') {
      Object.keys(defaults).forEach((key) => {
        if (section[key] !== undefined) result[key] = Boolean(section[key]);
      });
    }
    return result;
  };
  return {
    email: mergeSection(input.email, DEFAULT_NOTIFICATION_PREFS.email),
    sms: mergeSection(input.sms, DEFAULT_NOTIFICATION_PREFS.sms),
    push: mergeSection(input.push, DEFAULT_NOTIFICATION_PREFS.push),
  };
};

const getUserProfile = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
};

const buildSettingsDashboard = async (userId) => {
  const [profile, permissionsSetting, notificationsSetting, recentLogs] = await Promise.all([
    getUserProfile(userId),
    getSettingValue('manager_permissions', DEFAULT_MANAGER_PERMISSIONS),
    getSettingValue('notification_preferences', DEFAULT_NOTIFICATION_PREFS),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
  ]);

  return {
    profile,
    permissions: sanitizePermissions(permissionsSetting),
    notifications: sanitizeNotifications(notificationsSetting),
    recentActivity: recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      module: log.module,
      description: log.description,
      createdAt: log.createdAt,
      user: log.user,
    })),
  };
};

const updateProfileInternal = async (userId, { name, email, phone, password, currentPassword }) => {
  const data = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone;

  if (email !== undefined) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      throw new Error('Email already in use');
    }
    data.email = email;
  }

  if (password !== undefined) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.password) throw new Error('No password set for this account');
    const isValid = await bcrypt.compare(String(currentPassword || ''), user.password);
    if (!isValid) throw new Error('Current password is incorrect');
    data.password = await bcrypt.hash(String(password), 10);
  }

  if (Object.keys(data).length === 0) {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  return prisma.user.update({ where: { id: userId }, data });
};

const getSettingsDashboard = async (req, res) => {
  try {
    const data = await buildSettingsDashboard(req.userId);
    return successResponse(res, data, 'Settings dashboard fetched successfully');
  } catch (error) {
    console.error('Settings dashboard error:', error);
    return errorResponse(res, error.message);
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, password, currentPassword } = req.body || {};
    const user = await updateProfileInternal(req.userId, {
      name,
      email,
      phone,
      password,
      currentPassword,
    });

    await writeLog({
      userId: req.userId,
      action: 'update',
      module: 'settings',
      description: 'Updated profile information',
    });

    const profile = await getUserProfile(req.userId);
    return successResponse(res, profile, 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse(res, error.message);
  }
};

const updateManagerPermissions = async (req, res) => {
  try {
    const permissions = sanitizePermissions(req.body?.permissions || req.body);
    await upsertSettingValue('manager_permissions', permissions);
    await writeLog({
      userId: req.userId,
      action: 'update',
      module: 'settings',
      description: 'Updated manager permissions',
    });
    return successResponse(res, permissions, 'Manager permissions updated');
  } catch (error) {
    console.error('Update manager permissions error:', error);
    return errorResponse(res, error.message);
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const prefs = sanitizeNotifications(req.body);
    await upsertSettingValue('notification_preferences', prefs);
    await writeLog({
      userId: req.userId,
      action: 'update',
      module: 'settings',
      description: 'Updated notification preferences',
    });
    return successResponse(res, prefs, 'Notification preferences updated');
  } catch (error) {
    console.error('Update notification preferences error:', error);
    return errorResponse(res, error.message);
  }
};

// ---------------- Legacy/admin endpoints ----------------

const updateNameEmail = async (req, res) => {
  try {
    const { name, email } = req.body || {};
    await updateProfileInternal(req.userId, { name, email });
    await writeLog({
      userId: req.userId,
      action: 'update',
      module: 'profile',
      description: 'Updated name/email',
    });
    return successResponse(res, await getUserProfile(req.userId), 'Profile updated');
  } catch (error) {
    console.error('Update name/email error:', error);
    return errorResponse(res, error.message);
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword) return errorResponse(res, 'New password is required', 400);
    await updateProfileInternal(req.userId, { password: newPassword, currentPassword });
    await writeLog({
      userId: req.userId,
      action: 'update',
      module: 'profile',
      description: 'Changed password',
    });
    return successResponse(res, null, 'Password changed');
  } catch (error) {
    console.error('Change password error:', error);
    return errorResponse(res, error.message);
  }
};

const getSettings = async (_req, res) => {
  try {
    const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    return successResponse(res, rows);
  } catch (error) {
    console.error('Get settings error:', error);
    return errorResponse(res, error.message);
  }
};

const upsertSettings = async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    await prisma.$transaction(
      items.map((item) =>
        prisma.setting.upsert({
          where: { key: item.key },
          update: { value: String(item.value ?? '') },
          create: { key: item.key, value: String(item.value ?? '') },
        })
      )
    );
    await writeLog({
      userId: req.userId,
      action: 'update',
      module: 'settings',
      description: 'Updated settings',
    });
    return successResponse(res, null, 'Settings saved');
  } catch (error) {
    console.error('Upsert settings error:', error);
    return errorResponse(res, error.message);
  }
};

const addManager = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {};
    if (!name || !email || !password) {
      return errorResponse(res, 'Name, email, and password are required', 400);
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return errorResponse(res, 'Email already in use', 400);
    const hashed = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: hashed,
        role: 'manager',
        status: 'active',
      },
    });
    await writeLog({
      userId: req.userId,
      action: 'create',
      module: 'manager',
      description: `Manager ${email} created`,
    });
    return successResponse(res, user, 'Manager added');
  } catch (error) {
    console.error('Add manager error:', error);
    return errorResponse(res, error.message);
  }
};

const listManagers = async (_req, res) => {
  try {
    const rows = await prisma.user.findMany({
      where: { role: 'manager' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, rows);
  } catch (error) {
    console.error('List managers error:', error);
    return errorResponse(res, error.message);
  }
};

const updateManager = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return errorResponse(res, 'Invalid manager id', 400);
    const { name, email, phone, status, password } = req.body || {};
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (status !== undefined) data.status = status;
    if (password) data.password = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.update({ where: { id }, data });
    await writeLog({
      userId: req.userId,
      action: 'update',
      module: 'manager',
      description: `Manager #${id} updated`,
    });
    return successResponse(res, user, 'Manager updated');
  } catch (error) {
    console.error('Update manager error:', error);
    return errorResponse(res, error.message);
  }
};

const deleteManager = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return errorResponse(res, 'Invalid manager id', 400);
    await prisma.user.delete({ where: { id } });
    await writeLog({
      userId: req.userId,
      action: 'delete',
      module: 'manager',
      description: `Manager #${id} deleted`,
    });
    return successResponse(res, null, 'Manager deleted');
  } catch (error) {
    console.error('Delete manager error:', error);
    return errorResponse(res, error.message);
  }
};

const listActivityLogs = async (req, res) => {
  try {
    const { module, userId, from, to, limit = 50 } = req.query;
    const where = {};
    if (module) where.module = String(module);
    if (userId) where.userId = Number(userId);
    if (from || to) {
      where.createdAt = {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      };
    }
    const rows = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 50,
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    return successResponse(res, rows);
  } catch (error) {
    console.error('List activity logs error:', error);
    return errorResponse(res, error.message);
  }
};

const addScoreCard = async (req, res) => {
  try {
    const { entityType, entityId, score, criteria, remarks } = req.body || {};
    if (!entityType || !entityId || score === undefined) {
      return errorResponse(res, 'entityType, entityId, and score are required', 400);
    }
    const row = await prisma.scoreCard.create({
      data: {
        entityType,
        entityId: Number(entityId),
        score: Number(score),
        criteria: criteria || null,
        remarks: remarks || null,
        recordedBy: req.userId,
      },
    });
    await writeLog({
      userId: req.userId,
      action: 'create',
      module: 'scorecard',
      description: `${entityType}#${entityId} scored ${score}`,
    });
    return successResponse(res, row, 'Score recorded');
  } catch (error) {
    console.error('Add scorecard error:', error);
    return errorResponse(res, error.message);
  }
};

const getScoreCards = async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    const where = {};
    if (entityType) where.entityType = String(entityType);
    if (entityId) where.entityId = Number(entityId);
    const rows = await prisma.scoreCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, rows);
  } catch (error) {
    console.error('Get scorecards error:', error);
    return errorResponse(res, error.message);
  }
};

const scoreSummary = async (req, res) => {
  try {
    const { entityType } = req.query;
    const groups = await prisma.scoreCard.groupBy({
      by: ['entityType', 'entityId'],
      where: entityType ? { entityType } : undefined,
      _avg: { score: true },
      _count: { _all: true },
      orderBy: { entityId: 'asc' },
    });
    return successResponse(res, groups);
  } catch (error) {
    console.error('Score summary error:', error);
    return errorResponse(res, error.message);
  }
};

module.exports = {
  getSettingsDashboard,
  updateProfile,
  updateManagerPermissions,
  updateNotificationPreferences,
  updateNameEmail,
  changePassword,
  getSettings,
  upsertSettings,
  addManager,
  listManagers,
  updateManager,
  deleteManager,
  listActivityLogs,
  addScoreCard,
  getScoreCards,
  scoreSummary,
};

