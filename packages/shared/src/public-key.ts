import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Browser public keys are not secrets; they identify a project + origin policy. */
export function newPublicKey(env: "live" | "test" = "live"): string {
  const bytes = randomBytes(32);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `pk_${env}_${out}`;
}

export const PUBLIC_KEY_PATTERN = /^pk_(live|test)_[0-9A-Za-z]{32}$/;
