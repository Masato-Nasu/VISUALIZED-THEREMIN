// app.js — KB screen + AERIAL-like audio + two-finger overlay toggle
let audioCtx, master, thereminGain, osc, analyser, data, dest, rec, recChunks=[];
let bgmAudio = null;
let started=false;
const P = { freqMin:120, freqMax:1800, gainMin:0.0, gainMax:0.85, smooth:0.12, chimeGain:0.7 };
const S = { fT:440, fC:440, gT:0, gC:0, pointer:false, px:0.5, py:0.5, lastShake:0, lastToggle:0 };

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function lerp(a,b,t){ return a+(b-a)*t; }
function map(v,a1,a2,b1,b2){ const t=(v-a1)/(a2-a1); return b1+(b2-b1)*t; }

async function boot(){
  if(started) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  master = audioCtx.createGain(); master.gain.value = 0.9; master.connect(audioCtx.destination);
  thereminGain = audioCtx.createGain(); thereminGain.gain.value = 0; thereminGain.connect(master);
  osc = audioCtx.createOscillator(); osc.type="sine"; osc.frequency.value=440; osc.connect(thereminGain); osc.start();
  analyser = audioCtx.createAnalyser(); analyser.fftSize = 512; data = new Uint8Array(analyser.frequencyBinCount); master.connect(analyser);
  dest = audioCtx.createMediaStreamDestination(); master.connect(dest);
  rec = new MediaRecorder(dest.stream);
  rec.ondataavailable = e=>{ if(e.data.size>0) recChunks.push(e.data); };
  rec.onstop = ()=>{ const blob=new Blob(recChunks,{type:"audio/webm"}); recChunks=[]; const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`kbxaerial-${Date.now()}.webm`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000); };
  // iOS permission prompts
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function"){ try{ await DeviceOrientationEvent.requestPermission(); }catch{} }
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function"){ try{ await DeviceMotionEvent.requestPermission(); }catch{} }
  started=true;
}

function chime(){
  if(!started) return;
  const t=audioCtx.currentTime;
  const g=audioCtx.createGain(); g.gain.value=0; g.connect(master);
  const o=audioCtx.createOscillator(); o.type="sine"; o.frequency.setValueAtTime(880,t); o.connect(g);
  g.gain.linearRampToValueAtTime(P.chimeGain, t+0.005);
  o.frequency.exponentialRampToValueAtTime(440, t+0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.23);
  o.stop(t+0.25);
}

function setBgm(file){
  if(!file) return;
  if(!bgmAudio){ bgmAudio=new Audio(); bgmAudio.loop=true; }
  bgmAudio.src=URL.createObjectURL(file);
  bgmAudio.play();
}

function onPointer(e){
  S.pointer = (e.type!=="pointerup" && e.type!=="pointerleave");
  if(S.pointer){
    const r=canvas.getBoundingClientRect();
    S.px = clamp((e.clientX-r.left)/r.width,0,1);
    S.py = clamp((e.clientY-r.top)/r.height,0,1);
  }
}
addEventListener("pointerdown", e=>{ if(e.target.id==="canvas"){ chime(); } onPointer(e); });
addEventListener("pointermove", onPointer);
addEventListener("pointerup", onPointer);
addEventListener("pointerleave", onPointer);

function mapOrientation(beta,gamma){
  const br=(beta||0)*Math.PI/180;
  const pitch01=clamp((1-Math.cos(br))/2,0,1);
  const gr=(gamma||0)*Math.PI/180;
  const vol01=(Math.sin(gr)+1)/2;
  return {pitch01, vol01};
}
function onOrient(e){
  const {beta, gamma} = e;
  const {pitch01, vol01} = mapOrientation(beta, gamma);
  S.fT = map(pitch01,0,1,P.freqMin,P.freqMax);
  S.gT = map(vol01,0,1,P.gainMin,P.gainMax);
}
function onMotion(e){
  const a=e.accelerationIncludingGravity; if(!a) return;
  const m=Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
  const now=performance.now();
  if(m>24 && now-S.lastShake>600){ S.lastShake=now; chime(); }
}

