const { prisma } = require('../../config/db');
const nodemailer = require('nodemailer');
const { sendWhatsApp, normalizePhone } = require('../../Helper/whatsapp.helper');

// ----- Nodemailer -----
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendEmail = async (to, subject, message) => {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html: message
  });
};

// ======== Build Recipients ========
const getRecipients = async (targetType) => {
  let list = [];
  const add = (arr, fn) => arr.forEach((x) => { const val = fn(x); if (val) list.push(val); });

  if (targetType === 'tenant' || targetType === 'all') {
    const tenants = await prisma.tenant.findMany({ select: { phone: true, email: true } });
    add(tenants, (t) => t);
  }
  if (targetType === 'vendor' || targetType === 'all') {
    const vendors = await prisma.vendor.findMany({ select: { phone: true, email: true } });
    add(vendors, (v) => v);
  }
  if (targetType === 'employee' || targetType === 'all') {
    const employees = await prisma.employee.findMany({
      include: { user: { select: { phone: true, email: true } } }
    });
    add(employees, (e) => e.user);
  }

  return list.filter(Boolean);
};

// ======== Create Campaign ========
exports.createCampaign = async (req, res) => {
  try {
    const { title, subject, message, campaignType, channel, targetType, recipients } = req.body;

    const campaign = await prisma.campaign.create({
      data: {
        title,
        subject,
        message,
        campaignType,
        channel,
        targetType,
        recipients: recipients ? JSON.parse(recipients) : [],
        createdBy: req.userId
      }
    });

    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ======== List All ========
exports.listCampaigns = async (_req, res) => {
  const data = await prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data });
};

// ======== Send Campaign ========
exports.sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await prisma.campaign.findUnique({ where: { id: Number(id) } });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const recipients = await getRecipients(campaign.targetType);
    const callbackUrl = `${process.env.APP_BASE_URL}/api/webhooks/twilio/whatsapp-status`;
    let sent = 0;

    for (const r of recipients) {
      try {
        if (campaign.channel === 'whatsapp' && r.phone) {
          const phone = normalizePhone(r.phone);
          const msg = await sendWhatsApp(phone, campaign.message, callbackUrl);
          await prisma.campaignLog.create({
            data: {
              campaignId: campaign.id,
              channel: 'whatsapp',
              status: 'sent',
              recipientPhone: phone,
              providerMessageId: msg.sid
            }
          });
        } else if (campaign.channel === 'email' && r.email) {
          await sendEmail(r.email, campaign.subject, campaign.message);
          await prisma.campaignLog.create({
            data: {
              campaignId: campaign.id,
              channel: 'email',
              status: 'sent',
              recipientEmail: r.email
            }
          });
        }
        sent++;
      } catch (err) {
        await prisma.campaignLog.create({
          data: {
            campaignId: campaign.id,
            channel: campaign.channel,
            status: 'failed',
            recipientEmail: r.email,
            recipientPhone: r.phone
          }
        });
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'sent', sendDate: new Date() }
    });

    res.json({ success: true, total: recipients.length, sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ======== Get Logs ========
exports.getLogs = async (req, res) => {
  const { id } = req.params;
  const logs = await prisma.campaignLog.findMany({
    where: { campaignId: Number(id) },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, logs });
};

// ======== Webhooks (Twilio) ========
exports.twilioStatusWebhook = async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;
    const log = await prisma.campaignLog.findUnique({ where: { providerMessageId: MessageSid } });
    if (!log) return res.send('OK');

    const status = MessageStatus?.toLowerCase();
    const update = {};
    if (status === 'delivered') update.status = 'delivered', update.deliveredAt = new Date();
    if (status === 'read') update.status = 'read', update.readAt = new Date();
    if (status === 'failed') update.status = 'failed';

    await prisma.campaignLog.update({ where: { id: log.id }, data: update });
    res.send('OK');
  } catch {
    res.send('OK');
  }
};

exports.twilioInboundWebhook = async (req, res) => {
  try {
    const { From, Body } = req.body;
    const phone = (From || '').replace('whatsapp:', '');
    const latest = await prisma.campaignLog.findFirst({
      where: { channel: 'whatsapp', recipientPhone: phone },
      orderBy: { createdAt: 'desc' }
    });
    if (latest) {
      await prisma.campaignLog.update({
        where: { id: latest.id },
        data: { status: 'replied', repliedAt: new Date(), replyText: Body }
      });
    }
    res.send('OK');
  } catch {
    res.send('OK');
  }
};
