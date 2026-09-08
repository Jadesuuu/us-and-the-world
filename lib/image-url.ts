// Photo URL helpers shared by every thumbnail surface (Lived cards,
// sidebar rows, timeline strips, lightbox filmstrip).
//
// Full-size photos are 1400px wide and 200–300 KB each. Rendering them
// into 56px or 140px slots means a page with twenty memories downloads
// several megabytes it never displays. These helpers hand back a small
// variant instead:
//   - Cloudinary URLs get a width + auto-format/quality transform.
//   - Demo snapshot photos (/demo/...) point at the thumbs/ sibling that
//     scripts/build-demo-snapshot.mjs generates.
//   - Anything else is returned untouched.

const CLOUDINARY_UPLOAD = "/image/upload/";

export function isCloudinaryUrl(url: string): boolean {
  return url.includes("res.cloudinary.com") && url.includes(CLOUDINARY_UPLOAD);
}

// Full-size delivery URL for the lightbox: automatic format/quality and a
// width cap. Phone uploads are 3000–4000px wide; no screen shows more than
// ~2000 CSS px, so anything above is wasted bytes. URLs that already carry
// a transform are left alone. Non-Cloudinary inputs pass through.
export function optimizedUrl(url: string, maxWidth = 2000): string {
  if (!isCloudinaryUrl(url)) return url;
  if (/\/image\/upload\/[a-z]+_[^/]*\//.test(url)) return url;
  return url.replace(
    CLOUDINARY_UPLOAD,
    `${CLOUDINARY_UPLOAD}w_${maxWidth},c_limit,f_auto,q_auto/`,
  );
}

// Small variant for grid/list thumbnails. `width` is the CSS pixel width
// of the slot; we request 2x for high-DPI screens.
export function thumbUrl(url: string, width = 240): string {
  if (isCloudinaryUrl(url)) {
    const w = Math.round(width * 2);
    return url.replace(
      CLOUDINARY_UPLOAD,
      `${CLOUDINARY_UPLOAD}w_${w},c_limit,f_auto,q_auto/`,
    );
  }
  const demo = /^\/demo\/(photos|places)\/([^/]+\.jpg)$/.exec(url);
  if (demo) return `/demo/${demo[1]}/thumbs/${demo[2]}`;
  return url;
}
