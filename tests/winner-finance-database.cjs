const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  const owner = { sub: '19058048-7336-4af7-b228-a30c31681d67', email: 'rockesprorts.official@gmail.com' };
  const finance = { sub: '2cda9c7b-22da-4811-b7c2-9284f09ffdea', app_metadata: { rock_winners_role: 'finance_manager' } };
  const member = { sub: '07bdfbc2-59b9-4db5-b395-6fb511870d4e', user_metadata: { rock_winners_role: 'finance_manager' } };
  const post = '352a5bc8-3356-42bd-8a20-ccbc620856a4';
  const visitor = '2859764a-6149-42df-9d45-c0756faf6d18';
  const entry = '99cc8aa9-04bb-4d28-96a5-4c10eb897ae9';
  async function auth(claims) {
    await db.exec('reset role');
    await db.query("select set_config('test.jwt', $1, false)", [JSON.stringify(claims || {})]);
    await db.exec('set role ' + (claims ? 'authenticated' : 'anon'));
  }
  async function row(sql, args) { return (await db.query(sql, args)).rows[0]; }
  const publish = () => row('select public.rock_winners_publish($1, 1)', [post]);
  const interact = async (action, name = null, message = null, id = null) => (await row(
    'select public.rock_winners_interact($1,$2,$3,$4,$5,$6) as event', [post, action, visitor, name, message, id]
  )).event;
  const manage = action => row('select public.rock_winners_manage_post($1,$2)', [post, action]);
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      grant usage on schema auth to anon, authenticated;
      create function auth.jwt() returns jsonb language sql stable as
        $$select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb$$;
      create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    `);
    for (const script of ['rock-winners.sql', 'rock-finance.sql']) {
      await db.exec(fs.readFileSync('supabase/' + script, 'utf8'));
    }
    for (const user of [owner, finance]) {
      await auth(user);
      assert.equal((await row('select public.rock_winners_can_edit() allowed')).allowed, true);
    }
    await auth(member);
    assert.equal((await row('select public.rock_winners_can_edit() allowed')).allowed, false);
    await assert.rejects(publish, /permission required/);
    await auth(finance);
    const image = 'data:image/png;base64,YQ==';
    const winners = Array.from({length: 4}, (_, i) => ({name: 'Player ' + i, photo: image, logo: image, prize: 'NPR 300'}));
    await row(`insert into public.rock_winner_drafts(id,stage,mode,tournament_name,tournament_date,winners)
      values($1,'results','tdm','TDM 1v1','2026-11-21',$2) returning id`, [post, JSON.stringify(winners)]);
    await auth(null);
    await assert.rejects(row('select * from public.rock_winner_drafts'), /permission denied/);
    await assert.rejects(interact('like'), /Post unavailable/);
    assert.equal(await row('select id from public.rock_winner_posts'), undefined);
    await auth(finance);
    await publish();
    await manage('story');
    await manage('highlight');
    await row("update public.rock_winner_drafts set tournament_name = 'Private edit', revision = 2 where id=$1", [post]);
    await assert.rejects(publish, /Draft changed/);
    await auth(null);
    assert.deepEqual(await row('select tournament_name, story_highlight from public.rock_winner_posts'), { tournament_name: 'TDM 1v1', story_highlight: true });
    await interact('like');
    await interact('like');
    assert.equal((await interact('read')).likes, 1);
    await assert.rejects(interact('comment', 'Guest', 'https://spam.example'), /short name/);
    await interact('comment', 'Guest', 'Well played!');
    await assert.rejects(interact('comment', 'Guest', 'Again'), /temporarily limited/);
    assert.equal((await interact('read')).comments.length, 0);
    await assert.rejects(interact('approve', null, null, 2), /Action unavailable/);
    await assert.rejects(row('select * from public.rock_finance_transactions'), /permission denied/);
    await auth(finance);
    const pending = (await interact('read')).comments[0];
    await interact('approve', null, null, pending.id);
    const saved = await row(`insert into public.rock_finance_transactions
      (id,direction,category,amount,winner_id,status,payment_method,entry_date,approved)
      values($1,'expense','Tournament Winner Prize',900,$2,'pending','eSewa','2026-11-21',true) returning approved`, [entry,post]);
    assert.equal(saved.approved, false);
    assert.equal(await row('update public.rock_finance_settings set require_owner_approval=true returning id'), undefined);
    await auth(member);
    assert.equal(await row('select id from public.rock_finance_transactions'), undefined);
    await auth(owner);
    assert.equal((await row('update public.rock_finance_settings set require_owner_approval=true returning id')).id, true);
    await row('update public.rock_finance_transactions set approved=true where id=$1', [entry]);
    assert.equal((await row('select count(*)::int as edits from public.rock_finance_history')).edits, 2);
    await auth(finance);
    assert.equal((await row("update public.rock_finance_transactions set amount=950 where id=$1 returning approved,revision", [entry])).approved, false);
    await auth(null);
    assert.equal((await interact('read')).comments[0].message, 'Well played!');
    await auth(owner);
    await manage('delete');
    await auth(null);
    assert.equal(await row('select id from public.rock_winner_posts'), undefined);
    await assert.rejects(interact('read'), /Post unavailable/);
    console.log('PASS: editor permissions, draft privacy, publish revisions, stories, guest moderation, and private finance audit.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
