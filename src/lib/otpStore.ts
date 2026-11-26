import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

export interface StoredOtpRecord {
  token: string;
  email: string;
  submissionHash: string;
  otpHash: string;
  salt: string;
  createdAt: number;
  expiresAt: number;
  resendAvailableAt: number;
  attemptsRemaining: number;
  verified: boolean;
  consumed: boolean;
}

interface OtpTokenPayload {
  v: number;
  email: string;
  subHash: string;
  otpHash: string;
  salt: string;
  exp: number;
  iat: number;
  rat: number;
  att: number;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes validity
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
const MAX_VERIFICATION_ATTEMPTS = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_IP = 6;
const MAX_PER_EMAIL = 4;

// In-memory rate limiting & consumed tokens set
const ipRateLimitMap = new Map<string, number[]>();
const emailRateLimitMap = new Map<string, number[]>();
const consumedTokenSignatures = new Set<string>();

// Writable temporary directory on Vercel AWS Lambda / local
const TMP_DIR = path.join(os.tmpdir(), "portfolio_otp_cache");
const CONSUMED_TOKENS_FILE = path.join(TMP_DIR, "consumed_signatures.json");

function ensureTmpDir(): void {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
  } catch {}
}

function loadConsumedSignatures(): void {
  try {
    ensureTmpDir();
    if (fs.existsSync(CONSUMED_TOKENS_FILE)) {
      const raw = fs.readFileSync(CONSUMED_TOKENS_FILE, "utf8");
      const list: string[] = JSON.parse(raw);
      for (const sig of list) {
        consumedTokenSignatures.add(sig);
      }
    }
  } catch {}
}

function persistConsumedSignature(signature: string): void {
  consumedTokenSignatures.add(signature);
  try {
    ensureTmpDir();
    const arr = Array.from(consumedTokenSignatures).slice(-2000); // keep last 2000
    fs.writeFileSync(CONSUMED_TOKENS_FILE, JSON.stringify(arr), "utf8");
  } catch {}
}

// Initial load
loadConsumedSignatures();

function getSigningKey(): Buffer {
  const secretSource =
    process.env.SMTP_PASS ||
    process.env.GEMINI_API_KEY ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "portfolio_otp_stateless_signing_salt_2026_fixed";
  return crypto.createHash("sha256").update(secretSource).digest();
}

function signPayload(payload: OtpTokenPayload): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json, "utf8").toString("base64url");
  const hmac = crypto
    .createHmac("sha256", getSigningKey())
    .update(data)
    .digest("hex");
  return `otptkn_${data}.${hmac}`;
}

function verifyAndParseToken(token: string): { ok: boolean; payload?: OtpTokenPayload; signature?: string; error?: string } {
  if (!token || !token.startsWith("otptkn_")) {
    return { ok: false, error: "Invalid verification session token." };
  }

  const raw = token.slice("otptkn_".length);
  const parts = raw.split(".");
  if (parts.length !== 2) {
    return { ok: false, error: "Malformed verification session token." };
  }

  const [data, signature] = parts;
  const expectedHmac = crypto
    .createHmac("sha256", getSigningKey())
    .update(data)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expectedHmac, "hex");

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, error: "Tampered or invalid verification session signature." };
  }

  try {
    const json = Buffer.from(data, "base64url").toString("utf8");
    const payload: OtpTokenPayload = JSON.parse(json);
    return { ok: true, payload, signature };
  } catch {
    return { ok: false, error: "Unable to parse verification session payload." };
  }
}

function isRateLimited(map: Map<string, number[]>, key: string, max: number): boolean {
  const now = Date.now();
  const times = map.get(key) || [];
  const validTimes = times.filter((t) => now - t < RATE_WINDOW_MS);
  if (validTimes.length >= max) {
    map.set(key, validTimes);
    return true;
  }
  validTimes.push(now);
  map.set(key, validTimes);
  return false;
}

