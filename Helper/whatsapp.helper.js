const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const normalizePhone = (raw) => {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  if (!digits.startsWith('+')) return `+${digits}`;
  return digits;
};

const sendWhatsApp = async (toE164, body, statusCbUrl) => {
  return client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${toE164}`,
    body,
    statusCallback: statusCbUrl
  });
};

module.exports = { sendWhatsApp, normalizePhone };
