import nodemailer from "nodemailer";
import { formatDate, formatEC, formatStatus, GOLD, PINK } from "./mailTheme.js";

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
const notifyTo = process.env.ADMIN_NOTIFY_EMAIL || process.env.STUDIO_EMAIL || "";
const adminUrl = process.env.ADMIN_URL || "http://localhost:5174";

export const adminMailEnabled = Boolean(gmailUser && gmailAppPassword && notifyTo);

let transporter = null;

function getTransporter() {
  if (!adminMailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });
  }
  return transporter;
}

const EVENT_STYLES = {
  created: {
    label: "New Booking",
    accent: PINK.blush,
    accentBg: PINK.bgSoft,
    icon: "✦",
  },
  deposit_submitted: {
    label: "Deposit to Review",
    accent: GOLD.dim,
    accentBg: "#faf6ec",
    icon: "◎",
  },
  approved: {
    label: "Confirmed",
    accent: GOLD.dim,
    accentBg: "rgba(201, 169, 98, 0.15)",
    icon: "✓",
  },
  expired: {
    label: "Booking Expired",
    accent: "#b85c55",
    accentBg: "#fdf0ef",
    icon: "○",
  },
};

const ADMIN_MESSAGES = {
  created: (booking) => ({
    subject: `[Liyelle] New booking — ${booking.reference}`,
    headline: "New appointment booked",
    intro: "A client reserved a slot and is awaiting deposit payment.",
    cta: "View in admin",
  }),
  deposit_submitted: (booking) => ({
    subject: `[Liyelle] Deposit to review — ${booking.reference}`,
    headline: "Deposit proof uploaded",
    intro: "A client submitted their transfer screenshot. Please review and approve or decline.",
    cta: "Review deposit",
  }),
  approved: (booking) => ({
    subject: `[Liyelle] Booking confirmed — ${booking.reference}`,
    headline: "Appointment confirmed",
    intro: "This booking was approved and the client has been notified.",
    cta: "View booking",
  }),
  expired: (booking) => ({
    subject: `[Liyelle] Booking expired — ${booking.reference}`,
    headline: "Booking hold expired",
    intro: "The deposit window closed and this slot was released.",
    cta: "View booking",
  }),
};

function buildBookingEmailHtml(event, booking, meta) {
  const style = EVENT_STYLES[event] || EVENT_STYLES.created;
  const rows = [
    ["Reference", booking.reference],
    ["Client", booking.clientName],
    ["Phone", booking.phone],
    booking.email ? ["Email", booking.email] : null,
    ["Service", booking.serviceName],
    ["Appointment", `${formatDate(booking.date)} · ${booking.time}`],
    ["Deposit", formatEC(booking.depositAmount)],
    ["Status", formatStatus(booking.status)],
  ].filter(Boolean);

  const detailRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${PINK.border};color:${PINK.label};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;width:130px;vertical-align:top;">${label}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${PINK.border};color:${PINK.text};font-size:15px;font-weight:600;vertical-align:top;">${value}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${meta.subject}</title>
</head>
<body style="margin:0;padding:0;background:${PINK.bgPage};font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PINK.bgPage};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${PINK.white};border-radius:18px;overflow:hidden;border:1px solid ${PINK.border};box-shadow:0 12px 40px rgba(139,74,82,0.10);">
          <tr>
            <td style="background:linear-gradient(135deg,${PINK.bg} 0%,${PINK.bgSoft} 100%);padding:28px 32px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${GOLD.dim};font-family:Arial,Helvetica,sans-serif;">The Liyelle Atelier</p>
              <h1 style="margin:0;font-size:30px;font-weight:400;color:${PINK.blush};font-family:Georgia,'Times New Roman',serif;">Liyelle</h1>
              <p style="margin:8px 0 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${GOLD.dim};font-family:Arial,Helvetica,sans-serif;">Admin Alert · Salon Studio</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:${style.accentBg};color:${style.accent};padding:8px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">
                    ${style.icon}&nbsp; ${style.label}
                  </td>
                </tr>
              </table>
              <h2 style="margin:18px 0 10px;font-size:24px;font-weight:600;color:${PINK.text};font-family:Georgia,'Times New Roman',serif;">${meta.headline}</h2>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${PINK.muted};font-family:Arial,Helvetica,sans-serif;">${meta.intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PINK.cardBg};border:1px solid ${PINK.borderSoft};border-radius:14px;padding:4px 18px;">
                ${detailRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${adminUrl}" style="display:inline-block;background:linear-gradient(135deg,${GOLD.main},${GOLD.dim});color:${GOLD.text};text-decoration:none;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:700;letter-spacing:0.04em;font-family:Arial,Helvetica,sans-serif;">${meta.cta}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid ${PINK.borderSoft};text-align:center;">
              <p style="margin:0;font-size:12px;color:${PINK.label};line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
                Automated booking alert · The Liyelle Atelier
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildBookingEmailText(event, booking, meta) {
  const lines = [
    meta.headline,
    meta.intro,
    "",
    `Reference: ${booking.reference}`,
    `Client: ${booking.clientName}`,
    `Phone: ${booking.phone}`,
    booking.email ? `Email: ${booking.email}` : null,
    `Service: ${booking.serviceName}`,
    `When: ${formatDate(booking.date)} at ${booking.time}`,
    `Deposit: ${formatEC(booking.depositAmount)}`,
    `Status: ${formatStatus(booking.status)}`,
    "",
    `Admin: ${adminUrl}`,
    "",
    "— The Liyelle Atelier",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function notifyAdminBooking(event, booking, _extra = {}) {
  if (!adminMailEnabled || !booking) return;

  const template = ADMIN_MESSAGES[event];
  if (!template) return;

  const meta = template(booking);
  const text = buildBookingEmailText(event, booking, meta);
  const html = buildBookingEmailHtml(event, booking, meta);

  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: `"The Liyelle Atelier" <${gmailUser}>`,
      to: notifyTo,
      subject: meta.subject,
      text,
      html,
    });
  } catch (err) {
    console.error("Admin email failed:", err.message);
  }
}
