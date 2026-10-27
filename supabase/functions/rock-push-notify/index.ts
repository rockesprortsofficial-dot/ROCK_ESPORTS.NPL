import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const OWNER_EMAIL = "rockesprorts.official@gmail.com";
const allowedSections = new Set([
  "home", "about", "management", "members", "statements", "contact",
  "tournament", "registration", "group-division", "tdm-group-division",
  "live-draw", "connect", "jersey-preview", "meeting", "rock-meeting-room",
  "notifications",
]);

Deno.serve(async (req: Request) => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json();
    const action = String(body.action || "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Server configuration is incomplete" }, 500);

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (action === "subscribe") {
      const realName = String(body.real_name || "").trim();
      const loginCode = String(body.login_code || "").trim();
      const password = String(body.password || "");
      const sub = body.subscription;
      const endpoint = String(sub?.endpoint || "");
      const p256dh = String(sub?.keys?.p256dh || "");
      const auth = String(sub?.keys?.auth || "");
      if (!realName || !/^\d{4}$/.test(loginCode) || !password ||
          !endpoint.startsWith("https://") || !p256dh || !auth) {
        return json({ error: "Please check your member details and device permission" }, 400);
      }

      // Check the existing Meeting Room credentials. The password is used for this check only;
      // it is never written to the database or push subscription record.
      const verify = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/rock_meeting_login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ p_real_name: realName, p_login_code: loginCode, p_password: password }),
      });
      if (!verify.ok) return json({ error: "Member login verification failed" }, 502);
      const result = await verify.json();
      const member = Array.isArray(result) ? result[0] : result;
      if (!member || member.success === false || !(member.id || member.member_id)) {
        return json({ error: "Incorrect login, inactive account, or account locked" }, 401);
      }

      const { data: existing, error: findError } = await db.from("rock_push_subscriptions")
        .select("id").eq("endpoint", endpoint).maybeSingle();
      if (findError) throw findError;
      const row = { endpoint, p256dh, auth };
      const save = existing
        ? await db.from("rock_push_subscriptions").update(row).eq("id", existing.id)
        : await db.from("rock_push_subscriptions").insert(row);
      if (save.error) throw save.error;
      return json({ success: true, message: "This device is registered for ROCK ESPORTS notifications" });
    }

    if (action !== "send") return json({ error: "Unknown action" }, 400);

    // Only the existing site owner account may publish mobile notifications.
    const bearer = req.headers.get("Authorization") || "";
    const accessToken = bearer.replace(/^Bearer\s+/i, "");
    if (!accessToken) return json({ error: "Sign in as the authorized site owner" }, 401);
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || authData.user?.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      return json({ error: "Unauthorized admin" }, 401);
    }

    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT");
    if (!publicKey || !privateKey || !subject) return json({ error: "VAPID secrets missing" }, 500);
    const title = String(body.title || "ROCK ESPORTS Update").trim().slice(0, 100);
    const message = String(body.message || "").trim().slice(0, 500);
    const sectionInput = String(body.section || "notifications");
    const section = allowedSections.has(sectionInput) ? sectionInput : "notifications";
    if (!title || !message) return json({ error: "Notification title and message are required" }, 400);

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const { data: subscriptions, error: readError } = await db.from("rock_push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (readError) throw readError;
    let sent = 0;
    let failed = 0;
    for (const item of subscriptions || []) {
      try {
        await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
          JSON.stringify({ title, body: message, data: { section } }));
        sent++;
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from("rock_push_subscriptions").delete().eq("id", item.id);
      }
    }
    return json({ success: true, sent, failed, total: (subscriptions || []).length });
  } catch (error) {
    console.error("ROCK push error:", error);
    return json({ error: "Notification request failed" }, 500);
  }
});