export function computeSubmissionHash(name: string, email: string, message: string): string {
  const raw = `${name.trim().toLowerCase()}|${email.trim().toLowerCase()}|${message.trim()}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface RequestOtpResult {
  ok: boolean;
  token?: string;
  otp?: string; // Plaintext OTP returned ONLY to caller for email dispatch
  expiresInSeconds?: number;
  resendInSeconds?: number;
  error?: string;
}

/**
 * Generate a cryptographically secure 6-digit OTP and encode it into a stateless signed token.
 * Highly scalable on Vercel Serverless with zero multi-instance sync or disk errors.
 */
export function requestOtp(
  email: string,
  ip: string,
  name: string,
  message: string
): RequestOtpResult {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check rate limits
  if (isRateLimited(ipRateLimitMap, ip, MAX_PER_IP)) {
    return {
      ok: false,
      error: "Too many verification attempts from your network. Please wait a few minutes before trying again.",
    };
  }

  if (isRateLimited(emailRateLimitMap, normalizedEmail, MAX_PER_EMAIL)) {
    return {
      ok: false,
      error: "Too many verification requests for this email address. Please check your inbox or wait a few minutes.",
    };
  }

  // 2. Generate 6-digit cryptographic OTP (100000 - 999999)
  const otpNumber = crypto.randomInt(100000, 1000000);
  const plainOtp = otpNumber.toString();

  // 3. Cryptographic salt & SHA-256 hash
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = crypto
    .createHash("sha256")
    .update(salt + plainOtp)
    .digest("hex");

  const now = Date.now();
  const submissionHash = computeSubmissionHash(name, normalizedEmail, message);

  const payload: OtpTokenPayload = {
    v: 1,
    email: normalizedEmail,
    subHash: submissionHash,
    otpHash,
    salt,
    iat: now,
    exp: now + OTP_TTL_MS,
    rat: now + RESEND_COOLDOWN_MS,
    att: MAX_VERIFICATION_ATTEMPTS,
  };

  const token = signPayload(payload);

  return {
    ok: true,
    token,
    otp: plainOtp, // ONLY returned to route handler for immediate SMTP dispatch
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    resendInSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
  };
}

export interface VerifyOtpResult {
  ok: boolean;
  error?: string;
  attemptsRemaining?: number;
  newToken?: string;
}

/**
 * Verify submitted OTP against stateless cryptographic token.
 */
export function verifyAndConsumeOtp(
  token: string,
  email: string,
  otp: string,
  name: string,
  message: string
): VerifyOtpResult {
  const parsed = verifyAndParseToken(token);
  if (!parsed.ok || !parsed.payload || !parsed.signature) {
    return { ok: false, error: parsed.error || "Invalid verification session." };
  }

  const { payload, signature } = parsed;

  // 1. Check replay attack
  if (consumedTokenSignatures.has(signature)) {
    return {
      ok: false,
      error: "This verification code has already been used. Please request a new code.",
    };
  }

  // 2. Check expiration
  const now = Date.now();
  if (now > payload.exp) {
    return {
      ok: false,
      error: "Verification code has expired (5-minute limit). Please request a fresh code.",
    };
  }

  // 3. Check attempts remaining
  if (payload.att <= 0) {
    persistConsumedSignature(signature);
    return {
      ok: false,
      error: "Too many failed verification attempts. Please request a fresh verification code.",
      attemptsRemaining: 0,
    };
  }

  // 4. Validate email binding
  const normalizedEmail = email.trim().toLowerCase();
  if (payload.email !== normalizedEmail) {
    return {
      ok: false,
      error: "The email address does not match the verification session. Please request a new code.",
    };
  }

  // 5. Validate submission payload tamper protection
  const currentSubmissionHash = computeSubmissionHash(name, normalizedEmail, message);
  if (payload.subHash !== currentSubmissionHash) {
    return {
      ok: false,
      error: "The message or sender details were modified after code generation. Please request a fresh code.",
    };
  }

  // 6. Verify OTP using constant-time comparison
  const submittedOtp = otp.trim();
  const computedHash = crypto
    .createHash("sha256")
    .update(payload.salt + submittedOtp)
    .digest("hex");

  const computedBuf = Buffer.from(computedHash, "hex");
  const expectedBuf = Buffer.from(payload.otpHash, "hex");

  const isMatch =
    computedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(computedBuf, expectedBuf);

  if (!isMatch) {
    const remaining = payload.att - 1;
    if (remaining <= 0) {
      persistConsumedSignature(signature);
      return {
        ok: false,
        error: "Incorrect verification code. Maximum attempts reached. Please request a new code.",
        attemptsRemaining: 0,
      };
    }

    // Generate updated token with decremented attempts
    const updatedPayload: OtpTokenPayload = {
      ...payload,
      att: remaining,
    };
    const newToken = signPayload(updatedPayload);

    return {
      ok: false,
      error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      attemptsRemaining: remaining,
      newToken,
    };
  }

  // 7. Successful verification: Consume token atomically to prevent replay
  persistConsumedSignature(signature);

  return { ok: true };
}
