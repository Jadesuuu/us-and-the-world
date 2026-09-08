// Builds lib/demo-data.ts + public/demo/photos/* from a raw export.
//
// Input:  scripts/demo-source/export.json   (see scripts/README-demo.md)
//         scripts/demo-source/curation.json (optional)
// Output: lib/demo-data.ts, public/demo/photos/<id>.jpg
//
// Photos are downloaded ONCE from Cloudinary at web size and rewritten to
// local paths so the demo never touches Cloudinary at runtime.
//
// Usage: node scripts/build-demo-snapshot.mjs

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "scripts/demo-source/export.json");
const CURATION = path.join(ROOT, "scripts/demo-source/curation.json");
const OUT_TS = path.join(ROOT, "lib/demo-data.ts");
const OUT_PHOTOS = path.join(ROOT, "public/demo/photos");
const PHOTO_WIDTH = 1400;

if (!existsSync(SRC)) {
  console.error(
    `Missing ${path.relative(ROOT, SRC)}. See scripts/README-demo.md.`,
  );
  process.exit(1);
}

const raw = JSON.parse(await readFile(SRC, "utf8"));
const curation = existsSync(CURATION)
  ? JSON.parse(await readFile(CURATION, "utf8"))
  : {};
const includeIds = curation.includePinIds
  ? new Set(curation.includePinIds)
  : null;
const excludeIds = new Set(curation.excludePinIds ?? []);
const excludePhotoIds = new Set(curation.excludePhotoIds ?? []);
const maxPhotosPerVisit = curation.maxPhotosPerVisit ?? 8;
const stripNotes = curation.stripNotes ?? false;
const stripLinks = curation.stripLinks ?? false;
// { "<real user id>": { "id": "demo-user-1", "display_name": "Sam" } }
// Every created_by / user_id is remapped through this table so real auth
// ids never reach the bundle. Unknown ids fall back to a hash-free label.
const userMap = curation.anonymizeUsers ?? {};
// Fictional voice for the demo. Applied AFTER stripNotes so the bundle
// carries only curated text, never the real notes.
//   notes.pins[pinId] / notes.visits[visitId]  → note text
//   visitOverrides[visitId].visited_at         → move a real visit's date
//   extraVisits[]                              → fictional return trips;
//     { id, pin_id, created_by (real id or demo id), visited_at, note,
//       photos: ["<kept visit_photo id>"] }  photos reuse local files.
const noteOverrides = curation.notes ?? {};
const pinNotes = noteOverrides.pins ?? {};
const visitNotes = noteOverrides.visits ?? {};
const visitOverrides = curation.visitOverrides ?? {};
const extraVisits = curation.extraVisits ?? [];
// Wikimedia Commons photos.
//   placePhotos[pinId] = [{ title: "File:…", artist, license }] → shown
//     in the drawer's "From the world" strip for pins with no visits.
//   extraPins[] = fictional pins { id, title, lat, lng, created_by,
//     created_at, note, placePhotos: [...] }.
//   extraVisits[].commonsPhotos = [{ title, artist, license }] → visit
//     photos with a credit that renders in the lightbox.
const placePhotosCfg = curation.placePhotos ?? {};
const extraPins = curation.extraPins ?? [];
const OUT_PLACES = path.join(ROOT, "public/demo/places");
const COMMONS_UA = {
  "User-Agent":
    "jf-world-demo-snapshot/1.0 (portfolio demo build script; one-off fetch)",
};
const DEMO_SPACE_ID = "demo-space";
function mapUser(id) {
  if (!id) return null;
  return userMap[id]?.id ?? "demo-user-unknown";
}

const pins = (raw.pins ?? []).filter(
  (p) => (!includeIds || includeIds.has(p.id)) && !excludeIds.has(p.id),
);
const pinIds = new Set(pins.map((p) => p.id));
const pinTitle = new Map(pins.map((p) => [p.id, p.title]));
for (const x of extraPins) {
  pinIds.add(x.id);
  pinTitle.set(x.id, x.title);
}

const visits = (raw.visits ?? []).filter((v) => pinIds.has(v.pin_id));
const photosByVisit = new Map();
for (const ph of raw.visit_photos ?? []) {
  const list = photosByVisit.get(ph.visit_id) ?? [];
  list.push(ph);
  photosByVisit.set(ph.visit_id, list);
}

