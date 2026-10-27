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
    '<div class="rc-card"><strong>अनलाइन</strong><div class="rc-status" id="rcOnline">जडान हुँदैछ…</div></div></aside>' +
    '<main class="rc-card rc-chat"><div class="rc-chat-head"><div><strong id="rcRoomTitle">ROCK CONNECT Lobby</strong><div class="rc-status" id="rcRoomStatus">जडान हुँदैछ…</div></div>' +
    '<button type="button" id="rcCallButton">📞 अडियो/भिडियो कल</button></div><div class="rc-messages" id="rcMessages"></div><div class="rc-status" id="rcReplyStatus"></div>' +
    '<div class="rc-actions" id="rcEmojiRow"><button class="secondary" type="button">😄</button><button class="secondary" type="button">🎮</button><button class="secondary" type="button">🏆</button><button class="secondary" type="button">❤️</button><button class="secondary" type="button">🔥</button></div>' +
    '<form class="rc-form" id="rcMessageForm"><label class="secondary" style="display:grid;place-items:center;padding:8px;border-radius:9px;cursor:pointer">＋<input id="rcMedia" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden></label>' +
    '<textarea id="rcMessage" maxlength="2000" placeholder="सन्देश लेख्नुहोस्…" aria-label="सन्देश"></textarea><button id="rcSend" type="submit">पठाउनुहोस्</button></form>' +
    '<div class="rc-actions" style="margin-top:8px"><button type="button" class="secondary" id="rcRecord">🎙️ आवाज रेकर्ड</button><span class="rc-status" id="rcChatStatus"></span></div></main></div>' +
    '<section class="rc-call" id="rcCallPanel"><div class="rc-chat-head"><strong>ROCK CONNECT कल</strong><button type="button" class="secondary" id="rcCallClose">कल बन्द गर्नुहोस्</button></div>' +
    '<div class="rc-call-stage" id="rcCallStage"></div><div class="rc-actions"><button type="button" id="rcMic">🎙️ माइक बन्द</button><button type="button" id="rcCamera">📹 क्यामेरा बन्द</button></div><p class="rc-status" id="rcCallStatus"></p></section></div>';
  container.replaceChildren(heading, app);

  const $ = (id) => document.getElementById(id);
  let authMode = "login", session = null, activeRoom = null, activeChannel = null, activeCall = null;
  let recorder = null, recorderStream = null, roomNames = new Map();

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
      if (activeChannel) client.removeChannel(activeChannel);
      activeChannel = null;
      return;
    }
    $("rcAccountName").textContent = "लगइन: " + (next.user.user_metadata?.display_name || next.user.email || "खेलाडी");
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
    const { data, error } = await client.from("rock_connect_profiles").select("user_id,display_name").order("display_name").limit(300);
    if (error) { say("rcDmStatus", "खेलाडी सूची खोल्न सकेन। Supabase मा ROCK CONNECT सेटअप जाँच्नुहोस्।"); return; }
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
    activeRoom = room;
    $("rcRoomTitle").textContent = roomNames.get(room.id) || room.title;
    if (activeChannel) await client.removeChannel(activeChannel);
    activeChannel = client.channel("rock-connect-" + room.id, { config: { presence: { key: session.user.id } } });
    activeChannel
      .on("postgres_changes", { event:"*", schema:"public", table:"rock_connect_messages", filter:"room_id=eq." + room.id }, (payload) => {
        if (payload.eventType === "INSERT" && payload.new.sender_id !== session.user.id && document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification(roomNames.get(room.id) || room.title, { body: payload.new.body || "मिडिया सन्देश आयो।" });
        }
        loadMessages();
      })
      .on("postgres_changes", { event:"*", schema:"public", table:"rock_connect_reactions" }, loadMessages)
      .on("presence", { event:"sync" }, () => { $("rcOnline").textContent = Object.keys(activeChannel.presenceState()).length + " जना यो कोठामा अनलाइन"; })
      .subscribe(async (state) => {
        if (state === "SUBSCRIBED") {
          await activeChannel.track({ name:$("rcAccountName").textContent, online_at:new Date().toISOString() });
          $("rcRoomStatus").textContent = "जडान भयो";
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") $("rcRoomStatus").textContent = "जडान हुन सकेन";
      });
    await loadMessages();
  }

  async function loadMessages() {
    if (!activeRoom || !session?.user) return;
    const room = activeRoom;
    const { data, error } = await client.from("rock_connect_messages").select("id,room_id,sender_id,body,media_path,media_type,reply_to,created_at")
      .eq("room_id", room.id).order("created_at",{ascending:false}).limit(100);
    if (error) { say("rcRoomStatus", "सन्देश खोल्न सकेन: " + error.message); return; }
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
      const card=document.createElement("article"); card.className="rc-message";
      const meta=document.createElement("div"); meta.className="meta";
      const author=document.createElement("strong"); author.textContent=names.get(message.sender_id)||"ROCK CONNECT";
      const date=document.createElement("time"); date.textContent=new Date(message.created_at).toLocaleString();
      meta.append(author,date); card.append(meta);
      if (message.reply_to && byId.has(message.reply_to)) { const quote=document.createElement("div"); quote.className="rc-status"; quote.textContent="↪ "+(byId.get(message.reply_to).body||"मिडिया सन्देश"); card.append(quote); }
      if (message.body) { const body=document.createElement("div"); body.className="body"; body.textContent=message.body; card.append(body); }
      if (message.media_path) {
        const {data:signed}=await client.storage.from("rock-connect-media").createSignedUrl(message.media_path,3600);
        if (signed?.signedUrl) {
          const media=message.media_type==="video"?document.createElement("video"):message.media_type==="audio"?document.createElement("audio"):document.createElement("img");
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

  $("rcMessageForm").addEventListener("submit",async(event)=>{event.preventDefault();await sendMessage(null);});
  $("rcMedia").addEventListener("change",async()=>{const file=$("rcMedia").files?.[0];if(file)await sendMessage(file);$("rcMedia").value="";});
  async function sendMessage(file) {
    if (!activeRoom||!session?.user) return;
    const body=$("rcMessage").value.trim(); if(!body&&!file)return;
    if(file&&(file.size>25*1024*1024||!/^image\\/(jpeg|png|webp|gif)$|^video\\/(mp4|webm|quicktime)$/.test(file.type))) { say("rcChatStatus","२५ MB सम्मको फोटो वा भिडियो छान्नुहोस्।"); return; }
    $("rcSend").disabled=true; say("rcChatStatus",file?"मिडिया राखिँदै छ…":"सन्देश पठाइँदै छ…");
    let path=null;
    try {
      let mediaType=null;
      if(file) {
        const ext=(file.name.split(".").pop()||"dat").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8);
        path=activeRoom.id+"/"+crypto.randomUUID()+"."+ext; mediaType=file.type.startsWith("video/")?"video":"image";
        const {error:uploadError}=await client.storage.from("rock-connect-media").upload(path,file,{contentType:file.type,upsert:false});
        if(uploadError)throw uploadError;
      }
      const {error}=await client.from("rock_connect_messages").insert({room_id:activeRoom.id,sender_id:session.user.id,body,media_path:path,media_type:mediaType,reply_to:replyTo});
      if(error){if(path)await client.storage.from("rock-connect-media").remove([path]);throw error;}
      $("rcMessage").value=""; replyTo=null; say("rcReplyStatus",""); say("rcChatStatus","सन्देश सुरक्षित भयो।"); await loadMessages();
    } catch(error){say("rcChatStatus",error?.message||"सन्देश पठाउन सकेन।");}
    finally{$("rcSend").disabled=false;}
  }

  $("rcRecord").onclick=async()=>{
    if(recorder?.state==="recording"){recorder.stop();$("rcRecord").textContent="अडियो तयार हुँदैछ…";return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){say("rcChatStatus","यो उपकरणमा अडियो रेकर्ड गर्न मिल्दैन।");return;}
    try{
      recorderStream=await navigator.mediaDevices.getUserMedia({audio:true}); const chunks=[];
      recorder=new MediaRecorder(recorderStream); recorder.ondataavailable=(e)=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=async()=>{const type=recorder.mimeType||"audio/webm";const file=new File([new Blob(chunks,{type})],"voice-note.webm",{type});recorderStream.getTracks().forEach((t)=>t.stop());recorder=null;recorderStream=null;$("rcRecord").textContent="🎙️ आवाज रेकर्ड";await sendVoice(file);};
      recorder.start(); $("rcRecord").textContent="⏹️ रेकर्डिङ रोक्नुहोस्"; say("rcChatStatus","आवाज रेकर्ड हुँदैछ…");
    }catch(error){say("rcChatStatus","माइक अनुमति चाहिन्छ: "+(error?.message||""));}
  };
  async function sendVoice(file){
    if(!activeRoom||!session?.user)return; $("rcSend").disabled=true; say("rcChatStatus","आवाज पठाइँदै छ…");
    const path=activeRoom.id+"/"+crypto.randomUUID()+".webm";
    try{
      const {error:uploadError}=await client.storage.from("rock-connect-media").upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;
      const {error}=await client.from("rock_connect_messages").insert({room_id:activeRoom.id,sender_id:session.user.id,body:"",media_path:path,media_type:"audio"});
      if(error){await client.storage.from("rock-connect-media").remove([path]);throw error;} say("rcChatStatus","आवाज सन्देश पठाइयो।");await loadMessages();
    }catch(error){say("rcChatStatus",error?.message||"आवाज पठाउन सकेन।");}finally{$("rcSend").disabled=false;}
  }

  $("rcCallButton").onclick=startCall; $("rcCallClose").onclick=endCall;
  $("rcMic").onclick=async()=>{if(!activeCall)return;const on=!activeCall.localParticipant.isMicrophoneEnabled;await activeCall.localParticipant.setMicrophoneEnabled(on);$("rcMic").textContent=on?"🎙️ माइक बन्द":"🎙️ माइक खोल्नुहोस्";};
  $("rcCamera").onclick=async()=>{if(!activeCall)return;const on=!activeCall.localParticipant.isCameraEnabled;await activeCall.localParticipant.setCameraEnabled(on);$("rcCamera").textContent=on?"📹 क्यामेरा बन्द":"📹 क्यामेरा खोल्नुहोस्";};

  async function startCall(){
    if(!activeRoom||!session?.user)return; $("rcCallPanel").classList.add("open"); say("rcCallStatus","कलमा जडान हुँदैछ…");
    const sdk=window.LivekitClient;if(!sdk?.Room){say("rcCallStatus","कल सेवा लोड भएन।");return;}
    try{
      const {data,error}=await client.functions.invoke("rock-connect-token",{body:{room_id:activeRoom.id}});
      if(error||!data?.token||!data?.server_url)throw new Error(data?.error||error?.message||"कल सुरु गर्न सकेन।");
      const room=new sdk.Room({adaptiveStream:true,dynacast:true}); activeCall=room; const stage=$("rcCallStage");
      const attach=(track,person)=>{const el=track.attach();el.dataset.identity=person.identity;stage.append(el);};
      room.on(sdk.RoomEvent.TrackSubscribed,(track,publication,person)=>attach(track,person));
      room.on(sdk.RoomEvent.TrackUnsubscribed,(track)=>track.detach().forEach((el)=>el.remove()));
      room.on(sdk.RoomEvent.Disconnected,()=>{activeCall=null;stage.replaceChildren();$("rcCallPanel").classList.remove("open");});
      await room.connect(data.server_url,data.token);
      await room.localParticipant.setMicrophoneEnabled(true); await room.localParticipant.setCameraEnabled(true);
      for(const publication of room.localParticipant.videoTrackPublications.values())if(publication.track)attach(publication.track,room.localParticipant);
      for(const person of room.remoteParticipants.values())for(const publication of person.trackPublications.values())if(publication.track)attach(publication.track,person);
      say("rcCallStatus","कल जडान भयो। यही कोठाका सदस्य सहभागी हुन सक्छन्।");
    }catch(error){say("rcCallStatus",error?.message||"कल सुरु गर्न सकेन।");}
  }
  async function endCall(){if(activeCall)await activeCall.disconnect();activeCall=null;$("rcCallStage").replaceChildren();$("rcCallPanel").classList.remove("open");}

  client.auth.onAuthStateChange((_event,next)=>setSignedIn(next));
  client.auth.getSession().then(({data})=>setSignedIn(data?.session||null));
})();
