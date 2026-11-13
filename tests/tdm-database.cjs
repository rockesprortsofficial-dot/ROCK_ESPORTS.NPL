/* Real PostgreSQL execution via PGlite; never connects to the production project. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.TDM_PGLITE_PATH||'../../tdm-test-runtime/node_modules/@electric-sql/pglite');
const {graph,model,groupCount}=require('../rock-tdm.js');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email',current_setting('test.email',true)) $$;
 grant usage on schema auth to anon,authenticated; grant execute on all functions in schema auth to anon,authenticated;
 create table public.rock_esports_live_draw(id text primary key,state jsonb,updated_at timestamptz default now());
 insert into public.rock_esports_live_draw values ('rock-esports-main','{"stage":"tdmGroups","tdmFormat":2,"participants":["Legacy"],"history":["old result"],"tdmPlayers":[{"photo":"https://example.org/old.jpg"}]}');`);
 await db.exec('alter default privileges grant execute on functions to anon,authenticated');
 const sql=fs.readFileSync(require('node:path').join(__dirname,'../supabase/rock-tdm-setup.sql'),'utf8');
 await db.exec(sql);await db.exec(sql); // migration is safe to run twice
 const query=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const scalar=async(sql,args=[])=>Object.values((await query(sql,args))[0])[0];
 const rpc=async(id,rev,action,payload={})=>scalar('select rock_tdm_owner($1,$2,$3,$4::jsonb)',[id,rev,action,JSON.stringify(payload)]);
 const fail=async(promise,pattern)=>assert.rejects(promise,pattern);
 const auth=async(email='rockesprorts.official@gmail.com')=>{await query("select set_config('test.uid','11111111-1111-1111-1111-111111111111',false),set_config('test.email',$1,false)",[email]);};
 await db.exec('set role anon');
 await scalar('select rock_tdm_list()');
 await fail(query('select * from rock_tdm_tournaments'),/permission denied/);
 await fail(rpc(null,0,'create'),/permission denied/);
 await db.exec('reset role;set role authenticated');
 await auth('intruder@example.org');await fail(rpc(null,0,'create'),/Owner login required/);
 await auth();
 let totals=[];
 for(const n of [8,16,24,32]){
  for(let run=0;run<3;run++){
   const payload={title:`Test ${n} ${run}`,participants:Array.from({length:n},(_,i)=>({name:`Player ${i}`,photo:'https://example.org/p.jpg',logo:'https://example.org/l.jpg'})),prizes:['','','',''],scheduledAt:null};
   let t=await rpc(null,0,'create',payload),original=t.state.createdAt;await fail(rpc(t.id,t.revision,'delete',{confirmation:t.id}),/Finish all tournament/);await fail(rpc(t.id,t.revision,'archive',{confirmation:t.id}),/Finish all tournament/);
   assert.equal(groupCount(n),n===8?4:n/4);
   await db.exec('reset role');const sqlGraph=await scalar('select rock_tdm_graph($1,$2::jsonb)',[n,JSON.stringify(t.state.order)]);
   await db.exec('set role authenticated');assert.deepEqual(t.state.bracket,sqlGraph,'complete graph is persisted');assert.deepEqual(sqlGraph,graph(n,t.state.order).matches,'browser and server graph must agree');
   await fail(rpc(t.id,t.revision,'confirm',{match:'M1',winner:0,scores:[10,1]}),/not ready/);
   await fail(rpc(t.id,t.revision,'draw'),/Finish current round/);
   for(let i=0;i<n;i++)t=await rpc(t.id,t.revision,'reveal');
   await fail(rpc(t.id,t.revision,'reveal'),/All chits/);
   const initial=model(t.state).initial;
   const groupSize=n===8?2:4;
   for(const m of initial){const [a,b]=model(t.state).pair(m);assert.equal(Math.floor(a/groupSize),Math.floor(b/groupSize));}
   const graphSize=model(t.state).matches.length;let played=0;
   while(Object.keys(t.state.results).length<graphSize){
    let progress=false;
    for(const m of model(t.state).matches){
     if(t.state.results[m.id]||!t.state.draws.some(d=>d.matches.includes(m.id)))continue;
     const pair=model(t.state).pair(m);if(!pair.every(Number.isInteger))continue;
     const winner=pair[(played+run)%2],scores=winner===pair[0]?[10,7]:[7,10],rev=t.revision;
     await fail(rpc(t.id,rev,'confirm',{match:m.id,winner}),/Two scores/);await fail(rpc(t.id,rev,'confirm',{match:m.id,winner:n+1,scores}),/invalid winner/);
     await fail(rpc(t.id,rev,'confirm',{match:m.id,winner,scores:[7,7]}),/higher score/);
     t=await rpc(t.id,rev,'confirm',{match:m.id,winner,scores});
     assert.equal(t.state.createdAt,original);played++;progress=true;if(played===2)await fail(rpc(t.id,t.revision,'draw'),/Finish current round/);
     await fail(rpc(t.id,rev,'confirm',{match:m.id,winner,scores}),/Another session/);
     await fail(rpc(t.id,t.revision,'confirm',{match:m.id,winner,scores}),/immutable/);
    }
    if(Object.keys(t.state.results).length===graphSize)break;
    const previous=structuredClone(t.state.draws),oldResults=structuredClone(t.state.results);
    t=await rpc(t.id,t.revision,'draw');
    assert.deepEqual(t.state.draws.slice(0,-1),previous);assert.deepEqual(t.state.results,oldResults);
    assert.ok(progress||t.state.draws.length>1,'must always make progress');
   }
   const m=model(t.state);assert.equal(played,n*1.5);assert.equal(new Set(m.places).size,4);assert.ok(m.places.every(Number.isInteger));
   assert.equal(m.out.length,n-4);assert.equal(new Set([...m.out.map(x=>x.player),...m.places]).size,n,'every player retained exactly once in final placements or eliminated history');
   const initialLosers=new Set(m.initial.map(x=>m.resolve({match:x.id,out:'lose'})));
   assert.ok(!initialLosers.has(m.places[2]),'third place is decided by last winner-route losers');assert.ok(!initialLosers.has(m.places[0])&&!initialLosers.has(m.places[1]));const fp=m.matches.find(x=>x.id==='FP');assert.equal(m.resolve(fp.a),m.resolve({match:'TP',out:'lose'}));assert.ok(initialLosers.has(m.resolve(fp.b)),'loser route champion gets fourth-place rematch');
   assert.equal(t.state.events.filter(x=>x.type==='MATCH CONFIRMED').length,n*1.5);
   assert.ok(t.state.participants.every(x=>x.photo&&x.logo));
   await fail(rpc(t.id,t.revision,'draw'),/No new round/);
   await fail(rpc(t.id,t.revision,'delete',{confirmation:'wrong'}),/confirmation/);
   await auth('intruder@example.org');await fail(rpc(t.id,t.revision,'delete',{confirmation:t.id}),/Owner login/);await auth();
   if(run===0){const results=structuredClone(t.state.results),draws=structuredClone(t.state.draws);await fail(rpc(t.id,t.revision,'archive',{confirmation:'wrong'}),/confirmation/);t=await rpc(t.id,t.revision,'archive',{confirmation:t.id});assert.ok(t.state.archivedAt);assert.deepEqual(t.state.results,results);assert.deepEqual(t.state.draws,draws);assert.equal(t.state.createdAt,original);await fail(rpc(t.id,t.revision,'archive',{confirmation:t.id}),/already reset/);}
   totals.push({players:n,matches:played,podium:m.places,history:t.state.events.length});
  }
 }
 const list=await scalar('select rock_tdm_list()');assert.equal(list.length,12,'new tournament never replaces an old tournament');
 const legacy=await scalar('select rock_tdm_legacy_list()');assert.equal(legacy.length,1);assert.deepEqual(legacy[0].state.history,['old result']);
 const scheduled=await rpc(null,0,'create',{title:'Scheduled',participants:Array.from({length:8},(_,i)=>({name:'P'+i})),prizes:['','','',''],scheduledAt:new Date(Date.now()+100000).toISOString()});
 await db.exec('reset role');await query("update rock_tdm_tournaments set state=jsonb_set(state,'{scheduledAt}',to_jsonb('2000-01-01T00:00:00Z'::text)) where id=$1",[scheduled.id]);
 await db.exec('set role anon');let scheduledPublic=(await scalar('select rock_tdm_list()')).find(t=>t.id===scheduled.id);assert.equal(scheduledPublic.state.revealed,8);await scalar('select rock_tdm_list()');scheduledPublic=(await scalar('select rock_tdm_list()')).find(t=>t.id===scheduled.id);assert.equal(scheduledPublic.state.events.filter(e=>e.type==='SCHEDULED REVEAL').length,1);
 await fail(query('update rock_tdm_tournaments set revision=0'),/permission denied/);
 await db.exec('reset role;set role authenticated');await auth();
 const doomed=list[0];await rpc(doomed.id,doomed.revision,'delete',{confirmation:doomed.id});assert.equal((await scalar('select rock_tdm_list()')).length,12);
 const deleteLegacy=(id,confirmation=id)=>scalar('select rock_tdm_delete_legacy($1,$2)',[id,confirmation]);
 await db.exec('reset role;set role anon');await fail(deleteLegacy(legacy[0].id),/permission denied/);
 await db.exec('reset role;set role authenticated');await auth('intruder@example.org');await fail(deleteLegacy(legacy[0].id),/Owner login/);await auth();
 await fail(deleteLegacy(legacy[0].id,'wrong'),/confirmation/);const removed=await deleteLegacy(legacy[0].id);assert.equal(removed.currentReset,true);assert.equal((await scalar('select rock_tdm_legacy_list()')).length,0);
 await db.exec('reset role');assert.equal(await scalar("select state->>'stage' from rock_esports_live_draw where id='rock-esports-main'"),'');
 await query('insert into rock_tdm_legacy_snapshots(id,state) values($1,$2::jsonb)',[legacy[0].id,JSON.stringify(legacy[0].state)]);await query("update rock_esports_live_draw set state='{\"stage\":\"round1\",\"participants\":[]}'::jsonb");await db.exec('set role authenticated');const protectedDraw=await deleteLegacy(legacy[0].id);assert.equal(protectedDraw.currentReset,false);await db.exec('reset role');assert.equal(await scalar("select state->>'stage' from rock_esports_live_draw where id='rock-esports-main'"),'round1');
 console.log(JSON.stringify({passed:true,tournaments:totals,permissions:'anonymous and non-owner writes blocked; owner-only confirmed deletion',history:'immutable results, original dates, prior draws, media and legacy snapshot retained',scheduled:'server reveal exactly once'},null,2));
 await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
