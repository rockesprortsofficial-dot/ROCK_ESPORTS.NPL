import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2.13.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const authorization = request.headers.get("Authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const livekitUrl = Deno.env.get("LIVEKIT_URL") || "";
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY") || "";
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET") || "";
    if (!jwt) return json({ error: "Log in before starting a call" }, 401);
    if (!supabaseUrl || !anonKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return json({ error: "ROCK CONNECT call service is not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData.user) return json({ error: "Your login has expired. Please log in again." }, 401);

    const body = await request.json();
    const roomId = String(body.room_id || "");
    const callId = String(body.call_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId)) {
      return json({ error: "Choose a valid Connect room" }, 400);
    }

    const { data: membership, error: memberError } = await supabase
      .from("rock_connect_members").select("room_id")
      .eq("room_id", roomId).eq("user_id", authData.user.id).maybeSingle();
    if (memberError || !membership) return json({ error: "You do not have access to this Connect room" }, 403);

    if (!/^[0-9a-f-]{36}$/i.test(callId)) return json({error:"Invalid call"},400);
    const {data: call,error: callError}=await supabase.from("rock_connect_calls").select("id,status,created_at,expires_at").eq("id",callId).eq("room_id",roomId).maybeSingle();
    if(callError||!call||call.status==="ended"||Date.parse(call.expires_at)<=Date.now()||(call.status==="ringing"&&Date.now()-Date.parse(call.created_at)>60000)) return json({error:"This call has ended"},403);
    const { data: profile } = await supabase.from("rock_connect_profiles")
      .select("display_name").eq("user_id", authData.user.id).maybeSingle();
    const name = String(profile?.display_name || "ROCK Connect Player").slice(0, 40);
    const roomName = `rock-connect-${roomId}-${callId}`;
    const accessToken = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: authData.user.id,
      name,
      ttl: "10m",
    });
    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return json({
      token: await accessToken.toJwt(),
      server_url: livekitUrl,
      identity: authData.user.id,
      name,
      room_name: roomName,
    });
  } catch (error) {
    console.error("ROCK CONNECT token error:", error);
    return json({ error: "Could not start the call" }, 500);
  }
});
