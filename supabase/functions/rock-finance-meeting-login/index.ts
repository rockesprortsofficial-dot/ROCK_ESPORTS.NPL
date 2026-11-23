import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.1";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

function reply(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return reply({ error: "POST only" }, 405);
  if (Number(request.headers.get("content-length")) > 4096) return reply({ error: "Invalid login" }, 400);

  const auth = { persistSession: false, autoRefreshToken: false };
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({ error: "Meeting login unavailable" }, 503);

  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "Invalid login" }, 400);
    const { name, code, password } = JSON.parse(raw);
    if (typeof name !== "string" || name.length > 120 || !/^\d{4}$/.test(code) ||
        typeof password !== "string" || !password || password.length > 256) {
      return reply({ error: "Enter your Meeting Room name, ID and password" }, 400);
    }

    const client = createClient(url, anon, { auth });
    const db = createClient(url, service, { auth });
    const { data, error } = await client.rpc("rock_meeting_login", {
      p_real_name: name.trim(), p_login_code: code, p_password: password,
    });
    const member = Array.isArray(data) ? data[0] : data;
    const memberId = member?.member_id ?? member?.id;
    if (error || member?.success === false || !memberId) {
      return reply({ error: "Meeting Room login or Finance access was not accepted" }, 401);
    }

    const { data: binding, error: bindingError } = await db.rpc("rock_finance_meeting_identity", {
      member_id: memberId,
    });
    if (bindingError || !binding?.email) {
      return reply({ error: "Meeting Room login or Finance access was not accepted" }, 401);
    }

    const { data: link, error: linkError } = await db.auth.admin.generateLink({
      type: "magiclink", email: binding.email,
    });
    if (linkError || (binding.user_id && link.user.id !== binding.user_id)) {
      return reply({ error: "Could not start the Finance session" }, 503);
    }
    const { data: verified, error: verifyError } = await client.auth.verifyOtp({
      type: "email", token_hash: link.properties.hashed_token,
    });
    if (verifyError || !verified.session || verified.user?.id !== link.user.id) {
      return reply({ error: "Could not start the Finance session" }, 503);
    }
    const jwtPayload = verified.session.access_token.split(".")[1];
    const claims = JSON.parse(atob(jwtPayload.replaceAll("-", "+").replaceAll("_", "/")));
    const { error: sessionError } = await db.rpc("rock_finance_register_meeting_session", {
      member_id: memberId, editor_id: link.user.id, session_id: claims.session_id,
    });
    if (sessionError) return reply({ error: "Could not authorize the Finance session" }, 503);
    return reply({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    });
  } catch {
    return reply({ error: "Meeting login unavailable" }, 503);
  }
});
