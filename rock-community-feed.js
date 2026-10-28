(() => {
  "use strict";

  // Footer-only artwork and gentle snowfall; retain existing copyright nodes.
  const siteFooter = document.querySelector("body > footer");
  if (siteFooter && !siteFooter.querySelector(".rock-snow-footer")) {
    const footerStyle = document.createElement("style");
    footerStyle.textContent = `
      footer.rock-footer-art{padding:0;background:#020d24;border-top:1px solid #168ee8}
      .rock-snow-footer{position:relative;width:100%;max-width:1800px;margin:0 auto;overflow:hidden;isolation:isolate}
      .rock-snow-footer>img{display:block;width:100%;height:auto;aspect-ratio:3/1;object-fit:contain}
      .rock-footer-art> .container{position:absolute;width:1px!important;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
      .rock-footer-snow{position:absolute;left:34%;right:0;top:0;height:82%;pointer-events:none;overflow:hidden;mask-image:linear-gradient(to bottom,#000 0%,#000 35%,transparent 64%,transparent 85%,#000 100%)}
      .rock-footer-snow span{position:absolute;top:-12px;left:var(--snow-x);width:var(--snow-size);height:var(--snow-size);border-radius:50%;background:#e8f8ff;opacity:.65;box-shadow:0 0 5px #b7eaff;animation:rockFooterSnowfall var(--snow-duration) linear infinite;animation-delay:var(--snow-delay);animation-play-state:paused}
      .rock-snow-footer.rock-snow-visible .rock-footer-snow span{animation-play-state:running}
      @keyframes rockFooterSnowfall{from{transform:translate3d(0,-12px,0)}to{transform:translate3d(24px,var(--snow-travel,450px),0)}}
      @media(prefers-reduced-motion:reduce){.rock-footer-snow{display:none}}
    `;
    document.head.append(footerStyle);
    const artwork = document.createElement("div");
    artwork.className = "rock-snow-footer";
    const banner = document.createElement("img");
    banner.src = new URL("./rock-footer-snow.webp", document.baseURI).href;
    banner.alt = "ROCK ESPORTS — Official Esports Organization, snowy Himalayan banner";
    banner.width = 2172; banner.height = 724; banner.loading = "lazy"; banner.decoding = "async";
    const snowfall = document.createElement("div");
    snowfall.className = "rock-footer-snow"; snowfall.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 32; i++) {
      const flake = document.createElement("span");
      flake.style.cssText = "--snow-x:" + ((i * 37) % 100) + "%;--snow-size:" + (1 + i % 3) + "px;--snow-duration:" + (8 + i % 7) + "s;--snow-delay:-" + (i % 13) + "s";
      snowfall.append(flake);
    }
    artwork.append(banner, snowfall);
    siteFooter.classList.add("rock-footer-art"); siteFooter.prepend(artwork);
    banner.addEventListener("error", () => { artwork.remove(); siteFooter.classList.remove("rock-footer-art"); });
    new ResizeObserver(() => artwork.style.setProperty("--snow-travel", (snowfall.clientHeight + 24) + "px")).observe(artwork);
    new IntersectionObserver(entries => artwork.classList.toggle("rock-snow-visible", entries[0].isIntersecting)).observe(artwork);
  }

  const nav = document.querySelector(".nav-inner");
  if (!nav) return;
  // Keep the existing banner, moving ticker and tabs visible while content scrolls.

  // Mobile-only full-width header, with no side gutters between its parts.
  const mobileHeaderStyle = document.createElement("style");
  mobileHeaderStyle.textContent = `
    @media(max-width:700px){
      body>header.top{width:100%;padding:env(safe-area-inset-top,0px) 0 0!important}
      body>header.top>.container,body>.container:has(>.rock-ticker),body>.container:has(>#rockFestivalBar){width:100%!important;max-width:100%!important;padding:0!important;margin:0!important}
      body>header.top .banner{border-radius:0!important;aspect-ratio:4.1/1!important;border-left:0;border-right:0}
      body>.container>.rock-ticker{margin:0!important;border-radius:0!important;border-left:0;border-right:0}
      body>.container>.rock-ticker .rock-ticker-word{font-size:clamp(14px,4vw,20px);padding:6px 12px;letter-spacing:1px}
      body>.container>#rockFestivalBar.rock-festival-bar{height:clamp(50px,8svh,64px)!important;margin:0!important;border-radius:0!important;border-left:0;border-right:0}
      body>.nav{width:100%;margin:0!important}
      body>.nav .nav-inner{width:100%!important;min-height:48px!important;padding:5px 36px!important;gap:5px!important}
      #rockCommunityFeed{padding-top:22px;padding-bottom:28px}
    }
  `;
  document.head.append(mobileHeaderStyle);

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

  const communityTranslations = {
  "खेलाडीका पोस्ट, फोटो र भिडियो हेर्नुहोस्। पोस्ट गर्न, मन पराउन वा प्रतिक्रिया दिन आफ्नो खाता खोलेर लगइन गर्नुहोस्।": "Browse posts, photos and videos without an account. Sign in to post, like or comment.",
  "लगइन": "Sign in",
  "नयाँ खाता खोल्नुहोस्": "Create account",
  "वेबसाइटमा देखिने खेलाडीको नाम": "Public player name",
  "इमेल ठेगाना": "Email address",
  "पासवर्ड (कम्तीमा ८ अक्षर)": "Password (at least 8 characters)",
  "तपाईं के बाँड्न चाहनुहुन्छ?": "What would you like to share?",
  "फोटो वा भिडियो बढीमा २५ MB": "Photo or video up to 25 MB",
  "पोस्ट गर्नुहोस्": "Post",
  "पोस्टहरू खोलिँदै छन्…": "Loading posts…",
  "खाता खोल्नुहोस्": "Create account",
  "खेलाडी": "Player",
  "लगआउट": "Sign out",
  "तपाईं लगआउट हुनुभयो।": "You have signed out.",
  "खाता जाँचिँदै छ…": "Checking your account…",
  "Supabase बाट आएको इमेल खोलेर खाता पुष्टि गर्नुहोस्, त्यसपछि लगइन गर्नुहोस्।": "Confirm your account using the email from Supabase, then sign in.",
  "खाता तयार भयो। अब पोस्ट गर्न सक्नुहुन्छ।": "Account ready. You can now post.",
  "लगइन सफल भयो।": "Signed in successfully.",
  "खाता खोल्न वा लगइन गर्न सकिएन।": "Unable to create an account or sign in.",
  "अहिलेसम्म कुनै पोस्ट छैन। पहिलो पोस्ट तपाईंले गर्नुहोस्।": "No posts yet. Be the first to share.",
  "पोस्टहरू अहिले खोल्न सकिएन। Supabase मा समुदायको सेटअप पूरा भएको छ कि जाँच गर्नुहोस्।": "Unable to load posts right now. Please check the community setup in Supabase.",
  "खेलाडीले साझा गरेको फोटो": "Photo shared by a player",
  "मन पराएँ": "Like",
  "हेराइ": "views",
  "प्रतिक्रिया": "comments",
  "रिपोर्ट": "Report",
  "पोस्ट हटाउनुहोस्": "Delete post",
  "प्रतिक्रिया लेख्नुहोस्…": "Write a comment…",
  "पठाउनुहोस्": "Send",
  "प्रतिक्रिया लेख्न लगइन गर्नुहोस्।": "Sign in to comment.",
  "मन पराउन पहिले लगइन गर्नुहोस्।": "Sign in to like a post.",
  "यो पोस्ट किन रिपोर्ट गर्दै हुनुहुन्छ?": "Why are you reporting this post?",
  "रिपोर्ट पठाइयो। व्यवस्थापकले जाँच गर्नुहुनेछ।": "Report submitted for review.",
  "यो पोस्ट हटाउने हो?": "Delete this post?",
  "पोस्ट गर्न लगइन गर्नुहोस्।": "Sign in to post.",
  "लेखाइ वा फोटो/भिडियो राख्नुहोस्।": "Add text or a photo/video.",
  "समर्थित फोटो वा २५ MB सम्मको भिडियो छान्नुहोस्।": "Choose a supported photo or video up to 25 MB.",
  "पोस्ट राखिँदै छ…": "Publishing your post…",
  "पोस्ट सफलतापूर्वक राखियो।": "Post published successfully.",
  "पोस्ट राख्न सकिएन।": "Unable to publish the post.",
  "लगइन अहिले उपलब्ध छैन। सार्वजनिक पोस्ट हेर्न सक्नुहुन्छ।": "Sign in is unavailable right now. You can still browse public posts.",
  "फोटो वा भिडियो बढीमा ५०० MB": "Photo or video up to 500 MB",
  "५०० MB सम्मको समर्थित फोटो वा भिडियो छान्नुहोस्।": "Choose a supported photo or video up to 500 MB.",
  "मिडिया खोल्न सकिएन। फेरि प्रयास गर्नुहोस्।": "Unable to load media. Please try again.",
  "अपलोड असफल भयो। फेरि प्रयास गर्नुहोस्।": "Upload failed. Please try again.",
  "अपलोड": "Uploading"
};
  let language = "ne";
  try { language = localStorage.getItem("rockCommunityLanguage") === "en" ? "en" : "ne"; } catch (_) {}
  function t(text) {
    if (language !== "en") return text;
    if (communityTranslations[text]) return communityTranslations[text];
    return text;
  }

  const section = document.createElement("section");
  section.id = "rockCommunityFeed";
  section.className = "section rock-community-section";
  section.innerHTML = `
    <div class="container">
      <h2>ROCK ESPORTS COMMUNITY</h2>
      <div class="rock-community-switch" role="group" aria-label="Community language / समुदायको भाषा"><button type="button" id="rockCommunityNepali" lang="ne">नेपाली</button><button type="button" id="rockCommunityEnglish" lang="en">English</button></div>
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
          <div id="rockCommunityMediaLimit" class="rock-community-meta">फोटो वा भिडियो बढीमा २५ MB</div>
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
  const contactLink = nav.querySelector('a[href="#contact"]');
  const tournamentLink = nav.querySelector('a[href="#tournament"]');
  if (contactLink) contactLink.after(link);
  else if (tournamentLink) tournamentLink.before(link);
  else nav.append(link);

  const staticLabels = [];
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (communityTranslations[node.textContent.trim()]) staticLabels.push({ node, original: node.textContent.trim() });
  }
  section.querySelectorAll("[placeholder]").forEach(node => staticLabels.push({node, attribute:"placeholder", original:node.getAttribute("placeholder")}));
  function applyLanguage() {
    section.lang = language;
    for (const item of staticLabels) {
      if (item.attribute) item.node.setAttribute(item.attribute, t(item.original));
      else item.node.textContent = t(item.original);
    }
    for (const [id, value] of [["rockCommunityNepali", "ne"], ["rockCommunityEnglish", "en"]]) {
      const button = document.getElementById(id);
      button.setAttribute("aria-pressed", String(language === value));
      button.classList.toggle("secondary", language !== value);
    }
    document.getElementById("rockCommunityAuthSubmit").textContent = t(mode === "signup" ? "खाता खोल्नुहोस्" : "लगइन");
    document.getElementById("rockCommunityMediaLimit").textContent = t(b2Enabled ? "फोटो वा भिडियो बढीमा ५०० MB" : "फोटो वा भिडियो बढीमा २५ MB");
  }
  function chooseLanguage(next) {
    language = next;
    try { localStorage.setItem("rockCommunityLanguage", language); } catch (_) {}
    applyLanguage();
    authStatus.textContent = "";
    postStatus.textContent = "";
    showAccount(session);
    loadFeed();
  }
  document.getElementById("rockCommunityNepali").addEventListener("click", () => chooseLanguage("ne"));
  document.getElementById("rockCommunityEnglish").addEventListener("click", () => chooseLanguage("en"));

  let mode = "login";
  let session = null;
  const authForm = document.getElementById("rockCommunityAuthFormFields");
  const authStatus = document.getElementById("rockCommunityAuthStatus");
  const postStatus = document.getElementById("rockCommunityPostStatus");
  const postHost = document.getElementById("rockCommunityPosts");
  let b2Enabled = false;
  let maxMediaBytes = 25 * 1024 * 1024;
  const mediaLinks = new Map();
  async function mediaCall(body) {
    const { data, error } = await client.functions.invoke("rock-community-media", { body });
    if (error || data?.error) throw new Error(data?.error || "Media service is unavailable. Please try again.");
    return data;
  }
  const mediaConfiguration = (async () => {
    try {
      const config = await mediaCall({ action: "config" });
      if (config.enabled && config.maxBytes === 500000000) { b2Enabled = true; maxMediaBytes = config.maxBytes; }
    } catch (_) {}
    applyLanguage();
  })();
  async function privateMediaUrl(postId) {
    const cached = mediaLinks.get(postId);
    if (cached && cached.expires > Date.now()) return cached.url;
    const result = await mediaCall({action:"view", postId});
    const address = new URL(result.url);
    if (address.protocol !== "https:" || !address.hostname.endsWith(".backblazeb2.com")) throw new Error("Invalid media URL");
    mediaLinks.set(postId,{url:result.url,expires:Date.now()+45*60*1000});
    return result.url;
  }
  function uploadDirect(prepared, file) {
    return new Promise((resolve,reject) => {
      const request = new XMLHttpRequest();
      request.open("PUT", prepared.url); request.timeout = 60*60*1000;
      for (const [name,value] of Object.entries(prepared.headers)) request.setRequestHeader(name,value);
      request.upload.onprogress = event => { if(event.lengthComputable) postStatus.textContent = t("अपलोड") + " · " + Math.round(event.loaded/event.total*100) + "%"; };
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(t("अपलोड असफल भयो। फेरि प्रयास गर्नुहोस्।")));
      request.onerror = request.ontimeout = () => reject(new Error(t("अपलोड असफल भयो। फेरि प्रयास गर्नुहोस्।")));
      request.send(file);
    });
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);

  function setMode(next) {
    mode = next;
    const signup = mode === "signup";
    document.getElementById("rockCommunityName").hidden = !signup;
    document.getElementById("rockCommunityName").required = signup;
    document.getElementById("rockCommunityPassword").autocomplete = signup ? "new-password" : "current-password";
    document.getElementById("rockCommunityAuthSubmit").textContent = signup ? t("खाता खोल्नुहोस्") : t("लगइन");
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
      label.textContent = `${t("लगइन")}: ${user.user_metadata?.display_name || user.email || t("खेलाडी")}`;
      const out = document.createElement("button");
      out.type = "button"; out.className = "secondary"; out.textContent = t("लगआउट");
      out.addEventListener("click", async () => { await client.auth.signOut(); authStatus.textContent = t("तपाईं लगआउट हुनुभयो।"); });
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
    button.disabled = true; authStatus.textContent = t("खाता जाँचिँदै छ…");
    try {
      const result = mode === "signup"
        ? await client.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) authStatus.textContent = t("Supabase बाट आएको इमेल खोलेर खाता पुष्टि गर्नुहोस्, त्यसपछि लगइन गर्नुहोस्।");
      else authStatus.textContent = mode === "signup" ? t("खाता तयार भयो। अब पोस्ट गर्न सक्नुहुन्छ।") : t("लगइन सफल भयो।");
      showAccount(result.data.session || null);
      if (result.data.session) await loadFeed();
    } catch (error) { authStatus.textContent = error?.message || t("खाता खोल्न वा लगइन गर्न सकिएन।"); }
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
      if (!posts?.length) { postHost.innerHTML = `<div class="rock-community-card">${t("अहिलेसम्म कुनै पोस्ट छैन। पहिलो पोस्ट तपाईंले गर्नुहोस्।")}</div>`; return; }
      const ids = posts.map((p) => p.id);
      const [{ data: comments }, { data: likes }] = await Promise.all([
        client.from("rock_community_comments").select("id,post_id,author_id,author_name,content,created_at").in("post_id", ids).order("created_at", { ascending: true }).limit(200),
        session?.user ? client.from("rock_community_likes").select("post_id").eq("user_id", session.user.id).in("post_id", ids) : Promise.resolve({ data: [] }),
      ]);
      const liked = new Set((likes || []).map((item) => item.post_id));
      for (const post of posts) postHost.append(buildPost(post, (comments || []).filter((c) => c.post_id === post.id), liked.has(post.id)));
      recordViews(posts);
    } catch (error) {
      postHost.innerHTML = `<div class="rock-community-card">${t("पोस्टहरू अहिले खोल्न सकिएन। Supabase मा समुदायको सेटअप पूरा भएको छ कि जाँच गर्नुहोस्।")}</div>`;
      console.error("ROCK community feed:", error);
    }
  }

  function buildPost(post, comments, isLiked) {
    const card = document.createElement("article"); card.className = "rock-community-card";
    const meta = document.createElement("div"); meta.className = "rock-community-meta";
    const author = document.createElement("strong"); author.textContent = post.author_name || "ROCK ESPORTS gamer";
    const date = document.createElement("time"); date.dateTime = post.created_at; date.textContent = new Date(post.created_at).toLocaleString(language === "en" ? "en-US" : "ne-NP");
    meta.append(author, date); card.append(meta);
    if (post.content) { const body = document.createElement("p"); body.textContent = post.content; card.append(body); }
    if (post.media_path) {
      const isPrivate = post.media_path.startsWith("b2:");
      const media = document.createElement(post.media_type === "video" ? "video" : "img");
      if (post.media_type === "video") { media.controls = true; media.playsInline = true; media.preload = "metadata"; }
      else { media.alt = t("खेलाडीले साझा गरेको फोटो"); media.loading = "lazy"; media.referrerPolicy = "no-referrer"; }
      card.append(media);
      if (isPrivate) {
        privateMediaUrl(post.id).then(address => { media.src = address; }).catch(() => {
          const note=document.createElement("p");note.textContent=t("मिडिया खोल्न सकिएन। फेरि प्रयास गर्नुहोस्।");media.replaceWith(note);
        });
        media.addEventListener("error", () => {
          if(media.dataset.refreshed)return; media.dataset.refreshed="true"; mediaLinks.delete(post.id);
          privateMediaUrl(post.id).then(address=>{media.src=address;}).catch(()=>{});
        });
      } else {
        const {data}=client.storage.from("rock-community-media").getPublicUrl(post.media_path); media.src=data.publicUrl;
      }
    }
    const actions = document.createElement("div"); actions.className = "rock-community-actions";
    const like = document.createElement("button"); like.type = "button"; like.className = isLiked ? "" : "secondary"; like.textContent = `👍 ${t("मन पराएँ")} · ${post.like_count || 0}`;
    like.addEventListener("click", () => toggleLike(post, like));
    const stats = document.createElement("span"); stats.className = "rock-community-meta"; stats.textContent = `👁 ${post.view_count || 0} ${t("हेराइ")} · 💬 ${post.comment_count || 0} ${t("प्रतिक्रिया")}`;
    actions.append(like, stats);
    if (session?.user) {
      const report = document.createElement("button"); report.className = "secondary"; report.textContent = t("रिपोर्ट"); report.addEventListener("click", () => reportPost(post.id)); actions.append(report);
      if (session.user.id === post.author_id || session.user.email?.toLowerCase() === "rockesprorts.official@gmail.com") {
        const remove = document.createElement("button"); remove.className = "secondary"; remove.textContent = t("पोस्ट हटाउनुहोस्"); remove.addEventListener("click", () => removePost(post)); actions.append(remove);
      }
    }
    card.append(actions);
    const discussion = document.createElement("div"); discussion.className = "rock-community-comments";
    for (const item of comments) { const row = document.createElement("div"); row.className = "rock-community-comment"; const who = document.createElement("strong"); who.textContent = `${item.author_name || t("खेलाडी")}: `; const text = document.createElement("span"); text.textContent = item.content; row.append(who, text); discussion.append(row); }
    if (session?.user) {
      const form = document.createElement("form"); form.className = "rock-community-actions";
      const input = document.createElement("input"); input.maxLength = 500; input.required = true; input.placeholder = t("प्रतिक्रिया लेख्नुहोस्…");
      const send = document.createElement("button"); send.textContent = t("पठाउनुहोस्"); form.append(input, send);
      form.addEventListener("submit", async (event) => { event.preventDefault(); send.disabled = true; const { error } = await client.from("rock_community_comments").insert({ post_id: post.id, author_id: session.user.id, content: input.value.trim() }); if (error) authStatus.textContent = error.message; else await loadFeed(); send.disabled = false; });
      discussion.append(form);
    } else { const tip = document.createElement("p"); tip.textContent = t("प्रतिक्रिया लेख्न लगइन गर्नुहोस्।"); discussion.append(tip); }
    card.append(discussion);
    return card;
  }

  async function toggleLike(post, button) {
    if (!session?.user) { authStatus.textContent = t("मन पराउन पहिले लगइन गर्नुहोस्।"); return; }
    button.disabled = true;
    const { data: existing, error: readError } = await client.from("rock_community_likes").select("post_id").eq("post_id", post.id).eq("user_id", session.user.id).maybeSingle();
    if (readError) authStatus.textContent = readError.message;
    else if (existing) { const { error } = await client.from("rock_community_likes").delete().eq("post_id", post.id).eq("user_id", session.user.id); if (error) authStatus.textContent = error.message; }
    else { const { error } = await client.from("rock_community_likes").insert({ post_id: post.id, user_id: session.user.id }); if (error) authStatus.textContent = error.message; }
    await loadFeed();
  }

  async function reportPost(postId) {
    const reason = window.prompt(t("यो पोस्ट किन रिपोर्ट गर्दै हुनुहुन्छ?")); if (!reason || !session?.user) return;
    const { error } = await client.from("rock_community_reports").insert({ post_id: postId, reporter_id: session.user.id, reason: reason.slice(0, 300) });
    authStatus.textContent = error ? error.message : t("रिपोर्ट पठाइयो। व्यवस्थापकले जाँच गर्नुहुनेछ।");
  }

  async function removePost(post) {
    if (!window.confirm(t("यो पोस्ट हटाउने हो?"))) return;
    if (post.media_path?.startsWith("b2:")) {
      try { await mediaCall({action:"remove",postId:post.id}); mediaLinks.delete(post.id); await loadFeed(); }
      catch(error) { authStatus.textContent=error.message; }
      return;
    }
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
    if (!session?.user) { postStatus.textContent = t("पोस्ट गर्न लगइन गर्नुहोस्।"); return; }
    const content = document.getElementById("rockCommunityPostText").value.trim();
    const file = document.getElementById("rockCommunityMedia").files?.[0] || null;
    const postForm = event.currentTarget;
    const submit = postForm.querySelector("button[type=submit]");
    await mediaConfiguration;
    if (!content && !file) { postStatus.textContent = t("लेखाइ वा फोटो/भिडियो राख्नुहोस्।"); return; }
    if (file && (!/^image\/(jpeg|png|webp|gif)$|^video\/(mp4|webm|quicktime)$/.test(file.type) || file.size > maxMediaBytes)) { postStatus.textContent = t(b2Enabled ? "५०० MB सम्मको समर्थित फोटो वा भिडियो छान्नुहोस्।" : "समर्थित फोटो वा २५ MB सम्मको भिडियो छान्नुहोस्।"); return; }
    submit.disabled = true; postStatus.textContent = t("पोस्ट राखिँदै छ…");
    let mediaPath = null, mediaType = null;
    let pendingB2Session = null;
    try {
      if (file && b2Enabled) {
        const prepared=await mediaCall({action:"prepare",size:file.size,type:file.type});
        pendingB2Session=prepared.session;
        await uploadDirect(prepared,file);
        await mediaCall({action:"publish",session:prepared.session,content});
        pendingB2Session=null;
        postForm.reset(); postStatus.textContent=t("पोस्ट सफलतापूर्वक राखियो।"); await loadFeed(); return;
      }
      if (file) {
        const ext = ({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov"})[file.type];
        mediaPath = `${session.user.id}/${crypto.randomUUID()}.${ext}`; mediaType = file.type.startsWith("video/") ? "video" : "image";
        const { error } = await client.storage.from("rock-community-media").upload(mediaPath, file, { contentType: file.type, upsert: false });
        if (error) throw error;
      }
      const { error } = await client.from("rock_community_posts").insert({ author_id: session.user.id, content, media_path: mediaPath, media_type: mediaType });
      if (error) { if (mediaPath) await client.storage.from("rock-community-media").remove([mediaPath]); throw error; }
      postForm.reset(); postStatus.textContent = t("पोस्ट सफलतापूर्वक राखियो।"); await loadFeed();
    } catch (error) {
      if(pendingB2Session) { try { await mediaCall({action:"discard",session:pendingB2Session}); } catch(_) {} }
      postStatus.textContent = error?.message || t("पोस्ट राख्न सकिएन।");
    }
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
  applyLanguage();
  showSelectedTab();
  // Guest reading must not wait for authentication to initialize.
  loadFeed();
  currentSession().then(loadFeed).catch(() => {
    authStatus.textContent = t("लगइन अहिले उपलब्ध छैन। सार्वजनिक पोस्ट हेर्न सक्नुहुन्छ।");
  });
  window.setInterval(loadFeed, 60000);
})();

