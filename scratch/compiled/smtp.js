"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSmtpConfig = getSmtpConfig;
exports.getSmtpTransporter = getSmtpTransporter;
exports.verifySmtpConnection = verifySmtpConnection;
const nodemailer_1 = __importDefault(require("nodemailer"));
function getSmtpConfig() {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const user = process.env.SMTP_USER || "snitin.tech@gmail.com";
    const pass = process.env.SMTP_PASS || "";
    const contactEmail = process.env.CONTACT_EMAIL || "snitin.tech@gmail.com";
    return { host, port, secure, user, pass, contactEmail };
}
let cachedTransporter = null;
let lastPass = "";
function getSmtpTransporter() {
    const config = getSmtpConfig();
    if (!config.pass) {
        return null;
    }
    // Invalidate cache if password or config changes
    if (!cachedTransporter || lastPass !== config.pass) {
        cachedTransporter = nodemailer_1.default.createTransport({
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
async function verifySmtpConnection() {
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "SMTP verification failed";
        console.error("[SMTP] Connection verification failed:", message);
        return { ok: false, error: message };
    }
}