// ---- photo download --------------------------------------------------
// Every full-size photo also gets a 480px `thumbs/` sibling. The app's
// thumbUrl() helper (lib/image-url.ts) points list/grid slots at these so
// the home page doesn't download megabytes of 1400px images.
const THUMB_WIDTH = 480;
async function resetDir(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.join(dir, "thumbs"), { recursive: true });
}
async function writeWithThumb(dir, file, buf) {
  await writeFile(path.join(dir, file), buf);
  const thumb = await sharp(buf)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
  await writeFile(path.join(dir, "thumbs", file), thumb);
}
await resetDir(OUT_PHOTOS);

function webSized(url) {
  // Cloudinary accepts transformations after /image/upload/.
  if (url.includes("res.cloudinary.com") && url.includes("/image/upload/")) {
    return url.replace(
      "/image/upload/",
      `/image/upload/w_${PHOTO_WIDTH},c_limit,q_auto:good,f_jpg/`,
    );
  }
  return url;
}

await resetDir(OUT_PLACES);

let bytes = 0;
let count = 0;
let commonsCount = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Downloads one Commons file at web width and returns a LightboxPhoto-
// shaped record with the credit string. Special:Redirect resolves the
// file title to the current thumbnail URL, so titles stay stable even if
// Commons re-hashes its upload paths.
async function localizeCommons(photo, id) {
  const name = photo.title.replace(/^File:/, "");
  const url =
    `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/` +
    `${encodeURIComponent(name)}&width=${PHOTO_WIDTH}`;
  let res = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(2000 * attempt);
    res = await fetch(url, { headers: COMMONS_UA });
    if (res.ok) break;
    console.warn(`  ! ${res.status} for ${photo.title} (attempt ${attempt + 1})`);
  }
  if (!res?.ok) return null;
  // Commons thumbnails can still be ~700 KB; re-encode to web weight so
  // the repo and first paint stay light.
  const buf = await sharp(Buffer.from(await res.arrayBuffer()))
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();
  const file = `${id}.jpg`;
  await writeWithThumb(OUT_PLACES, file, buf);
  bytes += buf.length;
  commonsCount += 1;
  credits.push({ file, title: photo.title, artist: photo.artist, license: photo.license });
  await sleep(250);
  return {
    url: `/demo/places/${file}`,
    thumbnailUrl: `/demo/places/thumbs/${file}`,
    attribution: `${photo.artist} · ${photo.license} · Wikimedia Commons`,
  };
}

