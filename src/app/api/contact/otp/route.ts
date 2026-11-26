import { NextRequest, NextResponse } from "next/server";
import { requestOtp } from "@/lib/otpStore";
import { getSmtpTransporter, getSmtpConfig, formatSmtpError } from "@/lib/smtp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Invalid request payload." }, { status: 400 });
    }

    const { name, email, message, hp_field, clientTime } = body;

    // 1. Anti-spam honeypot
    if (hp_field && typeof hp_field === "string" && hp_field.trim().length > 0) {
      return NextResponse.json({ success: true, token: "mock_session_token", resendIn: 60 });
    }

    // 2. Anti-spam timing check
    if (clientTime && Date.now() - Number(clientTime) < 500) {
      return NextResponse.json({ success: true, token: "mock_session_token", resendIn: 60 });
    }

    // 3. Validation
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json(
        { success: false, error: "Please enter your name (at least 2 characters)." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!trimmedMessage || trimmedMessage.length < 10) {
      return NextResponse.json(
        { success: false, error: "Please write a message with at least 10 characters." },
        { status: 400 }
      );
    }

    // 4. Verify SMTP configuration
    const smtpConfig = getSmtpConfig();
    const transporter = getSmtpTransporter();

    if (!transporter || !smtpConfig.pass) {
      return NextResponse.json(
        {
          success: false,
          error: "Gmail SMTP delivery is not configured on this server (SMTP_PASS is not set in Vercel Environment Variables). Please email snitin.tech@gmail.com directly.",
          configured: false,
        },
        { status: 503 }
      );
    }

    // 5. Request cryptographic OTP
    const otpResult = requestOtp(trimmedEmail, ip, trimmedName, trimmedMessage);
    if (!otpResult.ok || !otpResult.token || !otpResult.otp) {
      return NextResponse.json(
        { success: false, error: otpResult.error || "Failed to generate verification code." },
        { status: 429 }
      );
    }

    // 6. Send OTP to visitor's email via Gmail SMTP
    const sanitizedName = escapeHtml(trimmedName);
    const otpCode = otpResult.otp; // Plaintext OTP used ONLY here for sending email

    const otpHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; background-color: #0c0d0c; color: #f5f5f5; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 16px; margin-bottom: 24px;">
          <p style="font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: #888888; margin: 0 0 6px 0;">PORTFOLIO VERIFICATION</p>
          <h2 style="font-size: 22px; font-weight: 700; margin: 0; color: #ffffff;">Email Verification Code</h2>
        </div>

        <p style="font-size: 15px; line-height: 1.6; color: #e5e5e5; margin: 0 0 16px 0;">Hello ${sanitizedName},</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #c4c4c4; margin: 0 0 24px 0;">
          Use the following 6-digit one-time passcode to verify your email address and submit your message to Nitin Shukla:
        </p>

        <div style="text-align: center; margin: 28px 0; padding: 20px; background-color: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;">
          <span style="font-family: monospace, Consolas, Courier; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ffffff;">
            ${otpCode}
          </span>
          <p style="font-size: 12px; color: #888888; margin: 10px 0 0 0;">Valid for 5 minutes · Single use only</p>
        </div>

        <p style="font-size: 13px; line-height: 1.6; color: #999999; margin: 0 0 24px 0;">
          If you did not request this code through Nitin's portfolio contact form, you can safely ignore this email.
        </p>

        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; font-size: 12px; color: #666666;">
          <p style="margin: 0;">Sent securely via Nitin Shukla's Portfolio Verification Service.</p>
        </div>
      </div>
    `;

    const otpText = `Hello ${trimmedName},

Your verification code for Nitin Shukla's portfolio is: ${otpCode}

This code will expire in 5 minutes.
If you did not request this verification, please disregard this email.

Best regards,
Nitin Shukla
${smtpConfig.user}`;

    await transporter.sendMail({
      from: `"Nitin Shukla" <${smtpConfig.user}>`,
      to: trimmedEmail,
      subject: `Your Verification Code: ${otpCode} — Nitin Shukla Portfolio`,
      html: otpHtml,
      text: otpText,
    });

    // Zero exposure of plaintext OTP in response!
    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email.",
      token: otpResult.token,
      expiresInSeconds: otpResult.expiresInSeconds,
      resendInSeconds: otpResult.resendInSeconds,
    });
  } catch (err: unknown) {
    console.error("[OTP Route] Dispatch error:", err);
    const formattedError = formatSmtpError(err);
    return NextResponse.json(
      {
        success: false,
        error: `Could not send verification email: ${formattedError}`,
      },
      { status: 500 }
    );
  }
}
