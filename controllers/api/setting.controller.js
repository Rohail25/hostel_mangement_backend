const bcrypt = require("bcryptjs");
const { prisma } = require("../../config/db");
const { successResponse, errorResponse } = require("../../Helper/helper");
const { writeLog } = require("../../Helper/audit.helper");

// ========== PROFILE (logged-in admin/manager) ==========
exports.updateNameEmail = async (req, res) => {
  try {
    const { name, email } = req.body; // User model uses "name"
    const data = {};
    if (name) data.name = name;
    if (email) {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists && exists.id !== req.userId)
        return errorResponse(res, "Email already in use", 400);
      data.email = email;
    }
    const user = await prisma.user.update({ where: { id: req.userId }, data });
    await writeLog({
      userId: req.userId,
      action: "update",
      module: "profile",
      description: "Updated name/email",
    });
    return successResponse(res, user, "Profile updated");
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.password) return errorResponse(res, "No password set", 400);

    const ok = await bcrypt.compare(
      String(currentPassword || ""),
      user.password
    );
    if (!ok) return errorResponse(res, "Current password is incorrect", 400);

    const hashed = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashed },
    });
    await writeLog({
      userId: req.userId,
      action: "update",
      module: "profile",
      description: "Changed password",
    });
    return successResponse(res, null, "Password changed");
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

// ========== KEY–VALUE SETTINGS ==========
exports.getSettings = async (_req, res) => {
  try {
    const rows = await prisma.setting.findMany({ orderBy: { key: "asc" } });
    return successResponse(res, rows);
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

// expects: [{key:"company_name", value:"Hostelity"}, ...]
exports.upsertSettings = async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    await prisma.$transaction(
      items.map((it) =>
        prisma.setting.upsert({
          where: { key: it.key },
          update: { value: String(it.value ?? "") },
          create: { key: it.key, value: String(it.value ?? "") },
        })
      )
    );
    await writeLog({
      userId: req.userId,
      action: "update",
      module: "settings",
      description: "Updated settings",
    });
    return successResponse(res, null, "Settings saved");
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

// ========== MANAGERS ==========
exports.addManager = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const exist = await prisma.user.findUnique({ where: { email } });
    if (exist) return errorResponse(res, "Email already in use", 400);

    const hashed = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashed,
        role: "manager",
        status: "active",
      },
    });
    await writeLog({
      userId: req.userId,
      action: "create",
      module: "manager",
      description: `Manager ${email} created`,
    });
    return successResponse(res, user, "Manager added");
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

exports.listManagers = async (_req, res) => {
  try {
    const rows = await prisma.user.findMany({
      where: { role: "manager" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });
    return successResponse(res, rows);
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

exports.updateManager = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, phone, status, password } = req.body;
    const data = { name, email, phone, status };
    if (password) data.password = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.update({ where: { id }, data });
    await writeLog({
      userId: req.userId,
      action: "update",
      module: "manager",
      description: `Manager #${id} updated`,
    });
    return successResponse(res, user, "Manager updated");
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

exports.deleteManager = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.user.delete({ where: { id } });
    await writeLog({
      userId: req.userId,
      action: "delete",
      module: "manager",
      description: `Manager #${id} deleted`,
    });
    return successResponse(res, null, "Manager deleted");
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

// ========== ACTIVITY LOGS ==========
exports.listActivityLogs = async (req, res) => {
  try {
    const { module, userId, from, to } = req.query;
    const where = {};
    if (module) where.module = String(module);
    if (userId) where.userId = Number(userId);
    if (from || to)
      where.createdAt = {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      };
    const rows = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    return successResponse(res, rows);
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

// ========== SCORE CARDS ==========
exports.addScoreCard = async (req, res) => {
  try {
    const { entityType, entityId, score, criteria, remarks } = req.body;
    const row = await prisma.scoreCard.create({
      data: {
        entityType,
        entityId: Number(entityId),
        score: Number(score),
        criteria,
        remarks,
        recordedBy: req.userId,
      },
    });
    await writeLog({
      userId: req.userId,
      action: "create",
      module: "scorecard",
      description: `${entityType}#${entityId} scored ${score}`,
    });
    return successResponse(res, row, "Score recorded");
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

exports.getScoreCards = async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    const where = {};
    if (entityType) where.entityType = String(entityType);
    if (entityId) where.entityId = Number(entityId);

    const rows = await prisma.scoreCard.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return successResponse(res, rows);
  } catch (e) {
    return errorResponse(res, e.message);
  }
};

exports.scoreSummary = async (req, res) => {
  try {
    const { entityType } = req.query; // optional
    const groups = await prisma.scoreCard.groupBy({
      by: ["entityType", "entityId"],
      where: entityType ? { entityType } : undefined,
      _avg: { score: true },
      _count: { _all: true },
      orderBy: { entityId: "asc" },
    });
    return successResponse(res, groups);
  } catch (e) {
    return errorResponse(res, e.message);
  }
};
