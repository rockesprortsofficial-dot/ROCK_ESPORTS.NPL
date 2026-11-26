// Pure TDM recovery state machine. Isolated from production.
export function advance(state, action, payload={}, model, now=new Date().toISOString()){
 const s=JSON.parse(JSON.stringify(state)), n=s.participants.length;
 const fail=m=>{throw new Error(m)};
 const event=(type,extra={})=>s.events.push({at:now,type,...extra});
 const drawn=id=>s.draws.some(d=>d.matches.includes(id));
 function next(){
  if(s.draws.some(d=>d.matches.some(id=>!s.results[id]&&!(id==="GF"&&!s.results.FP))))return false;
  const m=model(s);
  const ids=m.matches.filter(x=>!drawn(x.id)&&!s.results[x.id]&&(x.id!=="GF"||s.results.FP)&&m.pair(x).every(Number.isInteger)).map(x=>x.id);
  if(!ids.length)return false;
  s.draws.push({at:now,matches:ids});event("ROUND DRAW",{matches:ids});return true;
 }
 if(s.archivedAt)fail("Archived tournament");
 if(action==="reveal"||action==="reveal_all"){
  if(s.revealed>=n)fail("All chits are open");
  s.revealed=action==="reveal_all"?n:s.revealed+1;event("CHIT REVEAL");
 }else if(action==="draw"){
  if(!next())fail("Finish current matches first");
 }else if(action==="confirm"){
  const m=model(s), match=m.matches.find(x=>x.id===payload.match);
  if(!match||s.results[match.id]||!drawn(match.id)||(match.id==="GF"&&!s.results.FP))fail("Match not ready");
  const pair=m.pair(match), w=payload.winner, scores=payload.scores;
  if(!pair.every(Number.isInteger)||!pair.includes(w))fail("Invalid winner");
  if(!Array.isArray(scores)||scores.length!==2||scores.some(x=>!Number.isInteger(x)||x<0||x>999)||scores[pair.indexOf(w)]<=scores[1-pair.indexOf(w)])fail("Invalid scores");
  s.results[match.id]={winner:w,scores,at:now};
  event("MATCH CONFIRMED",{match:match.id,winner:w,loser:pair.find(x=>x!==w),scores});next();
 }else fail("Unsupported recovery action");
 return s;
}
