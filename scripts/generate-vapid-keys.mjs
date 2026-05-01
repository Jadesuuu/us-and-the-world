#!/usr/bin/env node
// Generates a P-256 keypair in the format Web Push expects:
//   public key  = 65-byte uncompressed point  (base64url)
//   private key = 32-byte scalar              (base64url)
//
// Run once:    node scripts/generate-vapid-keys.mjs
// Then copy the printed values into:
//   .env.local                           (NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   Supabase Function Secrets dashboard  (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
//
// VAPID_SUBJECT is your contact URL or mailto:, e.g. "mailto:jadesuuu@gmail.com".
// Browsers occasionally include it in push reports.

import { generateKeyPairSync } from "node:crypto";

function toBase64Url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

// Private key: extract the raw 32-byte scalar from the JWK.
const privJwk = privateKey.export({ format: "jwk" });
const privateKeyB64u = privJwk.d;

// Public key: derive from the JWK x/y coordinates. SEC1 uncompressed
// is the byte 0x04 followed by 32-byte x and 32-byte y.
const pubJwk = publicKey.export({ format: "jwk" });
const x = Buffer.from(pubJwk.x, "base64url");
const y = Buffer.from(pubJwk.y, "base64url");
const sec1 = Buffer.concat([Buffer.from([0x04]), x, y]);
if (sec1.length !== 65) {
  console.error("unexpected public key length:", sec1.length);
  process.exit(1);
}
const publicKeyB64u = toBase64Url(sec1);

console.log("");
console.log("VAPID keypair generated.");
console.log("");
console.log("# .env.local");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKeyB64u}`);
console.log("");
console.log("# Supabase → Project Settings → Edge Functions → Secrets");
console.log(`VAPID_PUBLIC_KEY=${publicKeyB64u}`);
console.log(`VAPID_PRIVATE_KEY=${privateKeyB64u}`);
console.log("VAPID_SUBJECT=mailto:jadesuuu@gmail.com   # change to your contact");
console.log("");
