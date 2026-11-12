import crypto from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  '1234567890',
  '12345678901',
  'qwertyuiop',
  'qwerty1234',
  'letmein123',
  'welcome123',
  'admin12345',
  'milestone123',
  'changeme123',
  'aaaaaaaaaa',
  '0000000000',
  '1111111111',
  'iloveyou12',
]);

// Precomputed dummy scrypt hash for constant-time comparison when user does not exist
const DUMMY_SALT = '00112233445566778899aabbccddeeff';
const DUMMY_DERIVED = crypto
  .scryptSync('constant-time-dummy-password-value', DUMMY_SALT, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 32 * 1024 * 1024,
  })
  .toString('hex');

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (typeof password !== 'string') {
    return { valid: false, reason: 'Password is required.' };
  }
  if (password.length < 10) {
    return { valid: false, reason: 'Password must be at least 10 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, reason: 'Password must be at most 128 characters long.' };
  }
  const normalized = password.toLowerCase().trim();
  if (COMMON_PASSWORDS.has(normalized)) {
    return { valid: false, reason: 'That password is too common. Choose a less predictable phrase.' };
  }
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 32 * 1024 * 1024 },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
  return `$scrypt$n=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith('$scrypt$')) {
    // Run dummy scrypt computation so non-existent accounts take identical time
    await new Promise<void>((resolve) => {
      crypto.scrypt(
        password || '',
        DUMMY_SALT,
        KEY_LEN,
        { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 32 * 1024 * 1024 },
        (_err, derived) => {
          if (derived) {
            const target = Buffer.from(DUMMY_DERIVED, 'hex');
            if (derived.length === target.length) {
              crypto.timingSafeEqual(derived, target);
            }
          }
          resolve();
        }
      );
    });
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 5) return false;
  const paramStr = parts[2];
  const salt = parts[3];
  const expectedHex = parts[4];
  if (!paramStr || !salt || !expectedHex) return false;

  const params = Object.fromEntries(
    paramStr.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, Number(v)];
    })
  );
  const N = Number.isFinite(params.n) ? params.n : SCRYPT_N;
  const r = Number.isFinite(params.r) ? params.r : SCRYPT_R;
  const p = Number.isFinite(params.p) ? params.p : SCRYPT_P;

  try {
    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, KEY_LEN, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hashIp(ip: string | undefined, secret: string): string | null {
  if (!ip) return null;
  return crypto
    .createHmac('sha256', secret || 'milestone-ip-salt')
    .update(ip)
    .digest('hex')
    .slice(0, 24);
}

export function summarizeUserAgent(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent.toLowerCase();
  let browser = 'Browser';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari';
  else if (ua.includes('playwright')) browser = 'Playwright';

  let os = '';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  return os ? `${browser} on ${os}` : browser;
}
