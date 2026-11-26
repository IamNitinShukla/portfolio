import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import { verifyAndConsumeOtp } from "@/lib/otpStore";
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

    const { name, email, subject, message, otp, token, hp_field, clientTime } = body;

    // 1. Anti-spam honeypot
    if (hp_field && typeof hp_field === "string" && hp_field.trim().length > 0) {
      return NextResponse.json({
        success: true,
        message: "Your message has been sent successfully. I'll get back to you soon.",
      });
    }

    // 2. Anti-spam timing check
    if (clientTime && Date.now() - Number(clientTime) < 500) {
      return NextResponse.json({
        success: true,
        message: "Your message has been sent successfully. I'll get back to you soon.",
      });
    }

    // 3. Validation
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    const trimmedSubject = typeof subject === "string" ? subject.trim() : "";
    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    const trimmedOtp = typeof otp === "string" ? otp.trim() : "";
    const trimmedToken = typeof token === "string" ? token.trim() : "";

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

    if (!trimmedOtp || !trimmedToken) {
      return NextResponse.json(
        { success: false, error: "Email verification is required. Please verify your email first." },
        { status: 400 }
      );
    }

    // 4. Verify and consume OTP atomically (Stateless HMAC verification works across all serverless lambdas)
    const otpValidation = verifyAndConsumeOtp(
      trimmedToken,
      trimmedEmail,
      trimmedOtp,
      trimmedName,
      trimmedMessage
    );

    if (!otpValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: otpValidation.error || "Email verification failed.",
          attemptsRemaining: otpValidation.attemptsRemaining,
          newToken: otpValidation.newToken,
        },
        { status: 400 }
      );
    }

    // 5. Verify SMTP configuration
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

    const submissionTime = new Date();
    const formattedTimestamp = submissionTime.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const submissionRecord = {
      id: `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: submissionTime.toISOString(),
      formattedTimestamp: `${formattedTimestamp} IST`,
      name: trimmedName,
      email: trimmedEmail,
      subject: trimmedSubject || "Portfolio Inquiry",
      message: trimmedMessage,
      ipHash: Buffer.from(ip).toString("base64").slice(0, 10),
      verified: true,
    };

    // 6. Safe audit log (Uses writable os.tmpdir() on Vercel without throwing EROFS)
    try {
      const auditDir = path.join(os.tmpdir(), "portfolio_audit");
      if (!fs.existsSync(auditDir)) {
        fs.mkdirSync(auditDir, { recursive: true });
      }
      fs.appendFileSync(path.join(auditDir, "inquiries.jsonl"), JSON.stringify(submissionRecord) + "\n", "utf8");
    } catch {}

    // 7. Send primary inquiry email to Nitin's Gmail
    const sanitizedName = escapeHtml(trimmedName);
    const sanitizedEmail = escapeHtml(trimmedEmail);
    const sanitizedSubject = escapeHtml(trimmedSubject || "Portfolio Inquiry");
    const sanitizedMessage = escapeHtml(trimmedMessage).replace(/\n/g, "<br />");

    const inquiryHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0c0d0c; color: #f5f5f5; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 16px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <p style="font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: #888888; margin: 0;">PORTFOLIO INQUIRY</p>
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 11px; font-weight: 600;">✓ OTP Verified</span>
          </div>
          <h2 style="font-size: 22px; font-weight: 700; margin: 10px 0 0 0; color: #ffffff;">New message from ${sanitizedName}</h2>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #888888; width: 100px;">From:</td>
            <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">${sanitizedName} &lt;<a href="mailto:${sanitizedEmail}" style="color: #6657d9; text-decoration: none;">${sanitizedEmail}</a>&gt;</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888888;">Topic:</td>
            <td style="padding: 8px 0; color: #ffffff;">${sanitizedSubject}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888888;">Received:</td>
            <td style="padding: 8px 0; color: #ffffff;">${formattedTimestamp} IST</td>
          </tr>
        </table>

        <div style="background-color: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 18px; margin-bottom: 24px; line-height: 1.6; font-size: 14px; color: #e5e5e5; white-space: pre-wrap;">
${sanitizedMessage}
        </div>

        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; font-size: 12px; color: #737373;">
          <p style="margin: 0;">💡 <strong>Quick Reply:</strong> You can click <em>Reply</em> in Gmail to respond directly to <strong>${sanitizedName}</strong> at <strong>${sanitizedEmail}</strong>.</p>
        </div>
      </div>
    `;

    const inquiryText = `Portfolio Inquiry from Nitin's Portfolio [OTP Verified]

From: ${trimmedName} (${trimmedEmail})
Subject: ${trimmedSubject || "Portfolio Inquiry"}
Timestamp: ${formattedTimestamp} IST

Message:
${trimmedMessage}

---
You can reply directly to this email to respond to ${trimmedName} (${trimmedEmail}).`;

    await transporter.sendMail({
      from: `"Portfolio Contact" <${smtpConfig.user}>`,
      to: smtpConfig.contactEmail,
      replyTo: trimmedEmail,
      subject: `Portfolio Inquiry — ${trimmedName}`,
      html: inquiryHtml,
      text: inquiryText,
    });

    // 8. Send confirmation email to visitor (Only after inquiry delivery succeeds)
    try {
      const confirmationHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #0c0d0c; color: #f5f5f5; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <div style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 16px; margin-bottom: 20px;">
            <p style="font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #888888; margin: 0 0 6px 0;">CONFIRMATION</p>
            <h2 style="font-size: 20px; font-weight: 700; margin: 0; color: #ffffff;">Thanks for reaching out!</h2>
          </div>

          <p style="font-size: 15px; line-height: 1.6; color: #e5e5e5; margin: 0 0 16px 0;">Hello ${sanitizedName},</p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #d4d4d4; margin: 0 0 16px 0;">
            Thank you for contacting me through my portfolio. I've successfully received your message and appreciate you taking the time to reach out.
          </p>

          <p style="font-size: 14px; line-height: 1.6; color: #d4d4d4; margin: 0 0 24px 0;">
            I'll review your inquiry and get back to you as soon as possible.
          </p>

          <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; font-size: 13px; color: #a3a3a3;">
            <p style="margin: 0 0 4px 0; color: #ffffff; font-weight: 600;">Nitin Shukla</p>
            <p style="margin: 0; color: #888888;"><a href="mailto:${smtpConfig.contactEmail}" style="color: #6657d9; text-decoration: none;">${smtpConfig.contactEmail}</a></p>
          </div>
        </div>
      `;

      const confirmationText = `Hello ${trimmedName},

Thank you for contacting me through my portfolio.
I've successfully received your message and appreciate you taking the time to reach out.
I'll review your inquiry and get back to you as soon as possible.

Best regards,
Nitin Shukla
${smtpConfig.contactEmail}`;

      await transporter.sendMail({
        from: `"Nitin Shukla" <${smtpConfig.user}>`,
        to: trimmedEmail,
        subject: "Thanks for reaching out to Nitin!",
        html: confirmationHtml,
        text: confirmationText,
      });
    } catch (confErr) {
      console.warn("[Contact API] Visitor confirmation email warning:", confErr);
    }

    return NextResponse.json({
      success: true,
      message: "Your message has been sent successfully. I'll get back to you soon.",
    });
  } catch (err: unknown) {
    console.error("[Contact API] Error handling submission:", err);
    const formattedError = formatSmtpError(err);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to deliver email: ${formattedError}`,
      },
      { status: 500 }
    );
  }
}
