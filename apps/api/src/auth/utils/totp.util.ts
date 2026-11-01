import { createHmac, randomBytes } from 'node:crypto';

/**
 * Standard RFC 6238 Time-based One-Time Password (TOTP) utility
 */
export class TotpUtil {
  private static readonly PERIOD = 30; // 30-second time step
  private static readonly DIGITS = 6;

  /**
   * Generates a 20-byte base32 secret string.
   */
  static generateSecret(): string {
    const buffer = randomBytes(20);
    return this.base32Encode(buffer);
  }

  /**
   * Generates a 6-digit TOTP code for a given timestamp.
   */
  static generateCode(secret: string, timestampSeconds: number = Math.floor(Date.now() / 1000)): string {
    const key = this.base32Decode(secret);
    const counter = Math.floor(timestampSeconds / this.PERIOD);

    // 8-byte big-endian counter
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const hmac = createHmac('sha1', key).update(counterBuffer).digest();

    // Dynamic truncation
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 10 ** this.DIGITS;
    return otp.toString().padStart(this.DIGITS, '0');
  }

  /**
   * Verifies a code allowing a ±1 window (covering clock drift).
   */
  static verifyCode(code: string, secret: string, timestampSeconds: number = Math.floor(Date.now() / 1000)): boolean {
    if (!code || code.length !== this.DIGITS) return false;

    // Check t - 1, t, t + 1
    for (let window = -1; window <= 1; window++) {
      const checkTime = timestampSeconds + window * this.PERIOD;
      const expected = this.generateCode(secret, checkTime);
      if (expected === code) {
        return true;
      }
    }
    return false;
  }

  /**
   * Builds otpauth URL for Google Authenticator / Authy QR codes.
   */
  static getOtpAuthUrl(issuer: string, accountName: string, secret: string): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedAccount = encodeURIComponent(accountName);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  private static base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  private static base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += this.base32Chars[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += this.base32Chars[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private static base32Decode(input: string): Buffer {
    const clean = input.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < clean.length; i++) {
      const idx = this.base32Chars.indexOf(clean[i]);
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }
}