// Credits ledger for the CC licences (attribution must ship with the
// distributed files, not just in the UI).
const credits = [];
const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function localize(url, id) {
  if (!url) return null;
  const res = await fetch(webSized(url));
  if (!res.ok) {
    console.warn(`  ! ${res.status} for ${url}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `${id}.jpg`;
  await writeWithThumb(OUT_PHOTOS, file, buf);
  bytes += buf.length;
  count += 1;
  return `/demo/photos/${file}`;
}

// ---- assemble ----------------------------------------------------------
const dayCount = new Map();
const outVisits = [];
const sortedVisits = visits.sort((a, b) =>
  b.visited_at.localeCompare(a.visited_at),
);
for (const v of sortedVisits) {
  const photos = (photosByVisit.get(v.id) ?? [])
    .filter((ph) => !excludePhotoIds.has(ph.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, maxPhotosPerVisit);
  const visit_photos = [];
  for (const ph of photos) {
    const local = await localize(ph.image_url, ph.id);
    if (!local) continue;
    visit_photos.push({
      id: ph.id,
      visit_id: ph.visit_id,
      image_url: local,
      public_id: null,
      created_at: ph.created_at,
    });
  }
  const visited_at = visitOverrides[v.id]?.visited_at ?? v.visited_at;
  outVisits.push({
    id: v.id,
    pin_id: v.pin_id,
    space_id: DEMO_SPACE_ID,
    visited_at,
    note: visitNotes[v.id] ?? (stripNotes ? null : (v.note ?? null)),
    created_by: mapUser(v.created_by),
    created_at: visited_at,
    visit_photos,
    pin: { id: v.pin_id, title: pinTitle.get(v.pin_id) },
  });
}

// Fictional return trips. Photos point at files already downloaded above.
const keptPhotoIds = new Set(
  outVisits.flatMap((v) => v.visit_photos.map((p) => p.id)),
);
for (const x of extraVisits) {
  if (!pinIds.has(x.pin_id)) {
    console.warn(`  ! extraVisit ${x.id}: unknown pin ${x.pin_id}`);
    continue;
  }
  const visit_photos = [];
  for (const [i, photoId] of (x.photos ?? []).entries()) {
    if (!keptPhotoIds.has(photoId)) {
      console.warn(`  ! extraVisit ${x.id}: photo ${photoId} not in snapshot`);
      continue;
    }
    visit_photos.push({
      id: `${x.id}-p${i}`,
      visit_id: x.id,
      image_url: `/demo/photos/${photoId}.jpg`,
      public_id: null,
      created_at: x.visited_at,
    });
  }
  for (const [i, cp] of (x.commonsPhotos ?? []).entries()) {
    const local = await localizeCommons(cp, `${slug(x.id)}-${i}`);
    if (!local) continue;
    visit_photos.push({
      id: `${x.id}-c${i}`,
      visit_id: x.id,
      image_url: local.url,
      public_id: null,
      created_at: x.visited_at,
      attribution: local.attribution,
    });
  }
  outVisits.push({
    id: x.id,
    pin_id: x.pin_id,
    space_id: DEMO_SPACE_ID,
    visited_at: x.visited_at,
    note: x.note ?? null,
    created_by: userMap[x.created_by]?.id ?? x.created_by,
    created_at: x.visited_at,
    visit_photos,
    pin: { id: x.pin_id, title: pinTitle.get(x.pin_id) },
  });
}
outVisits.sort((a, b) => b.visited_at.localeCompare(a.visited_at));

// Distinct visited days per pin, computed after overrides and extras so
// visit_day_count matches what the Lived tab will actually show.
for (const v of outVisits) {
  const day = new Date(v.visited_at).toISOString().slice(0, 10);
  const days = dayCount.get(v.pin_id) ?? new Set();
  days.add(day);
  dayCount.set(v.pin_id, days);
}

const outPins = [];
const sortedPins = pins.sort((a, b) =>
  b.created_at.localeCompare(a.created_at),
);
for (const p of sortedPins) {
  const image_urls = [];
  for (const [i, u] of (p.image_urls ?? []).entries()) {
    const local = await localize(u, `${p.id}-legacy-${i}`);
    if (local) image_urls.push(local);
  }
  const visit_day_count = dayCount.get(p.id)?.size ?? 0;
  outPins.push({
    id: p.id,
    space_id: DEMO_SPACE_ID,
    title: p.title,
    note: pinNotes[p.id] ?? (stripNotes ? null : (p.note ?? null)),
    lat: p.lat,
    lng: p.lng,
    is_done: p.is_done ?? false,
    done_at: p.done_at ?? null,
    memory: stripNotes ? null : (p.memory ?? null),
    image_urls,
    // Stripped on purpose: a place id would make the drawer call Google.
    google_place_id: null,
    inspiration_url: stripLinks ? null : (p.inspiration_url ?? null),
    created_by: mapUser(p.created_by),
    created_at: p.created_at,
    updated_at: p.updated_at,
    visit_day_count,
    has_visits: visit_day_count > 0 || !!p.is_done,
  });
}

// "From the world" strips: bundled place photos for pins without visits.
const outPlacePhotos = {};
async function attachPlacePhotos(pinId, photos) {
  const list = [];
  for (const [i, cp] of (photos ?? []).entries()) {
    const local = await localizeCommons(cp, `${slug(pinId)}-${i}`);
    if (local) list.push(local);
  }
  if (list.length) outPlacePhotos[pinId] = list;
  return list;
}
// Lived pins: the desktop list thumbnail falls back to the newest visit
// photo so the Dreaming list isn't a column of placeholders.
function firstVisitPhoto(pinId) {
  const v = outVisits.find(
    (v) => v.pin_id === pinId && v.visit_photos.length > 0,
  );
  return v ? v.visit_photos[0].image_url : null;
}
for (const p of outPins) {
  if (p.has_visits) {
    const thumb = firstVisitPhoto(p.id);
    if (thumb && p.image_urls.length === 0) p.image_urls = [thumb];
    continue;
  }
  const list = await attachPlacePhotos(p.id, placePhotosCfg[p.id]);
  // Desktop list thumbnails read image_urls[0].
  if (list.length && p.image_urls.length === 0) {
    p.image_urls = list.map((l) => l.url);
  }
}

// Fictional pins around the globe.
for (const x of extraPins) {
  const visit_day_count = dayCount.get(x.id)?.size ?? 0;
  const has_visits = visit_day_count > 0;
  const list = has_visits ? [] : await attachPlacePhotos(x.id, x.placePhotos);
  const thumb = has_visits ? firstVisitPhoto(x.id) : null;
  outPins.push({
    id: x.id,
    space_id: DEMO_SPACE_ID,
    title: x.title,
    note: x.note ?? null,
    lat: x.lat,
    lng: x.lng,
    is_done: false,
    done_at: null,
    memory: null,
    image_urls: thumb ? [thumb] : list.map((l) => l.url),
    google_place_id: null,
    inspiration_url: null,
    created_by: userMap[x.created_by]?.id ?? x.created_by,
    created_at: x.created_at,
    updated_at: x.created_at,
    visit_day_count,
    has_visits,
  });
}
outPins.sort((a, b) => b.created_at.localeCompare(a.created_at));

const outProfiles = [];
for (const pr of raw.profiles ?? []) {
  const mapped = userMap[pr.user_id];
  outProfiles.push({
    user_id: mapUser(pr.user_id),
    display_name: mapped?.display_name ?? pr.display_name,
    // Avatars are personal by definition; dropped whenever users are
    // anonymized.
    avatar_url: mapped
      ? null
      : await localize(pr.avatar_url, `avatar-${pr.user_id}`),
    created_at: pr.created_at ?? null,
  });
}

const header = `// GENERATED FILE — do not edit by hand.
// Run \`node scripts/build-demo-snapshot.mjs\` to regenerate from
// scripts/demo-source/export.json. See scripts/README-demo.md.
import type { Pin } from "@/hooks/usePins";
import type { VisitWithPin } from "@/hooks/useAllVisits";
import type { Profile } from "@/hooks/useProfiles";
import type { LightboxPhoto } from "@/components/ImageLightbox";

`;
const body =
  `export const DEMO_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};\n` +
  `export const DEMO_PINS: Pin[] = ${JSON.stringify(outPins, null, 2)};\n` +
  `export const DEMO_VISITS: VisitWithPin[] = ${JSON.stringify(outVisits, null, 2)};\n` +
  `export const DEMO_PROFILES: Profile[] = ${JSON.stringify(outProfiles, null, 2)};\n` +
  `export const DEMO_PLACE_PHOTOS: Record<string, LightboxPhoto[]> = ${JSON.stringify(outPlacePhotos, null, 2)};\n`;
await writeFile(OUT_TS, header + body);

const creditsMd =
  `# Demo photo credits\n\n` +
  `The place photos in this folder come from Wikimedia Commons and are used ` +
  `under the licence listed next to each file. They were resized for the web; ` +
  `no other changes were made. Photos under \`../photos/\` are the app ` +
  `authors' own.\n\n| File | Source | Author | Licence |\n|---|---|---|---|\n` +
  credits
    .map(
      (c) =>
        `| ${c.file} | [${c.title.replace(/^File:/, "")}](https://commons.wikimedia.org/wiki/${encodeURIComponent(c.title)}) | ${c.artist} | ${c.license} |`,
    )
    .join("\n") +
  "\n";
await writeFile(path.join(OUT_PLACES, "CREDITS.md"), creditsMd);

const lived = outPins.filter((p) => p.has_visits).length;
console.log(
  `Snapshot: ${outPins.length} pins (${lived} lived), ` +
    `${outVisits.length} visits, ${count} own photos + ${commonsCount} Commons photos ` +
    `(${(bytes / 1024 / 1024).toFixed(1)} MB), ${outProfiles.length} profiles, ` +
    `${Object.keys(outPlacePhotos).length} pins with place photos.`,
);
