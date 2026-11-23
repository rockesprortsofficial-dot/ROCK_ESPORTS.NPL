const fs=require('node:fs');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
(async()=>{
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      grant usage on schema auth to authenticated, anon, service_role;
      create table auth.users (id uuid primary key, email text not null);
      create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb$$;
      create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
      create table public.rock_meeting_members(id uuid primary key, login_code_hash text, password_hash text, is_active boolean);
      insert into public.rock_meeting_members values ('00000000-0000-0000-0000-000000000001','code','old-password-hash',true);
    `);
    for (const file of ['rock-winners.sql','rock-finance.sql','rock-finance-meeting-login.sql','rock-private-finals.sql','rock-results-only.sql']) {
      await db.exec(fs.readFileSync('supabase/'+file,'utf8'));
    }
    const member='00000000-0000-0000-0000-000000000001', editor='00000000-0000-0000-0000-000000000002',
      session='00000000-0000-0000-0000-000000000003';
    const query=async(sql,args)=>(await db.query(sql,args)).rows[0];
    await query('insert into rock_winners_private.meeting_finance_editor(member_id) values($1)',[member]);
    await db.exec('set role service_role');
    const {identity}=await query('select public.rock_finance_meeting_identity($1) as identity',[member]);
    assert.ok(identity.email.endsWith('.invalid'));
    await db.exec('reset role');
    await query('insert into auth.users values($1,$2)',[editor,identity.email]);
    await db.exec('set role service_role');
    await query('select public.rock_finance_register_meeting_session($1,$2,$3)',[member,editor,session]);
    await db.exec('reset role');
    const allowed=async claims=>{
      await db.exec('reset role');
      await query("select set_config('test.jwt',$1,false)",[JSON.stringify(claims)]);
      await db.exec('set role authenticated');
      return (await query('select public.rock_winners_can_edit() allowed')).allowed;
    };
    const finals='00000000-0000-0000-0000-000000000004', results='00000000-0000-0000-0000-000000000005';
    for (const [id,stage] of [[finals,'finals'],[results,'results']]) {
      await db.query("insert into public.rock_winner_drafts(id,stage,mode,winners) values($1,$2,'tdm','[{},{},{},{}]')",[id,stage]);
      await db.query("insert into public.rock_winner_posts(id,stage,mode,tournament_name,tournament_date,winners) values($1,$2,'tdm','Test',current_date,'[]')",[id,stage]);
    }
    const list=async()=> (await db.query("select stage from public.rock_winner_posts order by stage")).rows.map(row=>row.stage);
    const readPost=id=>query("select public.rock_winners_interact($1,'read') as data",[id]);
    const act=(action,id=null,name=null,body=null)=>query(
      'select public.rock_winners_interact($1,$2,$3,$4,$5,$6) as data',[results,action,member,name,body,id]);
    await db.exec("select set_config('test.jwt','{}',false); set role anon");
    assert.deepEqual(await list(),['results']);
    await assert.rejects(readPost(finals),/Post unavailable/);
    await act('like');
    await act('like');
    assert.equal((await readPost(results)).data.likes,1);
    await act('comment',null,'Guest','This is a test comment.');
    assert.equal((await readPost(results)).data.comments.length,0);
    await allowed({sub:member,session_id:session});
    assert.deepEqual(await list(),['results']);
    await assert.rejects(readPost(finals),/Post unavailable/);
    assert.equal(await allowed({sub:editor,session_id:session}),true);
    assert.deepEqual(await list(),['results']);
    const comment=(await readPost(results)).data.comments[0];
    await assert.rejects(act('delete_comment',comment.id),/Action unavailable/);
    await act('approve',comment.id);
    await db.exec("reset role; select set_config('test.jwt','{}',false); set role anon");
    assert.equal((await readPost(results)).data.comments.length,1);
    await assert.rejects(act('delete_comment',comment.id),/Action unavailable/);
    const owner={sub:member,email:'rockesprorts.official@gmail.com'};
    assert.equal(await allowed(owner),true);
    assert.deepEqual(await list(),['results']);
    await assert.rejects(readPost(finals),/Post unavailable/);
    await act('delete_comment',comment.id);
    assert.equal((await readPost(results)).data.comments.length,0);
    await db.exec("reset role; update public.rock_meeting_members set is_active = false");
    assert.equal(await allowed({sub:editor,session_id:session}),false);
    console.log('PASS: existing Meeting Room password, verified session only, removed finals, guest likes and comments, Owner-only comment deletion, inactive member denied.');
  } finally { await db.close(); }
})().catch(error=>{console.error(error.message,error.position);process.exitCode=1});
