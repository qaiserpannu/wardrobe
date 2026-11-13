import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node.js; no extra library).
 * Stored form: scrypt$N$r$p$salt$hash, so the cost can be raised later
 * without breaking existing passwords.
 */
const COST = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

function derive(password: string, salt: Buffer, N: number, r: number, p: number, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, length, { N, r, p, maxmem: 256 * N * r }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST.N, COST.r, COST.p, KEY_LENGTH);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !N || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const cost = [Number(N), Number(r), Number(p)];
  if (cost.some((n) => !Number.isInteger(n) || n < 1) || Number(N) > 2 ** 20) return false;
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(N), Number(r), Number(p), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Why a new password is not acceptable, or null if it is fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (/^(.)\1+$/.test(password)) return "Choose a password that is not one repeated character.";
  return null;
}
