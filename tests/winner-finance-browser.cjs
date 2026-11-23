const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.ROCK_TEST_BROWSER || undefined,
    headless: true
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1430, height: 1020 } });
    page.setDefaultTimeout(12000);
    const photo = 'data:image/png;base64,' + fs.readFileSync('assets/icons/rock-192.png').toString('base64');
    const posts = [];
    const drafts = [];
    for (const stage of ['results']) {
      for (const mode of ['tdm', 'classic', 'wow']) {
        const post = {
          id: stage + '-' + mode, stage, mode, tournament_name: mode.toUpperCase() + ' Test Cup',
          tournament_date: '2026-11-21', story_at: new Date().toISOString(),
          winners: Array.from({ length: 4 }, (_, i) => ({ name: 'Winner ' + (i + 1), prize: 'NPR 300', photo, logo: photo })),
          mvp: mode === 'tdm' ? { name: 'MVP Test', prize: 'NPR 100', photo, logo: photo } : null
        };
        posts.push(post);
        drafts.push({ ...post, revision: 1 });
      }
    }
    await page.addInitScript(({ posts, drafts }) => {
      window.rockCalls = [];
      const client = {
        auth: {
          getSession: async () => ({ data: { session: window.rockTestGuest ? null : { user: window.rockTestManager ? { id: 'manager' } : { id: 'test', email:'rockesprorts.official@gmail.com' } } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
        },
        from(table) {
          const filters = {};
          const api = {
            select() { return api; },
            eq(key, value) { filters[key] = value; return api; },
            order() { return api; },
            or() { return api; },
            range() { return api; },
            limit() { return api; },
            update(record) { api.change = record; return api; },
            insert(record) { api.change = record; return api; },
            maybeSingle() { api.one = true; return api; },
            single() { api.one = true; return api; },
            then(resolve) {
              const matches = rows => rows.filter(row => Object.entries(filters).every(([key, val]) => row[key] === val));
              let result = [];
              if (table === 'rock_winner_posts') result = matches(posts);
              if (table === 'rock_winner_drafts') result = api.change ? [api.change] : matches(drafts);
              if (table === 'rock_finance_settings') result = [{ require_owner_approval: false }];
              resolve({ data: api.one ? result[0] || null : result, error: null });
            }
          };
          return api;
        },
        rpc(name, payload) {
          if (name === 'rock_finance_is_owner' && window.rockTestManager) return Promise.resolve({ data: false });
          window.rockCalls.push([name, payload]);
          return Promise.resolve({ data: name === 'rock_winners_interact'
            ? { likes: 1, liked: false, comment_count: 1, comments: [{id: 1,display_name:'Guest',message:'Test comment',state:'visible'}] } : true });
        }
      };
      window.supabase = { createClient: () => client };
    }, { posts, drafts });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'localhost') return route.fulfill({ body: '' });
      const file = path.resolve('.' + (url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(process.cwd() + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.abort();
      return route.fulfill({ path: file });
    });
    const errors = [];
    page.on('pageerror', error => {
      if (error.stack.includes('rock-winners.js') || error.stack.includes('rock-finance.js')) errors.push(error.message);
    });
    await page.goto('http://localhost/#results', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: '#rockIntroSequence, #rockAiChatRoot { display: none !important; }' });
    for (const stage of ['results']) {
      await page.evaluate(stage => { location.hash = stage; }, stage);
      const section = page.locator('#' + stage);
      for (const mode of ['TDM', 'CLASSIC', 'WOW']) {
        await section.getByRole('button', { name: mode, exact: true }).click({ force: true });
        const card = section.locator('.rock-winner-card');
        await card.getByRole('heading', { name: mode + ' Test Cup' }).waitFor();
        assert.equal(await card.locator('.rock-winner-placements > [data-rank]').count(), 4);
        assert.equal(await card.locator('.rock-winner-mvp').count(), mode === 'TDM' ? 1 : 0);
        for (const label of ['New post', 'Open saved drafts', 'Edit', 'Delete comment']) {
          assert.equal(await section.getByRole('button', { name: label, exact: true }).count(), 0);
        }
        await section.getByRole('button', { name: mode + ' Test Cup', exact: true }).click();
        const story = page.locator('.rock-winner-story[open]');
        await story.getByRole('button', { name: '#3', exact: true }).click();
        assert.equal(await story.locator('[data-rank="3"].rock-winner-placement').isVisible(), true);
        assert.equal(await story.locator('[data-rank="1"].rock-winner-placement').isVisible(), false);
        await story.getByRole('button', { name: 'Close story' }).click();
      }
    }
    for (const route of ['#home', '#rockCommunityFeed', '#tournament', '#live-draw', '#group-division', '#live-broadcast']) {
      await page.evaluate(hash => { location.hash = hash; }, route);
      const nav = page.locator('.nav-inner a[href="' + route + '"]').first();
      await nav.waitFor({ state: 'attached' });
      await page.waitForFunction(hash => [...document.querySelectorAll('a[aria-current=page]')].some(link => link.hash === hash), route);
      assert.equal(await page.locator('#results').isVisible(), false);
      assert.equal(await page.locator('#finals').count(), 0);
    }
    await page.evaluate(() => { location.hash = 'results'; });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#results .rock-winner-card').waitFor();
    assert(await page.locator('#results .rock-winner-poster').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    const externalFinance = page.locator('.nav-inner a[href="#finance-management"]');
    assert.equal(await externalFinance.count(), 1);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.locator('.nav-inner').evaluate(nav => nav.scrollTo({left:0,behavior:'instant'}));
    assert.equal(await externalFinance.evaluate(link => {
      const rect = link.getBoundingClientRect();
      const nav = link.parentElement.getBoundingClientRect();
      return rect.width > 0 && rect.left >= nav.left && rect.right <= nav.right - 32;
    }), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#adminNavButton').evaluate(button => button.click());
    const admin = page.locator('#adminOverlay.open');
    const adminTab = admin.getByRole('button', { name: 'FINANCE MANAGEMENT SYSTEM', exact: true });
    await adminTab.waitFor();
    await adminTab.evaluate(button => button.click());
    await admin.getByRole('heading', { name: 'Pending Payment', exact: true }).waitFor();
    await admin.getByRole('heading', { name: 'OWNER CONTROL' }).waitFor();
    await admin.getByRole('button', { name: 'Open saved drafts', exact: true }).click();
    const draftsDialog = page.locator('dialog[open]');
    await draftsDialog.getByRole('heading', { name: 'Saved drafts' }).waitFor();
    await draftsDialog.getByRole('button', { name: 'Close', exact: true }).click();
    const managed = admin.locator('.rock-winner-card');
    await managed.getByRole('heading', { name: 'TDM Test Cup' }).waitFor();
    const remove = managed.getByRole('button', { name: 'Delete comment', exact: true });
    page.once('dialog', dialog => dialog.accept());
    await remove.click();
    await page.waitForFunction(() => window.rockCalls.some(([name, args]) => name === 'rock_winners_interact' && args.action === 'delete_comment'));
    await managed.getByRole('button', { name: 'Edit', exact: true }).click();
    const resultEditor = page.locator('dialog[open]');
    await resultEditor.getByRole('button', { name: 'Preview', exact: true }).click();
    assert.equal(await resultEditor.locator('.rock-winner-poster').innerText(), await managed.locator('.rock-winner-poster').innerText());
    await resultEditor.getByRole('button', { name: 'Close', exact: true }).click();
    await admin.getByRole('button', { name: 'New post', exact: true }).click();
    await resultEditor.getByRole('heading', { name: 'TDM RESULTS' }).waitFor();
    await resultEditor.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'New transaction' }).click();
    await page.getByText('Receipt or proof', { exact: true }).waitFor();
    await page.locator('dialog[open]').getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => { closeAdmin(); window.rockTestGuest = true; location.hash = 'results'; });
    await page.locator('.nav-inner a[href="#finance-management"]').evaluate(link => link.click());
    await page.getByRole('button', { name: 'Finance Manager · Meeting Room login' }).waitFor();
    assert.equal(await page.locator('dialog.rock-finance-workspace[open]').getByRole('heading', { name: 'OWNER CONTROL' }).count(), 0);
    await page.evaluate(() => { location.hash = 'results'; });
    const resultCard = page.locator('#results .rock-winner-card');
    await resultCard.getByRole('button', { name: '♥ Like', exact: true }).click();
    await resultCard.getByLabel('Guest name').fill('Visitor');
    await resultCard.getByLabel('Comment', { exact: true }).fill('Great event');
    await resultCard.getByRole('button', { name: 'Send comment' }).click();
    await resultCard.getByText('Comment sent for review.').waitFor();
    await page.evaluate(() => { window.rockTestGuest = false; window.rockTestManager = true; });
    await page.locator('.nav-inner a[href="#finance-management"]').evaluate(link => link.click());
    const workspace = page.locator('dialog.rock-finance-workspace[open]');
    await workspace.getByRole('heading', { name: 'Finance Manager · BIMAL CHAND' }).waitFor();
    await workspace.getByRole('button', { name: 'New post', exact: true }).waitFor();
    assert.equal(await page.locator('#adminOverlay.open').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: three RESULTS sections, shared editor preview and post templates, rank stories, mobile layout, finance entry.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
