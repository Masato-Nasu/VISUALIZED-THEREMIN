// app.js — Theremin Fusion (visual + theremin + BGM + chime + recording)
let audioCtx, masterGain, thereminGain, osc, bgm, analyser, analyserData, recorder, recChunks = [];
let started = false;
let params = {
  thereminOn: true,
  bgmOn: false,
  freqMin: 100, freqMax: 1800,
  gainMin: 0.0, gainMax: 0.8,
  smooth: 0.12,
  chimeGain: 0.7
};
let state = {
  targetFreq: 440, currentFreq: 440,
  targetGain: 0.0, currentGain: 0.0,
  lastMotion: 0, lastShake: 0,
  pointerActive: false, px: 0.5, py: 0.5
};

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }
function map(v, a1, a2, b1, b2){ const t=(v-a1)/(a2-a1); return b1 + (b2-b1)*t; }

async function ensureAudio(){
  if (started) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain(); masterGain.gain.value = 0.9;
  masterGain.connect(audioCtx.destination);

  thereminGain = audioCtx.createGain(); thereminGain.gain.value = 0;
  thereminGain.connect(masterGain);

  osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 440;
  osc.connect(thereminGain);
  osc.start();

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyserData = new Uint8Array(analyser.frequencyBinCount);
  masterGain.connect(analyser);

  // MediaRecorder (from destination stream)
  const dest = audioCtx.createMediaStreamDestination();
  masterGain.connect(dest);
  recorder = new MediaRecorder(dest.stream);
  recorder.ondataavailable = e => { if (e.data.size>0) recChunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(recChunks, {type:"audio/webm"});
    recChunks = [];
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `theremin-${Date.now()}.webm`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 10000);
  };

  started = true;
}

function startStopRecording(){
  if (!started) return;
  if (recorder.state === "recording"){
    recorder.stop();
    document.getElementById("recBtn").textContent = "● REC";
  } else {
    recChunks = [];
    recorder.start();
    document.getElementById("recBtn").textContent = "■ STOP";
  }
}

function setBgmFile(file){
  if (!file) return;
  if (!bgm){
    bgm = new Audio();
    bgm.loop = true;
    bgm.onplay = ()=> params.bgmOn = true;
    bgm.onpause = ()=> params.bgmOn = false;
  }
  bgm.src = URL.createObjectURL(file);
  bgm.play();
}

function triggerChime(){
  if (!started) return;
  const tnow = audioCtx.currentTime;
  const g = audioCtx.createGain(); g.gain.value = 0; g.connect(masterGain);
  const o = audioCtx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(880, tnow);
  o.connect(g);
  g.gain.linearRampToValueAtTime(params.chimeGain, tnow + 0.005);
  o.start();
  o.frequency.exponentialRampToValueAtTime(440, tnow + 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, tnow + 0.23);
  o.stop(tnow + 0.25);
}

function onPointer(e){
  state.pointerActive = (e.type !== "pointerup" && e.type !== "pointerleave");
  if (state.pointerActive){
    const rect = viz.getBoundingClientRect();
    state.px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    state.py = clamp((e.clientY - rect.top) / rect.height, 0, 1);
  }
}
addEventListener("pointerdown", e => { if (e.target.id==="viz") triggerChime(); onPointer(e); });
addEventListener("pointermove", onPointer);
addEventListener("pointerup", onPointer);
addEventListener("pointerleave", onPointer);

function mapOrientationToTheremin(beta, gamma){
  // beta: [-180,180] pitch. We want a smooth "hill" with peaks at +-180, valley near 0 → use 1 - cos(beta)
  const rad = (beta||0) * Math.PI/180;
  const smoothPitch = 1 - Math.cos(rad); // range [0,2] with 0 at 0deg, 2 at 180/-180
  const pitch01 = clamp(smoothPitch/2, 0, 1); // [0,1]

  // volume from roll gamma [-90,90] → use (sin mapped 0→1)
  const gRad = (gamma||0) * Math.PI/180;
  const vol01 = (Math.sin(gRad) + 1)/2; // [0,1]

  return { pitch01, vol01 };
}

function onDeviceOrientation(e){
  const {beta, gamma} = e; // pitch, roll
  const { pitch01, vol01 } = mapOrientationToTheremin(beta, gamma);
  state.targetFreq = map(pitch01, 0, 1, params.freqMin, params.freqMax);
  state.targetGain = map(vol01, 0, 1, params.gainMin, params.gainMax);
}
function onDeviceMotion(e){
  const a = e.accelerationIncludingGravity;
  if (!a) return;
  const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
  const now = performance.now();
  if (mag > 24 && now - state.lastShake > 600){
    state.lastShake = now;
    triggerChime();
  }
}

async function startAudio(){
  await ensureAudio();
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function"){
    try { await DeviceOrientationEvent.requestPermission(); } catch(e){}
  }
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function"){
    try { await DeviceMotionEvent.requestPermission(); } catch(e){}
  }
}

