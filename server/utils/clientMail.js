import nodemailer from "nodemailer";
import { formatDate, formatEC, GOLD, PINK } from "./mailTheme.js";

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

export const clientMailEnabled = Boolean(gmailUser && gmailAppPassword);

let transporter = null;

function getTransporter() {
  if (!clientMailEnabled) return null;
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

const CLIENT_MESSAGES = {
  created: (booking) => ({
    subject: `Booking received — ${booking.reference}`,
    headline: "You're almost booked in",
    intro: `Hi ${booking.clientName}, we've reserved your ${booking.serviceName} appointment. Complete your deposit to secure your slot.`,
    cta: "Complete deposit",
    badge: "Booking received",
    icon: "♡",
  }),
  approved: (booking) => ({
    subject: `Appointment confirmed — ${booking.reference}`,
    headline: "Your appointment is confirmed",
    intro: `Hi ${booking.clientName}, your deposit was approved. We can't wait to see you at the studio.`,
    cta: "View appointment",
    badge: "Confirmed",
    icon: "✦",
  }),
  deposit_submitted: (booking) => ({
    subject: `Deposit received — ${booking.reference}`,
    headline: "We received your deposit",
    intro: `Hi ${booking.clientName}, your transfer proof is with us. We'll review it and confirm your appointment shortly.`,
    cta: "View booking",
    badge: "Under review",
    icon: "◎",
  }),
  rejected: (booking) => ({
    subject: `Booking update — ${booking.reference}`,
    headline: "Booking not approved",
    intro: `Hi ${booking.clientName}, we weren't able to approve this booking. Reach out on WhatsApp if you have questions.`,
    cta: "Contact studio",
    badge: "Declined",
    icon: "○",
  }),
  rescheduled: (booking, extra) => ({
    subject: `Appointment rescheduled — ${booking.reference}`,
    headline: "Your appointment was moved",
    intro: `Hi ${booking.clientName}, your appointment has been rescheduled. See the updated details below.`,
    cta: "View appointment",
    badge: "Rescheduled",
    icon: "↻",
  }),
  expired: (booking) => ({
    subject: `Booking expired — ${booking.reference}`,
    headline: "Your hold has expired",
    intro: `Hi ${booking.clientName}, the deposit window closed and your slot was released. Book again anytime to reserve a new time.`,
    cta: "Book again",
    badge: "Expired",
    icon: "○",
  }),
  cancelled: (booking) => ({
    subject: `Booking cancelled — ${booking.reference}`,
    headline: "Appointment cancelled",
    intro: `Hi ${booking.clientName}, your booking has been cancelled. Contact the studio if you'd like to rebook.`,
    cta: "Book again",
    badge: "Cancelled",
    icon: "○",
  }),
};

function buildClientEmailHtml(event, booking, meta, extra = {}) {
  const appointmentDate = extra.newDate || booking.date;
  const appointmentTime = extra.newTime || booking.time;
  const bookingLink = `${clientUrl}/booking/${booking.id}`;
  const contactLink = `${clientUrl}/contact`;
  const bookLink = `${clientUrl}/book`;
  const ctaHref = ["rejected", "cancelled"].includes(event)
    ? contactLink
    : event === "expired"
      ? bookLink
      : bookingLink;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${meta.subject}</title>
</head>
<body style="margin:0;padding:0;background:${PINK.bgPage};font-family:'Montserrat',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,${PINK.bgPage} 0%,#ffd6e4 55%,${PINK.bg} 100%);padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
          <tr>
            <td style="text-align:center;padding:0 0 20px;">
              <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:${GOLD.dim};">The Liyelle Atelier</p>
              <h1 style="margin:0;font-size:42px;font-weight:400;color:${PINK.blush};font-family:Georgia,'Times New Roman',serif;">Liyelle</h1>
            </td>
          </tr>
          <tr>
            <td style="background:${PINK.white};border-radius:22px;overflow:hidden;border:1px solid ${PINK.border};box-shadow:0 16px 48px rgba(139,74,82,0.12);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:28px 28px 0;text-align:center;">
                    <p style="margin:0 0 14px;font-size:28px;line-height:1;color:${PINK.blush};">${meta.icon}</p>
                    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD.dim};font-weight:600;">${meta.badge}</p>
                    <h2 style="margin:0 0 12px;font-size:26px;font-weight:600;color:${PINK.text};font-family:Georgia,'Times New Roman',serif;line-height:1.25;">${meta.headline}</h2>
                    <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${PINK.muted};">${meta.intro}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,${PINK.bgSoft} 0%,${PINK.cardBg} 100%);border:1px solid ${PINK.borderSoft};border-radius:16px;">
                      <tr>
                        <td style="padding:20px 22px;text-align:center;">
                          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${PINK.label};">Your appointment</p>
                          <p style="margin:0 0 4px;font-size:20px;font-weight:600;color:${PINK.text};font-family:Georgia,'Times New Roman',serif;">${booking.serviceName}</p>
                          <p style="margin:0 0 14px;font-size:15px;color:${PINK.muted};">${formatDate(appointmentDate)} · ${appointmentTime}</p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid ${PINK.borderSoft};">
                            <tr>
                              <td style="padding:14px 8px 0;width:50%;text-align:center;">
                                <p style="margin:0;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${PINK.label};">Reference</p>
                                <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:${PINK.blush};">${booking.reference}</p>
                              </td>
                              <td style="padding:14px 8px 0;width:50%;text-align:center;">
                                <p style="margin:0;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${PINK.label};">Deposit</p>
                                <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:${GOLD.dim};">${formatEC(booking.depositAmount)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 30px;text-align:center;">
                    <a href="${ctaHref}" style="display:inline-block;background:linear-gradient(135deg,${GOLD.main},${GOLD.dim});color:${GOLD.text};text-decoration:none;padding:15px 32px;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${meta.cta}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 12px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:${PINK.label};line-height:1.5;">
                Salon Studio · Vieux-Fort · The Liyelle Atelier
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

function buildClientEmailText(event, booking, meta, extra = {}) {
  const appointmentDate = extra.newDate || booking.date;
  const appointmentTime = extra.newTime || booking.time;

  return [
    meta.headline,
    meta.intro,
    "",
    `Service: ${booking.serviceName}`,
    `When: ${formatDate(appointmentDate)} at ${appointmentTime}`,
    `Reference: ${booking.reference}`,
    `Deposit: ${formatEC(booking.depositAmount)}`,
    "",
    `View booking: ${clientUrl}/booking/${booking.id}`,
    "",
    "— The Liyelle Atelier",
  ].join("\n");
}

export async function notifyClientBooking(event, booking, extra = {}) {
  if (!clientMailEnabled || !booking?.email) return;

  const template = CLIENT_MESSAGES[event];
  if (!template) return;

  const meta = template(booking, extra);
  const text = buildClientEmailText(event, booking, meta, extra);
  const html = buildClientEmailHtml(event, booking, meta, extra);

  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: `"The Liyelle Atelier" <${gmailUser}>`,
      to: booking.email,
      subject: meta.subject,
      text,
      html,
    });
  } catch (err) {
    console.error("Client email failed:", err.message);
  }
}
