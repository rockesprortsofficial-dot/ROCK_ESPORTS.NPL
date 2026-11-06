const origin = "https://rockesprortsofficial-dot.github.io";
const maxBytes = 500_000_000;
const tokenId = Deno.env.get("ROCK_MUX_TOKEN_ID");
const tokenSecret = Deno.env.get("ROCK_MUX_TOKEN_SECRET");
const enabled = Boolean(tokenId && tokenSecret && Deno.env.get("ROCK_MUX_ENABLED") === "true");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anon = Deno.env.get("SUPABASE_ANON_KEY") || Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"))[0];
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const validId = id => typeof id === "string" && /^[a-zA-Z0-9]{1,128}$/.test(id);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function mux(path, method = "GET", data) {
  const response = await fetch("https://api.mux.com/video/v1/" + path, {
    method,
    headers: { Authorization: "Basic " + btoa(tokenId + ":" + tokenSecret), "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (response.status === 404) fail("Mux video or upload was not found.", 404);
  if (!response.ok) fail("Mux could not complete this request. Check the video allowance and try again.", 503);
  return response.status === 204 ? null : (await response.json()).data;
}

async function rest(path, auth, method = "GET", data) {
  const response = await fetch(supabaseUrl + "/rest/v1/rock_community_posts" + path, {
    method,
    headers: {
      apikey: anon, Authorization: auth, "Content-Type": "application/json",
      Prefer: "return=representation,resolution=ignore-duplicates",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) fail("Community database operation failed.", response.status);
  return response.status === 204 ? [] : await response.json();
}

async function postIdForUpload(id) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("rock-community-mux:" + id)));
  const hex = Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

Deno.serve(async req => {
  if (req.headers.get("origin") && req.headers.get("origin") !== origin) return json({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 12000) fail("Request too large.", 413);
    let body;
    try { body = JSON.parse(raw); } catch { fail("Invalid request."); }
    if (body?.action === "config") return json({ enabled, maxVideoBytes: maxBytes });
    if (!tokenId || !tokenSecret) fail("Mux is not configured.", 503);
    const auth = req.headers.get("authorization") || "";
    const response = await fetch(supabaseUrl + "/auth/v1/user", { headers: { apikey: anon, Authorization: auth } });
    if (!response.ok) fail("Sign in to manage videos.", 401);
    const user = await response.json();
    if (!uuid.test(user.id)) fail("Sign in to manage videos.", 401);
    const ownerTag = "rock-community:" + user.id;

    if (body?.action === "prepare") {
      if (!enabled) fail("Mux uploads are disabled.", 503);
      if (!["video/mp4", "video/webm", "video/quicktime"].includes(body.type) ||
          !Number.isSafeInteger(body.size) || body.size < 1 || body.size > maxBytes) {
        fail("Choose an MP4, MOV or WebM video up to 500 MB.");
      }
      const assets = await mux("assets?limit=10");
      if (!Array.isArray(assets) || assets.length >= 10) fail("The 10-video allowance is full.", 409);
      const upload = await mux("uploads", "POST", {
        timeout: 3600,
        cors_origin: origin,
        new_asset_settings: {
          playback_policies: ["public"],
          video_quality: "basic",
          max_resolution_tier: "1080p",
          passthrough: ownerTag,
        },
      });
      if (!validId(upload?.id) || new URL(upload.url).protocol !== "https:") fail("Invalid upload response.", 503);
      return json({ uploadId: upload.id, url: upload.url });
    }

    if (body?.action === "publish") {
      if (!validId(body.uploadId)) fail("Invalid upload.");
      const content = body.content ?? "";
      if (typeof content !== "string" || content.length > 2000) fail("Post text is too long.");
      const upload = await mux("uploads/" + body.uploadId);
      if (upload?.new_asset_settings?.passthrough !== ownerTag) fail("Invalid upload owner.", 403);
      if (["errored", "cancelled", "timed_out"].includes(upload.status)) fail("Mux could not finish this upload.");
      if (!validId(upload.asset_id)) return json({ pending: true });
      const asset = await mux("assets/" + upload.asset_id);
      if (asset.passthrough !== ownerTag) fail("Invalid video owner.", 403);
      if (asset.status === "errored") fail("Mux could not process this video.");
      if (asset.status !== "ready") return json({ pending: true });
      const playback = asset.playback_ids?.find(item => item.policy === "public")?.id;
      if (!validId(playback)) fail("Mux playback is unavailable.", 503);
      const id = await postIdForUpload(body.uploadId);
      const media_path = "mux:" + upload.asset_id + ":" + playback;
      await rest("?on_conflict=id", auth, "POST", { id, author_id: user.id, content, media_path, media_type: "video" });
      const [post] = await rest("?select=id,author_id,media_path&id=eq." + id, auth);
      if (post?.author_id !== user.id || post?.media_path !== media_path) fail("Could not verify the published video.", 409);
      return json({ postId: id });
    }

    if (body?.action === "remove") {
      if (typeof body.postId !== "string" || !uuid.test(body.postId)) fail("Invalid post.");
      const [post] = await rest("?select=id,author_id,media_path&id=eq." + body.postId, auth);
      if (!post || (post.author_id !== user.id && user.email?.toLowerCase() !== "rockesprorts.official@gmail.com")) fail("Not permitted.", 403);
      const match = /^mux:([a-zA-Z0-9]{1,128}):([a-zA-Z0-9]{1,128})$/.exec(post.media_path || "");
      if (!match) fail("Invalid Mux post.");
      const [, assetId, playback] = match;
      let asset;
      try { asset = await mux("assets/" + assetId); } catch (error) { if (error.status !== 404) throw error; }
      if (asset && (asset.passthrough !== "rock-community:" + post.author_id ||
          !asset.playback_ids?.some(item => item.id === playback))) fail("Invalid video owner.", 403);
      if (asset) await mux("assets/" + assetId, "DELETE");
      await rest("?id=eq." + post.id, auth, "DELETE");
      return json({ ok: true });
    }
    fail("Unknown video operation.");
  } catch (error) {
    return json({ error: error?.status ? error.message : "Mux video service is temporarily unavailable." }, error?.status || 503);
  }
});
