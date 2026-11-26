import nodemailer, { type Transporter } from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  contactEmail: string;
}

export function getSmtpConfig(): SmtpConfig {
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = (process.env.SMTP_USER || "snitin.tech@gmail.com").trim();
  // Strip quotes, spaces, and formatting copied from Google's 16-character display (e.g. "abcd efgh ijkl mnop")
  const rawPass = process.env.SMTP_PASS || "";
  const pass = rawPass.replace(/["'\s]/g, "").trim();
  const contactEmail = (process.env.CONTACT_EMAIL || "snitin.tech@gmail.com").trim();

  return { host, port, secure, user, pass, contactEmail };
}

let cachedTransporter: Transporter | null = null;
let lastPass = "";
let lastUser = "";

export function getSmtpTransporter(): Transporter | null {
  const config = getSmtpConfig();
  if (!config.pass) {
    return null;
  }

  const isGmail =
    config.host.toLowerCase().includes("gmail") ||
    config.user.toLowerCase().endsWith("@gmail.com");

  // Invalidate cache if password or user changes
  if (!cachedTransporter || lastPass !== config.pass || lastUser !== config.user) {
    if (isGmail) {
      // Official Nodemailer configuration for Gmail SMTP:
      // Uses built-in 'gmail' service definition which manages secure ports, pooling, and TLS
      cachedTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: config.user,
          pass: config.pass,
        },
        connectionTimeout: 12000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });
    } else {
      cachedTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
        tls: {
          rejectUnauthorized: true,
        },
        connectionTimeout: 12000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });
    }
    lastPass = config.pass;
    lastUser = config.user;
  }

  return cachedTransporter;
}

/**
 * Format SMTP errors into actionable messages without leaking credentials
 */
export function formatSmtpError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes("535") ||
    message.includes("BadCredentials") ||
    message.includes("Username and Password not accepted")
  ) {
    return "Gmail SMTP authentication failed (535 Bad Credentials). Ensure your 16-character Google App Password (without spaces) is correctly set in Vercel Environment Variables as SMTP_PASS for account snitin.tech@gmail.com, and 2-Step Verification is enabled on this Google account.";
  }
  if (
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND")
  ) {
    return `SMTP network connection timed out (${message}). Please check outbound network connectivity.`;
  }
  return message;
}

/**
 * Verify SMTP connectivity and authentication credentials
 */
export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  const config = getSmtpConfig();
  if (!config.pass) {
    return {
      ok: false,
      error: "SMTP_PASS is not configured in server environment. Please set your 16-character Google App Password in Vercel Environment Variables.",
    };
  }

  const transporter = getSmtpTransporter();
  if (!transporter) {
    return { ok: false, error: "Failed to initialize SMTP transporter." };
  }

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err: unknown) {
    const formattedError = formatSmtpError(err);
    console.error("[SMTP] Connection verification failed:", formattedError);
    return { ok: false, error: formattedError };
  }
}
