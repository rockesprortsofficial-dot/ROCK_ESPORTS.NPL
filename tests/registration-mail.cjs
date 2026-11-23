const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { runInNewContext } = require('node:vm');
const { PGlite } = require('@electric-sql/pglite');

test('registration recipients are live, deduplicated and snapshotted for resumable sends', async () => {
  const db = new PGlite();
  const editor = '8164f280-5f3a-46b4-8bcc-c674a1b85cb4';
  const campaign = '10d754ab-fa07-4c18-b693-6600d0f3d7c4';
  const other = 'ef51b43f-104a-47ac-b426-a74bf04590d3';
  const query = async (sql, args) => (await db.query(sql, args)).rows[0]?.value;
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.rock_esports_registrations(email text);
      insert into public.rock_esports_registrations values(' Player@example.test '),('player@example.test'),('invalid'),(null);
      insert into public.rock_esports_registrations select format('player%s@example.test',n) from generate_series(1,100) n;
    `);
    await db.exec(fs.readFileSync('supabase/rock-registration-mail.sql','utf8'));
    await db.exec('set role authenticated');
    await assert.rejects(query('select public.rock_registration_mail_status($1) as value',[editor]), /permission denied/);
    await db.exec('reset role; set role service_role');
    const batch = (id=campaign) => query('select public.rock_registration_mail_batch($1,$2,$3,$4,$5) as value',[id,editor,'Subject','Notice','mail@example.test']);
    const ack = (offset, outcome) => query('select public.rock_registration_mail_ack($1,$2,$3,$4) as value',[campaign,editor,offset,outcome]);
    const status = () => query('select public.rock_registration_mail_status($1) as value',[editor]);
    const first = await batch();
    assert.equal(first.total,101);
    assert.equal(first.processed,1);
    assert.match(first.recipient,/@example.test$/);
    await assert.rejects(batch(), /already in progress/);
    await assert.rejects(batch(other), /existing send/);
    await db.exec("reset role; insert into public.rock_esports_registrations values('new@example.test'); set role service_role");
    assert.equal((await status()).total,102);
    assert.deepEqual(await ack(1,'sent'),{sent:1,processed:1,total:101});
    assert.deepEqual(await ack(1,'sent'),{sent:1,processed:1,total:101});
    const second = await batch();
    assert.notEqual(second.recipient,first.recipient);
    assert.equal(second.total,101);
    assert.equal((await ack(2,'retry')).processed,1);
    assert.equal((await batch()).recipient,second.recipient);
    assert.equal((await ack(2,'uncertain')).sent,1);
    assert.notEqual((await batch()).recipient,second.recipient);
  } finally { await db.close(); }
});

test('only the verified Owner can send, and each player gets an isolated message', async () => {
  const id = '10d754ab-fa07-4c18-b693-6600d0f3d7c4';
  const calls = [];
  let serve;
  let configured = false, fail = false;
  const source = fs.readFileSync('supabase/functions/rock-registration-mail/index.ts','utf8').replace(/^import [^\n]+\n/gm,'');
  runInNewContext(source,{
    URL, URLSearchParams, Request, Response, AbortSignal, Buffer,
    Deno:{env:{get:key=>key.startsWith('ROCK_GMAIL_') ? configured?'fixture':undefined : 'configured'},serve:f=>{serve=f;}},
    createClient:()=>({
      auth:{getUser:async token=>({data:{user:{id:'owner',email_confirmed_at:'today',email:token==='owner'?'rockesprorts.official@gmail.com':'member@example.test'}}})},
      rpc:async name=>({data:name.endsWith('_batch')
        ?{subject:'Results',message:'Tournament update',sent:0,processed:1,total:2,recipient:'a@example.test'}
        :{sent:1,processed:1,total:2}})
    }),
    fetch:async (url, options)=>{
      if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'gmail-auth',expires_in:3600});
      calls.push({url,options});
      return fail ? new Response('',{status:429}) : Response.json({id:'gmail-message'});
    }
  });
  const send = token=>serve(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({action:'send',id})}));
  assert.equal((await send('member')).status,403);
  assert.equal((await send('owner')).status,503);
  assert.equal(calls.length,0);
  configured = true;
  fail = true;
  assert.equal((await send('owner')).status,502);
  fail = false;
  assert.equal((await (await send('owner')).json()).sent,1);
  assert.match(calls[1].url,/users\/rockesprorts.official%40gmail.com\/messages\/send$/);
  const raw = Buffer.from(JSON.parse(calls[1].options.body).raw,'base64url').toString('utf8');
  assert.match(raw,/From: ROCK ESPORTS <rockesprorts.official@gmail.com>/);
  assert.match(raw,/To: a@example.test/);
  assert.doesNotMatch(raw,/b@example.test/);
});
