// Isolated Firebase recovery transport. Not enabled on the production site.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
const config={apiKey:"AIzaSyANZojqboxn6OwSd8hVQqGdsELQ_J46c-k",authDomain:"rock-esports.firebaseapp.com",projectId:"rock-esports",storageBucket:"rock-esports.firebasestorage.app",messagingSenderId:"429933819916",appId:"1:429933819916:web:6487767fbb5b12e5aed629"};
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
