// Paste into the DevTools console while logged in at the live app.
// Downloads export.json using YOUR session — no keys involved beyond the
// public anon key, which you paste in below from .env.local.
// Save the downloaded file to scripts/demo-source/export.json.
(async () => {
  const ref = "dmkwatldiiuhzbmuwwgs";
  const anon = "PASTE_NEXT_PUBLIC_SUPABASE_ANON_KEY_HERE";
  const cookies = Object.fromEntries(
    document.cookie.split("; ").map((c) => {
      const i = c.indexOf("=");
      return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
    }),
  );
  let rawSess = cookies[`sb-${ref}-auth-token`];
  if (!rawSess) {
    rawSess = "";
    for (let i = 0; cookies[`sb-${ref}-auth-token.${i}`]; i++) {
      rawSess += cookies[`sb-${ref}-auth-token.${i}`];
    }
  }
  if (!rawSess) {
    throw new Error("No Supabase session cookie found — are you logged in?");
  }
  const json = rawSess.startsWith("base64-")
    ? atob(rawSess.slice(7).replace(/-/g, "+").replace(/_/g, "/"))
    : rawSess;
  const token = JSON.parse(json).access_token;
  const base = `https://${ref}.supabase.co/rest/v1`;
  const get = async (t) => {
    const r = await fetch(`${base}/${t}?select=*`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`${t}: ${r.status} ${await r.text()}`);
    return r.json();
  };
  const out = {
    exported_at: new Date().toISOString(),
    pins: await get("pins"),
    visits: await get("visits"),
    visit_photos: await get("visit_photos"),
    profiles: await get("profiles"),
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "export.json";
  a.click();
  console.log(
    `Exported ${out.pins.length} pins, ${out.visits.length} visits, ${out.visit_photos.length} photos.`,
  );
})();