function updateParamsUI(){
  const freqMin = Number(document.getElementById("freqMin").value);
  const freqMax = Number(document.getElementById("freqMax").value);
  params.freqMin = Math.min(freqMin, freqMax-1);
  params.freqMax = Math.max(freqMin+1, freqMax);
  params.gainMax = Number(document.getElementById("gainMax").value);
  params.smooth = Number(document.getElementById("smooth").value);
  document.getElementById("freqMinVal").textContent = params.freqMin;
  document.getElementById("freqMaxVal").textContent = params.freqMax;
  document.getElementById("gainMaxVal").textContent = params.gainMax.toFixed(2);
  document.getElementById("smoothVal").textContent = params.smooth.toFixed(2);
}

function loop(){
  requestAnimationFrame(loop);
  if (!started) return;

  // Input from pointer (desktop) overrides orientation while active
  if (state.pointerActive){
    state.targetFreq = map(1-state.py, 0, 1, params.freqMin, params.freqMax);
    state.targetGain = map(state.px, 0, 1, params.gainMin, params.gainMax);
  }

  // Smooth towards target
  const t = clamp(params.smooth, 0.01, 1.0);
  state.currentFreq = lerp(state.currentFreq, state.targetFreq, t);
  state.currentGain = lerp(state.currentGain, state.targetGain, t);

  osc.frequency.setValueAtTime(state.currentFreq, audioCtx.currentTime);
  thereminGain.gain.setValueAtTime(params.thereminOn ? state.currentGain : 0, audioCtx.currentTime);

  // Visuals
  drawVisual();
}

let gl, ctx2d, viz, off;
let k = { slices: 10, time: 0, brightness: 0.7 };
function initVisual(){
  viz = document.getElementById("viz");
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  viz.width = Math.floor(viz.clientWidth * dpr);
  viz.height = Math.floor(viz.clientHeight * dpr);
  off = document.createElement("canvas");
  off.width = viz.width; off.height = viz.height;
  ctx2d = off.getContext("2d");
}
addEventListener("resize", initVisual);

function drawVisual(){
  if (!ctx2d || !viz) return;
  // Read analyser to modulate
  analyser.getByteFrequencyData(analyserData);
  let sum = 0;
  for (let i=0;i<analyserData.length;i++) sum += analyserData[i];
  const energy = sum / (analyserData.length * 255); // 0..1
  k.time += 0.005 + energy*0.02;
  const brightness = 0.4 + energy*0.6;

  // Base gradient background
  ctx2d.clearRect(0,0,off.width, off.height);
  const g = ctx2d.createRadialGradient(off.width/2, off.height/2, 10, off.width/2, off.height/2, Math.max(off.width, off.height)/2);
  g.addColorStop(0, `rgba(160,180,255,${0.12+energy*0.2})`);
  g.addColorStop(1, `rgba(10,10,18,1)`);
  ctx2d.fillStyle = g;
  ctx2d.fillRect(0,0,off.width, off.height);

  // Simple kaleidoscope-like wedges
  const cx = off.width/2, cy = off.height/2;
  const R = Math.max(off.width, off.height)*0.6;
  const slices = 12;
  for (let i=0; i<slices; i++){
    const ang0 = (i/slices)*Math.PI*2 + k.time*0.6;
    const ang1 = ((i+1)/slices)*Math.PI*2 + k.time*0.6;
    const mid = (ang0+ang1)/2;
    const amp = 0.25 + energy*0.75;
    const r1 = R*(0.2 + amp*0.6);
    const r2 = R*(0.8 + amp*0.2*Math.sin(ang0*3+energy*10));
    ctx2d.beginPath();
    ctx2d.moveTo(cx + Math.cos(ang0)*r1, cy + Math.sin(ang0)*r1);
    ctx2d.lineTo(cx + Math.cos(ang1)*r1, cy + Math.sin(ang1)*r1);
    ctx2d.lineTo(cx + Math.cos(mid)*r2, cy + Math.sin(mid)*r2);
    ctx2d.closePath();
    const alpha = 0.2 + energy*0.5;
    ctx2d.fillStyle = `rgba(${180+Math.sin(i+energy*4)*50|0}, ${170+Math.sin(i*1.3+energy*3)*40|0}, ${255}, ${alpha})`;
    ctx2d.fill();
  }

  const ctx = viz.getContext("2d");
  ctx.clearRect(0,0,viz.width,viz.height);
  ctx.drawImage(off, 0,0);
}

function toggleTheremin(el){
  params.thereminOn = el.checked;
}
function playPauseBgm(el){
  if (!bgm) return;
  if (el.checked) bgm.play(); else bgm.pause();
}

document.addEventListener("DOMContentLoaded", () => {
  initVisual();
  loop();
  updateParamsUI();

  // Permissions & listeners
  window.addEventListener("deviceorientation", onDeviceOrientation);
  window.addEventListener("devicemotion", onDeviceMotion);

  // File input
  const bgmInput = document.getElementById("bgmFile");
  bgmInput.addEventListener("change", (e)=> setBgmFile(e.target.files[0]));

  // UI controls
  document.getElementById("startBtn").addEventListener("click", async () => {
    await startAudio();
    triggerChime();
  });
  document.getElementById("recBtn").addEventListener("click", startStopRecording);

  ["freqMin","freqMax","gainMax","smooth"].forEach(id => {
    document.getElementById(id).addEventListener("input", updateParamsUI);
  });

  // Install SW
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js");
  }
});
