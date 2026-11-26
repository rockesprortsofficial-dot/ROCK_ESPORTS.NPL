// Isolated Firebase recovery transport. Not enabled on the production site.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
const config = globalThis.ROCK_FIREBASE_CONFIG;
if (!config || config.projectId !== 'rock-esports' || !config.apiKey) throw new Error('Firebase configuration required');
const ownerUid="wKulCeUqaNQshYcPCJTuQpRGSP73";
const app=getApps().find(a=>a.name==="rock-tdm-recovery")||initializeApp(config,"rock-tdm-recovery");
const auth=getAuth(app),db=getFirestore(app);
export const isOwner=()=>auth.currentUser?.uid===ownerUid;
export const observeOwner=fn=>onAuthStateChanged(auth,()=>fn(isOwner()));
export async function login(email,password){await signInWithEmailAndPassword(auth,email,password);if(!isOwner()){await signOut(auth);throw Error("Owner account required");}}
export const logout=()=>signOut(auth);
function requireOwner(){if(!isOwner())throw Error("Owner login required");}
const ids=new Set(["tdm_group_division","tdm_live_draw"]);
function publicRef(id){if(!ids.has(id))throw Error("Unknown tournament document");return doc(db,"public_tournaments",id);}
export async function readPublic(id){const snap=await getDoc(publicRef(id));return snap.exists()?snap.data():null;}
export async function readRegistrations(){requireOwner();const snap=await getDocs(collection(db,"tournament_registrations"));return snap.docs.filter(d=>d.id!=="_setup_test").map(d=>({id:d.id,...d.data()}));}
export async function checkPrivateAccess(){requireOwner();const s=await getDoc(doc(db,"tournament_registrations","_setup_test"));return s.exists()&&s.data().status==="ready";}
export async function checkPublicAccess(){const [group,draw]=await Promise.all([readPublic("tdm_group_division"),readPublic("tdm_live_draw")]);return {group:!!group,draw:!!draw};}
// No tournament mutation is exposed until the existing SQL state machine is ported and verified.

export async function importRegistrations(records){
 requireOwner();
 if(!Array.isArray(records))throw Error("Expected registration array");
 for(const row of records){
  if(!row.id||!(/^[a-zA-Z0-9_-]{1,128}$/).test(String(row.id))||row.id==="_setup_test")throw Error("Invalid registration ID");
 }
 for(const row of records)await setDoc(doc(db,"tournament_registrations",String(row.id)),row,{merge:true});
 return records.length;
}
export async function savePublicSnapshot(id,expectedRevision,snapshot){
 requireOwner();
 if(!snapshot||typeof snapshot.title!=="string"||!Array.isArray(snapshot.matches))throw Error("Invalid public snapshot");
 const safe={title:snapshot.title,matches:snapshot.matches.map(m=>({id:String(m.id),playerA:String(m.playerA||""),playerB:String(m.playerB||""),winner:String(m.winner||""),scoreA:Number(m.scoreA||0),scoreB:Number(m.scoreB||0)}))};
 const ref=publicRef(id);
 return runTransaction(db,async tx=>{
  const old=await tx.get(ref), revision=old.data()?.revision??0;
  if(revision!==expectedRevision)throw Error("Refresh before saving");
  tx.set(ref,{...safe,revision:revision+1,updatedAt:serverTimestamp()},{merge:true});
  return revision+1;
 });
}
