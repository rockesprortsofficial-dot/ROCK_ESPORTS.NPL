const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {stripTypeScriptTypes} = require("node:module");
const {join} = require("node:path");
const {test} = require("node:test");
const {runInNewContext} = require("node:vm");

const source = name => readFileSync(join(__dirname,name), "utf8");
const room = "10000000-0000-4000-8000-000000000001";
const id = "10000000-0000-4000-8000-000000000002";
const sender = "10000000-0000-4000-8000-000000000003";
const scope = "https://example.com/site/";

test("CONNECT notifications open the right room in a running or closed app", async () => {
  const handlers = new Map(), shown = [], opened = [], posts = [];
  let windows = [];
  runInNewContext(source("../service-worker.js"), {
    URL, self: {
      addEventListener: (name, handler) => handlers.set(name, handler),
      registration: {scope, showNotification: async (title, options) => shown.push({title, ...options})},
      clients: {matchAll: async () => windows, openWindow: async url => opened.push(url)}
    }
  });
  async function dispatch(name, data) {
    let work;
    handlers.get(name)({...data, waitUntil: promise => { work = promise; }});
    await work;
  }
  await dispatch("push", {data:{json:()=>({title:"CONNECT",data:{audience:"connect",kind:"call",room_id:room,call_id:id,expires_at:"2000-01-01"}})}});
  assert.match(shown[0].title, /expired/i);
  assert.equal(shown[0].silent, true);
  await dispatch("notificationclick", {notification:{data:shown[0].data,close(){}}});
  const url = new URL(opened[0]);
  assert.equal(url.hash, "#connect");
  assert.equal(url.searchParams.get("connect_room"), room);
  assert.equal(url.searchParams.get("connect_call"), id);

  windows = [
    {url:scope+"meeting-room.html", focus:()=>assert.fail("Meeting Room received CONNECT route")},
    {url:scope+"index.html", focus:async()=>{}, postMessage:message=>posts.push(message)}
  ];
  await dispatch("push", {data:{json:()=>({data:{audience:"connect",kind:"message",room_id:room,message_id:id}})}});
  await dispatch("notificationclick", {notification:{data:shown[1].data,close(){}}});
  assert.equal(posts[0].type, "ROCK_CONNECT_OPEN");
  assert.equal(posts[0].room_id, room);
  assert.equal(posts[0].call_id, undefined);
  assert.equal(opened.length, 1);
});

test("trusted CONNECT dispatch fans out and drops expired call invites", async () => {
  const push = [], queries = [];
  let expired = false, serve;
  const endpoints = ["https://fcm.googleapis.com/a","https://web.push.apple.com/b"];
  const env = {
    SUPABASE_URL:"https://test.supabase.co", SUPABASE_ANON_KEY:"test", SUPABASE_SERVICE_ROLE_KEY:"test",
    ROCK_CONNECT_PUSH_SECRET:"test-hook-secret", VAPID_PRIVATE_KEY:Buffer.alloc(32,1).toString("base64url")
  };
  const db = {
    from(table) {
      return {select:()=>({eq:()=>({maybeSingle:async()=>({data:table==="rock_connect_rooms"
        ? {kind:"group"} : {id,room_id:room,initiated_by:sender,sender_id:sender,status:"ringing",
          mode:"audio",created_at:new Date(Date.now()-(expired?70000:0)).toISOString(),expires_at:new Date(Date.now()+60000).toISOString()}})})})};
    },
    async rpc(name, args) {
      queries.push({name,args});
      return {data:endpoints.map(endpoint=>({endpoint,p256dh:"key",auth:"auth"}))};
    }
  };
  const edge = source("../supabase/functions/rock-app-notifications/index.ts").replace(/^import .*;\r?$/gm,"");
  runInNewContext(stripTypeScriptTypes(edge), {
    Deno:{env:{get:key=>env[key]},serve:handler=>{serve=handler;}},
    createClient:()=>db, createECDH:require("node:crypto").createECDH,
    webpush:{setVapidDetails(){},sendNotification:async(sub,payload,options)=>push.push({sub,payload:JSON.parse(payload),options})},
    Request,Response,URL,TextEncoder,Buffer,crypto,console
  });
  const send = (secret, kind="call") => serve(new Request("https://example.com",{
    method:"POST",headers:{"x-rock-connect-secret":secret},body:JSON.stringify({action:"connect_dispatch",kind,id})
  }));
  assert.equal((await send("wrong")).status,403);
  assert.equal(queries.length,0);
  assert.equal((await (await send(env.ROCK_CONNECT_PUSH_SECRET)).json()).sent,2);
  assert.equal(queries[0].args.p_sender,sender);
  assert.equal(queries[0].args.p_room,room);
  assert.deepEqual(push.map(item=>item.sub.endpoint),endpoints);
  assert.equal(push[0].payload.data.call_id,id);
  assert.equal(push[0].payload.data.audience,"connect");
  assert.equal(push[0].options.urgency,"high");
  expired = true;
  assert.equal((await (await send(env.ROCK_CONNECT_PUSH_SECRET)).json()).sent,0);
  expired = false;
  assert.equal((await (await send(env.ROCK_CONNECT_PUSH_SECRET,"message")).json()).sent,2);
  assert.equal(push[2].payload.data.message_id,id);
});
