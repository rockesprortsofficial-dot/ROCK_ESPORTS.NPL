import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TokenVerifier } from "npm:livekit-server-sdk@2.13.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rock-room",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const BUCKET = "rock-meeting-media";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm", "video/quicktime",
]);

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return reply({ error: "GET or POST only" }, 405);

  try {
    const apiKey = Deno.env.get("LIVEKIT_API_KEY") || "";
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!apiKey || !apiSecret || !supabaseUrl || !serviceKey) {
      return reply({ error: "Meeting chat service is not fully configured" }, 500);
    }

    const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
    if (!bearer) return reply({ error: "Please join the meeting first" }, 401);

    const claims = await new TokenVerifier(apiKey, apiSecret).verify(bearer);
    const video = (claims as { video?: { room?: string; roomJoin?: boolean } }).video;
    const identity = String((claims as { sub?: string }).sub || "");
    const senderName = String((claims as { name?: string }).name || identity).slice(0, 100);
    if (!identity || video?.roomJoin !== true || !video.room) {
      return reply({ error: "Meeting access could not be verified" }, 401);
    }

    const url = new URL(req.url);
    const requestedRoom = req.method === "GET"
      ? (url.searchParams.get("room") || "")
      : (req.headers.get("x-rock-room") || "");
    if (requestedRoom !== video.room) return reply({ error: "This meeting room is not available to your account" }, 403);

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("rock_public_meeting_messages")
        .select("id,room_name,sender_id,sender_name,message,media_path,media_type,created_at")
        .eq("room_name", video.room)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const messages = await Promise.all((data || []).map(async (item) => {
        let mediaUrl: string | null = null;
        if (item.media_path) {
          const { data: signed, error: signedError } = await supabase.storage
            .from(BUCKET).createSignedUrl(item.media_path, 3600);
          if (!signedError) mediaUrl = signed?.signedUrl || null;
        }
        return { ...item, media_url: mediaUrl };
      }));
      return reply({ messages: messages.reverse() });
    }

    const contentType = req.headers.get("content-type") || "";
    let message = "";
    let file: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      message = String(form.get("message") || "").trim().slice(0, 2000);
      const candidate = form.get("media");
      if (candidate instanceof File && candidate.size > 0) file = candidate;
    } else {
      const body = await req.json();
      message = String(body.message || "").trim().slice(0, 2000);
    }

    if (!message && !file) return reply({ error: "Write a message or choose a photo/video" }, 400);
    if (file && (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) {
      return reply({ error: "Choose a supported photo or video up to 25 MB" }, 400);
    }

    let mediaPath: string | null = null;
    let mediaType: string | null = null;
    if (file) {
      const ext = ({
        "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
        "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
      } as Record<string, string>)[file.type];
      mediaPath = `${video.room}/${crypto.randomUUID()}.${ext}`;
      mediaType = file.type.startsWith("video/") ? "video" : "image";
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(mediaPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("rock_public_meeting_messages")
      .insert({
        room_name: video.room,
        sender_id: identity,
        sender_name: senderName,
        message,
        media_path: mediaPath,
        media_type: mediaType,
      })
      .select("id,room_name,sender_id,sender_name,message,media_path,media_type,created_at")
      .single();
    if (insertError) {
      if (mediaPath) await supabase.storage.from(BUCKET).remove([mediaPath]);
      throw insertError;
    }

    let mediaUrl: string | null = null;
    if (mediaPath) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(mediaPath, 3600);
      mediaUrl = signed?.signedUrl || null;
    }
    return reply({ message: { ...inserted, media_url: mediaUrl } }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (/token|jwt|signature|expired/i.test(message)) return reply({ error: "Meeting access expired. Please rejoin." }, 401);
    console.error("Meeting chat/media error:", error);
    return reply({ error: "Chat or media could not be saved. Please try again." }, 500);
  }
});
