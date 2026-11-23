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
    for (const file of ['rock-winners.sql','rock-finance.sql','rock-finance-meeting-login.sql']) {
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
    assert.equal(await allowed({sub:editor,session_id:session}),true);
    assert.equal(await allowed({sub:editor,session_id:member,app_metadata:{rock_winners_role:'finance_manager'}}),false);
    assert.equal(await allowed({sub:member,email:'rockesprorts.official@gmail.com'}),true);
    await db.exec("reset role; update public.rock_meeting_members set is_active = false");
    assert.equal(await allowed({sub:editor,session_id:session}),false);
    console.log('PASS: existing Meeting Room password, verified session only, Owner access, inactive member denied.');
  } finally { await db.close(); }
})().catch(error=>{console.error(error.message,error.position);process.exitCode=1});
