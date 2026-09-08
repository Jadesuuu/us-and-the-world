# Demo mode

`NEXT_PUBLIC_DEMO_MODE=1` turns the app into a read-only portfolio demo:
data comes from `lib/demo-data.ts`, auth is bypassed, and search / add /
log-visit / delete / push are hidden. Production never sets the flag.

## Refreshing the snapshot

1. Get a raw export into `scripts/demo-source/export.json` (gitignored), either:
   - **Browser (no secret keys):** open the live app while logged in, open
     DevTools → Console, paste `scripts/demo-source/browser-export-snippet.js`
     (fill in the anon key from `.env.local` first), and move the downloaded
     `export.json` into `scripts/demo-source/`.
   - **Service key:** add `SUPABASE_SERVICE_ROLE_KEY=...` to `.env.local`
     and run `node scripts/export-demo-source.mjs`.
2. Curate with `scripts/demo-source/curation.json` (gitignored, so keep a
   copy). The current policy is "places yes, personal information no":
   ```json
   {
     "excludePinIds": [],
     "excludePhotoIds": ["<visit_photo ids that show people>"],
     "maxPhotosPerVisit": 8,
     "stripNotes": true,
     "stripLinks": true,
     "anonymizeUsers": {
       "<real user id>": { "id": "demo-user-1", "display_name": "Sam" },
       "<real user id>": { "id": "demo-user-2", "display_name": "Alex" }
     }
   }
   ```
   `stripNotes` drops pin notes, memories and visit notes. `stripLinks`
   drops inspiration URLs. `anonymizeUsers` rewrites every `created_by` and
   profile, drops avatars, and replaces the space id. Google place ids are
   always removed. **Review every new photo before committing** — the
   contact-sheet trick: resize all of `public/demo/photos` into a grid with
   `sharp` and eyeball it.
   The fictional layer lives in the same file: `notes` (pin and visit text
   in the Sam/Alex voice), `visitOverrides` (move a real visit's date so
   revisits show up), `extraVisits` (fictional return trips), `extraPins`
   (fictional pins around the globe) and `placePhotos` (Wikimedia Commons
   photos for pins with no visits). Commons photos are referenced by file
   title with artist and license; the build script downloads them once,
   re-encodes to 1280px, and bakes the credit into each photo so it shows
   in the lightbox. Only CC BY, CC BY-SA, CC0 and public-domain files are
   used. Google Places photos are never used: their terms forbid storing
   or redistributing them.
3. `node scripts/build-demo-snapshot.mjs` downloads photos at web size into
   `public/demo/photos/` (own photos) and `public/demo/places/` (Commons),
   and writes `lib/demo-data.ts`. Commit all three.

## Running / deploying

- Local: `npm run dev:demo`
- Vercel: a second project on the same repo with `NEXT_PUBLIC_DEMO_MODE=1`,
  `NEXT_PUBLIC_MAPBOX_TOKEN` (URL-restricted to the demo domain), and
  optionally `NEXT_PUBLIC_DEMO_BACK_URL` for the "back to case study" link.
  No Supabase, Cloudinary, or Google variables are needed.
