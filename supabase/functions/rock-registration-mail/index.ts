import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.1";
import { Buffer } from "node:buffer";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const ownerEmail = "rockesprorts.official@gmail.com";
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
let gmailToken;
let gmailExpiry = 0;

function gmailConfig() {
  const client_id = Deno.env.get("ROCK_GMAIL_CLIENT_ID");
  const client_secret = Deno.env.get("ROCK_GMAIL_CLIENT_SECRET");
  const refresh_token = Deno.env.get("ROCK_GMAIL_REFRESH_TOKEN");
  return client_id && client_secret && refresh_token ? { client_id, client_secret, refresh_token } : null;
}

async function gmailAccess(config) {
  if (gmailToken && gmailExpiry > Date.now() + 60000) return gmailToken;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ ...config, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Gmail access unavailable");
  const token = await response.json();
  if (!token.access_token) throw new Error("Gmail access unavailable");
  gmailToken = token.access_token;
  gmailExpiry = Date.now() + Number(token.expires_in || 0) * 1000;
  return gmailToken;
}

function emailData(batch, campaign) {
  const words = [];
  let bytes = 0;
  let word = "";
  for (const character of batch.subject.replace(/[\r\n]/g, " ")) {
    const size = Buffer.byteLength(character);
    if (bytes + size > 45) {
      words.push("=?UTF-8?B?" + Buffer.from(word).toString("base64") + "?=");
      word = "";
      bytes = 0;
    }
    word += character;
    bytes += size;
  }
  if (word) words.push("=?UTF-8?B?" + Buffer.from(word).toString("base64") + "?=");
  const body = Buffer.from(batch.message).toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
  return Buffer.from([
    "From: ROCK ESPORTS <" + ownerEmail + ">",
    "To: " + batch.recipient,
    "Subject: " + words.join("\r\n "),
    "Message-ID: <" + campaign + "." + batch.processed + "@rock-esports.invalid>",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n")).toString("base64url");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return reply({ error: "POST only." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) return reply({ error: "Mail service unavailable." }, 503);
    const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) return reply({ error: "Owner sign-in required." }, 401);
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(bearer);
    if (authError || !user?.email_confirmed_at || user.email?.toLowerCase() !== ownerEmail) {
      return reply({ error: "Owner sign-in required." }, 403);
    }
    const text = await request.text();
    if (text.length > 12000) return reply({ error: "Message is too long." }, 400);
    const body = JSON.parse(text);
    const config = gmailConfig();
    const editor = user.id;
    if (body.action === "status") {
      const { data, error } = await db.rpc("rock_registration_mail_status", { editor });
      if (error) return reply({ error: "Could not load registrations." }, 500);
      return reply({ ...data, configured: Boolean(config) });
    }
    if (body.action !== "send" || typeof body.id !== "string" ||
        !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.id)) {
      return reply({ error: "Invalid mail request." }, 400);
    }
    if (!config) return reply({ error: "Connect the ROCK ESPORTS Gmail account before sending." }, 503);
    let access;
    try { access = await gmailAccess(config); }
    catch { return reply({ error: "Gmail authorization is missing or expired." }, 503); }

    const { data: batch, error: invalid } = await db.rpc("rock_registration_mail_batch", {
      campaign_id: body.id, editor,
      mail_subject: typeof body.subject === "string" ? body.subject : null,
      mail_message: typeof body.message === "string" ? body.message : null,
      mail_sender: ownerEmail,
    });
    if (invalid) return reply({ error: "Could not open this send. If sending was interrupted, wait a minute before resuming." }, 409);
    if (!batch.recipient) return reply({ sent: batch.sent, processed: batch.processed, total: batch.total });

    let outcome = "uncertain";
    let errorMessage = "";
    try {
      const sent = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/" + encodeURIComponent(ownerEmail) + "/messages/send",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" },
          body: JSON.stringify({ raw: emailData(batch, body.id) }),
          signal: AbortSignal.timeout(7000),
        },
      );
      if (sent.ok) outcome = "sent";
      else if (sent.status >= 400 && sent.status < 500) {
        outcome = "retry";
        if (sent.status === 401) gmailToken = null;
        errorMessage = sent.status === 429
          ? "Gmail is limiting sends. Resume after the limit resets."
          : "Gmail declined the email. Check the address or Gmail setup before resuming.";
      }
    } catch {}
    const { data, error } = await db.rpc("rock_registration_mail_ack", {
      campaign_id: body.id, editor, batch_offset: batch.processed, outcome,
    });
    if (error) return reply({ error: "Could not save Gmail progress. Wait a minute before resuming." }, 502);
    if (errorMessage) return reply({ error: errorMessage }, 502);
    return reply(data);
  } catch {
    return reply({ error: "Mail service unavailable. Resume the same send later." }, 503);
  }
});
