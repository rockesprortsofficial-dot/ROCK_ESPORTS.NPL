(() => {
  "use strict";
  const SUPABASE_URL = "https://pokdcjqvyjddbixqaktj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_jK4Pnt8Ou9lZOmQ2AEB60w_YFytJcbp";
  const API = SUPABASE_URL + "/functions/v1/rock-meeting-chat-media";
  const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
  let started = false;

  function addStyles() {
    if (document.getElementById("rock-meeting-chat-style")) return;
    const style = document.createElement("style");
    style.id = "rock-meeting-chat-style";
    style.textContent = `
      #rockMeetingChatToggle{position:fixed;right:14px;bottom:82px;z-index:1000005;border:1px solid #46a9ef;border-radius:999px;background:#0878bd;color:#fff;padding:12px 17px;font:800 14px system-ui;box-shadow:0 4px 16px #0008}
      #rockMeetingChatPanel{position:fixed;right:12px;bottom:137px;z-index:1000006;display:none;flex-direction:column;width:min(360px,calc(100vw - 24px));height:min(52vh,500px);min-height:280px;border:1px solid #3299dc;border-radius:15px;background:#071626;color:#eff8ff;box-shadow:0 8px 30px #000b;font:14px system-ui}
      #rockMeetingChatPanel.rock-chat-open{display:flex}
      #rockMeetingChatHead{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-bottom:1px solid #24506e;font-weight:800}
      #rockMeetingChatStatus{font-size:11px;color:#9bc4dd;font-weight:500}
      #rockMeetingChatMessages{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
      .rock-chat-msg{padding:8px 10px;border-radius:10px;background:#102b42;overflow-wrap:anywhere}
      .rock-chat-msg strong{display:block;color:#79c9ff;font-size:12px;margin-bottom:3px}
      .rock-chat-msg small{display:block;color:#9bb2c2;font-size:10px;margin-top:4px}
      .rock-chat-msg img,.rock-chat-msg video{display:block;width:100%;max-height:200px;object-fit:contain;border-radius:7px;margin-top:6px;background:#000}
      .rock-chat-msg a{color:#8bd2ff}
      #rockMeetingChatForm{display:flex;gap:6px;padding:9px;border-top:1px solid #24506e}
      #rockMeetingChatText{flex:1;min-width:0;border:1px solid #315a75;border-radius:9px;background:#091d2d;color:#fff;padding:10px;font:14px system-ui}
      #rockMeetingChatForm button{border:0;border-radius:9px;background:#0878bd;color:#fff;padding:8px 11px;font-weight:800}
      #rockMeetingChatFile{display:none}
      #rockMeetingChatUpload{background:#153b55!important;font-size:18px;padding:6px 10px!important}
      @media(max-width:600px){#rockMeetingChatPanel{right:8px;bottom:137px;width:calc(100vw - 16px);height:min(48vh,440px)}#rockMeetingChatToggle{right:9px;bottom:79px}}
    `;
    document.head.append(style);
  }

  function showMessage(list, item) {
    if (!item?.id || list.querySelector('[data-message-id="' + CSS.escape(String(item.id)) + '"]')) return;
    const card = document.createElement("article");
    card.className = "rock-chat-msg";
    card.dataset.messageId = String(item.id);
    const author = document.createElement("strong");
    author.textContent = item.sender_name || "ROCK ESPORTS Member";
    card.append(author);
    if (item.message) {
      const text = document.createElement("div");
      text.textContent = item.message;
      card.append(text);
    }
    if (item.media_url) {
      if (item.media_type === "video") {
        const video = document.createElement("video");
        video.src = item.media_url;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        card.append(video);
      } else {
        const link = document.createElement("a");
        link.href = item.media_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open shared photo";
        const image = document.createElement("img");
        image.src = item.media_url;
        image.alt = "Photo shared in the meeting";
        image.loading = "lazy";
        link.append(image);
        card.append(link);
      }
    }
    const date = document.createElement("small");
    date.textContent = item.created_at ? new Date(item.created_at).toLocaleString() : "";
    card.append(date);
    list.append(card);
    list.scrollTop = list.scrollHeight;
  }

  function mount(room, token) {
    if (started || document.getElementById("rlCall")?.hidden) return;
    started = true;
    addStyles();
    const panel = document.createElement("section");
    panel.id = "rockMeetingChatPanel";
    panel.setAttribute("aria-label", "Meeting Room chat and media");
    panel.innerHTML = '<div id="rockMeetingChatHead"><span>💬 Meeting Room Chat</span><span id="rockMeetingChatStatus">Connecting…</span></div><div id="rockMeetingChatMessages" aria-live="polite"></div><form id="rockMeetingChatForm"><label id="rockMeetingChatUpload" title="Share a photo or video">＋<input id="rockMeetingChatFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"></label><input id="rockMeetingChatText" maxlength="2000" autocomplete="off" placeholder="Write a message…"><button type="submit">Send</button></form>';
    const toggle = document.createElement("button");
    toggle.id = "rockMeetingChatToggle";
    toggle.type = "button";
    toggle.textContent = "💬 Chat / Media";
    toggle.setAttribute("aria-expanded", "false");
    document.body.append(panel, toggle);
    const list = panel.querySelector("#rockMeetingChatMessages");
    const status = panel.querySelector("#rockMeetingChatStatus");
    const form = panel.querySelector("#rockMeetingChatForm");
    const input = panel.querySelector("#rockMeetingChatText");
    const fileInput = panel.querySelector("#rockMeetingChatFile");

    toggle.addEventListener("click", () => {
      const open = panel.classList.toggle("rock-chat-open");
      toggle.setAttribute("aria-expanded", String(open));
      if (open) input.focus();
    });

    const apiFetch = (url, options = {}) => fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), apikey: SUPABASE_KEY, Authorization: "Bearer " + token },
    });

    let timer = 0;
    let disposed = false;
    const load = async () => {
      if (disposed) return;
      try {
        const response = await apiFetch(API + "?room=" + encodeURIComponent(room.name));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Chat could not load");
        for (const item of data.messages || []) showMessage(list, item);
        status.textContent = "Connected";
      } catch (error) {
        status.textContent = error?.message || "Reconnect to use chat";
      }
    };
    load();
    timer = window.setInterval(load, 3000);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      status.textContent = "Sending…";
      try {
        const response = await apiFetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-rock-room": room.name },
          body: JSON.stringify({ message }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Message could not send");
        showMessage(list, data.message);
        input.value = "";
        status.textContent = "Connected";
      } catch (error) {
        status.textContent = error?.message || "Message could not send";
      } finally {
        submit.disabled = false;
        input.focus();
      }
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (file.size > MAX_MEDIA_BYTES) {
        status.textContent = "Choose a photo/video smaller than 25 MB";
        fileInput.value = "";
        return;
      }
      const formData = new FormData();
      formData.append("media", file);
      formData.append("message", input.value.trim());
      status.textContent = "Uploading…";
      fileInput.disabled = true;
      try {
        const response = await apiFetch(API, {
          method: "POST",
          headers: { "x-rock-room": room.name },
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Media could not upload");
        showMessage(list, data.message);
        input.value = "";
        status.textContent = "Connected";
      } catch (error) {
        status.textContent = error?.message || "Media could not upload";
      } finally {
        fileInput.value = "";
        fileInput.disabled = false;
      }
    });

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      panel.remove();
      toggle.remove();
      started = false;
      room.off?.(window.LivekitClient.RoomEvent.Disconnected, cleanup);
    };
    const disconnectedEvent = window.LivekitClient.RoomEvent.Disconnected;
    room.on(disconnectedEvent, cleanup);
    window.addEventListener("pagehide", cleanup, { once: true });
  }

  function install() {
    const Room = window.LivekitClient?.Room;
    if (!Room?.prototype || Room.prototype.__rockMeetingChatWrapped) return false;
    const originalConnect = Room.prototype.connect;
    if (typeof originalConnect !== "function") return false;
    Room.prototype.connect = async function (serverUrl, token, ...args) {
      const result = await originalConnect.call(this, serverUrl, token, ...args);
      mount(this, token);
      return result;
    };
    Object.defineProperty(Room.prototype, "__rockMeetingChatWrapped", { value: true });
    return true;
  }

  if (!install()) {
    let attempts = 0;
    const wait = window.setInterval(() => {
      attempts++;
      if (install() || attempts > 40) window.clearInterval(wait);
    }, 250);
  }
})();
