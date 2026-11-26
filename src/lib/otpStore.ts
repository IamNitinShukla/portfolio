import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface StoredOtpRecord {
  token: string; // Public session token sent to client (opaque hex)
  email: string; // Lowercased normalized visitor email
  submissionHash: string; // SHA-256 of visitor name + message to prevent tamper
  otpHash: string; // SHA-256(salt + otp)
  salt: string; // Cryptographic salt
  createdAt: number;
  expiresAt: number; // 5 minutes after creation
  resendAvailableAt: number; // 60 seconds cooldown after creation
  attemptsRemaining: number; // Starts at 5, decrements on failure
  verified: boolean;
  consumed: boolean;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes validity
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
const MAX_VERIFICATION_ATTEMPTS = 5;

// In-memory rate limiting map for OTP generation: IP -> timestamps[]
const ipRateLimitMap = new Map<string, number[]>();
const emailRateLimitMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_IP = 6;
const MAX_PER_EMAIL = 4;

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

// Persistent storage file
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "otp_store.json");

function ensureStoreDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {}
  }
}

// Load records from persistent disk store
function loadRecords(): Map<string, StoredOtpRecord> {
  ensureStoreDir();
  const map = new Map<string, StoredOtpRecord>();
  if (!fs.existsSync(STORE_FILE)) {
    return map;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const arr: StoredOtpRecord[] = JSON.parse(raw);
    const now = Date.now();
    for (const r of arr) {
      // Filter out records that expired more than 10 minutes ago
      if (r.expiresAt + 10 * 60 * 1000 > now) {
        map.set(r.token, r);
      }
    }
  } catch (err) {
    console.error("[OTP Store] Error reading persistent store:", err);
  }
  return map;
}

