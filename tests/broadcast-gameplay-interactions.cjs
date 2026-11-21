const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');

(async()=>{
 const db=new PGlite();
 try{
  const owner='11111111-1111-1111-1111-111111111111';
  const visitor='22222222-2222-2222-2222-222222222222';
  const other='33333333-3333-3333-3333-333333333333';
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create publication supabase_realtime');
  await db.exec(readFileSync('supabase/rock-broadcast-social.sql','utf8'));
  await db.exec(readFileSync('supabase/rock-gameplay-interactions.sql','utf8'));
  await db.query('insert into auth.users values($1)',[owner]);
  const session=async mode=>(await db.query("insert into rock_broadcast_social_sessions(mode,owner_id,invite_hash,live) values($1,$2,repeat('a',64),true) returning id",[mode,owner])).rows[0].id;
  const id=await session('gameplay'),watchparty=await session('watchparty');
  const invoke=async(action,{session=id,who=visitor,name=null,message=null,event=null,moderator=null}={})=>(await db.query(
   'select rock_gameplay_interact($1,$2,$3,$4,$5,$6,$7) as result',
   [session,action,who,name,message,event,moderator])).rows[0].result;
  await db.exec('set role anon');
  await assert.rejects(invoke('like'));
  await assert.rejects(db.query('select * from rock_gameplay_events'));
  await assert.rejects(db.query('update rock_gameplay_feed set revision=0'));
  await db.exec('reset role;set role service_role');
  assert.match((await invoke('read',{session:watchparty})).error,/ended/);
  assert.deepEqual(await invoke('like'),{ok:true});
  assert.deepEqual(await invoke('like'),{ok:true});
  assert.equal((await invoke('read')).likes,1);
  assert.match((await invoke('comment',{name:'Guest',message:'a'.repeat(241)})).error,/short name/);
  assert.deepEqual(await invoke('comment',{name:'Guest',message:'<b>Test</b>'}),{ok:true});
  assert.match((await invoke('comment',{name:'Guest',message:'Again'})).error,/moment/);
  assert.deepEqual((await invoke('read')).comments,[]);
  const pending=(await invoke('read',{moderator:owner})).comments[0];
  assert.equal(pending.state,'pending');
  assert.match((await invoke('approve',{event:pending.id,moderator:other})).error,/unavailable/);
  await invoke('approve',{event:pending.id,moderator:owner});
  assert.equal((await invoke('read')).comment_count,1);
  assert.equal((await invoke('read')).comments[0].message,'<b>Test</b>');
  assert.equal('visitor' in (await invoke('read')).comments[0],false);
  await invoke('block',{event:pending.id,moderator:owner});
  assert.equal((await invoke('read')).comment_count,0);
  assert.match((await invoke('comment',{name:'Guest',message:'Blocked'})).error,/blocked/);
  await db.query('update rock_broadcast_social_sessions set live=false where id=$1',[id]);
  assert.match((await invoke('like',{who:other})).error,/offline/);
  await db.exec('reset role;set role anon');
  assert.deepEqual(Object.keys((await db.query('select * from rock_gameplay_feed')).rows[0]).sort(),['revision','session_id']);
  console.log('PASS: gameplay-only interactions, deduplicated likes, validation, cooldown, approval, blocking and private identities.');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
