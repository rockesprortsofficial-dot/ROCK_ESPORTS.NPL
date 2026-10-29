// ROCK ESPORTS - LiveKit token Edge Function
// Paste this complete file into Supabase Edge Functions > livekit-token > index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AccessToken } from "npm:livekit-server-sdk@2.13.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // These values must be saved in Supabase Edge Function Secrets.
    // Never put the LiveKit API secret in the website or share it publicly.
    const livekitUrl = Deno.env.get("LIVEKIT_URL") ?? "";
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret || !supabaseUrl || !supabaseAnonKey) {
      console.error("One or more required Edge Function secrets are missing.");
      return jsonResponse({ error: "Server configuration is incomplete" }, 500);
    }

    const body = await request.json();
    const realName = String(body.real_name ?? "").trim();
    const loginCode = String(body.login_code ?? "").trim();
    const password = String(body.password ?? "");
    const roomName = String(body.room_name ?? "").trim();

    if (!realName || !/^\d{4}$/.test(loginCode) || !password ||
        !/^[A-Za-z0-9_-]{1,80}$/.test(roomName)) {
      return jsonResponse({ error: "Please check the login details and room name" }, 400);
    }

    // Verify the member using the existing Supabase login RPC.
    const verifyResponse = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/rock_meeting_login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          p_real_name: realName,
          p_login_code: loginCode,
          p_password: password,
        }),
      },
    );

    if (!verifyResponse.ok) {
      console.error("Member verification RPC returned status:", verifyResponse.status);
      return jsonResponse({ error: "Member login verification failed" }, 502);
    }

    const result = await verifyResponse.json();
    const member = Array.isArray(result) ? result[0] : result;
    const memberId = member?.id ?? member?.member_id;

    if (!member || member.success === false || !memberId) {
      return jsonResponse({ error: "Incorrect login, inactive account, or account locked" }, 401);
    }

    // Create a short-lived token. The LiveKit secret stays on the server.
    const memberName = String(member.real_name ?? member.name ?? realName);
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: String(memberId),
      name: memberName,
      metadata: JSON.stringify({ rock_private_member: true }),
      ttl: "2h",
    });

    token.addGrant({
      roomJoin: true,
      room: "rock-private-" + roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return jsonResponse({
      token: await token.toJwt(),
      server_url: livekitUrl,
      identity: String(memberId),
      name: memberName,
      room_name: "rock-private-" + roomName,
    });
  } catch (error) {
    console.error("LiveKit token function error:", error);
    return jsonResponse({ error: "Token generation failed" }, 500);
  }
});
