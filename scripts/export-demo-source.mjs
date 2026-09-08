// Pulls pins, visits, visit_photos and profiles into
// scripts/demo-source/export.json using the Supabase service-role key.
//
// The key is read from SUPABASE_SERVICE_ROLE_KEY in .env.local and is never
// committed (both .env* and scripts/demo-source/*.json are gitignored).
//
// Usage: node scripts/export-demo-source.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  (await readFile(path.join(ROOT, ".env.local"), "utf8"))
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

async function table(name) {
  const res = await fetch(`${url}/rest/v1/${name}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  return res.json();
}

const out = {
  exported_at: new Date().toISOString(),
  pins: await table("pins"),
  visits: await table("visits"),
  visit_photos: await table("visit_photos"),
  profiles: await table("profiles"),
};
await mkdir(path.join(ROOT, "scripts/demo-source"), { recursive: true });
await writeFile(
  path.join(ROOT, "scripts/demo-source/export.json"),
  JSON.stringify(out, null, 2),
);
console.log(
  `Exported ${out.pins.length} pins, ${out.visits.length} visits, ` +
    `${out.visit_photos.length} photos, ${out.profiles.length} profiles.`,
);
