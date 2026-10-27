import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AccessToken, RoomServiceClient } from "npm:livekit-server-sdk@2.13.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const PUBLIC_ROOM = "rock-esports-main";
const MAX_PARTICIPANTS = 100;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const livekitUrl = Deno.env.get("LIVEKIT_URL") || "";
    const apiKey = Deno.env.get("LIVEKIT_API_KEY") || "";
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET") || "";
    if (!livekitUrl || !apiKey || !apiSecret) {
      return json({ error: "Meeting service is not configured" }, 500);
    }

    const body = await req.json();
    const name = String(body.display_name || "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 32 || /[<>\u0000-\u001f]/.test(name)) {
      return json({ error: "Enter a gamer name between 2 and 32 characters" }, 400);
    }

    const apiHost = livekitUrl.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
    const roomService = new RoomServiceClient(apiHost, apiKey, apiSecret);
    let rooms = await roomService.listRooms([PUBLIC_ROOM]);
    if (rooms.length === 0) {
      try {
        await roomService.createRoom({
          name: PUBLIC_ROOM,
          maxParticipants: MAX_PARTICIPANTS,
          emptyTimeout: 300,
        });
      } catch (error) {
        // Another person may have created the shared room at the same time.
        rooms = await roomService.listRooms([PUBLIC_ROOM]);
        if (rooms.length === 0) throw error;
      }
      rooms = await roomService.listRooms([PUBLIC_ROOM]);
    }

    const room = rooms[0];
    if (room && room.numParticipants >= MAX_PARTICIPANTS) {
      return json({ error: "This meeting has reached 100 people. Please try again later." }, 429);
    }

    const identity = "guest-" + crypto.randomUUID();
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: "2h",
    });
    token.addGrant({
      roomJoin: true,
      room: PUBLIC_ROOM,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    token.roomConfig = {
      name: PUBLIC_ROOM,
      maxParticipants: MAX_PARTICIPANTS,
      emptyTimeout: 300,
    };

    return json({
      token: await token.toJwt(),
      server_url: livekitUrl,
      identity,
      name,
      room_name: PUBLIC_ROOM,
    });
  } catch (error) {
    console.error("ROCK public meeting join error:", error);
    return json({ error: "Could not join the public meeting. Please try again." }, 500);
  }
});
