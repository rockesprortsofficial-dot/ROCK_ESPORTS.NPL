(() => {
  "use strict";
  const SUPABASE_URL = "https://pokdcjqvyjddbixqaktj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_jK4Pnt8Ou9lZOmQ2AEB60w_YFytJcbp";
  const PRIVATE_TOKEN_URL = SUPABASE_URL + "/functions/v1/livekit-token";
  const GUEST_TOKEN_URL = SUPABASE_URL + "/functions/v1/livekit-guest-token";
  const PUBLIC_ROOM = "rock-esports-main";

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init = {}) {
    const requestUrl = input instanceof Request ? input.url : String(input);
    if (window.__rockGuestJoinPending && requestUrl.includes(PRIVATE_TOKEN_URL)) {
      window.__rockGuestJoinPending = false;
      let originalBody = {};
      try { originalBody = JSON.parse(init.body || "{}"); } catch (_) {}
      const headers = new Headers(init.headers || {});
      headers.set("Content-Type", "application/json");
      headers.set("apikey", SUPABASE_KEY);
      headers.set("Authorization", "Bearer " + SUPABASE_KEY);
      const code = document.getElementById("rlCode");
      const pass = document.getElementById("rlPass");
      if (code) code.value = "";
      if (pass) pass.value = "";
      return nativeFetch(GUEST_TOKEN_URL, {
        ...init,
        headers,
        body: JSON.stringify({ display_name: originalBody.real_name || "" }),
      });
    }
    return nativeFetch(input, init);
  };

  function addGuestJoin() {
    const panel = document.getElementById("rockLiveKitPanel");
    const nameInput = document.getElementById("rlName");
    const codeInput = document.getElementById("rlCode");
    const passInput = document.getElementById("rlPass");
    const roomInput = document.getElementById("rlRoom");
    const memberButton = document.getElementById("rlJoin");
    if (!panel || !nameInput || !codeInput || !passInput || !roomInput || !memberButton || document.getElementById("rlGuestJoin")) return false;

    const guestButton = document.createElement("button");
    guestButton.id = "rlGuestJoin";
    guestButton.type = "button";
    guestButton.textContent = "🎮 Join the public gamer meeting";
    guestButton.style.cssText = "display:block;width:100%;margin:10px 0;padding:12px;border:1px solid #49a9e8;border-radius:9px;background:#0878bd;color:#fff;font-weight:800;cursor:pointer";

    const guestHint = document.createElement("p");
    guestHint.id = "rlGuestHint";
    guestHint.textContent = "Enter your gamer name above. No member code or password is needed.";
    guestHint.style.cssText = "margin:0 0 8px;color:#b6cee2;font-size:13px";

    const memberMode = document.createElement("button");
    memberMode.id = "rlMemberMode";
    memberMode.type = "button";
    memberMode.textContent = "Use member login instead";
    memberMode.hidden = true;
    memberMode.style.cssText = "display:block;margin:8px 0;padding:8px 12px;border:1px solid #2675a8;border-radius:8px;background:#102b42;color:#fff;font-weight:700;cursor:pointer";

    const codeLabel = codeInput.closest("label");
    const passLabel = passInput.closest("label");
    const setGuestMode = (enabled) => {
      if (codeLabel) codeLabel.hidden = enabled;
      if (passLabel) passLabel.hidden = enabled;
      memberButton.hidden = enabled;
      guestHint.hidden = !enabled;
      memberMode.hidden = !enabled;
      guestButton.textContent = enabled ? "🎮 Join public meeting" : "🎮 Join the public gamer meeting";
      nameInput.placeholder = enabled ? "Your gamer name" : "Registered full name";
    };

    memberButton.before(guestButton, guestHint, memberMode);
    guestHint.hidden = true;
    guestButton.addEventListener("click", () => setGuestMode(true));
    memberMode.addEventListener("click", () => setGuestMode(false));

    guestButton.addEventListener("click", () => {
      if (!guestHint.hidden) {
        const gamerName = nameInput.value.trim();
        if (gamerName.length < 2) {
          guestHint.textContent = "पहिले माथिको ठाउँमा आफ्नो गेमर नाम लेख्नुहोस्।";
          nameInput.focus();
          return;
        }
        roomInput.value = PUBLIC_ROOM;
        codeInput.value = "0000";
        passInput.value = "public-guest";
        window.__rockGuestJoinPending = true;
        guestHint.textContent = "Connecting to the public room…";
        memberButton.click();
      }
    });
    return true;
  }

  if (!addGuestJoin()) {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts++;
      if (addGuestJoin() || attempts > 30) window.clearInterval(timer);
    }, 250);
  }
})();
