(() => {
  'use strict';

  const modes = ['tdm', 'classic', 'wow'];
  const tables = { drafts: 'rock_winner_drafts', posts: 'rock_winner_posts' };
  const logo = 'assets/icons/rock-512.png';
  const imagePattern = /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/]+=*$/i;
  const pageSize = 4;
  const panels = new Map();
  let visitorId;

  function visitor() {
    if (!visitorId) {
      try {
        visitorId = localStorage.getItem('rock-winners-visitor');
        if (!/^[a-f0-9-]{36}$/i.test(visitorId || '')) {
          visitorId = crypto.randomUUID();
          localStorage.setItem('rock-winners-visitor', visitorId);
        }
      } catch {
        visitorId = crypto.randomUUID();
      }
    }
    return visitorId;
  }

  function element(tag, text, classes) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (classes) node.className = classes;
    return node;
  }

  function button(text, handler) {
    const node = element('button', text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  }

  async function request(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async function canEdit() {
    const { data } = await sb.auth.getSession();
    return Boolean(data.session && await request(sb.rpc('rock_winners_can_edit')));
  }

  function postCard(post) {
    const card = element('article', '', 'rock-winner-card rock-champions-card rock-' + post.mode + '-winner-card');
    const header = element('header');
    const badge = element('img', '', 'rock-winner-brand');
    badge.src = logo;
    badge.alt = 'ROCK';
    const date = element('time', post.tournament_date || 'Date pending');
    if (post.tournament_date) date.dateTime = post.tournament_date;
    header.append(badge, element('strong', 'ROCK ESPORTS'));
    card.append(header);
    const poster = element('div', '', 'rock-winner-poster');
    {
      const title = element('div', '', 'rock-tdm-winner-title');
      const posterLogo = badge.cloneNode();
      posterLogo.className = 'rock-tdm-poster-logo rock-winner-brand';
      title.append(
        posterLogo, element('span', 'PUBG MOBILE', 'rock-tdm-pubg'),
        element('p', 'ROCK ESPORTS PRESENTS'),
        element('h3', post.tournament_name || post.mode.toUpperCase() + ' TOURNAMENT'),
        element('strong', 'CHAMPIONS'),
        element('span', '🇳🇵', 'rock-tdm-flag rock-tdm-flag-left'),
        element('span', '🇳🇵', 'rock-tdm-flag rock-tdm-flag-right')
      );
      poster.append(title);
    }

    const placements = element('div', '', 'rock-winner-placements');
    function placement(entry, title) {
      const item = element('div', '', 'rock-winner-placement');
      const portrait = element('div', '', 'rock-winner-portrait');
      if (title.startsWith('♛')) portrait.append(element('span', '♛', 'rock-winner-crown'));
      if (imagePattern.test(entry.photo)) {
        const photo = element('img', '', 'rock-winner-photo');
        photo.src = entry.photo;
        photo.alt = '';
        portrait.append(photo);
      }
      const name = element('p', '', 'rock-winner-name');
      if (imagePattern.test(entry.logo)) {
        const teamLogo = element('img', '', 'rock-winner-team-logo');
        teamLogo.src = entry.logo;
        teamLogo.alt = '';
        name.append(teamLogo);
      }
      name.append(document.createTextNode(entry.name || 'Name pending'));
      item.append(portrait, element('h4', title), name, element('p', entry.prize ? 'Prize · ' + entry.prize : '', 'rock-winner-prize'));
      return item;
    }
    post.winners.forEach((entry, index) => {
      const item = placement(entry, ['♛ #1 Champion', '#2 Runner-up', '#3 Third place', '#4 Fourth place'][index]);
      item.dataset.rank = String(index + 1);
      placements.append(item);
    });
    poster.append(placements);
    if (post.mvp) {
      const mvp = placement(post.mvp, 'MVP');
      mvp.classList.add('rock-winner-mvp');
      mvp.dataset.rank = 'mvp';
      poster.append(mvp);
    }
    {
      const metadata = element('div', '', 'rock-tdm-poster-meta');
      metadata.append(element('span', '🎮 ' + post.mode.toUpperCase() +
        (post.tournament_format ? ' (' + post.tournament_format + ')' : '') + ' · ' + post.stage.toUpperCase()), date);
      if (post.participant_count) metadata.append(element('span', (post.mode === 'tdm' ? 'Players' : 'Teams') + ' · ' + post.participant_count));
      if (post.maps) metadata.append(element('span', 'Maps · ' + post.maps));
      metadata.append(element('span', '🏆 Organizer · ROCK ESPORTS'));
      poster.append(metadata);
    }
    poster.append(element('p', 'DREAM BIG • PLAY SMART • NEVER GIVE UP', 'rock-winner-slogan'));
    card.append(poster);
    return card;
  }

  function interactions(post, editor, onShare) {
    const area = element('div', '', 'rock-winner-interactions');
    const toolbar = element('div', '', 'rock-winner-social');
    const summary = element('p', '', 'rock-winner-counts');
    const status = element('p');
    status.setAttribute('role', 'status');
    const comments = element('div');
    const form = element('form');
    const name = element('input');
    name.required = true;
    name.maxLength = 32;
    name.autocomplete = 'nickname';
    const body = element('input');
    body.required = true;
    body.maxLength = 240;
    const submit = element('button', 'Send comment');
    const call = (action, extras = {}) => request(sb.rpc('rock_winners_interact', {
      target_post: post.id, action, visitor_id: visitor(), ...extras
    }));
    const like = button('♥ Like', () => act('like', {}, like));
    like.className = 'rock-winner-like';
    async function refresh() {
      const data = await call('read');
      like.textContent = data.liked ? '♥ Liked' : '♥ Like';
      summary.textContent = '♥ ' + data.likes + ' · ' + data.comment_count + ' Comments';
      like.disabled = data.liked;
      comments.replaceChildren();
      for (const comment of data.comments) {
        const row = element('div', '', 'rock-winner-comment');
        row.append(element('strong', comment.display_name), element('p', comment.message));
        if (editor) {
          if (comment.state === 'pending') {
            const approve = button('Approve', () => act('approve', { comment_id: comment.id }, approve));
            row.append(approve);
          }
          const hide = button('Hide', () => act('hide', { comment_id: comment.id }, hide));
          row.append(hide);
        }
        comments.append(row);
      }
    }
    async function act(action, extras, control) {
      control.disabled = true;
      try {
        await call(action, extras);
        if (action === 'comment') {
          body.value = '';
          status.textContent = 'Comment sent for review.';
        } else {
          status.textContent = '';
        }
        await refresh();
      } catch (error) {
        status.textContent = error.message;
        control.disabled = false;
      } finally {
        if (control !== like) control.disabled = false;
      }
    }
    form.append(labelField('Guest name', name), labelField('Comment', body), submit);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (name.value.trim() && body.value.trim()) {
        void act('comment', { guest_name: name.value, body: body.value }, submit);
      }
    });
    toolbar.append(like, button('Comment', () => body.focus()), button('Share', onShare));
    area.append(summary, toolbar, comments, form, status);
    void refresh().catch(error => { status.textContent = error.message; });
    return area;
  }

  async function sharePost(post) {
    const url = new URL(location.href);
    url.hash = post.stage;
    url.searchParams.set('mode', post.mode);
    url.searchParams.set('post', post.id);
    if (navigator.share) await navigator.share({ title: post.tournament_name, url: url.href });
    else await navigator.clipboard.writeText(url.href);
  }

  function labelField(title, control) {
    const label = element('label', title);
    label.append(control);
    return label;
  }

  async function encodeImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 12 * 1024 * 1024) {
      throw new Error('Choose a JPEG, PNG or WebP image under 12 MB.');
    }
    const bitmap = await createImageBitmap(file);
    try {
      const ratio = Math.min(1, 560 / Math.max(bitmap.width, bitmap.height));
      const canvas = element('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/webp', 0.76);
      if (!imagePattern.test(image) || image.length > 380000) {
        throw new Error('This image is too large after resizing. Choose a smaller image.');
      }
      return image;
    } finally {
      bitmap.close();
    }
  }

  function openEditor(stage, mode, source, onSaved) {
    const draft = source || {
      id: crypto.randomUUID(), stage, mode, tournament_name: '', tournament_date: null,
      winners: Array.from({ length: 4 }, () => ({})), mvp: null
    };
    const dialog = element('dialog', '', 'rock-winners rock-winner-dialog');
    const form = element('form');
    const fields = element('fieldset');
    const date = element('input');
    date.type = 'date';
    date.value = draft.tournament_date || '';
    const tournamentName = element('input');
    tournamentName.maxLength = 120;
    tournamentName.value = draft.tournament_name || '';
    const format = element('input');
    format.maxLength = 40;
    format.value = draft.tournament_format || '';
    const participants = element('input');
    participants.type = 'number';
    participants.min = 1;
    participants.max = 9999;
    participants.value = draft.participant_count || '';
    const maps = element('input');
    maps.maxLength = 100;
    maps.value = draft.maps || '';
    const status = element('p');
    status.setAttribute('role', 'status');
    const preview = element('div');
    const mvpToggle = element('input');
    mvpToggle.type = 'checkbox';
    mvpToggle.checked = Boolean(draft.mvp);
    const mvpFields = element('fieldset');
    mvpFields.hidden = !mvpToggle.checked;
    mvpToggle.addEventListener('change', () => { mvpFields.hidden = !mvpToggle.checked; });
    const imageTasks = new Set();
    const invalidImages = new Set();

    function entryFields(parent, title, initial, withLogo, isMvp = false) {
      const box = element('fieldset');
      box.append(element('legend', title));
      const values = { ...initial };
      function textField(key, label, maxLength) {
        const input = element('input');
        input.maxLength = maxLength;
        input.value = values[key] || '';
        box.append(labelField(label, input));
        input.addEventListener('input', () => { values[key] = input.value.trim(); });
      }
      function imageField(key, label) {
        const input = element('input');
        const info = element('small', values[key] ? 'Image saved' : 'Choose an image');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.addEventListener('change', () => {
          const file = input.files[0];
          if (!file) { invalidImages.delete(input); return; }
          input.disabled = true;
          info.textContent = 'Preparing image…';
          const work = encodeImage(file).then(image => {
            values[key] = image;
            invalidImages.delete(input);
            info.textContent = 'Image ready';
          }).catch(error => {
            invalidImages.add(input);
            info.textContent = error.message;
          }).finally(() => { input.disabled = false; imageTasks.delete(work); });
          imageTasks.add(work);
        });
        box.append(labelField(label, input), info);
      }
      textField('name', !isMvp ? (mode === 'tdm' ? 'Player name' : 'Team name') : 'MVP name', 120);
      textField('prize', 'Prize', 80);
      imageField('photo', 'Photo');
      if (withLogo) imageField('logo', 'Team logo');
      parent.append(box);
      return values;
    }

    fields.append(labelField('Tournament name', tournamentName), labelField('Tournament date', date),
      labelField('Format (optional)', format), labelField(mode === 'tdm' ? 'Player count (optional)' : 'Team count (optional)', participants),
      labelField('Maps (optional)', maps));
    const winners = draft.winners.map((entry, index) => entryFields(fields, `#${index + 1}`, entry, true));
    const mvp = entryFields(mvpFields, 'MVP', draft.mvp || {}, mode === 'tdm', true);
    fields.append(labelField('Include MVP', mvpToggle), mvpFields);
    const controls = element('div', '', 'rock-winner-actions');
    let revision = draft.revision;
    async function update(action) {
      if (!form.reportValidity()) return;
      fields.disabled = true;
      controls.inert = true;
      try {
        await Promise.all(imageTasks);
        if ([...invalidImages].some(input => mvpToggle.checked || !mvpFields.contains(input))) {
          throw new Error('Replace any images marked invalid.');
        }
        const data = {
          id: draft.id, stage, mode, tournament_name: tournamentName.value.trim(), tournament_date: date.value || null,
          tournament_format: format.value.trim(), participant_count: participants.valueAsNumber || null, maps: maps.value.trim(),
          winners, mvp: mvpToggle.checked ? mvp : null
        };
        if (action === 'preview') {
          preview.replaceChildren(postCard(data));
          preview.scrollIntoView({ block: 'nearest' });
          status.textContent = 'Private preview.';
          return;
        }
        const next = revision ? revision + 1 : 1;
        const changes = { ...data, revision: next };
        const mutation = revision
          ? sb.from(tables.drafts).update(changes).eq('id', draft.id).eq('revision', revision)
          : sb.from(tables.drafts).insert(changes);
        const saved = await request(mutation.select('revision').maybeSingle());
        if (!saved) throw new Error('Draft changed. Close and reopen it before saving.');
        revision = saved.revision;
        onSaved();
        status.textContent = 'Draft saved.';
        if (action === 'publish') {
          await request(sb.rpc('rock_winners_publish', { post_id: draft.id, expected_revision: revision }));
          onSaved();
          status.textContent = 'Published.';
        }
      } catch (error) {
        status.textContent = error.message;
      } finally {
        fields.disabled = false;
        controls.inert = false;
      }
    }
    controls.append(
      button('Save draft', () => update('save')),
      button('Preview', () => update('preview')),
      button('Publish', () => update('publish')),
      button('Close', () => dialog.close())
    );
    form.addEventListener('submit', event => event.preventDefault());
    form.append(fields, controls);
    dialog.append(element('h3', `${mode.toUpperCase()} ${stage.toUpperCase()}`), form, status, preview);
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    document.body.append(dialog);
    dialog.showModal();
  }

  function mount(root) {
    const stage = root.id;
    const nav = element('div', '', 'rock-winner-actions');
    const stories = element('div', '', 'rock-winner-actions');
    const management = element('div', '', 'rock-winner-actions');
    const list = element('div');
    const status = element('p');
    status.setAttribute('role', 'status');
    const share = post => async () => {
      try {
        await sharePost(post);
        if (!navigator.share) status.textContent = 'Post link copied.';
      } catch (error) {
        if (error.name !== 'AbortError') status.textContent = error.message;
      }
    };
    const modeHeading = element('h3');
    const shared = new URLSearchParams(location.search);
    let sharedId = shared.get('post');
    if (location.hash !== '#' + stage || !/^[0-9a-f-]{36}$/i.test(sharedId || '')) sharedId = null;
    let mode = sharedId && modes.includes(shared.get('mode')) ? shared.get('mode') : modes[0];
    let page = 0;
    let generation = 0;
    const refresh = () => load();
    const modeButtons = modes.map(option => button(option.toUpperCase(), () => {
      mode = option;
      sharedId = null;
      page = 0;
      void load();
    }));
    nav.append(...modeButtons);
    root.append(nav, modeHeading, management, status, stories, list);

    async function load() {
      const current = ++generation;
      const selected = mode;
      const offset = page * pageSize;
      status.textContent = 'Loading…';
      modeHeading.textContent = `${selected.toUpperCase()} ${stage.toUpperCase()}`;
      modeButtons.forEach((control, index) => control.setAttribute('aria-pressed', String(modes[index] === selected)));
      management.replaceChildren();
      stories.replaceChildren();
      list.replaceChildren();
      try {
        const postQuery = sb.from(tables.posts).select('*').eq('stage', stage).eq('mode', selected)
          .order('tournament_date', { ascending: false }).order('id', { ascending: false })
          .range(offset, offset + pageSize);
        const storyQuery = sb.from(tables.posts).select('id,tournament_name,tournament_date,story_at,story_highlight')
          .eq('stage', stage).eq('mode', selected)
          .or('story_highlight.eq.true,story_at.gt.' + new Date(Date.now() - 86400000).toISOString())
          .order('story_at', { ascending: false }).limit(40);
        const [posts, editor, storyPosts] = await Promise.all([
          request(sharedId ? postQuery.eq('id', sharedId) : postQuery), canEdit(), request(storyQuery)
        ]);
        if (current !== generation) return;
        status.textContent = posts.length ? '' : 'No published posts yet.';
        if (editor) {
          management.append(
            button('New post', () => openEditor(stage, selected, null, refresh)),
            button('Open saved drafts', async () => {
              try { await browseDrafts(selected); } catch (error) { status.textContent = error.message; }
            })
          );
        }
        if (sharedId) management.append(button('All posts', () => { sharedId = null; void load(); }));
        for (const item of storyPosts) {
          const control = button(item.tournament_name + (item.story_highlight ? ' · Highlight' : ''), async () => {
            try {
              const post = await request(sb.from(tables.posts).select('*').eq('id', item.id).single());
              if (!post.story_highlight && Date.parse(post.story_at) <= Date.now() - 86400000) {
                throw new Error('This story has expired.');
              }
              const dialog = element('dialog', '', 'rock-winners rock-winner-dialog rock-winner-story');
              const story = postCard(post);
              const frames = [...story.querySelectorAll('[data-rank]')];
              const controls = element('div', '', 'rock-winner-actions');
              function chooseFrame(rank) {
                story.dataset.placement = rank;
                frames.forEach(frame => { frame.hidden = frame.dataset.rank !== rank; });
                controls.querySelectorAll('[data-rank]').forEach(control => {
                  control.setAttribute('aria-pressed', String(control.dataset.rank === rank));
                });
              }
              for (const frame of frames) {
                const rank = frame.dataset.rank;
                const option = button(rank === 'mvp' ? 'MVP' : '#' + rank, () => chooseFrame(rank));
                option.dataset.rank = rank;
                controls.append(option);
              }
              controls.append(button('Close story', () => dialog.close()));
              chooseFrame('1');
              story.append(interactions(post, editor, share(post)));
              dialog.append(controls, story);
              dialog.addEventListener('close', () => dialog.remove(), { once: true });
              document.body.append(dialog);
              dialog.showModal();
            } catch (error) { status.textContent = error.message; }
          });
          control.className = 'rock-story-icon';
          const icon = element('img');
          icon.src = logo;
          icon.alt = '';
          control.prepend(icon);
          stories.append(control);
        }
        if (storyPosts.length) stories.prepend(element('h4', 'Winner stories'));
        for (const post of posts.slice(0, pageSize)) {
          const card = postCard(post);
          card.append(interactions(post, editor, share(post)));
          if (editor) card.append(button('Edit', async () => {
            try {
              const draft = await request(sb.from(tables.drafts).select('*').eq('id', post.id).single());
              openEditor(stage, selected, draft, refresh);
            } catch (error) { status.textContent = error.message; }
          }));
          if (editor) {
            const actions = element('div', '', 'rock-winner-actions');
            const changes = [['Publish story', 'story'], ['Delete post', 'delete']];
            if (post.story_at) changes.push(post.story_highlight
              ? ['Remove highlight', 'remove_highlight'] : ['Add highlight', 'highlight']);
            for (const [label, action] of changes) actions.append(button(label, async () => {
              if (action === 'delete' && !confirm('Remove this winner post from public view?')) return;
              try {
                await request(sb.rpc('rock_winners_manage_post', { post_id: post.id, action }));
                await load();
              } catch (error) { status.textContent = error.message; }
            }));
            card.append(actions);
          }
          list.append(card);
        }
        const pagination = element('div', '', 'rock-winner-actions');
        if (page > 0) pagination.append(button('Previous', () => { page--; void load(); }));
        if (posts.length > pageSize) pagination.append(button('Next', () => { page++; void load(); }));
        list.append(pagination);
      } catch (error) {
        if (current === generation) status.textContent = error.message;
      }
    }

    async function browseDrafts(selected) {
      const dialog = element('dialog', '', 'rock-winners rock-winner-dialog');
      const entries = element('div', '', 'rock-winner-actions');
      const notice = element('p');
      let offset = 0;
      async function showDraftPage() {
        const items = await request(sb.from(tables.drafts).select('id,tournament_name,tournament_date')
          .eq('stage', stage).eq('mode', selected).order('tournament_date', { ascending: false })
          .order('id', { ascending: false }).range(offset, offset + 9));
        entries.replaceChildren();
        notice.textContent = items.length ? '' : 'No saved drafts.';
        for (const item of items) entries.append(button((item.tournament_name || 'Untitled draft') + (item.tournament_date ? ' · ' + item.tournament_date : ''), async () => {
          try {
            const draft = await request(sb.from(tables.drafts).select('*').eq('id', item.id).single());
            dialog.close();
            openEditor(stage, selected, draft, refresh);
          } catch (error) { notice.textContent = error.message; }
        }));
        if (items.length === 10) entries.append(button('More', async () => {
          offset += 10;
          try { await showDraftPage(); } catch (error) { notice.textContent = error.message; }
        }));
        if (offset) entries.append(button('Previous', async () => {
          offset -= 10;
          try { await showDraftPage(); } catch (error) { notice.textContent = error.message; }
        }));
      }
      await showDraftPage();
      dialog.append(element('h3', 'Saved drafts'), entries, notice, button('Close', () => dialog.close()));
      dialog.addEventListener('close', () => dialog.remove(), { once: true });
      document.body.append(dialog);
      dialog.showModal();
    }

    panels.set(stage, load);
    return load;
  }

  document.querySelectorAll('section#results, section#finals').forEach(root => {
    root.addEventListener('focusin', () => {
      if (!panels.has(root.id)) void mount(root)();
    }, { once: true });
  });
  const openFromHash = () => {
    const root = document.getElementById(location.hash.slice(1));
    if (root?.matches('section#results, section#finals') && !panels.has(root.id)) void mount(root)();
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (!panels.has(entry.target.id)) void mount(entry.target)();
      }
    });
    document.querySelectorAll('section#results, section#finals').forEach(root => observer.observe(root));
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
  let currentUser;
  sb.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    const key = JSON.stringify([user?.id, user?.app_metadata?.rock_winners_role]);
    if (key === currentUser) return;
    currentUser = key;
    setTimeout(() => panels.forEach(load => { void load(); }), 0);
  });
})();
