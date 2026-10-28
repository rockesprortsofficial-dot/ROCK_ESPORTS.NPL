(() => {
  "use strict";
  const section = document.getElementById("connect");
  const client = typeof sb !== "undefined" ? sb : null;
  if (!section || !client || section.dataset.rockConnectReady) return;
  const container = section.querySelector(".container");
  const heading = container && container.querySelector(".head");
  if (!container || !heading) return;
  section.dataset.rockConnectReady = "1";

  const style = document.createElement("style");
  style.textContent = [
    "#rockConnectApp{margin-top:16px;color:#eef7ff}",
    "#rockConnectApp .rc-card{background:#071626;border:1px solid #214762;border-radius:14px;padding:16px;margin:12px 0}",
    "#rockConnectApp input,#rockConnectApp textarea,#rockConnectApp select{box-sizing:border-box;width:100%;background:#030c16;color:#fff;border:1px solid #315a75;border-radius:9px;padding:10px;font:inherit}",
    "#rockConnectApp button{border:0;border-radius:9px;background:#0878bd;color:#fff;padding:9px 12px;font-weight:800;cursor:pointer}",
    "#rockConnectApp button.secondary{background:#17334a;border:1px solid #315a75}",
    "#rockConnectApp button:disabled{opacity:.55;cursor:wait}",
    "#rockConnectApp .rc-auth-form{display:grid;gap:10px;max-width:460px}",
    "#rockConnectApp .rc-actions,#rockConnectApp .rc-room-list{display:flex;gap:8px;flex-wrap:wrap}",
    "#rockConnectApp .rc-layout{display:grid;grid-template-columns:minmax(190px,260px) minmax(0,1fr);gap:12px}",
    "#rockConnectApp .rc-room{width:100%;text-align:left;background:#0d263a!important}",
    "#rockConnectApp .rc-room.active{background:#0878bd!important}",
    "#rockConnectApp .rc-chat{min-width:0;display:flex;flex-direction:column;min-height:500px}",
    "#rockConnectApp .rc-chat-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-bottom:1px solid #214762;padding-bottom:10px}",
    "#rockConnectApp .rc-messages{flex:1;overflow:auto;min-height:280px;max-height:56vh;padding:10px 2px;display:flex;flex-direction:column;gap:9px}",
    "#rockConnectApp .rc-message{background:#102b42;border:1px solid #1d4058;border-radius:12px;padding:10px;overflow-wrap:anywhere}",
    "#rockConnectApp .rc-message .meta{color:#9bb2c2;font-size:12px;display:flex;gap:9px;flex-wrap:wrap}",
    "#rockConnectApp .rc-message .body{white-space:pre-wrap;margin:6px 0}",
    "#rockConnectApp .rc-message img,#rockConnectApp .rc-message video{display:block;max-width:100%;max-height:340px;border-radius:10px;margin-top:8px;background:#000}",
    "#rockConnectApp .rc-message audio{width:min(100%,420px);margin-top:8px}",
    "#rockConnectApp .rc-status{min-height:1.4em;color:#9bd4fa;font-size:13px}",
    "#rockConnectApp .rc-form{display:grid;grid-template-columns:auto 1fr auto;gap:8px;border-top:1px solid #214762;padding-top:10px}",
    "#rockConnectApp .rc-form textarea{min-height:44px;max-height:120px;resize:vertical}",
    "#rockConnectApp .rc-call{position:fixed;inset:5vh 4vw;z-index:1000010;background:#04101c;border:1px solid #3d97ce;border-radius:16px;padding:16px;color:#fff;display:none;overflow:auto}",
    "#rockConnectApp .rc-call.open{display:block}",
    "#rockConnectApp .rc-call-stage{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:12px 0}",
    "#rockConnectApp .rc-call-stage video{width:100%;max-height:55vh;object-fit:contain;background:#000;border-radius:12px}",
    "#rockConnectApp .rc-call-stage audio{display:none}",
    "@media(max-width:720px){#rockConnectApp .rc-layout{grid-template-columns:1fr}#rockConnectApp .rc-sidebar{order:2}#rockConnectApp .rc-chat{min-height:60vh}#rockConnectApp .rc-messages{max-height:46vh}#rockConnectApp .rc-form{grid-template-columns:1fr auto}}"
  ].join("");
  style.textContent += `
    #rockConnectApp .rc-layout{gap:0;border:1px solid #214762;border-radius:18px;overflow:hidden;background:#061321}
    #rockConnectApp .rc-sidebar{padding:12px;background:#071b2d;border-right:1px solid #214762}
    #rockConnectApp .rc-sidebar .rc-card{border:0;background:transparent;padding:8px;margin:0 0 14px}
    #rockConnectApp .rc-chat{margin:0;border:0;border-radius:0;min-height:660px}
    #rockConnectApp .rc-message{max-width:82%;align-self:flex-start;border-radius:17px 17px 17px 4px}
    #rockConnectApp .rc-message.rc-own{align-self:flex-end;background:linear-gradient(135deg,#1264dc,#6339c9);border:0;border-radius:17px 17px 4px 17px}
    #rockConnectApp .rc-message .rc-actions{gap:4px}#rockConnectApp .rc-message .rc-actions button{padding:4px 6px;font-size:12px;background:#08203380}
    #rockConnectApp .rc-tools{display:flex;gap:6px;flex-wrap:wrap;padding:8px 0}
    #rockConnectApp .rc-picker{padding:10px;border:1px solid #315a75;border-radius:12px;background:#0b2035;margin:8px 0}
    #rockConnectApp .rc-picker[hidden],#rockConnectApp [hidden],#rcIncoming[hidden]{display:none!important}
    #rockConnectApp .rc-picker-grid{display:flex;flex-wrap:wrap;gap:6px;max-height:220px;overflow:auto}
    #rockConnectApp .rc-picker-grid button{font-size:23px;min-width:42px;padding:7px}
    #rockConnectApp .rc-sticker{display:inline-flex;align-items:center;justify-content:center;flex-direction:column;width:116px;min-height:110px;border-radius:24px;background:radial-gradient(circle at 30% 10%,#166dce,#162255 65%);border:2px solid #54ccff;color:#fff;box-shadow:0 5px 18px #0004;text-align:center}
    #rockConnectApp .rc-sticker span{font-size:40px}#rockConnectApp .rc-sticker strong{font-size:18px;letter-spacing:1px}
    #rockConnectApp .rc-attachment{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid #315a75;border-radius:12px}
    #rockConnectApp .rc-attachment img,#rockConnectApp .rc-attachment video{width:75px;height:65px;object-fit:contain;border-radius:8px}
    #rockConnectApp .rc-form{grid-template-columns:auto minmax(0,1fr) auto;align-items:end}
    #rockConnectApp .rc-form label{cursor:pointer;font-size:22px}#rockConnectApp .rc-form button{min-height:44px}
    #rockConnectApp .rc-mobile-back{display:none}
    #rockConnectApp .rc-call{inset:0;border-radius:0;padding:clamp(12px,3vw,28px);background:radial-gradient(circle at top,#102c52,#030b16 65%)}
    #rockConnectApp .rc-call-stage video{max-height:70vh;min-height:180px}
    #rockConnectApp .rc-hangup{background:#df3551!important}
    #rcIncoming{position:fixed;z-index:1000030;inset:auto 16px 20px auto;width:min(360px,calc(100vw - 32px));padding:22px;background:#0c1d34;color:#fff;border:1px solid #4989c3;border-radius:20px;box-shadow:0 15px 70px #000b;font-family:system-ui}
    #rcIncoming h3{margin:0 0 10px}#rcIncoming button{padding:12px 18px;margin:8px 6px 0 0;border:0;border-radius:24px;color:#fff;cursor:pointer;font-weight:800;background:#139d70}#rcIncoming .rc-decline{background:#d43a53}
    @media(max-width:720px){#rockConnectApp .rc-layout{display:block}#rockConnectApp .rc-sidebar{order:0;border:0}#rockConnectApp .rc-chat{min-height:65vh}#rockConnectApp .rc-layout:not(.rc-show-chat) .rc-chat{display:none}#rockConnectApp .rc-layout.rc-show-chat .rc-sidebar{display:none}#rockConnectApp .rc-mobile-back{display:inline-flex}#rockConnectApp .rc-messages{max-height:48dvh}#rockConnectApp .rc-message{max-width:94%}#rockConnectApp .rc-call-stage{grid-template-columns:1fr}#rockConnectApp .rc-call-stage video{max-height:45vh}#rockConnectApp .rc-form{grid-template-columns:auto minmax(0,1fr) auto}}
  `;
  document.head.append(style);

  const app = document.createElement("div");
  app.id = "rockConnectApp";
  app.innerHTML =
    '<div class="rc-card" id="rcAuth"><h3>ROCK CONNECT मा लगइन गर्नुहोस्</h3>' +
    '<p>पोस्ट र च्याट हेर्न खाता चाहिन्छ। फोटो/भिडियो बाँड्न र कल गर्न इमेलबाट खाता खोलेर लगइन गर्नुहोस्।</p>' +
    '<div class="rc-actions"><button type="button" id="rcLoginTab">लगइन</button><button type="button" class="secondary" id="rcSignupTab">नयाँ खाता</button></div>' +
    '<form class="rc-auth-form" id="rcAuthForm"><input id="rcName" maxlength="40" placeholder="खेलाडीको नाम" hidden>' +
    '<input id="rcEmail" type="email" maxlength="254" required placeholder="इमेल ठेगाना">' +
    '<input id="rcPassword" type="password" minlength="8" maxlength="128" required placeholder="पासवर्ड (कम्तीमा ८ अक्षर)">' +
    '<button id="rcAuthSubmit" type="submit">लगइन</button></form><p class="rc-status" id="rcAuthStatus"></p></div>' +
    '<div id="rcSignedIn" hidden><div class="rc-card rc-actions" style="align-items:center;justify-content:space-between">' +
    '<strong id="rcAccountName">ROCK CONNECT</strong><div class="rc-actions"><button type="button" class="secondary" id="rcEnableNotifications">🔔 सूचना खोल्नुहोस्</button><button type="button" class="secondary" id="rcSignOut">लगआउट</button></div></div>' +
    '<div class="rc-layout"><aside class="rc-sidebar"><div class="rc-card"><h3>च्याट कोठा</h3><div class="rc-room-list" id="rcRooms"></div></div>' +
    '<div class="rc-card"><h3>निजी च्याट सुरु गर्नुहोस्</h3><select id="rcPlayerSelect"><option value="">खेलाडी छान्नुहोस्</option></select>' +
    '<button type="button" id="rcStartDm" style="margin-top:8px;width:100%">निजी च्याट खोल्नुहोस्</button><p class="rc-status" id="rcDmStatus"></p></div>' +
    '<div class="rc-card"><strong>अनलाइन</strong><div class="rc-status" id="rcOnline">जडान हुँदैछ…</div></div><div class="rc-card"><strong>Recent calls / कल इतिहास</strong><div id="rcCallHistory" class="rc-status"></div></div></aside>' +
    '<main class="rc-card rc-chat"><div class="rc-chat-head"><button type="button" class="secondary rc-mobile-back" id="rcBack" aria-label="Back to chats">‹ Chats</button><div><strong id="rcRoomTitle">ROCK CONNECT Lobby</strong><div class="rc-status" id="rcRoomStatus">जडान हुँदैछ…</div></div>' +
    '<div class="rc-actions"><button type="button" id="rcAudioCall" aria-label="Audio call">📞 Audio</button><button type="button" id="rcCallButton" aria-label="Video call">📹 Video</button></div></div><div class="rc-messages" id="rcMessages"></div><div class="rc-status" id="rcReplyStatus"></div>' +
    '<div class="rc-tools"><button type="button" class="secondary" id="rcEmojiToggle" aria-expanded="false">😊 Emoji</button><button type="button" class="secondary" id="rcStickerToggle" aria-expanded="false">🎨 Stickers</button><button type="button" class="secondary" id="rcCallSound">🔊 Call sound: off</button></div><div class="rc-picker" id="rcEmojiPicker" hidden><div class="rc-picker-grid" id="rcEmojiGrid"></div></div><div class="rc-picker" id="rcStickerPicker" hidden><div class="rc-picker-grid" id="rcStickerGrid"></div></div><div class="rc-attachment" id="rcAttachment" hidden></div><div class="rc-actions" id="rcEmojiRow"><button class="secondary" type="button">😄</button><button class="secondary" type="button">🎮</button><button class="secondary" type="button">🏆</button><button class="secondary" type="button">❤️</button><button class="secondary" type="button">🔥</button></div>' +
    '<form class="rc-form" id="rcMessageForm"><label class="secondary" style="display:grid;place-items:center;padding:8px;border-radius:9px;cursor:pointer">＋<input id="rcMedia" aria-label="Attach photo or video (up to 25 MB)" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden></label>' +
    '<textarea id="rcMessage" maxlength="2000" placeholder="सन्देश लेख्नुहोस्…" aria-label="सन्देश"></textarea><button id="rcSend" type="submit">पठाउनुहोस्</button></form>' +
    '<div class="rc-actions" style="margin-top:8px"><button type="button" class="secondary" id="rcRecord">🎙️ आवाज रेकर्ड</button><span class="rc-status" id="rcChatStatus"></span></div></main></div>' +
    '<section class="rc-call" id="rcCallPanel"><div class="rc-chat-head"><strong>ROCK CONNECT कल</strong><button type="button" class="secondary" id="rcCallClose" aria-label="End call">कल बन्द गर्नुहोस्</button></div>' +
    '<div class="rc-call-stage" id="rcCallStage"></div><div class="rc-actions"><button type="button" id="rcMic">🎙️ माइक बन्द</button><button type="button" id="rcCamera">📹 क्यामेरा बन्द</button><button type="button" class="secondary" id="rcScreen">🖥️ Share screen</button></div><p class="rc-status" id="rcCallStatus"></p></section></div>';
  container.replaceChildren(heading, app);

  const meetingHead=document.querySelector("#meeting .head");if(meetingHead){const link=document.createElement("a");link.href="#connect";link.textContent="💬 Chat, photos & calls — ROCK CONNECT";link.style.cssText="display:inline-block;padding:10px 14px;margin-top:10px;border:1px solid #315a75;border-radius:9px;color:#9bd4fa";meetingHead.append(link);}
  const $ = (id) => document.getElementById(id);
  let authMode = "login", session = null, activeRoom = null, activeChannel = null, activeCall = null;
  let recorder = null, recorderStream = null, roomNames = new Map();
  let replyTo = null, pendingFile = null, previewUrl = null, sending = false, messageLoadVersion = 0;
  let roomsById = new Map(), peopleNames = new Map(), callChannel = null, callRecord = null, incomingCall = null, incomingTimer = null, ringTimer = null, soundContext = null;

  function say(id, text) { if ($(id)) $(id).textContent = text || ""; }
  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";
    $("rcName").hidden = !signup; $("rcName").required = signup;
    $("rcPassword").autocomplete = signup ? "new-password" : "current-password";
    $("rcAuthSubmit").textContent = signup ? "खाता खोल्नुहोस्" : "लगइन";
  }
  $("rcLoginTab").onclick = () => setAuthMode("login");
  $("rcSignupTab").onclick = () => setAuthMode("signup");

  function setSignedIn(next) {
    session = next;
    $("rcAuth").hidden = !!next?.user;
    $("rcSignedIn").hidden = !next?.user;
    if (!next?.user) {
      activeRoom = null;
      endCall(); hideIncoming(); clearAttachment();
      if(recorder?.state === "recording") recorder.stop();
      if(callChannel) client.removeChannel(callChannel); callChannel=null;
      $("rcMessages").replaceChildren(); $("rcRooms").replaceChildren(); $("rcPlayerSelect").replaceChildren(new Option("खेलाडी छान्नुहोस्", ""));
      if (activeChannel) client.removeChannel(activeChannel);
      activeChannel = null;
      return;
    }
    $("rcAccountName").textContent = "ROCK CONNECT • Signed in";
    loadDirectory(); loadRooms();
  }

  $("rcAuthForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("rcAuthSubmit"); button.disabled = true; say("rcAuthStatus", "खाता जाँचिँदै छ…");
    try {
      const email = $("rcEmail").value.trim(), password = $("rcPassword").value;
      const displayName = $("rcName").value.trim();
      const result = authMode === "signup"
        ? await client.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (authMode === "signup" && !result.data.session) say("rcAuthStatus", "इमेलमा आएको सन्देशबाट खाता पुष्टि गर्नुहोस्, त्यसपछि लगइन गर्नुहोस्।");
      else { say("rcAuthStatus", "लगइन सफल भयो।"); setSignedIn(result.data.session || null); }
    } catch (error) { say("rcAuthStatus", error?.message || "लगइन गर्न सकिएन।"); }
    finally { button.disabled = false; }
  });

  $("rcSignOut").onclick = async () => { await client.auth.signOut(); setSignedIn(null); };
  $("rcEnableNotifications").onclick = async () => {
    if (!("Notification" in window)) { say("rcChatStatus", "यो ब्राउजरले सूचना देखाउन सक्दैन।"); return; }
    const permission = await Notification.requestPermission();
    say("rcChatStatus", permission === "granted" ? "यो पेज पछाडि हुँदा सन्देशको सूचना आउँछ।" : "सूचना अनुमति दिइएन।");
  };
  $("rcEmojiRow").onclick = (event) => { const emoji = event.target.closest("button")?.textContent; if (emoji) { $("rcMessage").value += emoji; $("rcMessage").focus(); } };

  async function loadDirectory() {
    const directoryUser=session?.user?.id;
    const { data, error } = await client.from("rock_connect_profiles").select("user_id,display_name").order("display_name").limit(300);
    if (error) { say("rcDmStatus", "खेलाडी सूची खोल्न सकेन। Supabase मा ROCK CONNECT सेटअप जाँच्नुहोस्।"); return; }
    if(!directoryUser||session?.user?.id!==directoryUser)return;
    peopleNames = new Map((data||[]).map(person=>[person.user_id,person.display_name]));
    const select = $("rcPlayerSelect"); select.replaceChildren(new Option("खेलाडी छान्नुहोस्", ""));
    for (const person of data || []) if (person.user_id !== session?.user?.id) select.add(new Option(person.display_name, person.user_id));
  }

  $("rcStartDm").onclick = async () => {
    const other = $("rcPlayerSelect").value;
    if (!other) { say("rcDmStatus", "पहिले खेलाडी छान्नुहोस्।"); return; }
    say("rcDmStatus", "निजी च्याट खोलिँदै छ…");
    const { data, error } = await client.rpc("rock_connect_create_dm", { p_other_user: other });
    if (error) { say("rcDmStatus", error.message); return; }
    say("rcDmStatus", ""); await loadRooms(String(data));
  };

  async function loadRooms(openId) {
    if (!session?.user) return;
    const { data: memberships, error: memberError } = await client.from("rock_connect_members").select("room_id").eq("user_id", session.user.id);
    if (memberError) { say("rcChatStatus", "Supabase मा ROCK CONNECT सेटअप गर्न बाँकी छ।"); return; }
    const ids = (memberships || []).map((row) => row.room_id);
    if (!ids.length) { say("rcChatStatus", "च्याट कोठा भेटिएन।"); return; }
    const { data: rooms, error } = await client.from("rock_connect_rooms").select("id,title,kind").in("id", ids);
    if (error) { say("rcChatStatus", error.message); return; }
    const dmIds = (rooms || []).filter((room) => room.kind === "dm").map((room) => room.id);
    roomNames = new Map((rooms || []).map((room) => [room.id, room.title]));
    if (dmIds.length) {
      const { data: members } = await client.from("rock_connect_members").select("room_id,user_id").in("room_id", dmIds);
      const otherIds = (members || []).filter((m) => m.user_id !== session.user.id).map((m) => m.user_id);
      const { data: profiles } = otherIds.length ? await client.from("rock_connect_profiles").select("user_id,display_name").in("user_id", otherIds) : { data: [] };
      const names = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));
      for (const room of rooms || []) {
        if (room.kind === "dm") {
          const other = (members || []).find((m) => m.room_id === room.id && m.user_id !== session.user.id);
          roomNames.set(room.id, "निजी: " + (names.get(other?.user_id) || "खेलाडी"));
        }
      }
    }
    roomsById = new Map((rooms||[]).map(room=>[room.id,room]));
    watchCalls(); loadCallHistory();
    const ordered = (rooms || []).sort((a,b) => a.kind === "lobby" ? -1 : b.kind === "lobby" ? 1 : 0);
    $("rcRooms").replaceChildren();
    for (const room of ordered) {
      const button = document.createElement("button"); button.type="button";
      button.className = "rc-room" + (room.id === activeRoom?.id ? " active" : "");
      button.textContent = roomNames.get(room.id) || room.title;
      button.onclick = () => openRoom(room); $("rcRooms").append(button);
    }
    await openRoom(ordered.find((r) => r.id === openId) || ordered.find((r) => r.id === activeRoom?.id) || ordered[0]);
  }

  async function openRoom(room) {
    activeRoom = room; replyTo=null; say("rcReplyStatus", ""); clearAttachment();
    $("rockConnectApp").querySelector(".rc-layout").classList.add("rc-show-chat");
    $("rcMessages").replaceChildren();
    $("rcRoomTitle").textContent = roomNames.get(room.id) || room.title;
    if (activeChannel) await client.removeChannel(activeChannel);
    activeChannel = client.channel("rock-connect-" + room.id, { config: { presence: { key: session.user.id } } });
    activeChannel
      .on("postgres_changes", { event:"*", schema:"public", table:"rock_connect_messages", filter:"room_id=eq." + room.id }, (payload) => {
        if (payload.eventType === "INSERT" && session?.user && payload.new.sender_id !== session.user.id && document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification(roomNames.get(room.id) || room.title, { body: payload.new.body || "मिडिया सन्देश आयो।" });
        }
        loadMessages();
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"rock_connect_reactions" }, loadMessages)
      .on("presence", { event:"sync" }, () => { $("rcOnline").textContent = Object.keys(activeChannel.presenceState()).length + " जना यो कोठामा अनलाइन"; })
      .subscribe(async (state) => {
        if (state === "SUBSCRIBED" && session?.user && activeRoom?.id===room.id) {
          await activeChannel.track({ name:peopleNames.get(session.user.id)||"खेलाडी", online_at:new Date().toISOString() });
          $("rcRoomStatus").textContent = "जडान भयो";
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") $("rcRoomStatus").textContent = "जडान हुन सकेन";
      });
    await loadMessages();
  }

  async function loadMessages() {
    if (!activeRoom || !session?.user) return;
    const room = activeRoom; const version=++messageLoadVersion;
    const { data, error } = await client.from("rock_connect_messages").select("id,room_id,sender_id,body,media_path,media_type,reply_to,created_at")
      .eq("room_id", room.id).order("created_at",{ascending:false}).limit(100);
    if (error) { say("rcRoomStatus", "सन्देश खोल्न सकेन: " + error.message); return; }
    if(activeRoom?.id!==room.id || version!==messageLoadVersion || !session?.user)return;
    const messages = (data || []).reverse(), host = $("rcMessages");
    if (!messages.length) { host.innerHTML = '<div class="rc-message">यो च्याट खाली छ। पहिलो सन्देश पठाउनुहोस्।</div>'; return; }
    const ids = messages.map((m) => m.id);
    const [{data: reactions},{data: receipts},{data: profiles}] = await Promise.all([
      client.from("rock_connect_reactions").select("message_id,user_id,emoji").in("message_id",ids),
      client.from("rock_connect_receipts").select("message_id,user_id").in("message_id",ids),
      client.from("rock_connect_profiles").select("user_id,display_name").in("user_id",[...new Set(messages.map((m)=>m.sender_id))])
    ]);
    const names = new Map((profiles||[]).map((p)=>[p.user_id,p.display_name]));
    const byId = new Map(messages.map((m)=>[m.id,m]));
    host.replaceChildren();
    for (const message of messages) {
      if(activeRoom?.id!==room.id || version!==messageLoadVersion || !session?.user)return;
      const card=document.createElement("article"); card.className="rc-message"+(message.sender_id===session.user.id?" rc-own":"");
      const meta=document.createElement("div"); meta.className="meta";
      const author=document.createElement("strong"); author.textContent=names.get(message.sender_id)||"ROCK CONNECT";
      const date=document.createElement("time"); date.textContent=new Date(message.created_at).toLocaleString();
      meta.append(author,date); card.append(meta);
      if (message.reply_to && byId.has(message.reply_to)) { const quote=document.createElement("div"); quote.className="rc-status"; quote.textContent="↪ "+(byId.get(message.reply_to).body||"मिडिया सन्देश"); card.append(quote); }
      if (message.body) { const sticker=STICKERS.find(item=>message.body==="[ROCK_STICKER:v1:"+item.id+"]"); if(sticker)card.append(stickerNode(sticker)); else { const body=document.createElement("div"); body.className="body"; body.textContent=message.body; card.append(body); } }
      if (message.media_path) {
        const {data:signed}=await client.storage.from("rock-connect-media").createSignedUrl(message.media_path,3600);
        if (signed?.signedUrl) {
          const media=message.media_type==="video"?document.createElement("video"):message.media_type==="audio"?document.createElement("audio"):document.createElement("img");
          if(activeRoom?.id!==room.id || version!==messageLoadVersion || !session?.user)return;
          media.src=signed.signedUrl;
          if (message.media_type==="image") { media.alt="साझा गरिएको फोटो"; media.loading="lazy"; }
          else { media.controls=true; if (message.media_type==="video") media.playsInline=true; }
          card.append(media);
        }
      }
      const actions=document.createElement("div"); actions.className="rc-actions";
      for (const emoji of ["👍","❤️","😂","🔥","🎮","🏆"]) {
        const count=(reactions||[]).filter((r)=>r.message_id===message.id&&r.emoji===emoji).length;
        const b=document.createElement("button"); b.type="button"; b.className="secondary"; b.textContent=emoji+(count?" "+count:"");
        b.onclick=()=>toggleReaction(message.id,emoji); actions.append(b);
      }
      const reply=document.createElement("button"); reply.type="button"; reply.className="secondary"; reply.textContent="जवाफ";
      reply.onclick=()=>{ replyTo=message.id; say("rcReplyStatus","यो सन्देशको जवाफ लेख्नुहोस्।"); $("rcMessage").focus(); };
      actions.append(reply);
      if (message.sender_id===session.user.id) {
        const read=(receipts||[]).some((r)=>r.message_id===message.id&&r.user_id!==session.user.id);
        const seen=document.createElement("span"); seen.className="rc-status"; seen.textContent=read?"पढियो":"पठाइयो"; actions.append(seen);
      }
      card.append(actions); host.append(card);
    }
    if(activeRoom?.id!==room.id || version!==messageLoadVersion || !session?.user)return;
    host.scrollTop=host.scrollHeight;
    const seen=messages.filter((m)=>m.sender_id!==session.user.id).map((m)=>({message_id:m.id,user_id:session.user.id}));
    if (seen.length) await client.from("rock_connect_receipts").upsert(seen,{onConflict:"message_id,user_id",ignoreDuplicates:true});
  }

  async function toggleReaction(messageId,emoji) {
    const {data,error}=await client.from("rock_connect_reactions").select("message_id").eq("message_id",messageId).eq("user_id",session.user.id).eq("emoji",emoji).maybeSingle();
    if (error) { say("rcChatStatus",error.message); return; }
    if (data) await client.from("rock_connect_reactions").delete().eq("message_id",messageId).eq("user_id",session.user.id).eq("emoji",emoji);
    else await client.from("rock_connect_reactions").insert({message_id:messageId,user_id:session.user.id,emoji});
    await loadMessages();
  }

  $("rcMessageForm").addEventListener("submit",async(event)=>{event.preventDefault();await sendMessage(pendingFile);});
  $("rcMedia").addEventListener("change",()=>{const file=$("rcMedia").files?.[0]; if(file)previewAttachment(file);});
  async function sendMessage(file, overrideBody) {
    if (!activeRoom||!session?.user||sending) return;
    const targetRoom=activeRoom.id, sender=session.user.id, targetReply=replyTo;
    const body=overrideBody===undefined?$("rcMessage").value.trim():overrideBody; if(!body&&!file)return;
    if(file&&!validAttachment(file)) { say("rcChatStatus","२५ MB सम्मको फोटो वा भिडियो छान्नुहोस्।"); return; }
    sending=true; $("rcSend").disabled=true; say("rcChatStatus",file?"मिडिया राखिँदै छ…":"सन्देश पठाइँदै छ…");
    let path=null;
    try {
      let mediaType=null;
      if(file) {
        const ext=(file.name.split(".").pop()||"dat").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8);
        path=targetRoom+"/"+crypto.randomUUID()+"."+ext; mediaType=file.type.startsWith("video/")?"video":"image";
        const {error:uploadError}=await client.storage.from("rock-connect-media").upload(path,file,{contentType:file.type,upsert:false});
        if(uploadError)throw uploadError;
      }
      const {error}=await client.from("rock_connect_messages").insert({room_id:targetRoom,sender_id:sender,body,media_path:path,media_type:mediaType,reply_to:targetReply});
      if(error){if(path)await client.storage.from("rock-connect-media").remove([path]);throw error;}
      if(overrideBody===undefined && activeRoom?.id===targetRoom){$("rcMessage").value="";clearAttachment();} replyTo=null; say("rcReplyStatus",""); say("rcChatStatus","सन्देश सुरक्षित भयो।"); await loadMessages();
    } catch(error){say("rcChatStatus",error?.message||"सन्देश पठाउन सकेन।");}
    finally{sending=false;$("rcSend").disabled=false;}
  }

  $("rcRecord").onclick=async()=>{
    if(recorder?.state==="recording"){recorder.stop();$("rcRecord").textContent="अडियो तयार हुँदैछ…";return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){say("rcChatStatus","यो उपकरणमा अडियो रेकर्ड गर्न मिल्दैन।");return;}
    try{
      recorderStream=await navigator.mediaDevices.getUserMedia({audio:true}); const chunks=[];
      const recordingRoom=activeRoom?.id; recorder=new MediaRecorder(recorderStream); recorder.ondataavailable=(e)=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=async()=>{const type=recorder.mimeType||"audio/webm";const file=new File([new Blob(chunks,{type})],"voice-note.webm",{type});recorderStream.getTracks().forEach((t)=>t.stop());recorder=null;recorderStream=null;$("rcRecord").textContent="🎙️ आवाज रेकर्ड";await sendVoice(file,recordingRoom);};
      recorder.start(); $("rcRecord").textContent="⏹️ रेकर्डिङ रोक्नुहोस्"; say("rcChatStatus","आवाज रेकर्ड हुँदैछ…");
    }catch(error){say("rcChatStatus","माइक अनुमति चाहिन्छ: "+(error?.message||""));}
  };
  async function sendVoice(file, roomId=activeRoom?.id){
    if(!roomId||!session?.user||sending)return; if(file.size>25*1024*1024){say("rcChatStatus","आवाज बढीमा २५ MB हुनुपर्छ।");return;} sending=true; $("rcSend").disabled=true; say("rcChatStatus","आवाज पठाइँदै छ…");
    const path=roomId+"/"+crypto.randomUUID()+".webm";
    try{
      const {error:uploadError}=await client.storage.from("rock-connect-media").upload(path,file,{contentType:file.type.split(";")[0],upsert:false});if(uploadError)throw uploadError;
      const {error}=await client.from("rock_connect_messages").insert({room_id:roomId,sender_id:session.user.id,body:"",media_path:path,media_type:"audio"});
      if(error){await client.storage.from("rock-connect-media").remove([path]);throw error;} say("rcChatStatus","आवाज सन्देश पठाइयो।");await loadMessages();
    }catch(error){say("rcChatStatus",error?.message||"आवाज पठाउन सकेन।");}finally{sending=false;$("rcSend").disabled=false;}
  }

  const STICKERS=[{id:"gg",emoji:"🎮",label:"GG!"},{id:"victory",emoji:"🏆",label:"VICTORY"},{id:"fire",emoji:"🔥",label:"ON FIRE"},{id:"nice",emoji:"👏",label:"NICE!"},{id:"love",emoji:"💙",label:"ROCK LOVE"},{id:"hello",emoji:"👋",label:"HELLO"},{id:"ready",emoji:"⚡",label:"READY!"},{id:"thanks",emoji:"🙏",label:"THANK YOU"}];
  function stickerNode(sticker){const box=document.createElement("div");box.className="rc-sticker";box.setAttribute("role","img");box.setAttribute("aria-label",sticker.label+" sticker");const icon=document.createElement("span");icon.textContent=sticker.emoji;const label=document.createElement("strong");label.textContent=sticker.label;box.append(icon,label);return box;}
  function validAttachment(file){return file.size>0&&file.size<=25*1024*1024&&new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"]).has(file.type);}
  function clearAttachment(){pendingFile=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;$("rcMedia").value="";$("rcAttachment").replaceChildren();$("rcAttachment").hidden=true;}
  function previewAttachment(file){clearAttachment();if(!validAttachment(file)){say("rcChatStatus","२५ MB सम्मको फोटो वा भिडियो छान्नुहोस्।");return;}pendingFile=file;previewUrl=URL.createObjectURL(file);const preview=document.createElement(file.type.startsWith("video/")?"video":"img");preview.src=previewUrl;preview.alt="Attachment preview";const info=document.createElement("span");info.textContent=file.name+" · "+(file.size/1024/1024).toFixed(1)+" MB";const cancel=document.createElement("button");cancel.type="button";cancel.className="secondary";cancel.textContent="✕";cancel.setAttribute("aria-label","Remove attachment");cancel.onclick=clearAttachment;$("rcAttachment").append(preview,info,cancel);$("rcAttachment").hidden=false;say("rcChatStatus","फोटो/भिडियो तयार छ। पठाउनुहोस् थिच्नुहोस्।");}
  function togglePicker(id,button){const box=$(id);box.hidden=!box.hidden;$(button).setAttribute("aria-expanded",String(!box.hidden));}
  $("rcEmojiToggle").onclick=()=>togglePicker("rcEmojiPicker","rcEmojiToggle");
  $("rcStickerToggle").onclick=()=>togglePicker("rcStickerPicker","rcStickerToggle");
  $("rcBack").onclick=()=>$("rockConnectApp").querySelector(".rc-layout").classList.remove("rc-show-chat");
  for(const emoji of ["😀","😁","😂","🤣","😊","😍","🥰","😎","🥳","😢","😮","😡","👍","👎","👏","🙌","🙏","💪","👋","🤝","❤️","💙","💜","💯","🔥","⚡","✨","🎉","🎮","🏆","🥇","🎯","🚀","✅","🇳🇵","🤩"]){const button=document.createElement("button");button.type="button";button.className="secondary";button.textContent=emoji;button.setAttribute("aria-label","Insert emoji "+emoji);button.onclick=()=>{const field=$("rcMessage");const start=field.selectionStart??field.value.length,end=field.selectionEnd??start;if(field.value.length-(end-start)+emoji.length>2000)return;field.setRangeText(emoji,start,end,"end");field.focus();};$("rcEmojiGrid").append(button);}
  for(const sticker of STICKERS){const button=document.createElement("button");button.type="button";button.className="secondary";button.setAttribute("aria-label","Send "+sticker.label+" sticker");button.append(stickerNode(sticker));button.onclick=async()=>{await sendMessage(null,"[ROCK_STICKER:v1:"+sticker.id+"]");$("rcStickerPicker").hidden=true;$("rcStickerToggle").setAttribute("aria-expanded","false");};$("rcStickerGrid").append(button);}
  const incoming=document.createElement("section");incoming.id="rcIncoming";incoming.hidden=true;incoming.setAttribute("role","dialog");incoming.setAttribute("aria-modal","false");incoming.setAttribute("aria-labelledby","rcIncomingTitle");incoming.innerHTML='<h3 id="rcIncomingTitle">Incoming call</h3><p id="rcIncomingName"></p><button type="button" id="rcAcceptCall">Accept / उठाउनुहोस्</button><button type="button" class="rc-decline" id="rcDeclineCall">Decline / अस्वीकार</button>';document.body.append(incoming);
  function stopRing(){if(ringTimer)clearInterval(ringTimer);ringTimer=null;}
  function ring(){if(!soundContext||soundContext.state!=="running")return;try{const oscillator=soundContext.createOscillator(),gain=soundContext.createGain();oscillator.type="sine";oscillator.frequency.value=660;gain.gain.setValueAtTime(.035,soundContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,soundContext.currentTime+.25);oscillator.connect(gain);gain.connect(soundContext.destination);oscillator.start();oscillator.stop(soundContext.currentTime+.3);}catch(_){}}
  $("rcCallSound").onclick=async()=>{try{if(soundContext){stopRing();await soundContext.close();soundContext=null;$("rcCallSound").textContent="🔊 Call sound: off";}else{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error("Sound is unavailable");soundContext=new Audio();await soundContext.resume();ring();$("rcCallSound").textContent="🔔 Call sound: on";}}catch(error){say("rcChatStatus",error.message);}};
  function hideIncoming(){incoming.hidden=true;incomingCall=null;if(incomingTimer)clearTimeout(incomingTimer);incomingTimer=null;stopRing();}
  function offerCall(row){if(!session?.user||row.initiated_by===session.user.id||row.status!=="ringing"||activeCall)return;const age=Date.now()-Date.parse(row.created_at);if(age>60000||Date.parse(row.expires_at)<Date.now())return;incomingCall=row;$("rcIncomingTitle").textContent=row.mode==="audio"?"📞 Incoming audio call":"📹 Incoming video call";$("rcIncomingName").textContent=peopleNames.get(row.initiated_by)||"ROCK CONNECT member";incoming.hidden=false;ring();stopRing();ringTimer=setInterval(ring,2000);if(incomingTimer)clearTimeout(incomingTimer);incomingTimer=setTimeout(()=>{hideIncoming();loadCallHistory();},Math.max(0,60000-age));}
  function watchCalls(){if(!session?.user)return;if(callChannel)client.removeChannel(callChannel);callChannel=client.channel("rock-connect-call-events-"+session.user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"rock_connect_calls"},event=>{offerCall(event.new);loadCallHistory();}).on("postgres_changes",{event:"UPDATE",schema:"public",table:"rock_connect_calls"},event=>{if(event.new.status==="ended"){if(incomingCall?.id===event.new.id)hideIncoming();if(callRecord?.id===event.new.id)endCall(false);}loadCallHistory();}).on("postgres_changes",{event:"INSERT",schema:"public",table:"rock_connect_members",filter:"user_id=eq."+session.user.id},()=>loadRooms()).subscribe();
    client.from("rock_connect_calls").select("id,room_id,initiated_by,mode,status,created_at,expires_at").eq("status","ringing").neq("initiated_by",session.user.id).gte("created_at",new Date(Date.now()-60000).toISOString()).order("created_at",{ascending:false}).limit(1).then(({data})=>{if(data?.[0])offerCall(data[0]);});
  }
  async function loadCallHistory(){if(!session?.user)return;const {data,error}=await client.from("rock_connect_calls").select("id,room_id,initiated_by,mode,status,created_at").order("created_at",{ascending:false}).limit(12);if(error){say("rcCallHistory","Call history is unavailable.");return;}const host=$("rcCallHistory");host.replaceChildren();for(const item of data||[]){const line=document.createElement("p");const missed=item.status==="ringing"&&Date.now()-Date.parse(item.created_at)>60000;line.textContent=(item.mode==="audio"?"📞 ":"📹 ")+(missed?"Missed / छुटेको":item.status==="accepted"?"In progress":item.status==="ended"?"Ended":"Ringing")+" · "+(roomNames.get(item.room_id)||"Chat")+" · "+new Date(item.created_at).toLocaleTimeString();host.append(line);}if(!data?.length)host.textContent="No recent calls / हाल कुनै कल छैन।";}
  setInterval(()=>{if(session?.user&&location.hash==="#connect")loadCallHistory();},30000);
  $("rcDeclineCall").onclick=async()=>{const row=incomingCall;hideIncoming();if(row&&roomsById.get(row.room_id)?.kind==="dm")await client.from("rock_connect_calls").update({status:"ended"}).eq("id",row.id);};
  $("rcAcceptCall").onclick=async()=>{const row=incomingCall;if(!row||!session?.user)return;hideIncoming();try{const {data:rooms,error:roomError}=await client.from("rock_connect_rooms").select("id,title,kind").eq("id",row.room_id).maybeSingle();if(roomError||!rooms)throw new Error("Chat is no longer available");const {data,error}=await client.from("rock_connect_calls").update({status:"accepted"}).eq("id",row.id).in("status",["ringing","accepted"]).gt("expires_at",new Date().toISOString()).select();if(error||!data?.length)throw new Error("This call has ended");roomsById.set(rooms.id,rooms);location.hash="connect";await openRoom(rooms);await joinCall({...row,status:"accepted"});}catch(error){say("rcChatStatus",error.message);}};
  async function beginCall(mode){if(!activeRoom||!session?.user||activeCall)return;const targetRoom=activeRoom.id;say("rcChatStatus","Starting call… / कल सुरु हुँदैछ…");try{const {data:existing,error:lookupError}=await client.from("rock_connect_calls").select("id,room_id,initiated_by,mode,status,created_at,expires_at").eq("room_id",targetRoom).eq("status","accepted").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(1);if(lookupError)throw lookupError;if(existing?.[0]){await joinCall(existing[0]);return;}const {data,error}=await client.from("rock_connect_calls").insert({room_id:targetRoom,initiated_by:session.user.id,mode}).select().single();if(error)throw error;await joinCall(data);}catch(error){say("rcChatStatus",error.message||"Call service is unavailable");}}
  $("rcCallButton").onclick=()=>beginCall("video");$("rcAudioCall").onclick=()=>beginCall("audio");$("rcCallClose").classList.add("rc-hangup");$("rcCallClose").onclick=()=>endCall();
  $("rcMic").onclick=async()=>{if(!activeCall)return;try{const on=!activeCall.localParticipant.isMicrophoneEnabled;await activeCall.localParticipant.setMicrophoneEnabled(on);$("rcMic").textContent=on?"🎙️ Mute":"🎙️ Unmute";}catch(error){say("rcCallStatus",error.message);}};
  $("rcCamera").onclick=async()=>{if(!activeCall)return;try{const on=!activeCall.localParticipant.isCameraEnabled;await activeCall.localParticipant.setCameraEnabled(on);$("rcCamera").textContent=on?"📹 Camera off":"📹 Camera on";}catch(error){say("rcCallStatus",error.message);}};
  $("rcScreen").onclick=async()=>{if(!activeCall)return;try{await activeCall.localParticipant.setScreenShareEnabled(!activeCall.localParticipant.isScreenShareEnabled);}catch(error){say("rcCallStatus","Screen share: "+error.message);}};
  let callGeneration=0;
  async function joinCall(record){if(activeCall||callRecord)return;const generation=++callGeneration;callRecord=record;$("rcCallPanel").classList.add("open");say("rcCallStatus","Connecting… / जडान हुँदैछ…");const sdk=window.LivekitClient;if(!sdk?.Room){say("rcCallStatus","Call service did not load. Refresh and try again.");await endCall();return;}
    try{const {data,error}=await client.functions.invoke("rock-connect-token",{body:{room_id:record.room_id,call_id:record.id}});if(error||!data?.token||!data?.server_url)throw new Error(data?.error||error?.message||"Call service is unavailable");if(generation!==callGeneration||!session?.user)return;const room=new sdk.Room({adaptiveStream:true,dynacast:true});activeCall=room;const stage=$("rcCallStage");stage.replaceChildren();const attach=(track,person)=>{const el=track.attach();el.dataset.identity=person.identity;el.dataset.track=track.sid||"local";if(person===room.localParticipant)el.muted=true;stage.append(el);};
      room.on(sdk.RoomEvent.TrackSubscribed,(track,_publication,person)=>attach(track,person));room.on(sdk.RoomEvent.TrackUnsubscribed,track=>track.detach().forEach(el=>el.remove()));
      room.on(sdk.RoomEvent.LocalTrackPublished,publication=>{if(publication.track?.kind==="video")attach(publication.track,room.localParticipant);});room.on(sdk.RoomEvent.LocalTrackUnpublished,publication=>{if(publication.track)publication.track.detach().forEach(el=>el.remove());});
      room.on(sdk.RoomEvent.Disconnected,()=>{if(activeCall===room){activeCall=null;callRecord=null;stage.replaceChildren();$("rcCallPanel").classList.remove("open");}});
      await room.connect(data.server_url,data.token);if(generation!==callGeneration||!session?.user){await room.disconnect();return;}await room.localParticipant.setMicrophoneEnabled(true);await room.localParticipant.setCameraEnabled(record.mode==="video");$("rcCamera").textContent=record.mode==="video"?"📹 Camera off":"📹 Camera on";$("rcMic").textContent="🎙️ Mute";
      for(const person of room.remoteParticipants.values())for(const publication of person.trackPublications.values())if(publication.track)attach(publication.track,person);
      say("rcCallStatus",record.status==="ringing"?"Calling room members… / सदस्यलाई कल हुँदैछ…":"Connected / जडान भयो।");
    }catch(error){const message=error.message||"Could not connect";await endCall();say("rcChatStatus",message);}
  }
  async function endCall(markEnded=true){callGeneration++;const room=activeCall,record=callRecord;activeCall=null;callRecord=null;if(room)await room.disconnect();$("rcCallStage").replaceChildren();$("rcCallPanel").classList.remove("open");if(markEnded&&record&&session?.user&&(record.initiated_by===session.user.id||roomsById.get(record.room_id)?.kind==="dm")){const {error}=await client.from("rock_connect_calls").update({status:"ended"}).eq("id",record.id);if(error)say("rcChatStatus","Call closed. History will update when connected.");}loadCallHistory();}

  client.auth.onAuthStateChange((_event,next)=>setSignedIn(next));
  client.auth.getSession().then(({data})=>setSignedIn(data?.session||null));
})();
