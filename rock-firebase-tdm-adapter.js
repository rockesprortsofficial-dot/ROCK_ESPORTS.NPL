// TDM state adapter. Uses a separate recovery document; no production activation.
import {advance} from "./rock-firebase-tdm-state.js";
import {isOwner,readPublic,savePublicSnapshot} from "./rock-firebase-recovery.js";
export function projectMatches(state,model){
 const m=model(state);
 return {title:state.title,matches:m.matches.filter(x=>state.draws.some(d=>d.matches.includes(x.id))).map(x=>{
  const [a,b]=m.pair(x),r=state.results[x.id];
  return {id:x.id,playerA:state.participants[a]?.name||"",playerB:state.participants[b]?.name||"",winner:r?state.participants[r.winner]?.name||"":"",scoreA:r?.scores[0]||0,scoreB:r?.scores[1]||0};
 })};
}
export async function publishMatchView(state,model){
 if(!isOwner())throw Error("Owner login required");
 const snapshot=projectMatches(state,model);
 const ids=["tdm_live_draw","tdm_group_division"];
 const revisions=await Promise.all(ids.map(async id=>(await readPublic(id))?.revision??0));
 // Independent writes: report failure rather than implying atomic publication.
 const results=await Promise.allSettled(ids.map((id,i)=>savePublicSnapshot(id,revisions[i],snapshot)));
 if(results.some(r=>r.status==="rejected"))throw Error("Publication incomplete; refresh both documents before retrying");
 return results.map(r=>r.value);
}
export function nextState(state,action,payload,model){return advance(state,action,payload,model);}
