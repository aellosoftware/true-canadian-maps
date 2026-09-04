import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const url = env().SMTP_URL;
  transporter = url ? nodemailer.createTransport(url) : null;
  return transporter;
}

/**
 * Authentication links are never logged. Production delivery requires a sender
 * and SMTP transport; callers surface a recoverable delivery error.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const t = getTransporter();
  if (!t) {
    throw new Error("Email delivery is not configured. Please try again later.");
  }
  const from = env().SMTP_FROM;
  if (!from) throw new Error("Email sender is not configured. Please try again later.");
  try { await t.sendMail({ from, ...mail }); }
  catch { throw new Error("Email delivery failed. Please try again later."); }
}