async function start(){
  await boot();
  hint.classList.add("hidden");
  chime();
}

function toggleRec(){
  if(!started) return;
  if(rec.state==="recording"){ rec.stop(); } else { recChunks=[]; rec.start(); }
}

// ---- Two-finger gesture to toggle overlay ----
function maybeToggleOverlay(e){
  const now = performance.now();
  if(e.touches && e.touches.length>=2 && now - S.lastToggle > 500){
    S.lastToggle = now;
    hint.classList.toggle("hidden");
  }
}
document.addEventListener("touchstart", maybeToggleOverlay, {passive:true});

// ---- KB Visual ----
let canvas, ctx, off, dpr=1;
let K={t:0};
function initCanvas(){
  canvas=document.getElementById("canvas");
  dpr = Math.min(devicePixelRatio||1,2);
  const L=Math.min(innerWidth, innerHeight);
  canvas.width = Math.floor(L*dpr);
  canvas.height = Math.floor(L*dpr);
  off = document.createElement("canvas");
  off.width = canvas.width; off.height = canvas.height;
  ctx = off.getContext("2d");
}
addEventListener("resize", initCanvas);

function draw(){
  requestAnimationFrame(draw);
  if(!ctx||!canvas) return;
  if(started) analyser.getByteFrequencyData(data);
  let sum=0; for(let i=0;i<(data?data.length:0);i++) sum+=data[i];
  const energy = data? sum/(data.length*255) : 0;
  if(started){
    const t=clamp(P.smooth,0.05,0.6);
    S.fC = lerp(S.fC,S.fT,t);
    S.gC = lerp(S.gC,S.gT,t);
    osc.frequency.setValueAtTime(S.fC,audioCtx.currentTime);
    thereminGain.gain.setValueAtTime(S.gC,audioCtx.currentTime);
  }
  ctx.clearRect(0,0,off.width,off.height);
  ctx.fillStyle="#0b0c10"; ctx.fillRect(0,0,off.width,off.height);
  const cx=off.width/2, cy=off.height/2;
  const R=Math.min(off.width,off.height)*0.5;
  const slices=16;
  K.t += 0.004 + energy*0.02;
  for(let i=0;i<slices;i++){
    const a0=(i/slices)*Math.PI*2 + K.t*0.7;
    const a1=((i+1)/slices)*Math.PI*2 + K.t*0.7;
    const mid=(a0+a1)/2;
    const amp=0.15 + energy*0.6;
    const r1=R*(0.2+amp*0.4);
    const r2=R*(0.85+0.1*Math.sin(mid*3+energy*6));
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a0)*r1, cy+Math.sin(a0)*r1);
    ctx.lineTo(cx+Math.cos(a1)*r1, cy+Math.sin(a1)*r1);
    ctx.lineTo(cx+Math.cos(mid)*r2, cy+Math.sin(mid)*r2);
    ctx.closePath();
    const alpha=0.18 + energy*0.45;
    ctx.fillStyle=`rgba(${160+Math.sin(i*1.1)*40|0}, ${170+Math.sin(i*0.9+1.2)*35|0}, 245, ${alpha})`;
    ctx.fill();
  }
  const gctx=document.getElementById("canvas").getContext("2d");
  gctx.clearRect(0,0,canvas.width,canvas.height);
  gctx.drawImage(off,0,0);
}

document.addEventListener("DOMContentLoaded",()=>{
  initCanvas();
  draw();
  window.addEventListener("deviceorientation", onOrient);
  window.addEventListener("devicemotion", onMotion);
  document.getElementById("start").addEventListener("click", start);
  document.getElementById("tap").addEventListener("click", chime);
  document.getElementById("bgm").addEventListener("change", e=>setBgm(e.target.files[0]));
  document.getElementById("rec").addEventListener("click", toggleRec);
  if("serviceWorker" in navigator){ navigator.serviceWorker.register("./sw.js"); }
});