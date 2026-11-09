// WebAudio (bez plików): wiatr w koronach, ptaki, dzięcioł, sowa nocą, piły, silniki, krótkie efekty.
import {state,camera,VIEW,SETTINGS,cal,active,$} from './core.js';
import {E} from './ents.js';
let A=null;
function init(){
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const ac=new AC(),master=ac.createGain();master.gain.value=0;master.connect(ac.destination);
  const buf=ac.createBuffer(1,ac.sampleRate*1.2,ac.sampleRate),d=buf.getChannelData(0);let s=1999;for(let i=0;i<d.length;i++){s=(Math.imul(s,1664525)+1013904223)|0;d[i]=(s/2147483648)*.5}
  const noise=ac.createBufferSource();noise.buffer=buf;noise.loop=true;noise.start();
  const chain=(nodes)=>{for(let i=0;i<nodes.length-1;i++)nodes[i].connect(nodes[i+1]);return nodes[nodes.length-1]};
  const gain=v=>{const g=ac.createGain();g.gain.value=v;return g};
  const filt=(type,f,q=1)=>{const b=ac.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;return b};
  // wiatr
  const windF=filt('lowpass',380),windG=gain(.02);chain([noise,windF,windG,master]);
  const leafF=filt('highpass',3200),leafG=gain(.004);chain([noise,leafF,leafG,master]);
  // piła łańcuchowa: piła + szum pasmowy
  const sawO=ac.createOscillator();sawO.type='sawtooth';sawO.frequency.value=150;sawO.start();
  const sawF=filt('bandpass',1400,1.4),sawG=gain(0);chain([sawO,sawF,sawG,master]);
  const sawN=filt('bandpass',2600,2),sawNG=gain(0);chain([noise,sawN,sawNG,master]);
  // silniki: niski pomruk (auta, ciągnik) i brzęczenie quada
  const engO=ac.createOscillator();engO.type='sawtooth';engO.frequency.value=48;engO.start();
  const engF=filt('lowpass',260),engG=gain(0);chain([engO,engF,engG,master]);
  const quadO=ac.createOscillator();quadO.type='square';quadO.frequency.value=92;quadO.start();
  const quadF=filt('bandpass',700,1.2),quadG=gain(0);chain([quadO,quadF,quadG,master]);
  A={ac,master,noise,windG,leafG,sawO,sawG,sawNG,engO,engG,quadO,quadG,bird:4,wood:12,owl:20};
 }catch(e){A=null}
}
export function toggleSound(){
 if(!A)init();state.mute=!state.mute;A?.ac.resume();
 $('#soundbtn').textContent=state.mute?'Dźwięk: wył.':'Dźwięk: wł.';
}
export function resumeSound(){A?.ac.resume()}
const inView=(x,y)=>{const cx=camera.x+VIEW.w/2,cy=camera.y+VIEW.h/2,R=Math.max(VIEW.w,VIEW.h)*.75;return Math.max(0,1-Math.hypot(x-cx,y-cy)/R)};
export function updateSound(dt){
 if(!A)return;const {ac,master}=A,t=ac.currentTime,on=active()&&!state.mute;
 master.gain.setTargetAtTime(on?.32*SETTINGS.volume:0,t,.1);if(!on)return;
 const h=cal.hour(),night=cal.night(),se=cal.season();
 A.windG.gain.setTargetAtTime(.016+.012*Math.sin(state.elapsed*.21)**2,t,.4);
 A.leafG.gain.setTargetAtTime(se===3?.001:.003+.003*Math.sin(state.elapsed*.33)**2,t,.4);
 let saw=0;for(const p of E.people)if(p.pose==='saw'&&!p.hidden&&p.kind==='worker')saw=Math.max(saw,inView(p.x,p.y));
 A.sawG.gain.setTargetAtTime(saw*.05,t,.05);A.sawNG.gain.setTargetAtTime(saw*.03,t,.05);
 A.sawO.frequency.setTargetAtTime(140+Math.sin(state.elapsed*7)*14+saw*20,t,.05);
 let eng=0,quad=0;for(const v of E.vehicles){const k=inView(v.pos[0],v.pos[1])*Math.min(1,Math.abs(v.v)/20+.15*(v.parked?0:1));if(v.kind==='quad'||v.kind==='cross')quad=Math.max(quad,k);else if(v.kind!=='bike')eng=Math.max(eng,k)}
 A.engG.gain.setTargetAtTime(eng*.07,t,.15);A.quadG.gain.setTargetAtTime(quad*.035,t,.1);A.quadO.frequency.setTargetAtTime(88+quad*40+Math.sin(state.elapsed*5)*6,t,.08);
 A.bird-=dt;A.wood-=dt;A.owl-=dt;
 if(!night&&se!==3&&A.bird<=0){A.bird=2+Math.random()*5;chirp()}
 if(!night&&A.wood<=0){A.wood=14+Math.random()*20;drum()}
 if(night&&A.owl<=0){A.owl=12+Math.random()*16;owl()}
}
function tone(type,f0,f1,a,d,at=0){const {ac,master}=A,t=ac.currentTime+at,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+d);g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime(a,t+.01);g.gain.exponentialRampToValueAtTime(.00001,t+d);o.connect(g).connect(master);o.start(t);o.stop(t+d+.03)}
function burst(f,q,a,d,at=0){const {ac,master,noise}=A,t=ac.currentTime+at,b=ac.createBiquadFilter(),g=ac.createGain();b.type='bandpass';b.frequency.value=f;b.Q.value=q;g.gain.setValueAtTime(.00001,t);g.gain.linearRampToValueAtTime(a,t+.01);g.gain.exponentialRampToValueAtTime(.00001,t+d);noise.connect(b).connect(g).connect(A.master);setTimeout(()=>{try{b.disconnect()}catch(e){}},(d+at)*1000+200)}
function chirp(){const f=1800+Math.random()*1400,n=2+Math.floor(Math.random()*4);for(let i=0;i<n;i++)tone('sine',f,f*(1.2+Math.random()*.3),.01,.09,i*.13)}
function drum(){for(let i=0;i<14;i++)burst(900,4,.05*(1-i/16),.03,i*.055)}
function owl(){tone('sine',380,340,.02,.35);tone('sine',390,330,.018,.6,.55)}
export function sfx(k){
 if(!A||state.mute)return;
 if(k==='crash'){burst(180,.7,.22,1.1);burst(600,.9,.12,.6,.05);tone('triangle',70,40,.18,.5)}
 else if(k==='creak')tone('sawtooth',220,90,.03,1.1);
 else if(k==='coin'){tone('sine',880,880,.06,.14);tone('sine',1320,1320,.06,.2,.1)}
 else if(k==='ping'){tone('triangle',660,660,.05,.15);tone('triangle',990,990,.05,.22,.12)}
 else if(k==='mark')tone('square',520,700,.025,.06);
 else if(k==='unmark')tone('square',600,380,.02,.06);
 else if(k==='clunk'){tone('square',130,48,.12,.14);tone('triangle',70,40,.15,.2)}
 else if(k==='winch')tone('sawtooth',90,140,.03,.9);
 else if(k==='log')burst(260,1.2,.08,.18);
 else if(k==='shot'){burst(900,.5,.25,.35);burst(200,.6,.15,.9,.05)}
 else if(k==='roar'){roar()}
 else if(k==='door'){tone('triangle',300,240,.04,.12);tone('triangle',240,200,.03,.12,.12)}
}
// Ryk byka na rykowisku: niski, chrapliwy, opadający ton z szumem.
function roar(){
 const {ac,master}=A,t=ac.currentTime;
 for(const [f0,f1,a,d,at] of [[120,180,.05,.9,0],[180,95,.06,1.6,.85]]){
  const o=ac.createOscillator(),g=ac.createGain(),b=ac.createBiquadFilter();o.type='sawtooth';b.type='lowpass';b.frequency.value=520;
  o.frequency.setValueAtTime(f0,t+at);o.frequency.linearRampToValueAtTime(f1,t+at+d);g.gain.setValueAtTime(.00001,t+at);g.gain.linearRampToValueAtTime(a,t+at+.15);g.gain.exponentialRampToValueAtTime(.00001,t+at+d);
  o.connect(b).connect(g).connect(master);o.start(t+at);o.stop(t+at+d+.05)}
 burst(300,.8,.03,2.2,.1);
}
