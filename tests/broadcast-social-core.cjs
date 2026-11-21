const assert=require('node:assert/strict'),{layout,videoRect}=require('../rock-broadcast-social-layout.js'),{grant,publicStatus}=require('../supabase/functions/rock-broadcast-social/policy.ts');
for(const n of [1,2,10,11,25,50,100,200]){const g=layout(n);assert.equal(g.tiles.length,n);assert.ok(g.game[3]>=800);for(let i=0;i<n;i++){const a=g.tiles[i];assert.ok(a[0]>=160&&a[1]>=900&&a[0]+a[2]<=1920&&a[1]+a[3]<=1080);for(let j=0;j<i;j++){const b=g.tiles[j];assert.ok(a[0]+a[2]<=b[0]||b[0]+b[2]<=a[0]||a[1]+a[3]<=b[1]||b[1]+b[3]<=a[1]);}}}
assert.equal(layout(12).tiles.length,12);assert.equal(layout(2,'gameplay').tiles.length,2);const id='11111111-1111-1111-1111-111111111111';assert.equal(grant('viewer',id).canPublish,false);assert.deepEqual(grant('member',id).canPublishSources,[1,2]);assert.notEqual(grant('viewer',id).room,grant('member',id).room);assert.deepEqual(publicStatus({id,mode:'watchparty',invite_hash:'SECRET',blocked:['PRIVATE'],owner_id:'OWNER',live:false,join_open:true}),{id,mode:'watchparty',live:false,join_open:true});
assert.deepEqual(videoRect([0,0,200,100],100,100),[50,0,100,100]);
assert.deepEqual(videoRect([0,0,200,100],100,100,true),[0,-50,200,200]);
assert.deepEqual(videoRect([10,20,200,100],400,100),[10,45,200,50]);
assert.deepEqual(videoRect([0,0,200,100],200,100,true,1.5),[-50,-25,300,150]);
console.log('PASS: adaptive 1–200 participant layout, no overlap/game obstruction, isolated viewer/member grants and public status privacy. Capacity is configured separately by the server.');