// Atomically save records to persistent disk store
function saveRecords(map: Map<string, StoredOtpRecord>): void {
  ensureStoreDir();
  const arr = Array.from(map.values());
  const tmpFile = `${STORE_FILE}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(arr, null, 2), "utf8");
    fs.renameSync(tmpFile, STORE_FILE);
  } catch (err) {
    console.error("[OTP Store] Atomic save failed:", err);
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  }
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
 * Generate a cryptographically secure 6-digit OTP and store its hash
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
      error: "Too many verification requests from this IP. Please wait 10 minutes before trying again.",
    };
  }

  if (isRateLimited(emailRateLimitMap, normalizedEmail, MAX_PER_EMAIL)) {
    return {
      ok: false,
      error: "Too many verification codes requested for this email. Please wait 10 minutes or check your spam folder.",
    };
  }

  const records = loadRecords();
  const now = Date.now();

  // Check if an unexpired record for this email already exists and cooldown has not elapsed
  const recordsArr = Array.from(records.values());
  for (const record of recordsArr) {
    if (record.email === normalizedEmail && !record.verified && record.expiresAt > now) {
      if (record.resendAvailableAt > now) {
        const remainingCooldown = Math.ceil((record.resendAvailableAt - now) / 1000);
        return {
          ok: false,
          error: `Please wait ${remainingCooldown}s before requesting another verification code.`,
          resendInSeconds: remainingCooldown,
        };
      }
    }
  }

  // 2. Generate cryptographically secure 6-digit OTP
  // crypto.randomInt is cryptographically strong (uniform distribution without modulo bias)
  const otpNumber = crypto.randomInt(100000, 1000000);
  const plaintextOtp = otpNumber.toString();

  // 3. Salt and hash the OTP (SHA-256)
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = crypto
    .createHash("sha256")
    .update(salt + plaintextOtp)
    .digest("hex");

  // 4. Generate opaque session token for client binding
  const token = `otptkn_${crypto.randomBytes(24).toString("hex")}`;
  const submissionHash = computeSubmissionHash(name, normalizedEmail, message);

  // Invalidate previous unconsumed records for this email
  const entriesArr = Array.from(records.entries());
  for (const [k, v] of entriesArr) {
    if (v.email === normalizedEmail && !v.consumed) {
      records.delete(k);
    }
  }

  const newRecord: StoredOtpRecord = {
    token,
    email: normalizedEmail,
    submissionHash,
    otpHash,
    salt,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
    resendAvailableAt: now + RESEND_COOLDOWN_MS,
    attemptsRemaining: MAX_VERIFICATION_ATTEMPTS,
    verified: false,
    consumed: false,
  };

  records.set(token, newRecord);
  saveRecords(records);

  return {
    ok: true,
    token,
    otp: plaintextOtp, // Caller dispatches this via SMTP email; never returned to HTTP client
    expiresInSeconds: 300,
    resendInSeconds: 60,
  };
}

export interface VerifyOtpResult {
  ok: boolean;
  error?: string;
  attemptsRemaining?: number;
}

/**
 * Validate an entered OTP against the stored hash and submission payload
 */
export function verifyAndConsumeOtp(
  token: string,
  email: string,
  enteredOtp: string,
  name: string,
  message: string
): VerifyOtpResult {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanEnteredOtp = (enteredOtp || "").trim();

  if (!token || !cleanEnteredOtp) {
    return { ok: false, error: "Verification token and code are required." };
  }

  const records = loadRecords();
  const record = records.get(token);

  if (!record) {
    return {
      ok: false,
      error: "Verification session not found or expired. Please request a new code.",
    };
  }

  const now = Date.now();

  // 1. Check expiration
  if (record.expiresAt < now) {
    records.delete(token);
    saveRecords(records);
    return {
      ok: false,
      error: "Verification code has expired. Please request a new code.",
    };
  }

  // 2. Check email binding
  if (record.email !== normalizedEmail) {
    return {
      ok: false,
      error: "Email address does not match the active verification session.",
    };
  }

  // 3. Prevent replay attacks / token reuse
  if (record.consumed) {
    return {
      ok: false,
      error: "This verification code has already been used. Please request a new code.",
    };
  }

  // 4. Verify message payload has not been tampered with
  const currentSubmissionHash = computeSubmissionHash(name, normalizedEmail, message);
  if (record.submissionHash !== currentSubmissionHash) {
    return {
      ok: false,
      error: "The message or sender details were modified after code generation. Please request a fresh code.",
    };
  }

  // 5. Check remaining attempts
  if (record.attemptsRemaining <= 0) {
    records.delete(token);
    saveRecords(records);
    return {
      ok: false,
      error: "Maximum verification attempts exceeded. Please request a new code.",
      attemptsRemaining: 0,
    };
  }

  // 6. Verify OTP hash using timingSafeEqual
  const enteredHash = crypto
    .createHash("sha256")
    .update(record.salt + cleanEnteredOtp)
    .digest("hex");

  const hashBuffer = Buffer.from(record.otpHash, "hex");
  const enteredBuffer = Buffer.from(enteredHash, "hex");

  const isMatch =
    hashBuffer.length === enteredBuffer.length &&
    crypto.timingSafeEqual(hashBuffer, enteredBuffer);

  if (!isMatch) {
    record.attemptsRemaining -= 1;
    if (record.attemptsRemaining <= 0) {
      records.delete(token);
      saveRecords(records);
      return {
        ok: false,
        error: "Maximum verification attempts exceeded. Please request a new code.",
        attemptsRemaining: 0,
      };
    }

    records.set(token, record);
    saveRecords(records);

    return {
      ok: false,
      error: `Incorrect verification code. ${record.attemptsRemaining} attempt${record.attemptsRemaining === 1 ? "" : "s"} remaining.`,
      attemptsRemaining: record.attemptsRemaining,
    };
  }

  // 7. Successful verification: mark as consumed immediately (one-time use)
  record.verified = true;
  record.consumed = true;
  records.set(token, record);
  saveRecords(records);

  return { ok: true };
}
