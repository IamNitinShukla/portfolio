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
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER || "snitin.tech@gmail.com";
  const pass = process.env.SMTP_PASS || "";
  const contactEmail = process.env.CONTACT_EMAIL || "snitin.tech@gmail.com";

  return { host, port, secure, user, pass, contactEmail };
}

let cachedTransporter: Transporter | null = null;
let lastPass = "";

export function getSmtpTransporter(): Transporter | null {
  const config = getSmtpConfig();
  if (!config.pass) {
    return null;
  }

  // Invalidate cache if password or config changes
  if (!cachedTransporter || lastPass !== config.pass) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true for port 465 with SSL/TLS
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        // Enforce valid TLS certificates
        rejectUnauthorized: true,
      },
      connectionTimeout: 10000, // 10s timeout
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    lastPass = config.pass;
  }

  return cachedTransporter;
}

/**
 * Verify SMTP connectivity and authentication credentials
 */
export async function verifySmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  const config = getSmtpConfig();
  if (!config.pass) {
    return {
      ok: false,
      error: "SMTP_PASS is not configured in server environment (.env.local). Please set your 16-character Google App Password.",
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
    const message = err instanceof Error ? err.message : "SMTP verification failed";
    console.error("[SMTP] Connection verification failed:", message);
    return { ok: false, error: message };
  }
}
