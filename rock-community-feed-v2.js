(() => {
  "use strict";
  const nav = document.querySelector(".nav-inner");
  if (!nav) return;
  // Keep the existing banner, moving ticker and tabs visible while content scrolls.
  const navigation = nav.closest(".nav");
  const headerParts = [document.querySelector("body > .top"), document.querySelector(".rock-ticker")?.parentElement, document.getElementById("rockFestivalBar")?.parentElement, navigation].filter(Boolean);
  const stickyStyle = document.createElement("style");
  stickyStyle.textContent = '[data-rock-fixed-header]{position:sticky!important;top:var(--rock-header-offset,0px)!important;z-index:60;background-color:#03070d}[data-rock-fixed-header]:not(.nav){display:flow-root}html{scroll-padding-top:var(--rock-header-height,0px);overflow-x:clip}body:not(.rock-meeting-active){overflow-x:clip}';
  document.head.append(stickyStyle);
  function measureHeader() {
    let offset = 0;
    for (const part of headerParts) {
      part.setAttribute("data-rock-fixed-header", "");
      part.style.setProperty("--rock-header-offset", offset + "px");
      offset += part.getBoundingClientRect().height;
    }
    document.documentElement.style.setProperty("--rock-header-height", offset + "px");
  }
  const headerObserver = new ResizeObserver(measureHeader);
  headerParts.forEach(part => headerObserver.observe(part));
  measureHeader();
  window.addEventListener("resize", measureHeader);
  const adminButton = nav.querySelector("#adminNavButton");
  if (adminButton) {
    adminButton.textContent = "🔐";
    adminButton.setAttribute("aria-label", "ADMIN / EDIT");
    adminButton.title = "ADMIN / EDIT";
    adminButton.classList.add("rock-admin-icon");
    nav.append(adminButton);
  }
  if (document.getElementById("rockCommunityFeed")) return;
  const client = typeof sb !== "undefined" ? sb : null;
  if (!client) return;

  const style = document.createElement("style");
  style.textContent = `
    .rock-tab-hidden{display:none!important}.nav-inner>a.rock-active-nav{background:#0878bd;color:#fff;border-radius:9px}
    #adminNavButton.rock-admin-icon{display:inline-flex!important;align-items:center;justify-content:center;width:28px;height:28px;min-width:28px;box-sizing:border-box;padding:0!important;margin-left:4px;font-size:13px;line-height:1;border-radius:50%;opacity:.68;flex:0 0 28px}
    #adminNavButton.rock-admin-icon:hover,#adminNavButton.rock-admin-icon:focus-visible{opacity:1}
    #rockCommunityFeed .rock-community-card,#rockCommunityFeed .rock-community-auth,#rockCommunityFeed .rock-community-compose{background:#071626;border:1px solid #214762;border-radius:14px;padding:16px;margin:14px 0;color:#edf7ff}
    #rockCommunityFeed .rock-community-auth form,#rockCommunityFeed .rock-community-compose form{display:grid;gap:10px}
    #rockCommunityFeed input,#rockCommunityFeed textarea{box-sizing:border-box;width:100%;background:#030c16;color:#fff;border:1px solid #315a75;border-radius:9px;padding:11px;font:inherit}
    #rockCommunityFeed textarea{min-height:90px;resize:vertical}
    #rockCommunityFeed button{border:0;border-radius:9px;background:#0878bd;color:#fff;padding:10px 13px;font-weight:800;cursor:pointer}
    #rockCommunityFeed button.secondary{background:#17334a;border:1px solid #315a75}
    #rockCommunityFeed .rock-community-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    #rockCommunityFeed .rock-community-meta{color:#9bb2c2;font-size:12px;display:flex;gap:12px;flex-wrap:wrap}
    #rockCommunityFeed .rock-community-card p{white-space:pre-wrap;overflow-wrap:anywhere}
    #rockCommunityFeed .rock-community-card img,#rockCommunityFeed .rock-community-card video{display:block;max-width:100%;max-height:520px;border-radius:10px;margin-top:10px;background:#000}
    #rockCommunityFeed .rock-community-comments{border-top:1px solid #214762;margin-top:12px;padding-top:8px}
    #rockCommunityFeed .rock-community-comment{padding:7px 0;border-bottom:1px solid #16344b;overflow-wrap:anywhere}
    #rockCommunityFeed .rock-community-status{min-height:1.4em;color:#9bd4fa}
    #rockCommunityFeed .rock-community-switch{display:flex;gap:8px;margin:10px 0}
    #rockCommunityFeed .rock-community-account{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    @media(max-width:600px){#rockCommunityFeed .rock-community-card,#rockCommunityFeed .rock-community-auth,#rockCommunityFeed .rock-community-compose{padding:12px}}
  `;
  document.head.append(style);

  const section = document.createElement("section");
  section.id = "rockCommunityFeed";
  section.className = "section rock-community-section";
  section.innerHTML = `
    <div class="container">
      <h2>ROCK ESPORTS COMMUNITY</h2>
      <p>खेलाडीका पोस्ट, फोटो र भिडियो हेर्नुहोस्। पोस्ट गर्न, मन पराउन वा प्रतिक्रिया दिन आफ्नो खाता खोलेर लगइन गर्नुहोस्।</p>
      <div class="rock-community-auth">
        <div id="rockCommunityAccount" class="rock-community-account" hidden></div>
        <div id="rockCommunityAuthForm">
          <div class="rock-community-switch"><button type="button" id="rockCommunitySignInTab">लगइन</button><button type="button" class="secondary" id="rockCommunitySignUpTab">नयाँ खाता खोल्नुहोस्</button></div>
          <form id="rockCommunityAuthFormFields">
            <input id="rockCommunityName" maxlength="40" placeholder="वेबसाइटमा देखिने खेलाडीको नाम" autocomplete="nickname" hidden>
            <input id="rockCommunityEmail" type="email" required maxlength="254" placeholder="इमेल ठेगाना" autocomplete="email">
            <input id="rockCommunityPassword" type="password" required minlength="8" maxlength="128" placeholder="पासवर्ड (कम्तीमा ८ अक्षर)" autocomplete="current-password">
            <button id="rockCommunityAuthSubmit" type="submit">लगइन</button>
          </form>
        </div>
        <p id="rockCommunityAuthStatus" class="rock-community-status" role="status"></p>
      </div>
      <div id="rockCommunityComposer" class="rock-community-compose" hidden>
        <form id="rockCommunityPostForm">
          <textarea id="rockCommunityPostText" maxlength="2000" placeholder="तपाईं के बाँड्न चाहनुहुन्छ?"></textarea>
          <input id="rockCommunityMedia" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime">
          <div class="rock-community-meta">फोटो वा भिडियो बढीमा २५ MB</div>
          <button type="submit">पोस्ट गर्नुहोस्</button>
        </form>
        <p id="rockCommunityPostStatus" class="rock-community-status" role="status"></p>
      </div>
      <div id="rockCommunityPosts" aria-live="polite"><p>पोस्टहरू खोलिँदै छन्…</p></div>
    </div>`;
  const home = document.getElementById("home");
  const footer = document.querySelector("footer");
  if (home) home.after(section);
  else if (footer) footer.before(section);
  else document.body.append(section);

  // Public posts stay ahead of account controls for visitors.
  const feedContainer = section.querySelector(".container");
  feedContainer.insertBefore(document.getElementById("rockCommunityPosts"), section.querySelector(".rock-community-auth"));

  const link = document.createElement("a");
  link.href = "#rockCommunityFeed";
  link.textContent = "👥 COMMUNITY";
  link.setAttribute("aria-label", "ROCK ESPORTS Community");
  nav.append(link);

  let mode = "login";
  let session = null;
  const authForm = document.getElementById("rockCommunityAuthFormFields");
  const authStatus = document.getElementById("rockCommunityAuthStatus");
  const postStatus = document.getElementById("rockCommunityPostStatus");
  const postHost = document.getElementById("rockCommunityPosts");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);

  function setMode(next) {
    mode = next;
    const signup = mode === "signup";
    document.getElementById("rockCommunityName").hidden = !signup;
    document.getElementById("rockCommunityName").required = signup;
    document.getElementById("rockCommunityPassword").autocomplete = signup ? "new-password" : "current-password";
    document.getElementById("rockCommunityAuthSubmit").textContent = signup ? "खाता खोल्नुहोस्" : "लगइन";
    document.getElementById("rockCommunitySignInTab").classList.toggle("secondary", signup);
    document.getElementById("rockCommunitySignUpTab").classList.toggle("secondary", !signup);
    authStatus.textContent = "";
  }
  document.getElementById("rockCommunitySignInTab").addEventListener("click", () => setMode("login"));
  document.getElementById("rockCommunitySignUpTab").addEventListener("click", () => setMode("signup"));

  function showAccount(current) {
    session = current;
    const user = current?.user;
    document.getElementById("rockCommunityAuthForm").hidden = !!user;
    document.getElementById("rockCommunityComposer").hidden = !user;
    const account = document.getElementById("rockCommunityAccount");
    account.hidden = !user;
    account.replaceChildren();
    if (user) {
      const label = document.createElement("span");
      label.textContent = `लगइन: ${user.user_metadata?.display_name || user.email || "खेलाडी"}`;
      const out = document.createElement("button");
      out.type = "button"; out.className = "secondary"; out.textContent = "लगआउट";
      out.addEventListener("click", async () => { await client.auth.signOut(); authStatus.textContent = "तपाईं लगआउट हुनुभयो।"; });
      account.append(label, out);
    }
  }

  async function currentSession() {
    const { data } = await client.auth.getSession();
    showAccount(data?.session || null);
  }
  client.auth.onAuthStateChange((_event, newSession) => {
    showAccount(newSession);
    window.setTimeout(loadFeed, 0);
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("rockCommunityEmail").value.trim();
    const password = document.getElementById("rockCommunityPassword").value;
    const displayName = document.getElementById("rockCommunityName").value.trim();
    const button = document.getElementById("rockCommunityAuthSubmit");
    button.disabled = true; authStatus.textContent = "खाता जाँचिँदै छ…";
    try {
      const result = mode === "signup"
        ? await client.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) authStatus.textContent = "Supabase बाट आएको इमेल खोलेर खाता पुष्टि गर्नुहोस्, त्यसपछि लगइन गर्नुहोस्।";
      else authStatus.textContent = mode === "signup" ? "खाता तयार भयो। अब पोस्ट गर्न सक्नुहुन्छ।" : "लगइन सफल भयो।";
      showAccount(result.data.session || null);
      if (result.data.session) await loadFeed();
    } catch (error) { authStatus.textContent = error?.message || "खाता खोल्न वा लगइन गर्न सकिएन।"; }
    finally { button.disabled = false; }
  });

  async function loadFeed() {
    if (!postHost.isConnected) return;
    postHost.textContent = "";
    try {
      const { data: posts, error } = await client.from("rock_community_posts")
        .select("id,author_id,author_name,content,media_path,media_type,like_count,comment_count,view_count,created_at")
        .eq("status", "published").order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      if (!posts?.length) { postHost.innerHTML = '<div class="rock-community-card">अहिलेसम्म कुनै पोस्ट छैन। पहिलो पोस्ट तपाईंले गर्नुहोस्।</div>'; return; }
      const ids = posts.map((p) => p.id);
      const [{ data: comments }, { data: likes }] = await Promise.all([
        client.from("rock_community_comments").select("id,post_id,author_id,author_name,content,created_at").in("post_id", ids).order("created_at", { ascending: true }).limit(200),
        session?.user ? client.from("rock_community_likes").select("post_id").eq("user_id", session.user.id).in("post_id", ids) : Promise.resolve({ data: [] }),
      ]);
      const liked = new Set((likes || []).map((item) => item.post_id));
      for (const post of posts) postHost.append(buildPost(post, (comments || []).filter((c) => c.post_id === post.id), liked.has(post.id)));
      recordViews(posts);
    } catch (error) {
      postHost.innerHTML = '<div class="rock-community-card">पोस्टहरू अहिले खोल्न सकिएन। Supabase मा समुदायको सेटअप पूरा भएको छ कि जाँच गर्नुहोस्।</div>';
      console.error("ROCK community feed:", error);
    }
  }

  function buildPost(post, comments, isLiked) {
    const card = document.createElement("article"); card.className = "rock-community-card";
    const meta = document.createElement("div"); meta.className = "rock-community-meta";
    const author = document.createElement("strong"); author.textContent = post.author_name || "ROCK ESPORTS gamer";
    const date = document.createElement("time"); date.dateTime = post.created_at; date.textContent = new Date(post.created_at).toLocaleString();
    meta.append(author, date); card.append(meta);
    if (post.content) { const body = document.createElement("p"); body.textContent = post.content; card.append(body); }
    if (post.media_path) {
      const { data } = client.storage.from("rock-community-media").getPublicUrl(post.media_path);
      if (post.media_type === "video") { const video = document.createElement("video"); video.src = data.publicUrl; video.controls = true; video.playsInline = true; video.preload = "metadata"; card.append(video); }
      else { const image = document.createElement("img"); image.src = data.publicUrl; image.alt = "खेलाडीले साझा गरेको फोटो"; image.loading = "lazy"; card.append(image); }
    }
    const actions = document.createElement("div"); actions.className = "rock-community-actions";
    const like = document.createElement("button"); like.type = "button"; like.className = isLiked ? "" : "secondary"; like.textContent = `👍 मन पराएँ · ${post.like_count || 0}`;
    like.addEventListener("click", () => toggleLike(post, like));
    const stats = document.createElement("span"); stats.className = "rock-community-meta"; stats.textContent = `👁 ${post.view_count || 0} हेराइ · 💬 ${post.comment_count || 0} प्रतिक्रिया`;
    actions.append(like, stats);
    if (session?.user) {
      const report = document.createElement("button"); report.className = "secondary"; report.textContent = "रिपोर्ट"; report.addEventListener("click", () => reportPost(post.id)); actions.append(report);
      if (session.user.id === post.author_id || session.user.email?.toLowerCase() === "rockesprorts.official@gmail.com") {
        const remove = document.createElement("button"); remove.className = "secondary"; remove.textContent = "पोस्ट हटाउनुहोस्"; remove.addEventListener("click", () => removePost(post)); actions.append(remove);
      }
    }
    card.append(actions);
    const discussion = document.createElement("div"); discussion.className = "rock-community-comments";
    for (const item of comments) { const row = document.createElement("div"); row.className = "rock-community-comment"; const who = document.createElement("strong"); who.textContent = `${item.author_name || "खेलाडी"}: `; const text = document.createElement("span"); text.textContent = item.content; row.append(who, text); discussion.append(row); }
    if (session?.user) {
      const form = document.createElement("form"); form.className = "rock-community-actions";
      const input = document.createElement("input"); input.maxLength = 500; input.required = true; input.placeholder = "प्रतिक्रिया लेख्नुहोस्…";
      const send = document.createElement("button"); send.textContent = "पठाउनुहोस्"; form.append(input, send);
      form.addEventListener("submit", async (event) => { event.preventDefault(); send.disabled = true; const { error } = await client.from("rock_community_comments").insert({ post_id: post.id, author_id: session.user.id, content: input.value.trim() }); if (error) authStatus.textContent = error.message; else await loadFeed(); send.disabled = false; });
      discussion.append(form);
    } else { const tip = document.createElement("p"); tip.textContent = "प्रतिक्रिया लेख्न लगइन गर्नुहोस्।"; discussion.append(tip); }
    card.append(discussion);
    return card;
  }

  async function toggleLike(post, button) {
    if (!session?.user) { authStatus.textContent = "मन पराउन पहिले लगइन गर्नुहोस्।"; return; }
    button.disabled = true;
    const { data: existing, error: readError } = await client.from("rock_community_likes").select("post_id").eq("post_id", post.id).eq("user_id", session.user.id).maybeSingle();
    if (readError) authStatus.textContent = readError.message;
    else if (existing) { const { error } = await client.from("rock_community_likes").delete().eq("post_id", post.id).eq("user_id", session.user.id); if (error) authStatus.textContent = error.message; }
    else { const { error } = await client.from("rock_community_likes").insert({ post_id: post.id, user_id: session.user.id }); if (error) authStatus.textContent = error.message; }
    await loadFeed();
  }

  async function reportPost(postId) {
    const reason = window.prompt("यो पोस्ट किन रिपोर्ट गर्दै हुनुहुन्छ?"); if (!reason || !session?.user) return;
    const { error } = await client.from("rock_community_reports").insert({ post_id: postId, reporter_id: session.user.id, reason: reason.slice(0, 300) });
    authStatus.textContent = error ? error.message : "रिपोर्ट पठाइयो। व्यवस्थापकले जाँच गर्नुहुनेछ।";
  }

  async function removePost(post) {
    if (!window.confirm("यो पोस्ट हटाउने हो?")) return;
    const { error } = await client.from("rock_community_posts").delete().eq("id", post.id);
    if (error) { authStatus.textContent = error.message; return; }
    if (post.media_path) await client.storage.from("rock-community-media").remove([post.media_path]);
    await loadFeed();
  }

  async function recordViews(posts) {
    let viewer = "";
    try { viewer = localStorage.getItem("rockCommunityViewer") || ""; if (!viewer) { viewer = crypto.randomUUID(); localStorage.setItem("rockCommunityViewer", viewer); } } catch (_) { viewer = crypto.randomUUID(); }
    for (const post of posts) {
      try { await client.rpc("rock_community_record_view", { p_post_id: post.id, p_viewer_key: viewer }); } catch (_) {}
    }
  }

  document.getElementById("rockCommunityPostForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!session?.user) { postStatus.textContent = "पोस्ट गर्न लगइन गर्नुहोस्।"; return; }
    const content = document.getElementById("rockCommunityPostText").value.trim();
    const file = document.getElementById("rockCommunityMedia").files?.[0] || null;
    const submit = event.currentTarget.querySelector("button[type=submit]");
    if (!content && !file) { postStatus.textContent = "लेखाइ वा फोटो/भिडियो राख्नुहोस्।"; return; }
    if (file && (!/^image\/(jpeg|png|webp|gif)$|^video\/(mp4|webm|quicktime)$/.test(file.type) || file.size > 25 * 1024 * 1024)) { postStatus.textContent = "समर्थित फोटो वा २५ MB सम्मको भिडियो छान्नुहोस्।"; return; }
    submit.disabled = true; postStatus.textContent = "पोस्ट राखिँदै छ…";
    let mediaPath = null, mediaType = null;
    try {
      if (file) {
        const ext = ({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"})[file.type];
        mediaPath = `${session.user.id}/${crypto.randomUUID()}.${ext}`; mediaType = file.type.startsWith("video/") ? "video" : "image";
        const { error } = await client.storage.from("rock-community-media").upload(mediaPath, file, { contentType: file.type, upsert: false });
        if (error) throw error;
      }
      const { error } = await client.from("rock_community_posts").insert({ author_id: session.user.id, content, media_path: mediaPath, media_type: mediaType });
      if (error) { if (mediaPath) await client.storage.from("rock-community-media").remove([mediaPath]); throw error; }
      event.currentTarget.reset(); postStatus.textContent = "पोस्ट सफलतापूर्वक राखियो।"; await loadFeed();
    } catch (error) { postStatus.textContent = error?.message || "पोस्ट राख्न सकिएन।"; }
    finally { submit.disabled = false; }
  });

  const routeIds = new Set([...nav.querySelectorAll('a[href^="#"]')].map((a) => a.hash.slice(1)).filter((id) => document.getElementById(id)));
  routeIds.add("rockCommunityFeed");
  function showSelectedTab() {
    const raw = decodeURIComponent(location.hash.slice(1));
    const selected = routeIds.has(raw) ? raw : "rockCommunityFeed";
    document.querySelectorAll("main>section[id],body>section[id]").forEach((item) => {
      const visible = item.id === selected || (item.id === "rockRegAnnouncement" && ["tournament", "registration"].includes(selected));
      item.classList.toggle("rock-tab-hidden", !visible);
    });
    nav.querySelectorAll('a[href^="#"]').forEach((item) => {
      const active = item.hash.slice(1) === selected;
      item.classList.toggle("rock-active-nav", active);
      if (active) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", showSelectedTab);
  showSelectedTab();
  // Guest reading must not wait for authentication to initialize.
  loadFeed();
  currentSession().then(loadFeed).catch(() => {
    authStatus.textContent = "लगइन अहिले उपलब्ध छैन। सार्वजनिक पोस्ट हेर्न सक्नुहुन्छ।";
  });
  window.setInterval(loadFeed, 60000);
})();

