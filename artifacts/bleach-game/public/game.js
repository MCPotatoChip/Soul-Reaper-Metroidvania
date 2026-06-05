// ─────────────────────────────── CANVAS / CONSTANTS ───────────────────────────
const C=document.getElementById('game-canvas'),X=C.getContext('2d');
C.width=960;C.height=540;
const MC=document.getElementById('map-canvas'),MX=MC.getContext('2d');
const PC=document.getElementById('portrait-canvas'),PX=PC.getContext('2d');

const T=32,G=0.55,MF=12,PS=3.5,JF=-11,WJX=6,WJY=-10;
const DS=14,DD=8,DC=28,AD=12,AC=14,AR=44,DMG=5,PG=-10;
const SH=10,HC=30,GC=25,CC=20,IT=60;
const GS={TITLE:0,PLAY:1,DLG:3,SHOP:4,MAP:5,DEAD:6,ABILITY:7,BOSS_INTRO:8};
let gs=GS.TITLE,fr=0,shk=0,fls=0,tLock=false,nT=0;
// Combo counter
let comboCount=0,comboTimer=0,comboBest=0;
// Floating damage numbers
const dmgNums=[];
// Shake intensity (0-1 slider)
let shkIntensity=1;
// Boss intro cutscene
let bossIntroTimer=0,bossIntroName='',bossIntroLine='';

function notify(m){
  const e=document.getElementById('notif');
  e.textContent=m;e.style.opacity='1';
  clearTimeout(nT);nT=setTimeout(()=>e.style.opacity='0',3000);
}

const ks={},kp={};let eP=false,sP=false,clickP=false;
document.addEventListener('keydown',e=>{
  if(settingsListening){handleSettingsKey(e.code);e.preventDefault();return;}
  if(!ks[e.code])kp[e.code]=true;
  ks[e.code]=true;
  if(e.code==='KeyE')eP=true;
  if(e.code==='Space')sP=true;
  ['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&e.preventDefault();
});
document.addEventListener('keyup',e=>ks[e.code]=false);

// ─────────────────────────────── INPUT ABSTRACTION ────────────────────────────
const IN={
  // Action list
  actions:['left','right','up','down','jump','attack','getsuga','cero','dash','heal','charge','interact','map','bankai','hollow'],
  actionLabels:{left:'Move Left',right:'Move Right',up:'Look Up',down:'Look Down',jump:'Jump',attack:'Attack (Zanpakuto)',getsuga:'Getsuga Tenshō',cero:'Cero',dash:'Flash Step',heal:'Heal',charge:'Charge Reiatsu',interact:'Interact',map:'Map',bankai:'Bankai',hollow:'Hollow Mask'},

  // Default keyboard bindings (action -> array of key codes)
  defKB:{left:['ArrowLeft','KeyA'],right:['ArrowRight','KeyD'],up:['ArrowUp','KeyW'],down:['ArrowDown','KeyS'],jump:['Space','ArrowUp'],attack:['KeyJ','KeyZ'],getsuga:['KeyK','KeyX'],cero:['KeyL'],dash:['ShiftLeft','ShiftRight'],heal:['KeyF'],charge:['KeyC'],interact:['KeyE'],map:['KeyM','Tab'],bankai:['KeyB'],hollow:['KeyH']},

  // Default gamepad bindings (action -> array of button indices, standard mapping)
  // Xbox: A=0,B=1,X=2,Y=3,LB=4,RB=5,LT=6,RT=7,Back=8,Start=9,LS=10,RS=11,Up=12,Down=13,Left=14,Right=15
  defGP:{left:[14],right:[15],up:[12],down:[13],jump:[0],attack:[2],getsuga:[3],cero:[4],dash:[5],heal:[1],charge:[6],interact:[8],map:[9],bankai:[7],hollow:[10]},

  kb:null, // current keyboard bindings
  gp:null, // current gamepad bindings

  // State
  _held:{},_pressed:{},_gpHeld:{},_gpPressed:{},_gpPrev:{},
  _touchHeld:{},_touchPressed:{},_touchPrev:{},
  _joyX:0,_joyY:0,

  init(){
    // Load saved bindings or use defaults
    this.kb=JSON.parse(JSON.stringify(this.defKB));
    this.gp=JSON.parse(JSON.stringify(this.defGP));
    const saved=localStorage.getItem('bleach_binds');
    if(saved){try{const d=JSON.parse(saved);if(d.kb)this.kb=d.kb;if(d.gp)this.gp=d.gp;}catch(e){}}
  },

  saveBindings(){localStorage.setItem('bleach_binds',JSON.stringify({kb:this.kb,gp:this.gp}));},
  resetBindings(){this.kb=JSON.parse(JSON.stringify(this.defKB));this.gp=JSON.parse(JSON.stringify(this.defGP));this.saveBindings();},

  // Called each frame to merge all input sources
  poll(){
    // Gamepad
    const gpads=navigator.getGamepads?navigator.getGamepads():[];
    let pad=null;
    for(let i=0;i<gpads.length;i++){if(gpads[i]&&gpads[i].connected){pad=gpads[i];break;}}

    for(const act of this.actions){
      // Keyboard
      const kbKeys=this.kb[act]||[];
      const kbHeld=kbKeys.some(k=>ks[k]);
      const kbPress=kbKeys.some(k=>kp[k]);

      // Gamepad
      let gpHeld=false,gpPress=false;
      if(pad){
        const gpBtns=this.gp[act]||[];
        // D-pad / stick for directional
        if(act==='left'){gpHeld=gpHeld||(pad.axes[0]<-0.3);}
        if(act==='right'){gpHeld=gpHeld||(pad.axes[0]>0.3);}
        if(act==='up'){gpHeld=gpHeld||(pad.axes[1]<-0.3);}
        if(act==='down'){gpHeld=gpHeld||(pad.axes[1]>0.3);}
        for(const bi of gpBtns){
          if(bi<pad.buttons.length&&pad.buttons[bi].pressed){gpHeld=true;break;}
        }
        const wasGP=this._gpPrev[act]||false;
        gpPress=gpHeld&&!wasGP;
        this._gpPrev[act]=gpHeld;
      }

      // Touch
      const touchHeld=this._touchHeld[act]||false;
      const wasTch=this._touchPrev[act]||false;
      const touchPress=touchHeld&&!wasTch;
      this._touchPrev[act]=touchHeld;

      // Joystick overrides for directions on touch
      if(act==='left'&&this._joyX<-0.3){this._held[act]=true;this._pressed[act]=kbPress||gpPress||(!wasTch&&true);continue;}
      if(act==='right'&&this._joyX>0.3){this._held[act]=true;this._pressed[act]=kbPress||gpPress||(!wasTch&&true);continue;}
      if(act==='up'&&this._joyY<-0.3){this._held[act]=true;this._pressed[act]=kbPress||gpPress;continue;}
      if(act==='down'&&this._joyY>0.3){this._held[act]=true;this._pressed[act]=kbPress||gpPress;continue;}

      this._held[act]=kbHeld||gpHeld||touchHeld;
      this._pressed[act]=kbPress||gpPress||touchPress;
    }

    // Also set eP/sP from unified
    if(this._pressed.interact)eP=true;
    if(this._pressed.jump)sP=true;
  },

  held(act){return this._held[act]||false;},
  pressed(act){return this._pressed[act]||false;},

  // Clear per-frame pressed state (called at end of game loop)
  clear(){
    for(const act of this.actions)this._pressed[act]=false;
    for(const k in kp)kp[k]=false;
    eP=false;sP=false;clickP=false;
  }
};
IN.init();

// ─────────────────────────────── MOBILE TOUCH SYSTEM ──────────────────────────
const isMobile='ontouchstart' in window||navigator.maxTouchPoints>1;
(function setupMobile(){
  if(!isMobile)return;
  const mc=document.getElementById('mobile-controls');mc.style.display='block';
  // Hide settings gear on mobile (settings accessed via title screen)
  // Keep it visible but smaller
  const joyZone=document.getElementById('joystick-zone');
  const knob=document.getElementById('joy-knob');
  const base=document.getElementById('joy-base');
  let joyTouchId=null;
  const baseR=60,knobR=25;

  function joyPos(touch){
    const rect=joyZone.getBoundingClientRect();
    const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    let dx=touch.clientX-cx,dy=touch.clientY-cy;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const maxD=baseR-5;
    if(dist>maxD){dx=(dx/dist)*maxD;dy=(dy/dist)*maxD;}
    knob.style.left=(rect.width/2-knobR+dx)+'px';
    knob.style.top=(rect.height/2-knobR+dy)+'px';
    IN._joyX=dx/maxD;IN._joyY=dy/maxD;
  }
  function joyReset(){
    knob.style.left='45px';knob.style.top='45px';
    IN._joyX=0;IN._joyY=0;joyTouchId=null;
  }

  joyZone.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];joyTouchId=t.identifier;joyPos(t);},{passive:false});
  joyZone.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===joyTouchId)joyPos(t);},{passive:false});
  joyZone.addEventListener('touchend',e=>{for(const t of e.changedTouches)if(t.identifier===joyTouchId)joyReset();},{passive:false});
  joyZone.addEventListener('touchcancel',e=>{joyReset();},{passive:false});

  // Action buttons
  document.querySelectorAll('.act-btn,.extra-btn').forEach(btn=>{
    const act=btn.dataset.action;
    btn.addEventListener('touchstart',e=>{e.preventDefault();IN._touchHeld[act]=true;btn.classList.add('pressed');},{passive:false});
    btn.addEventListener('touchend',e=>{e.preventDefault();IN._touchHeld[act]=false;btn.classList.remove('pressed');},{passive:false});
    btn.addEventListener('touchcancel',e=>{IN._touchHeld[act]=false;btn.classList.remove('pressed');},{passive:false});
  });

  // Prevent default on game canvas touch
  C.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});
  C.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
})();

// ─────────────────────────────── SETTINGS SYSTEM ──────────────────────────────
let settingsOpen=false,settingsListening=null,settingsTab='keyboard';
const GS_SETTINGS=99;

function handleSettingsKey(code){
  if(!settingsListening)return;
  const{act,tab}=settingsListening;
  if(code==='Escape'){settingsListening=null;renderSettings();return;}
  if(tab==='keyboard'){
    // Set this action's keyboard binding
    if(!IN.kb[act])IN.kb[act]=[];
    IN.kb[act]=[code]; // replace with single key
    IN.saveBindings();
  }
  settingsListening=null;renderSettings();
}

function openSettings(){
  settingsOpen=true;
  document.getElementById('settings-ui').style.display='block';
  renderSettings();
}
function closeSettings(){
  settingsOpen=false;settingsListening=null;
  document.getElementById('settings-ui').style.display='none';
  if(gs===GS_SETTINGS)gs=GS.PLAY;
}

function keyName(code){
  if(!code)return '?';
  const m={'ArrowLeft':'←','ArrowRight':'→','ArrowUp':'↑','ArrowDown':'↓','Space':'Space','ShiftLeft':'L-Shift','ShiftRight':'R-Shift','Enter':'Enter','Escape':'ESC','Tab':'Tab','Backspace':'Back'};
  if(m[code])return m[code];
  return code.replace('Key','').replace('Digit','');
}
function gpBtnName(idx){
  const names=['A','B','X','Y','LB','RB','LT','RT','Back','Start','LS','RS','D-Up','D-Down','D-Left','D-Right'];
  return names[idx]||('Btn'+idx);
}

function renderSettings(){
  const list=document.getElementById('bindings-list');list.innerHTML='';
  const tab=settingsTab;
  for(const act of IN.actions){
    const label=IN.actionLabels[act]||act;
    const row=document.createElement('div');row.className='bind-row';
    const lbl=document.createElement('span');lbl.className='bind-action';lbl.textContent=label;
    const btn=document.createElement('span');btn.className='bind-key';
    if(settingsListening&&settingsListening.act===act&&settingsListening.tab===tab){
      btn.classList.add('listening');
      btn.textContent='Press a '+(tab==='keyboard'?'key':'button')+'...';
    } else {
      if(tab==='keyboard'){
        btn.textContent=(IN.kb[act]||[]).map(keyName).join(' / ')||'None';
      } else {
        btn.textContent=(IN.gp[act]||[]).map(gpBtnName).join(' / ')||'None';
      }
    }
    btn.addEventListener('click',()=>{
      if(tab==='keyboard'){settingsListening={act,tab:'keyboard'};}
      else{settingsListening={act,tab:'controller'};startGPListen(act);}
      renderSettings();
    });
    row.appendChild(lbl);row.appendChild(btn);list.appendChild(row);
  }
}

// Gamepad listen mode
let gpListenInterval=null;
function startGPListen(act){
  if(gpListenInterval)clearInterval(gpListenInterval);
  gpListenInterval=setInterval(()=>{
    if(!settingsListening||settingsListening.tab!=='controller'){clearInterval(gpListenInterval);gpListenInterval=null;return;}
    const gpads=navigator.getGamepads?navigator.getGamepads():[];
    for(let i=0;i<gpads.length;i++){
      const pad=gpads[i];if(!pad)continue;
      for(let b=0;b<pad.buttons.length;b++){
        if(pad.buttons[b].pressed){
          IN.gp[act]=[b];IN.saveBindings();
          settingsListening=null;clearInterval(gpListenInterval);gpListenInterval=null;
          renderSettings();return;
        }
      }
    }
  },100);
}

// Settings tab switching
document.querySelectorAll('.stab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    settingsTab=tab.dataset.tab;
    document.querySelectorAll('.stab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');settingsListening=null;renderSettings();
  });
});
document.getElementById('settings-btn').addEventListener('click',()=>{
  if(settingsOpen)closeSettings();else{if(gs===GS.PLAY||gs===GS.TITLE){openSettings();if(gs===GS.PLAY)gs=GS_SETTINGS;}}
});
document.getElementById('close-settings').addEventListener('click',closeSettings);
document.getElementById('reset-binds').addEventListener('click',()=>{IN.resetBindings();renderSettings();});
document.getElementById('shake-slider').addEventListener('input',e=>{shkIntensity=parseFloat(e.target.value);});

// ─────────────────────────────── MUSIC / AUDIO ────────────────────────────────
const AU={
  c:null,
  musicNodes:[],
  currentTrack:null,
  musicVol:0.04,
  init(){this.c=new(window.AudioContext||window.webkitAudioContext)();},

  play(t){
    if(!this.c)return;
    const a=this.c,o=a.createOscillator(),g=a.createGain();
    o.connect(g);g.connect(a.destination);
    const n=a.currentTime;
    const S={
      slash:{w:'sawtooth',f:[[200,n],[80,n+.1]],g:[[.12,n],[.001,n+.12]],d:.12},
      hit:{w:'square',f:[[300,n],[100,n+.08]],g:[[.1,n],[.001,n+.1]],d:.1},
      hurt:{w:'sawtooth',f:[[400,n],[50,n+.3]],g:[[.12,n],[.001,n+.3]],d:.3},
      heal:{w:'sine',f:[[400,n],[800,n+.5]],g:[[.08,n],[.001,n+.6]],d:.6},
      getsuga:{w:'sawtooth',f:[[100,n],[600,n+.15],[50,n+.4]],g:[[.15,n],[.001,n+.5]],d:.5},
      cero:{w:'square',f:[[80,n],[400,n+.2],[100,n+.5]],g:[[.2,n],[.001,n+.6]],d:.6},
      dash:{w:'triangle',f:[[150,n],[50,n+.1]],g:[[.06,n],[.001,n+.12]],d:.12},
      jump:{w:'sine',f:[[200,n],[400,n+.1]],g:[[.04,n],[.001,n+.1]],d:.1},
      save:{w:'sine',f:[[523,n],[784,n+.3]],g:[[.08,n],[.001,n+.6]],d:.6},
      pickup:{w:'sine',f:[[600,n],[800,n+.1]],g:[[.06,n],[.001,n+.2]],d:.2},
      die:{w:'square',f:[[200,n],[30,n+.3]],g:[[.08,n],[.001,n+.35]],d:.35},
      menu:{w:'sine',f:[[500,n]],g:[[.04,n],[.001,n+.08]],d:.08},
      roar:{w:'sawtooth',f:[[60,n],[30,n+.8]],g:[[.15,n],[.001,n+1]],d:1},
      ability:{w:'sine',f:[[400,n],[800,n+.2],[1200,n+.4]],g:[[.1,n],[.001,n+.8]],d:.8},
      hollow:{w:'square',f:[[150,n],[300,n+.1],[100,n+.3]],g:[[.15,n],[.001,n+.4]],d:.4},
      charge:{w:'sine',f:[[300,n],[600,n+.5]],g:[[.05,n],[.001,n+.6]],d:.6},
      iceHit:{w:'triangle',f:[[800,n],[1200,n+.05],[400,n+.15]],g:[[.1,n],[.001,n+.2]],d:.2},
    }[t];
    if(!S)return;
    o.type=S.w;
    S.f.forEach((v,i)=>i===0?o.frequency.setValueAtTime(v[0],v[1]):o.frequency.exponentialRampToValueAtTime(v[0],v[1]));
    S.g.forEach((v,i)=>i===0?g.gain.setValueAtTime(v[0],v[1]):g.gain.exponentialRampToValueAtTime(v[0],v[1]));
    o.start(n);o.stop(n+S.d);
  },

  // ── Generative music tracks ──
  stopMusic(){
    this.musicNodes.forEach(n=>{try{n.stop();}catch(e){}});
    this.musicNodes=[];this.currentTrack=null;
  },

  playTrack(trackName){
    if(!this.c||this.currentTrack===trackName)return;
    this.stopMusic();this.currentTrack=trackName;
    if(trackName==='rukon')this._playRukon();
    else if(trackName==='seireitei')this._playSeireitei();
    else if(trackName==='hueco')this._playHueco();
    else if(trackName==='lasnoches')this._playLasNoches();
    else if(trackName==='boss')this._playBoss();
  },

  _makeGain(vol){const g=this.c.createGain();g.gain.setValueAtTime(vol,this.c.currentTime);g.connect(this.c.destination);return g;},

  _scheduleArp(freqs,beatLen,totalBeats,wave,vol,startT,loop){
    const a=this.c;const g=this._makeGain(0);g.gain.setValueAtTime(0,startT);
    const osc=a.createOscillator();osc.type=wave;osc.connect(g);
    let t=startT;
    for(let i=0;i<totalBeats;i++){
      const f=freqs[i%freqs.length];
      osc.frequency.setValueAtTime(f,t);
      g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+beatLen*0.85);
      t+=beatLen;
    }
    osc.start(startT);osc.stop(t);
    this.musicNodes.push(osc,g);
    if(loop&&this.currentTrack===loop){setTimeout(()=>this.playTrack(loop),(t-this.c.currentTime)*1000);}
  },

  _playRukon(){
    const a=this.c,st=a.currentTime+0.1;
    // Soft minor arpeggio – A minor pentatonic
    const mel=[220,261.6,293.7,349.2,392,440,523.2,587.3];
    this._scheduleArp(mel,0.28,48,'triangle',0.035,st,'rukon');
    // Bass drone
    const bass=a.createOscillator();bass.type='sine';bass.frequency.setValueAtTime(110,st);
    const bg=this._makeGain(0.02);bass.connect(bg);bass.start(st);bass.stop(st+13.5);
    this.musicNodes.push(bass,bg);
  },

  _playSeireitei(){
    const a=this.c,st=a.currentTime+0.1;
    // Driving square arps – D minor
    const mel=[293.7,349.2,392,466.2,523.2,392,349.2,293.7];
    this._scheduleArp(mel,0.18,64,'square',0.028,st,'seireitei');
    const bass=a.createOscillator();bass.type='sawtooth';bass.frequency.setValueAtTime(146.8,st);
    const bg=this._makeGain(0.015);bass.connect(bg);bass.start(st);bass.stop(st+11.5);
    this.musicNodes.push(bass,bg);
  },

  _playHueco(){
    const a=this.c,st=a.currentTime+0.1;
    // Sparse, eerie – E minor low
    const mel=[82.4,98,110,123.5,146.8,110,98,82.4];
    this._scheduleArp(mel,0.45,32,'sine',0.04,st,'hueco');
    // High shimmer
    const mel2=[659,698,740,784];
    this._scheduleArp(mel2,1.2,12,'triangle',0.012,st,'hueco');
  },

  _playLasNoches(){
    const a=this.c,st=a.currentTime+0.1;
    // Dark ambient – B minor
    const mel=[123.5,146.8,164.8,185,220,185,164.8,146.8];
    this._scheduleArp(mel,0.38,40,'sawtooth',0.022,st,'lasnoches');
    const bass=a.createOscillator();bass.type='sine';bass.frequency.setValueAtTime(61.7,st);
    const bg=this._makeGain(0.025);bass.connect(bg);bass.start(st);bass.stop(st+15.2);
    this.musicNodes.push(bass,bg);
  },

  _playBoss(){
    const a=this.c,st=a.currentTime+0.1;
    // Intense boss – fast A minor square loop
    const mel=[440,523.2,587.3,523.2,493.9,440,392,349.2];
    this._scheduleArp(mel,0.13,80,'square',0.032,st,'boss');
    // Low pound
    const mel2=[110,110,146.8,110];
    this._scheduleArp(mel2,0.52,20,'sawtooth',0.028,st,'boss');
  }
};

// ─────────────────────────────── PARTICLES ────────────────────────────────────
class Pt{
  constructor(x,y,vx,vy,l,c,s,t='c'){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.l=l;this.ml=l;this.c=c;this.s=s;this.t=t;
    this.g=t==='sp'?-0.02:0.04;
  }
  update(){this.x+=this.vx;this.y+=this.vy;this.vy+=this.g;this.l--;return this.l>0;}
  draw(c,cx,cy){
    const a=this.l/this.ml,sx=this.x-cx,sy=this.y-cy;
    c.globalAlpha=a;c.fillStyle=this.c;
    if(this.t==='c'){c.beginPath();c.arc(sx,sy,this.s*a,0,Math.PI*2);c.fill();}
    else if(this.t==='k'){c.fillRect(sx-1,sy-1,2,this.s*3*a);}
    else if(this.t==='sl'){c.strokeStyle=this.c;c.lineWidth=this.s*a;c.beginPath();c.moveTo(sx-this.vx*3,sy-this.vy*3);c.lineTo(sx,sy);c.stroke();}
    else if(this.t==='sp'){c.beginPath();c.arc(sx,sy,this.s,0,Math.PI*2);c.fill();c.globalAlpha=a*.3;c.beginPath();c.arc(sx,sy,this.s*2.5,0,Math.PI*2);c.fill();}
    else if(this.t==='sand'){c.fillRect(sx,sy,this.s,this.s);}
    else if(this.t==='ice'){c.save();c.globalAlpha=a;c.fillStyle='#aaddff';c.fillRect(sx-this.s,sy-this.s,this.s*2,this.s*2);c.strokeStyle='#cceeff';c.lineWidth=1;c.strokeRect(sx-this.s,sy-this.s,this.s*2,this.s*2);c.restore();}
    c.globalAlpha=1;
  }
}
const pts=[];
function sp(x,y,n,c,spd,l,s,t='c'){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,v=Math.random()*spd;
    pts.push(new Pt(x+(Math.random()-.5)*8,y+(Math.random()-.5)*8,Math.cos(a)*v,Math.sin(a)*v,l+Math.random()*l*.5,c,s+Math.random()*s*.5,t));
  }
}
function slFX(x,y,d){
  const cs=['#66aaff','#88ccff','#aaddff'];
  for(let i=0;i<8;i++){
    const a=(d===0?-Math.PI/2:d===1?Math.PI/2:d===2?Math.PI:0)+(Math.random()-.5)*.8,s=2+Math.random()*4;
    pts.push(new Pt(x,y,Math.cos(a)*s,Math.sin(a)*s,10+Math.random()*10,cs[~~(Math.random()*3)],2+Math.random()*2,'sl'));
  }
}
function iceFX(x,y){
  for(let i=0;i<12;i++){
    const a=Math.random()*Math.PI*2,v=1+Math.random()*3;
    pts.push(new Pt(x,y,Math.cos(a)*v,Math.sin(a)*v,20+Math.random()*15,'#88ccff',3+Math.random()*3,'ice'));
  }
}
function rO(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}

// ─────────────────────────────── ZONE THEMES ──────────────────────────────────
const ZN={
  rukon:{name:"Rukon District",bgT:'#101820',bgB:'#0c1a12',wc:'#2e3e2e',wi:'#3a4a3a',wh:'#485848',pc:'#4e7050',pt:'#5e8e5e',fc:'rgba(10,20,15,.18)',prt:'#557766'},
  seireitei:{name:"Seireitei",bgT:'#121228',bgB:'#0e0e22',wc:'#353555',wi:'#404060',wh:'#505078',pc:'#556088',pt:'#6878a8',fc:'rgba(15,10,30,.15)',prt:'#776699'},
  hueco:{name:"Hueco Mundo",bgT:'#0a0a08',bgB:'#151510',wc:'#484840',wi:'#585850',wh:'#686860',pc:'#706858',pt:'#887868',fc:'rgba(20,18,10,.12)',prt:'#aa9977'},
  lasnoches:{name:"Las Noches",bgT:'#18181c',bgB:'#0c0c10',wc:'#404048',wi:'#505058',wh:'#606068',pc:'#585860',pt:'#707078',fc:'rgba(15,15,20,.15)',prt:'#888890'}
};

// ─────────────────────────────── PORTRAIT DRAWING ─────────────────────────────
function drawPortrait(type){
  PX.clearRect(0,0,56,56);PX.fillStyle='#1a1028';PX.fillRect(0,0,56,56);
  switch(type){
    case 'urahara':case 'urahara2':case 'urahara3':
      PX.fillStyle='#f5d0a8';PX.fillRect(18,22,20,14);
      PX.fillStyle='#c0b090';PX.fillRect(18,34,20,4);
      PX.fillStyle='#445544';PX.fillRect(10,6,36,18);
      PX.fillStyle='#eee';PX.fillRect(10,10,36,2);PX.fillRect(10,16,36,2);
      PX.fillStyle='#445544';PX.fillRect(6,22,44,4);
      PX.fillStyle='rgba(0,0,0,.5)';PX.fillRect(18,24,20,8);
      PX.fillStyle='#556655';PX.fillRect(14,38,28,14);
      PX.fillStyle='#888';PX.fillRect(20,28,3,2);PX.fillRect(33,28,3,2);
      break;
    case 'rukia':
      PX.fillStyle='#f0c8a8';PX.fillRect(18,18,20,16);
      PX.fillStyle='#0a0a1a';PX.fillRect(12,6,32,16);
      PX.fillStyle='#0a0a1a';PX.fillRect(10,14,6,16);PX.fillRect(40,14,6,16);
      PX.fillStyle='#0a0a1a';PX.fillRect(20,4,6,6);
      PX.fillStyle='#7744bb';PX.fillRect(22,22,5,4);PX.fillRect(31,22,5,4);
      PX.fillStyle='#fff';PX.fillRect(24,23,2,2);PX.fillRect(33,23,2,2);
      PX.fillStyle='#111128';PX.fillRect(14,34,28,16);
      PX.fillStyle='#ddd';PX.fillRect(24,34,8,12);
      break;
    default:PX.fillStyle='#888';PX.fillRect(18,18,20,20);PX.fillRect(14,8,28,14);
  }
}

// ─────────────────────────────── NPC DATA ─────────────────────────────────────
const NI={
  urahara:{name:"Kisuke Urahara",shop:true,lines:["Ah~ Welcome! A Substitute Soul Reaper!","I'm Urahara. Humble shopkeeper at your service.","Defeat Hollows for Kon coins and Reiatsu.","Press J to swing Zangetsu!","My shop awaits whenever you need supplies~"]},
  rukia:{name:"Rukia Kuchiki",shop:false,ability:'walljump',abilityName:'Wall Jump',abilityDesc:'Jump off walls by pressing Space while sliding!\nUse this to reach high places.',lines:["Ichigo! I'll teach you something important.","When you slide against a wall, press Space to wall-jump!","You'll need it to get past the cliffs ahead.","Practice it well — the Seireitei won't be easy."]},
  yoruichi:{name:"Yoruichi Shihōin",shop:false,ability:'dash',abilityName:'Flash Step (Shunpo)',abilityDesc:'Press SHIFT to dash forward with invincibility!\nPass through gaps and dodge attacks.',lines:["Not bad kid, but you're too slow.","I'll teach you Shunpo — the Flash Step!","Press SHIFT to dash. You're invincible during it.","Use it to cross the gap ahead. Don't fall!"]},
  renji_npc:{name:"Renji Abarai",shop:false,lines:["Tch... you actually beat me.","I underestimated you, Ichigo.","Byakuya is ahead. He's on another level entirely.","His Senbonzakura... be ready for anything."]},
  urahara2:{name:"Kisuke Urahara",shop:true,lines:["Oh my~ you made it past Renji!","I set up a little branch shop here.","You'll need supplies for what's ahead.","Byakuya Kuchiki won't show mercy~"]},
  chad:{name:"Yasutora Sado",shop:false,ability:'getsuga',abilityName:'Getsuga Tenshō',abilityDesc:'Press K to fire a powerful energy wave!\nCosts 25 Reiatsu. Breaks through enemies.',lines:["Ichigo... I've been training too.","I can feel your Zanpakuto's power growing.","Channel your Reiatsu through Zangetsu!","Press K to unleash Getsuga Tenshō!"]},
  urahara3:{name:"Kisuke Urahara",shop:true,lines:["My my, you defeated Captain Kuchiki!","That's quite the achievement~","Hueco Mundo lies beyond...","The Espada await. Be careful, Ichigo."]},
  orihime:{name:"Orihime Inoue",shop:false,healer:true,lines:["Kurosaki-kun! You came for me!","I knew you would... I believed in you.","Let me heal your wounds. Sōten Kisshun!","Please be careful... the Espada are strong."]},
  nel:{name:"Nelliel Tu Odelschwanck",shop:false,ability:'cero',abilityName:'Cero',abilityDesc:'Press L to fire a devastating Cero blast!\nCosts 20 Reiatsu. Long range attack.',lines:["Itsygo! Nel will help you!","Nel used to be an Espada... the Tercera.","Nel can teach you to fire Cero!","Press L to blast your enemies!"]},
  grimmjow_npc:{name:"Grimmjow Jaegerjaquez",shop:false,lines:["Tch... you got stronger, Kurosaki.","But don't think this is over between us!","Ulquiorra is deeper in Las Noches.","He's different from me... be ready."]},
  urahara4:{name:"Kisuke Urahara",shop:true,lines:["A shop in Hueco Mundo? Of course!","I have connections everywhere~","You'll need these items for the Espada.","Good luck, Ichigo!"]}
};

// ─────────────────────────────── ROOM DATA ────────────────────────────────────
const RM={};
RM['r1']={zone:'rukon',w:30,h:17,
  tiles:(()=>{let w=30,h=17,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2||x===0)?1:0;}
  for(let x=8;x<12;x++)t[11][x]=2;for(let x=16;x<20;x++)t[9][x]=2;for(let x=22;x<26;x++)t[11][x]=2;
  t[14][10]=3;t[14][11]=3;
  for(let y=1;y<h-2;y++)if(y!==13&&y!==14)t[y][w-1]=1;return t;})(),
  enemies:[{type:'hollow',x:12,y:12},{type:'hollow',x:20,y:12},{type:'fly',x:16,y:7}],
  npcs:[{type:'urahara',x:6,y:13}],
  trans:[{x:29,yA:13,yB:14,to:'r2',tx:2,ty:15}],save:null};

RM['r2']={zone:'rukon',w:40,h:20,
  tiles:(()=>{let w=40,h=20,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2)?1:0;}
  for(let y=0;y<h;y++){if(y!==15&&y!==16)t[y][0]=1;t[y][w-1]=1;}
  for(let x=1;x<6;x++)t[17][x]=2;for(let x=3;x<7;x++)t[15][x]=2;for(let x=7;x<11;x++)t[13][x]=2;for(let x=11;x<15;x++)t[15][x]=2;
  for(let x=15;x<20;x++){t[14][x]=1;t[15][x]=1;}
  for(let y=3;y<18;y++){t[y][24]=1;t[y][29]=1;}
  for(let x=20;x<25;x++)t[16][x]=2;for(let x=20;x<24;x++)t[13][x]=2;for(let x=25;x<29;x++)t[16][x]=2;
  t[13][25]=2;t[13][26]=2;t[10][27]=2;t[10][28]=2;t[7][25]=2;t[7][26]=2;t[4][27]=2;t[4][28]=2;
  for(let y=2;y<5;y++)t[y][29]=0;
  for(let x=30;x<w;x++)t[1][x]=1;for(let x=30;x<38;x++)t[4][x]=2;
  for(let y=1;y<h-2;y++)if(y!==3&&y!==4)t[y][w-1]=1;
  for(let x=25;x<29;x++)t[h-2][x]=3;return t;})(),
  enemies:[{type:'hollow',x:9,y:12},{type:'fly',x:22,y:10}],
  npcs:[{type:'rukia',x:17,y:12}],
  trans:[{x:0,yA:15,yB:16,to:'r1',tx:27,ty:13},{x:39,yA:3,yB:4,to:'r3',tx:2,ty:13}],
  save:{x:16,y:12}};

RM['r3']={zone:'rukon',w:45,h:17,
  tiles:(()=>{let w=45,h=17,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2)?1:0;}
  for(let y=0;y<h;y++){if(y!==13&&y!==14)t[y][0]=1;if(y!==13&&y!==14)t[y][w-1]=1;}
  for(let x=6;x<10;x++)t[12][x]=2;
  for(let x=15;x<20;x++){t[h-2][x]=0;t[h-3][x]=0;}for(let x=15;x<20;x++)t[h-3][x]=3;
  for(let x=25;x<32;x++){t[h-2][x]=0;t[h-3][x]=0;}for(let x=25;x<32;x++)t[h-3][x]=3;
  for(let x=20;x<25;x++)t[13][x]=1;
  for(let x=32;x<w;x++)t[h-2][x]=1;for(let x=36;x<40;x++)t[10][x]=2;return t;})(),
  enemies:[{type:'hollow',x:22,y:12},{type:'fly',x:35,y:8},{type:'hollow',x:38,y:13}],
  npcs:[{type:'yoruichi',x:7,y:11}],
  trans:[{x:0,yA:13,yB:14,to:'r2',tx:37,ty:3},{x:44,yA:13,yB:14,to:'s1',tx:2,ty:13}],
  save:{x:34,y:13}};

RM['s1']={zone:'seireitei',w:40,h:17,
  tiles:(()=>{let w=40,h=17,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2)?1:0;}
  for(let y=0;y<h;y++){if(y!==13&&y!==14)t[y][0]=1;if(y!==13&&y!==14)t[y][w-1]=1;}
  for(let p=0;p<4;p++){const px=8+p*8;for(let py=5;py<15;py++)t[py][px]=1;}
  for(let x=3;x<8;x++)t[8][x]=2;for(let x=9;x<16;x++)t[6][x]=2;
  for(let x=17;x<24;x++)t[8][x]=2;for(let x=25;x<32;x++)t[6][x]=2;
  for(let x=33;x<38;x++)t[10][x]=2;return t;})(),
  enemies:[{type:'guard',x:10,y:13},{type:'guard',x:22,y:13},{type:'guard',x:34,y:9}],
  npcs:[],
  trans:[{x:0,yA:13,yB:14,to:'r3',tx:42,ty:13},{x:39,yA:13,yB:14,to:'boss1',tx:2,ty:10}],
  save:{x:35,y:13}};

RM['boss1']={zone:'seireitei',w:28,h:14,
  tiles:(()=>{let w=28,h=14,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2||x===w-1)?1:0;}
  for(let y=0;y<h;y++)if(y!==10&&y!==11)t[y][0]=1;
  for(let x=5;x<8;x++)t[9][x]=2;for(let x=20;x<23;x++)t[9][x]=2;for(let x=11;x<17;x++)t[7][x]=2;return t;})(),
  enemies:[],npcs:[],boss:{type:'renji',x:20,y:9},
  trans:[{x:0,yA:10,yB:11,to:'s1',tx:37,ty:13}],save:null};

RM['post_renji']={zone:'seireitei',w:45,h:17,
  tiles:(()=>{let w=45,h=17,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2)?1:0;}
  for(let y=0;y<h;y++){if(y!==13&&y!==14)t[y][0]=1;if(y!==13&&y!==14)t[y][w-1]=1;}
  for(let x=4;x<8;x++)t[12][x]=2;for(let x=14;x<18;x++)t[12][x]=2;
  for(let y=8;y<15;y++)t[y][22]=5;for(let y=8;y<15;y++)t[y][30]=5;
  for(let x=24;x<29;x++)t[12][x]=2;for(let x=32;x<36;x++)t[10][x]=2;return t;})(),
  enemies:[{type:'hollow',x:25,y:11},{type:'guard',x:33,y:9},{type:'fly',x:28,y:6}],
  npcs:[{type:'renji_npc',x:5,y:11},{type:'urahara2',x:8,y:13},{type:'chad',x:15,y:11}],
  trans:[{x:0,yA:13,yB:14,to:'boss1',tx:25,ty:10},{x:44,yA:13,yB:14,to:'s2',tx:2,ty:13}],
  save:{x:3,y:13}};

RM['s2']={zone:'seireitei',w:40,h:17,
  tiles:(()=>{let w=40,h=17,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2)?1:0;}
  for(let y=0;y<h;y++){if(y!==13&&y!==14)t[y][0]=1;if(y!==13&&y!==14)t[y][w-1]=1;}
  for(let p=0;p<5;p++){const px=6+p*7;for(let py=6;py<15;py++)t[py][px]=1;}
  for(let x=3;x<6;x++)t[9][x]=2;for(let x=7;x<13;x++)t[7][x]=2;for(let x=14;x<20;x++)t[9][x]=2;
  for(let x=21;x<27;x++)t[7][x]=2;for(let x=28;x<34;x++)t[9][x]=2;for(let x=35;x<38;x++)t[11][x]=2;
  t[14][10]=3;t[14][17]=3;t[14][24]=3;return t;})(),
  enemies:[{type:'guard',x:10,y:13},{type:'guard',x:18,y:13},{type:'guard',x:30,y:8},{type:'fly',x:25,y:4}],
  npcs:[],
  trans:[{x:0,yA:13,yB:14,to:'post_renji',tx:42,ty:13},{x:39,yA:13,yB:14,to:'boss2',tx:2,ty:10}],
  save:{x:36,y:13}};

RM['boss2']={zone:'seireitei',w:30,h:14,
  tiles:(()=>{let w=30,h=14,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2||x===w-1)?1:0;}
  for(let y=0;y<h;y++)if(y!==10&&y!==11)t[y][0]=1;
  for(let x=5;x<9;x++)t[9][x]=2;for(let x=21;x<25;x++)t[9][x]=2;for(let x=12;x<18;x++)t[7][x]=2;
  for(let x=8;x<12;x++)t[5][x]=2;for(let x=18;x<22;x++)t[5][x]=2;return t;})(),
  enemies:[],npcs:[],boss:{type:'byakuya',x:22,y:9},
  trans:[{x:0,yA:10,yB:11,to:'s2',tx:37,ty:13}],save:null};

RM['victory']={zone:'seireitei',w:25,h:14,
  tiles:(()=>{let w=25,h=14,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2||x===0)?1:0;}
  for(let y=0;y<h;y++)if(y!==10&&y!==11)t[y][w-1]=1;return t;})(),
  enemies:[],npcs:[{type:'urahara3',x:10,y:11}],
  trans:[{x:0,yA:10,yB:11,to:'boss2',tx:26,ty:10},{x:24,yA:10,yB:11,to:'h1',tx:2,ty:13}],
  save:{x:5,y:11}};

RM['h1']={zone:'hueco',w:50,h:17,
  tiles:(()=>{let w=50,h=17,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2)?1:0;}
  for(let y=0;y<h;y++){if(y!==13&&y!==14)t[y][0]=1;if(y!==13&&y!==14)t[y][w-1]=1;}
  for(let x=10;x<15;x++)t[h-2][x]=6;
  for(let x=25;x<32;x++){t[h-2][x]=0;t[h-1][x]=7;}
  for(let x=8;x<12;x++)t[11][x]=2;for(let x=18;x<24;x++)t[10][x]=2;for(let x=35;x<40;x++)t[9][x]=2;
  for(let py=8;py<15;py++){t[py][20]=1;t[py][38]=1;}return t;})(),
  enemies:[{type:'hollow',x:12,y:13},{type:'adjuchas',x:28,y:13},{type:'menos',x:42,y:10}],
  npcs:[],
  trans:[{x:0,yA:13,yB:14,to:'victory',tx:22,ty:10},{x:49,yA:13,yB:14,to:'h2',tx:2,ty:13}],
  save:{x:5,y:13}};

RM['h2']={zone:'hueco',w:45,h:20,
  tiles:(()=>{let w=45,h=20,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2)?1:0;}
  for(let y=0;y<h;y++){if(y!==13&&y!==14)t[y][0]=1;if(y!==16&&y!==17)t[y][w-1]=1;}
  for(let x=5;x<10;x++)t[12][x]=2;
  for(let x=15;x<20;x++){t[h-2][x]=0;t[h-3][x]=0;t[h-4][x]=0;t[h-1][x]=7;}
  for(let x=18;x<25;x++)t[h-2][x]=1;
  for(let x=22;x<28;x++)t[17][x]=2;for(let x=30;x<w;x++)t[h-2][x]=1;
  for(let x=32;x<38;x++)t[15][x]=2;return t;})(),
  enemies:[{type:'adjuchas',x:24,y:16},{type:'adjuchas',x:35,y:14},{type:'menos',x:40,y:15}],
  npcs:[{type:'nel',x:7,y:11}],
  trans:[{x:0,yA:13,yB:14,to:'h1',tx:47,ty:13},{x:44,yA:16,yB:17,to:'ln1',tx:2,ty:13}],
  save:{x:24,y:16}};

RM['ln1']={zone:'lasnoches',w:50,h:17,
  tiles:(()=>{let w=50,h=17,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2)?1:0;}
  for(let y=0;y<h;y++){if(y!==13&&y!==14)t[y][0]=1;if(y!==13&&y!==14)t[y][w-1]=1;}
  for(let p=0;p<6;p++){const px=6+p*7;for(let py=4;py<15;py++)t[py][px]=1;}
  for(let x=3;x<6;x++)t[8][x]=2;for(let x=7;x<13;x++)t[6][x]=2;for(let x=14;x<20;x++)t[8][x]=2;
  for(let x=21;x<27;x++)t[6][x]=2;for(let x=28;x<34;x++)t[8][x]=2;for(let x=35;x<41;x++)t[6][x]=2;
  for(let x=42;x<48;x++)t[10][x]=2;return t;})(),
  enemies:[{type:'arrancar',x:10,y:13},{type:'arrancar',x:24,y:13},{type:'arrancar',x:38,y:5},{type:'adjuchas',x:45,y:9}],
  npcs:[{type:'urahara4',x:4,y:13}],
  trans:[{x:0,yA:13,yB:14,to:'h2',tx:42,ty:16},{x:49,yA:13,yB:14,to:'boss3',tx:2,ty:10}],
  save:{x:44,y:13}};

RM['boss3']={zone:'lasnoches',w:32,h:14,
  tiles:(()=>{let w=32,h=14,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2||x===w-1)?1:0;}
  for(let y=0;y<h;y++)if(y!==10&&y!==11)t[y][0]=1;
  for(let x=5;x<10;x++)t[9][x]=2;for(let x=22;x<27;x++)t[9][x]=2;for(let x=12;x<20;x++)t[7][x]=2;
  for(let x=8;x<13;x++)t[5][x]=2;for(let x=19;x<24;x++)t[5][x]=2;return t;})(),
  enemies:[],npcs:[],boss:{type:'grimmjow',x:24,y:9},
  trans:[{x:0,yA:10,yB:11,to:'ln1',tx:47,ty:13}],save:null};

RM['post_grimm']={zone:'lasnoches',w:40,h:17,
  tiles:(()=>{let w=40,h=17,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2)?1:0;}
  for(let y=0;y<h;y++){if(y!==13&&y!==14)t[y][0]=1;if(y!==13&&y!==14)t[y][w-1]=1;}
  for(let x=6;x<12;x++)t[11][x]=2;for(let x=18;x<24;x++)t[9][x]=2;for(let x=28;x<34;x++)t[11][x]=2;return t;})(),
  enemies:[{type:'arrancar',x:20,y:8},{type:'arrancar',x:30,y:10}],
  npcs:[{type:'grimmjow_npc',x:8,y:10}],
  trans:[{x:0,yA:13,yB:14,to:'boss3',tx:28,ty:10},{x:39,yA:13,yB:14,to:'boss4',tx:2,ty:10}],
  save:{x:6,y:13}};

RM['boss4']={zone:'lasnoches',w:35,h:16,
  tiles:(()=>{let w=35,h=16,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2||x===w-1)?1:0;}
  for(let y=0;y<h;y++)if(y!==12&&y!==13)t[y][0]=1;
  for(let x=5;x<10;x++)t[11][x]=2;for(let x=25;x<30;x++)t[11][x]=2;for(let x=12;x<23;x++)t[9][x]=2;
  for(let x=8;x<14;x++)t[6][x]=2;for(let x=21;x<27;x++)t[6][x]=2;for(let x=14;x<21;x++)t[4][x]=2;return t;})(),
  enemies:[],npcs:[],boss:{type:'ulquiorra',x:26,y:10},
  trans:[{x:0,yA:12,yB:13,to:'post_grimm',tx:37,ty:13}],save:null};

RM['ending']={zone:'lasnoches',w:20,h:14,
  tiles:(()=>{let w=20,h=14,t=[];for(let y=0;y<h;y++){t[y]=[];for(let x=0;x<w;x++)t[y][x]=(y===0||y>=h-2||x===0||x===w-1)?1:0;}return t;})(),
  enemies:[],npcs:[],trans:[],save:{x:10,y:11},ending:true};

// ─────────────────────────────── CAMERA ───────────────────────────────────────
const cam={x:0,y:0,update(tx,ty,rw,rh){
  let gx=tx-C.width/2,gy=ty-C.height/2;
  gx=Math.max(0,Math.min(gx,rw*T-C.width));gy=Math.max(0,Math.min(gy,rh*T-C.height));
  this.x+=(gx-this.x)*.08;this.y+=(gy-this.y)*.08;
}};

// ─────────────────────────────── WEAPON MODIFIER ──────────────────────────────
// frozenBlade: slows + ice particles on hit; whipBlade: extended melee reach
const weaponMods={
  frozenBlade:{active:false,slowTime:0},
  whipBlade:{active:false}
};

// ─────────────────────────────── PLAYER ───────────────────────────────────────
const P={
  x:128,y:400,w:20,h:38,vx:0,vy:0,fc:1,gnd:false,wl:0,
  mHP:5,hp:5,mSl:100,sl:50,cn:30,
  hasDash:false,hasWJ:false,hasGet:false,hasCero:false,hasDJ:false,hasBankai:false,hasHollow:false,
  dT:0,dC:0,dD:0,aT:0,aC:0,aD:0,inv:0,hlT:0,jB:0,coy:0,dju:false,
  as:'idle',af:0,at:0,trail:[],
  sR:'r1',sX:128,sY:400,items:[],dead:false,bk:0,bkActive:false,hm:0,hmActive:false,inSand:false,
  // Reiatsu charge
  charging:false,chargeT:0,
  // Animation frame data for multi-frame sprites
  animFrame:0,animTimer:0,

  reset(){this.hp=this.mHP;this.sl=Math.min(50,this.mSl);this.inv=0;this.dT=0;this.aT=0;this.hlT=0;this.vx=0;this.vy=0;this.dead=false;this.bkActive=false;this.bk=0;this.hmActive=false;this.hm=0;this.charging=false;this.chargeT=0;},
  bounds(){return{left:this.x,top:this.y,right:this.x+this.w,bottom:this.y+this.h};},

  update(room){
    if(this.dead)return;

    // ── Bankai
    if(this.hasBankai&&this.bk>=100&&!this.bkActive&&!this.hmActive&&IN.pressed('bankai')){
      this.bkActive=true;this.bk=100;AU.play('ability');
      sp(this.x+this.w/2,this.y+this.h/2,30,'#ff4400',5,30,4,'sp');notify('BANKAI!');
    }
    if(this.bkActive){this.bk-=0.12;if(this.bk<=0){this.bkActive=false;this.bk=0;}}

    // ── Hollow Mask
    if(this.hasHollow&&this.hm>=100&&!this.hmActive&&!this.bkActive&&IN.pressed('hollow')){
      this.hmActive=true;this.hm=100;AU.play('hollow');
      sp(this.x+this.w/2,this.y+this.h/2,25,'#fff',4,25,3,'sp');notify('HOLLOWFICATION!');
    }
    if(this.hmActive){this.hm-=0.15;if(this.hm<=0){this.hmActive=false;this.hm=0;}}

    const pwrMult=this.bkActive?1.4:(this.hmActive?1.25:1);

    // ── Active Reiatsu Charge (hold C)
    this.charging=false;
    if(IN.held('charge')&&this.sl<this.mSl&&this.gnd&&this.aT<=0&&this.dT<=0&&this.hlT<=0){
      this.charging=true;
      this.chargeT++;
      const rate=0.35+(this.chargeT>60?0.25:0);
      this.sl=Math.min(this.mSl,this.sl+rate);
      this.vx*=0.5; // exposed / slowed
      if(fr%8===0){
        sp(this.x+this.w/2,this.y+this.h/2,4,'#3366ff',2,25,3,'sp');
        sp(this.x+this.w/2,this.y+this.h,3,'#66aaff',1.5,20,2,'sp');
      }
      if(fr%120===0)AU.play('charge');
    } else {
      this.chargeT=0;
    }

    // Update charge UI
    const chargeUI=document.getElementById('charge-indicator');
    const chargeFill=document.getElementById('charge-bar-fill');
    if(this.charging){
      chargeUI.style.display='flex';
      chargeFill.style.width=(this.sl/this.mSl*100)+'%';
    } else {
      chargeUI.style.display='none';
    }

    // ── Dash
    if(this.dT>0){
      this.dT--;this.vx=this.dD*DS*pwrMult;this.vy=0;
      if(fr%2===0)sp(this.x+this.w/2,this.y+this.h/2,2,this.bkActive?'#ff6633':'#66aaff',1,10,3);
      this.trail.push({x:this.x,y:this.y,a:1});
      if(this.trail.length>5)this.trail.shift();
    } else {
      this.trail=this.trail.filter(t=>{t.a-=.15;return t.a>0;});
      let mx=0;
      if(IN.held('left'))mx=-1;
      if(IN.held('right'))mx=1;
      const spd=this.inSand?PS*0.5:PS*pwrMult;
      if(mx!==0&&this.hlT<=0&&!this.charging){this.fc=mx;this.vx=mx*spd;}
      else if(!this.charging){this.vx*=.7;if(Math.abs(this.vx)<.1)this.vx=0;}

      if(this.wl!==0&&this.vy>0&&mx===this.wl&&this.hasWJ){this.vy+=G*.3;if(this.vy>2)this.vy=2;}
      else this.vy+=G;
      if(this.vy>MF)this.vy=MF;

      // ── Heal
      if(this.hlT>0){
        this.hlT--;this.vx=0;
        if(fr%4===0)sp(this.x+this.w/2,this.y+this.h/2,3,'#55ffaa',2,20,2,'sp');
        if(this.hlT===0){this.hp=Math.min(this.mHP,this.hp+1);this.sl-=HC;AU.play('heal');sp(this.x+this.w/2,this.y+this.h/2,15,'#55ffaa',3,30,4,'sp');notify('+1 HP');}
      }
    }

    if(this.gnd){this.coy=6;this.dju=false;}else this.coy--;
    if(IN.pressed('jump'))this.jB=8;if(this.jB>0)this.jB--;
    if(this.jB>0&&this.dT<=0&&this.hlT<=0&&!this.charging){
      if(this.coy>0){this.vy=JF*(this.inSand?0.7:1);this.gnd=false;this.coy=0;this.jB=0;AU.play('jump');sp(this.x+this.w/2,this.y+this.h,4,'#bbccdd',2,8,2);}
      else if(this.hasWJ&&this.wl!==0){this.vx=-this.wl*WJX;this.vy=WJY;this.fc=-this.wl;this.wl=0;this.jB=0;AU.play('jump');}
      else if(this.hasDJ&&!this.dju){this.vy=JF*.85;this.dju=true;this.jB=0;AU.play('jump');sp(this.x+this.w/2,this.y+this.h,8,'#9977ff',3,12,3,'sp');}
    }
    if(!IN.held('jump')&&this.vy<-2)this.vy*=.7;

    // ── Flash Step
    if(this.dC>0)this.dC--;
    if(IN.pressed('dash')&&this.hasDash&&this.dC<=0&&this.dT<=0&&this.hlT<=0&&!this.charging){
      this.dT=DD;this.dC=DC;this.dD=this.fc;this.inv=Math.max(this.inv,DD);AU.play('dash');shk=3;
    }

    // ── Attack
    if(this.aC>0)this.aC--;
    if(IN.pressed('attack')&&this.aT<=0&&this.aC<=0&&this.dT<=0&&this.hlT<=0&&!this.charging){
      this.aT=AD;this.aC=AC;
      if(IN.held('up'))this.aD=0;
      else if(IN.held('down')&&!this.gnd)this.aD=1;
      else this.aD=this.fc===1?3:2;
      const atkRange=weaponMods.whipBlade.active?AR*1.55:AR;
      AU.play('slash');slFX(this.x+this.w/2,this.y+this.h/2,this.aD);shk=2;
    }
    if(this.aT>0)this.aT--;

    // ── Getsuga
    if(IN.pressed('getsuga')&&this.hasGet&&this.sl>=GC&&this.aT<=0&&this.dT<=0&&this.hlT<=0&&!this.charging){
      this.sl-=GC;AU.play('getsuga');shk=8;fls=5;
      const d=pwrMult>1?12:8;
      projs.push({x:this.x+this.w/2+this.fc*20,y:this.y+this.h/2-5,vx:this.fc*d,vy:0,w:pwrMult>1?50:40,h:pwrMult>1?25:20,dmg:Math.floor(15*pwrMult),life:40,fc:this.fc,getsuga:true,bk:this.bkActive});
    }

    // ── Cero
    if(IN.pressed('cero')&&this.hasCero&&this.sl>=CC&&this.aT<=0&&this.dT<=0&&this.hlT<=0&&!this.charging){
      this.sl-=CC;AU.play('cero');shk=6;fls=4;
      projs.push({x:this.x+this.w/2+this.fc*15,y:this.y+this.h/2,vx:this.fc*10,vy:0,w:25,h:25,dmg:Math.floor(12*pwrMult),life:35,fc:this.fc,cero:true});
    }

    // ── Heal (F key)
    if(IN.held('heal')&&this.sl>=HC&&this.hp<this.mHP&&this.hlT<=0&&this.gnd&&this.dT<=0)this.hlT=45;
    if(this.hlT>0&&!IN.held('heal'))this.hlT=0;

    if(this.inv>0)this.inv--;
    this.collide(room);

    // ── Reiatsu passive regen (slow)
    if(!this.charging&&fr%180===0&&this.sl<this.mSl)this.sl=Math.min(this.mSl,this.sl+1);

    // ── Anim state
    this.at++;
    // Multi-frame animation timer
    this.animTimer++;
    if(this.animTimer>6){this.animTimer=0;this.animFrame=(this.animFrame+1)%4;}

    if(this.aT>0)this.as='attack';
    else if(this.dT>0)this.as='dash';
    else if(this.charging)this.as='charge';
    else if(this.hlT>0)this.as='heal';
    else if(!this.gnd){this.as=this.vy<0?'jump':'fall';if(this.wl!==0&&this.hasWJ)this.as='wallslide';}
    else if(Math.abs(this.vx)>.5)this.as='run';
    else this.as='idle';

    if((this.bkActive||this.hmActive)&&fr%3===0)sp(this.x+this.w/2,this.y+this.h/2,2,this.bkActive?'#ff4400':'#fff',3,15,3,'sp');
  },

  collide(room){
    const t=room.tiles;this.gnd=false;this.wl=0;this.inSand=false;
    this.x+=this.vx;let b=this.bounds();
    for(let ty=Math.floor(b.top/T);ty<=Math.floor(b.bottom/T);ty++)
      for(let tx=Math.floor(b.left/T);tx<=Math.floor(b.right/T);tx++){
        if(ty<0||ty>=room.h||tx<0||tx>=room.w)continue;
        const tl=t[ty][tx];
        if(tl===1||tl===5){const r={left:tx*T,top:ty*T,right:(tx+1)*T,bottom:(ty+1)*T};if(rO(b,r)){if(this.vx>0){this.x=r.left-this.w;this.wl=1;}else if(this.vx<0){this.x=r.right;this.wl=-1;}this.vx=0;b=this.bounds();}}
      }
    this.y+=this.vy;b=this.bounds();
    for(let ty=Math.floor(b.top/T);ty<=Math.floor(b.bottom/T);ty++)
      for(let tx=Math.floor(b.left/T);tx<=Math.floor(b.right/T);tx++){
        if(ty<0||ty>=room.h||tx<0||tx>=room.w)continue;
        const tl=t[ty][tx];
        if(tl===1||tl===5){const r={left:tx*T,top:ty*T,right:(tx+1)*T,bottom:(ty+1)*T};if(rO(b,r)){if(this.vy>0){this.y=r.top-this.h;this.gnd=true;}else if(this.vy<0)this.y=r.bottom;this.vy=0;b=this.bounds();}}
        else if(tl===2&&this.vy>0){const r={left:tx*T,top:ty*T,right:(tx+1)*T,bottom:ty*T+8};if((b.bottom-this.vy)<=r.top+4&&rO(b,r)&&!ks['ArrowDown']&&!ks['KeyS']){this.y=r.top-this.h;this.vy=0;this.gnd=true;b=this.bounds();}}
        else if(tl===3){const r={left:tx*T+2,top:ty*T+6,right:(tx+1)*T-2,bottom:(ty+1)*T};if(rO(b,r)){this.takeDmg(1);this.vy=-8;this.y-=10;}}
        else if(tl===6){this.inSand=true;if(this.vy>0)this.vy*=0.6;if(fr%10===0)sp(this.x+this.w/2,this.y+this.h,1,'#aa9966',1,15,2,'sand');}
      }
    if(!tLock&&room.trans)
      for(const tr of room.trans){
        const px=this.x+this.w/2;
        if(Math.abs(px-tr.x*T-T/2)<T*1.2){
          const tY=Math.floor((this.y+this.h/2)/T);
          if(tY>=tr.yA&&tY<=tr.yB){doTrans(tr.to,tr.tx*T,tr.ty*T);return;}
        }
      }
  },

  atkBounds(){
    const cx=this.x+this.w/2,cy=this.y+this.h/2;
    const r=weaponMods.whipBlade.active?Math.floor(AR*1.55):AR;
    switch(this.aD){
      case 0:return{left:cx-20,top:cy-r-10,right:cx+20,bottom:cy};
      case 1:return{left:cx-20,top:cy,right:cx+20,bottom:cy+r+10};
      case 2:return{left:cx-r-10,top:cy-18,right:cx,bottom:cy+18};
      case 3:return{left:cx,top:cy-18,right:cx+r+10,bottom:cy+18};
    }
  },

  takeDmg(n){
    if(this.inv>0||this.dead)return;
    this.hp-=n;this.inv=IT;this.hlT=0;AU.play('hurt');shk=8;fls=3;
    this.vy=-5;sp(this.x+this.w/2,this.y+this.h/2,10,'#ff5555',4,20,3);
    dmgNums.push({x:this.x+this.w/2+(Math.random()-.5)*10,y:this.y,v:'-'+n,c:'#ff3333',l:40,ml:40});
    if(this.hp<=0)this.die();
  },

  die(){
    this.dead=true;gs=GS.DEAD;
    document.getElementById('game-over-screen').style.display='flex';
    sp(this.x+this.w/2,this.y+this.h/2,30,'#ff2222',5,40,4,'k');
    AU.stopMusic();
  },

  respawn(){
    this.x=this.sX;this.y=this.sY;this.reset();
    loadRoom(this.sR);gs=GS.PLAY;
    document.getElementById('game-over-screen').style.display='none';
  },

  draw(c,cx,cy){
    if(this.dead)return;
    const sx=this.x-cx,sy=this.y-cy;
    for(const t of this.trail){c.globalAlpha=t.a*.3;drIchigo(c,t.x-cx,t.y-cy,this.fc,'#3366cc',null,0,0,0,false,false,0);c.globalAlpha=1;}
    if(this.inv>0&&Math.floor(this.inv/3)%2===0)c.globalAlpha=.4;
    if(this.bkActive||this.hmActive){
      c.save();c.globalAlpha=.2+Math.sin(fr*.15)*.1;
      c.fillStyle=this.bkActive?'#ff4400':'#fff';
      c.beginPath();c.arc(sx+this.w/2,sy+this.h/2,28+Math.sin(fr*.1)*4,0,Math.PI*2);c.fill();
      c.restore();
    }
    // Charge aura
    if(this.charging){
      c.save();c.globalAlpha=0.15+Math.sin(fr*.2)*.08;
      c.fillStyle='#3366ff';
      c.beginPath();c.arc(sx+this.w/2,sy+this.h/2,32+Math.sin(fr*.15)*5,0,Math.PI*2);c.fill();
      c.restore();
    }
    drIchigo(c,sx,sy,this.fc,null,this.as,this.at,this.aD,this.aT,this.bkActive,this.hmActive,this.animFrame);
    c.globalAlpha=1;

    // Attack arc
    if(this.aT>6){
      const p=1-(this.aT/AD),ax=this.x+this.w/2-cx,ay=this.y+this.h/2-cy;
      c.save();c.globalAlpha=.5*(1-p);
      c.strokeStyle=this.bkActive?'#ff6633':(this.hmActive?'#ff0000':(weaponMods.frozenBlade.active?'#88ccff':'#88bbff'));
      c.lineWidth=3;c.shadowColor=this.bkActive?'#ff4400':'#66aaff';c.shadowBlur=12;
      const atkR=weaponMods.whipBlade.active?AR*1.55:AR;
      let sa,ea;
      switch(this.aD){case 0:sa=-Math.PI*.8;ea=-Math.PI*.2;break;case 1:sa=Math.PI*.2;ea=Math.PI*.8;break;case 2:sa=Math.PI*.7;ea=Math.PI*1.3;break;case 3:sa=-Math.PI*.3;ea=Math.PI*.3;break;}
      c.beginPath();c.arc(ax,ay,atkR*(.5+p*.5),sa+p*.3,ea+p*.3);c.stroke();
      c.shadowBlur=0;c.restore();
    }
  }
};

// ─────────────────────────────── ICHIGO SPRITE ────────────────────────────────
// Multi-frame sprite: animFrame 0-3 drives subtle offsets for run/idle/jump
function drIchigo(c,sx,sy,fc,ov,as,at,ad,atk,bk,hm,animFrame){
  c.save();
  if(fc===-1){c.translate(sx+P.w,sy);c.scale(-1,1);sx=0;sy=0;}

  const f=animFrame||0;
  const bodyC=ov||(bk?'#1a0808':'#1a1a2a');
  const skinC=ov||'#f5d0a8';
  const hairC=ov||(bk?'#1a1a1a':'#ff7722');
  const bladeC=ov||(bk?'#111':'#ddddef');

  // ─ Frame-driven offsets
  let legLo=0,legRo=0,bodyBob=0,headBob=0;
  if(as==='run'){
    // alternating leg swing frames
    legLo=f<2?-3:3; legRo=f<2?3:-3;
    bodyBob=Math.abs(f-1.5)<1?-1:0;
    headBob=bodyBob;
  } else if(as==='idle'){
    bodyBob=f%4<2?0:1; headBob=bodyBob;
  } else if(as==='jump'||as==='fall'){
    legLo=-4; legRo=-2; bodyBob=-2;
  } else if(as==='wallslide'){
    legLo=2; legRo=2; bodyBob=1;
  } else if(as==='charge'){
    bodyBob=f%2===0?-1:0;
    headBob=bodyBob;
  } else if(as==='heal'){
    bodyBob=f%2===0?-2:0;
  }

  // ─ Legs (black hakama)
  c.fillStyle=bodyC;
  c.fillRect(sx+5,sy+26+legLo,5,12);
  c.fillRect(sx+10,sy+26+legRo,5,12);

  // Sandals
  c.fillStyle=ov||'#8b7355';
  c.fillRect(sx+4,sy+36+legLo,6,2);
  c.fillRect(sx+10,sy+36+legRo,6,2);

  // ─ Body
  c.fillStyle=bodyC;
  c.fillRect(sx+3,sy+14+bodyBob,14,14);

  // White inner robe
  if(!ov){c.fillStyle=bk?'#333':'#e8e8e8';c.fillRect(sx+7,sy+14+bodyBob,4,10);}

  // Obi sash
  c.fillStyle=ov||(bk?'#444':'#eee');
  c.fillRect(sx+3,sy+24+bodyBob,14,2);

  // Red straps (not in bankai)
  if(!ov&&!bk){
    c.fillStyle='#aa2222';
    c.fillRect(sx+2,sy+14+bodyBob,2,14);
    c.fillRect(sx+16,sy+14+bodyBob,2,14);
  }

  // ─ Head
  c.fillStyle=skinC;
  c.fillRect(sx+5,sy+4+headBob,10,10);

  // Spiky orange hair – frame-shifted tips
  c.fillStyle=hairC;
  c.fillRect(sx+4,sy+2+headBob,12,6);
  const tipShift=f%2===0?0:1;
  c.fillRect(sx+3,sy+headBob-tipShift,4,4);
  c.fillRect(sx+7,sy+headBob-2-tipShift,3,4);
  c.fillRect(sx+11,sy+headBob-1-tipShift,3,3);
  c.fillRect(sx+13,sy+headBob+1,3,4);
  c.fillRect(sx+3,sy+4+headBob,3,5);
  c.fillRect(sx+14,sy+4+headBob,3,4);
  c.fillRect(sx+8,sy+3+headBob,4,3);

  // Eyes
  if(!ov){
    c.fillStyle=hm?'#000':'#553311';
    c.fillRect(sx+7,sy+7+headBob,2,2);
    c.fillRect(sx+11,sy+7+headBob,2,2);
    if(hm){
      c.fillStyle='#ffdd00';c.fillRect(sx+6,sy+6+headBob,4,3);c.fillRect(sx+10,sy+6+headBob,4,3);
      c.fillStyle='#000';c.fillRect(sx+7,sy+7+headBob,2,2);c.fillRect(sx+11,sy+7+headBob,2,2);
    }
  }

  // Hollow mask (partial)
  if(hm&&!ov){
    c.fillStyle='#f8f8f0';c.fillRect(sx+2,sy+2+headBob,6,10);
    c.fillStyle='#cc0000';c.fillRect(sx+2,sy+3+headBob,2,3);
    c.fillStyle='#000';c.fillRect(sx+4,sy+6+headBob,2,2);
  }

  // Frozen blade tint (frozenBlade mod)
  const frozenTint=weaponMods.frozenBlade.active;
  const actualBladeC=frozenTint?'#aaddff':(bk?'#111':'#ddddef');

  // ─ Zangetsu
  if(as==='attack'&&atk>0){
    const p=1-(atk/AD);let ang;
    switch(ad){case 0:ang=-Math.PI/2+p*.5;break;case 1:ang=Math.PI/2-p*.5;break;case 2:ang=Math.PI+p*Math.PI*.5;break;default:ang=-p*Math.PI*.5;}
    const reach=weaponMods.whipBlade.active?52:36;
    c.save();c.translate(sx+10,sy+15+bodyBob);c.rotate(ang);
    c.fillStyle=actualBladeC;c.fillRect(-2,bk?-42:-reach,bk?5:4,bk?42:reach);
    if(!ov&&!bk){c.fillStyle=frozenTint?'rgba(100,200,255,.5)':'rgba(100,160,255,.4)';c.fillRect(-3,-reach,1,reach);}
    if(bk){c.fillStyle='rgba(255,60,0,.3)';c.fillRect(-4,-42,2,42);}
    // Whip segments
    if(weaponMods.whipBlade.active){
      c.fillStyle='rgba(200,80,0,.5)';
      for(let i=0;i<3;i++){c.fillRect(-1,-reach+i*14,3,8);}
    }
    c.fillStyle=ov||'#ffdd33';c.fillRect(-5,-1,11,3);
    c.fillStyle=ov||'#444';c.fillRect(-2,2,5,10);
    if(!ov){c.fillStyle='#ddd';for(let i=0;i<3;i++)c.fillRect(-2,3+i*3,5,1);}
    c.restore();
  } else {
    // Zangetsu on back
    c.fillStyle=actualBladeC;
    c.save();c.translate(sx+2,sy+6+bodyBob);c.rotate(-.2);
    c.fillRect(-2,bk?-28:-22,4,bk?38:32);
    c.fillStyle=ov||'#444';c.fillRect(-2,10,4,8);
    c.fillStyle=ov||'#ffdd33';c.fillRect(-4,9,8,2);
    c.restore();
  }
  c.restore();
}

// ─────────────────────────────── PROJECTILES (PLAYER) ─────────────────────────
let projs=[];
function upPr(room){
  projs=projs.filter(p=>{
    p.x+=p.vx;p.y+=p.vy;p.life--;
    if(p.getsuga&&fr%2===0)sp(p.x,p.y,3,p.bk?'#ff4400':'#ff7700',2,15,3,'k');
    if(p.cero&&fr%2===0)sp(p.x,p.y,2,'#ff0000',2,12,3,'sp');
    const tx=Math.floor(p.x/T),ty=Math.floor(p.y/T);
    if(tx>=0&&tx<room.w&&ty>=0&&ty<room.h){
      if(room.tiles[ty][tx]===1){sp(p.x,p.y,10,'#ff9922',4,20,3);return false;}
      if(room.tiles[ty][tx]===5){room.tiles[ty][tx]=0;sp(p.x,p.y,15,'#887766',5,25,3);AU.play('hit');shk=4;return false;}
    }
    for(const e of ens){
      if(e.hp<=0)continue;
      const eb=e.bounds();
      if(p.x>eb.left&&p.x<eb.right&&p.y>eb.top&&p.y<eb.bottom){
        e.takeDmg(p.dmg);
        sp(p.x,p.y,15,'#ff5500',5,25,4,'k');shk=5;
        // Frozen blade on projectile hit
        if(weaponMods.frozenBlade.active){e.slowTimer=180;iceFX(p.x,p.y);AU.play('iceHit');}
        return false;
      }
    }
    if(boss&&boss.hp>0){
      const bb=boss.bounds();
      if(p.x>bb.left&&p.x<bb.right&&p.y>bb.top&&p.y<bb.bottom){
        boss.takeDmg(p.dmg);sp(p.x,p.y,15,'#ff5500',5,25,4,'k');shk=6;return false;
      }
    }
    return p.life>0;
  });
}
function drPr(c,cx,cy){
  for(const p of projs){
    const sx=p.x-cx,sy=p.y-cy;c.save();
    if(p.getsuga){
      c.fillStyle=p.bk?'#ff4400':'#ff7700';c.shadowColor=p.bk?'#ff2200':'#ff5500';c.shadowBlur=20;
      c.beginPath();c.moveTo(sx+p.fc*20,sy);c.lineTo(sx-p.fc*15,sy-12);c.lineTo(sx-p.fc*10,sy);c.lineTo(sx-p.fc*15,sy+12);c.closePath();c.fill();
      c.fillStyle=p.bk?'#ffaa33':'#ffbb55';c.beginPath();c.moveTo(sx+p.fc*15,sy);c.lineTo(sx-p.fc*8,sy-6);c.lineTo(sx-p.fc*5,sy);c.lineTo(sx-p.fc*8,sy+6);c.closePath();c.fill();
    }else if(p.cero){
      c.fillStyle='#ff0000';c.shadowColor='#ff0000';c.shadowBlur=15;
      c.beginPath();c.arc(sx,sy,p.w/2,0,Math.PI*2);c.fill();
      c.fillStyle='#ff6666';c.beginPath();c.arc(sx,sy,p.w/4,0,Math.PI*2);c.fill();
    }
    c.shadowBlur=0;c.restore();
  }
}

// ─────────────────────────────── ENEMY CLASS ──────────────────────────────────
class En{
  constructor(x,y,type){
    this.x=x*T;this.y=y*T;this.type=type;this.vx=0;this.vy=0;this.fc=-1;
    this.w=28;this.h=28;this.at=0;this.st=0;this.hf=0;this.kb=0;
    this.dmg=1;this.spd=1;this.fly=false;this.state='patrol';this.acd=0;this.gnd=false;
    this.coins=5;this.slowTimer=0;this.jcd=0;
    // Animation
    this.animFrame=0;this.animTimer=0;
    // Patrol bounds – set lazy on first update
    this.patrolLeft=x*T-3*T;this.patrolRight=x*T+3*T;
    this.alertRange=0;this.chaseRange=0;

    if(type==='hollow'){this.hp=this.mhp=3;this.spd=0.8;this.coins=8;this.alertRange=140;this.chaseRange=200;this.w=30;this.h=30;}
    else if(type==='fly'){this.hp=this.mhp=2;this.w=24;this.h=20;this.spd=1.4;this.fly=true;this.flyY=this.y;this.coins=6;this.alertRange=160;this.chaseRange=220;}
    else if(type==='guard'){this.hp=this.mhp=5;this.w=24;this.h=38;this.spd=0.9;this.atkR=52;this.coins=12;this.alertRange=150;this.chaseRange=210;}
    else if(type==='menos'){this.hp=this.mhp=12;this.w=44;this.h=64;this.spd=0.25;this.dmg=2;this.coins=25;this.alertRange=200;this.chaseRange=280;}
    else if(type==='adjuchas'){this.hp=this.mhp=8;this.w=34;this.h=30;this.spd=1.4;this.dmg=2;this.coins=18;this.alertRange=160;this.chaseRange=230;}
    else if(type==='arrancar'){this.hp=this.mhp=7;this.w=24;this.h=40;this.spd=1.0;this.atkR=52;this.coins=15;this.alertRange=155;this.chaseRange=215;}
  }

  bounds(){return{left:this.x,top:this.y,right:this.x+this.w,bottom:this.y+this.h};}
  cx(){return this.x+this.w/2;}
  cy(){return this.y+this.h/2;}

  // Robust wall+edge check for patrol walking
  canWalk(room,dir){
    const frontX=this.x+(dir>0?this.w+3:-3);
    const headY=this.y+this.h*.4;
    const footY=this.y+this.h+4;
    const tx=~~(frontX/T),hy=~~(headY/T),fy=~~(footY/T);
    if(tx<0||tx>=room.w||hy<0||hy>=room.h||fy<0||fy>=room.h)return false;
    const wall=room.tiles[hy]?room.tiles[hy][tx]:1;
    const floor=room.tiles[fy]?room.tiles[fy][tx]:0;
    return wall!==1&&wall!==5&&(floor===1||floor===2||floor===6);
  }

  takeDmg(n){
    const reduced=this.slowTimer>0?Math.ceil(n*.7):n;
    this.hp-=reduced;this.hf=8;this.kb=10;
    const dx=this.x+this.w/2-(P.x+P.w/2);this.vx=Math.sign(dx)*4;this.vy=-3;
    AU.play('hit');sp(this.x+this.w/2,this.y+this.h/2,6,'#ff7755',3,15,2);
    dmgNums.push({x:this.x+this.w/2+(Math.random()-.5)*15,y:this.y-10,v:reduced,c:'#ffaa00',l:40,ml:40});
    // Apply frozen blade effect on melee hit
    if(weaponMods.frozenBlade.active){this.slowTimer=180;iceFX(this.x+this.w/2,this.y+this.h/2);AU.play('iceHit');}
    P.sl=Math.min(P.mSl,P.sl+SH);
    if(P.hasBankai)P.bk=Math.min(100,P.bk+4);
    if(P.hasHollow)P.hm=Math.min(100,P.hm+5);
    if(this.hp<=0){
      AU.play('die');
      sp(this.x+this.w/2,this.y+this.h/2,15,'#998866',4,25,3);
      sp(this.x+this.w/2,this.y+this.h/2,8,'#55bbff',3,30,2,'sp');
      P.cn+=this.coins+~~(Math.random()*5);
    }
  }

  update(room){
    this.at++;
    if(this.slowTimer>0)this.slowTimer--;
    // Multi-frame anim
    this.animTimer++;if(this.animTimer>8){this.animTimer=0;this.animFrame=(this.animFrame+1)%4;}

    if(this.hf>0)this.hf--;
    if(this.kb>0){
      this.kb--;this.vx*=.75;
      if(!this.fly)this.vy+=G;
      this.x+=this.vx;this.y+=this.vy;
      if(!this.fly)this.resFull(room);
      return;
    }

    const spdMult=this.slowTimer>0?0.35:1;

    if(this.type==='hollow')this.upHollow(room,spdMult);
    else if(this.type==='fly')this.upFly(spdMult);
    else if(this.type==='guard'||this.type==='arrancar')this.upGuard(room,spdMult);
    else if(this.type==='menos')this.upMenos(room,spdMult);
    else if(this.type==='adjuchas')this.upAdjuchas(room,spdMult);
  }

  // ────── HOLLOW AI ──────
  upHollow(room,sm){
    const pdx=(P.x+P.w/2)-this.cx(),pdy=(P.y+P.h/2)-this.cy();
    const pdist=Math.hypot(pdx,pdy);
    if(this.acd>0)this.acd--;
    if(this.jcd>0)this.jcd--;

    if(this.state==='attack'){
      this.st--;
      if(this.gnd)this.vx*=.92;
      if(this.st<=0){this.state='patrol';this.st=0;}
    } else if(this.state==='telegraph'){
      this.vx=0;this.st--;
      if(this.st<=0){
        this.state='attack';this.st=30;this.acd=80;this.vx=this.fc*3.5*sm;this.vy=-5;
      }
    } else {
      const alert=pdist<this.alertRange&&Math.abs(pdy)<T*3;
      const chasing=pdist<this.chaseRange&&Math.abs(pdy)<T*3.5;
      if(chasing){
        const wantDir=pdx>0?1:-1;
        if(alert&&this.gnd&&this.acd<=0){
          this.state='telegraph';this.st=12;this.fc=wantDir;this.vx=0;
        } else {
          this.state='chase';this.fc=wantDir;
          if(this.canWalk(room,wantDir)){
            this.vx=this.fc*this.spd*1.1*sm;
          } else if(this.gnd&&this.jcd<=0){
            this.vy=-8;this.jcd=45;
            this.vx=this.fc*this.spd*sm;
          } else if(this.gnd){
            // stuck at wall, can't jump yet - just wait
            this.vx=0;
          }
        }
      } else {
        this.state='patrol';
        if(!this.canWalk(room,this.fc)){this.fc*=-1;this.st=0;}
        this.st++;if(this.st>90+~~(Math.sin(this.at*.007)*25)){this.fc*=-1;this.st=0;}
        this.vx=this.fc*this.spd*0.65*sm;
      }
    }
    this.vy+=G;if(this.vy>MF)this.vy=MF;
    this.x+=this.vx;this.y+=this.vy;this.resFull(room);
  }

  // ────── FLY AI ──────
  upFly(sm){
    const dx=P.x-this.x,dy=P.y-this.y,d=Math.sqrt(dx*dx+dy*dy);
    if(this.state==='telegraph'){
      this.vx*=.8;this.vy*=.8;this.st--;
      if(this.st<=0){
        this.state='swoop';this.st=35;
        this.vx=(dx/d)*4.5*sm;this.vy=(dy/d)*4.5*sm;
        AU.play('dash');
      }
    } else if(this.state==='swoop'){
      this.st--;
      if(this.st<=0){this.state='idle';this.acd=40;}
    } else if(d<this.chaseRange&&d>8){
      if(this.acd>0)this.acd--;
      const ty=P.y-80;
      const ndx=dx,ndy=ty-this.y,nd=Math.sqrt(ndx*ndx+ndy*ndy)||1;
      this.state='chase';
      this.vx+=(ndx/nd)*0.18*sm;this.vy+=(ndy/nd)*0.18*sm;
      
      if(Math.abs(dx)<100&&dy>40&&this.acd<=0){
        this.state='telegraph';this.st=18;
      }
    } else {
      this.state='patrol';
      this.vx+=Math.sin(this.at*.03)*.07;this.vy+=Math.cos(this.at*.04)*.07;
      this.vy+=(this.flyY-this.y)*.009;
    }
    const maxSpd=this.state==='swoop'?(5*sm):(this.spd*1.5*sm);
    const s=Math.sqrt(this.vx**2+this.vy**2)||1;
    if(s>maxSpd){this.vx=(this.vx/s)*maxSpd;this.vy=(this.vy/s)*maxSpd;}
    this.fc=this.vx>0?1:-1;
    this.x+=this.vx;this.y+=this.vy;
  }

  // ────── GUARD / ARRANCAR AI ──────
  upGuard(room,sm){
    const pdx=(P.x+P.w/2)-this.cx(),pdy=(P.y+P.h/2)-this.cy();
    const pdist=Math.hypot(pdx,pdy);
    if(this.acd>0)this.acd--;
    if(this.jcd>0)this.jcd--;

    if(this.state==='attack'){
      this.st--;
      this.vx*=.92;
      if(this.st<=0){this.state='patrol';this.st=0;}
    } else if(this.state==='telegraph'){
      this.vx=0;this.st--;
      if(this.st<=0){
        this.state='attack';this.acd=this.type==='arrancar'?42:52;
        this.st=18;this.vx=this.fc*4.5*sm;
      }
    } else {
      if(pdist<(this.atkR||52)&&Math.abs(pdy)<48&&this.acd<=0){
        this.state='telegraph';this.st=15;this.fc=pdx>0?1:-1;this.vx=0;
      } else if(pdist<this.chaseRange&&Math.abs(pdy)<T*3.5){
        this.state='chase';
        const wantDir=pdx>0?1:-1;
        this.fc=wantDir;
        if(this.canWalk(room,wantDir)){
          this.vx=this.fc*this.spd*1.1*sm;
        } else if(this.gnd&&this.jcd<=0){
          this.vy=-8;this.jcd=45;
          this.vx=this.fc*this.spd*sm;
        } else if(this.gnd){
          this.vx=0;
        }
      } else {
        this.state='patrol';
        if(!this.canWalk(room,this.fc)){this.fc*=-1;this.st=0;}
        this.st++;if(this.st>100+~~(Math.sin(this.at*.006)*30)){this.fc*=-1;this.st=0;}
        this.vx=this.fc*this.spd*0.6*sm;
      }
    }
    this.vy+=G;if(this.vy>MF)this.vy=MF;
    this.x+=this.vx;this.y+=this.vy;this.resFull(room);
  }

  // ────── MENOS AI ──────
  upMenos(room,sm){
    const pdx=(P.x+P.w/2)-this.cx(),pdy=(P.y+P.h/2)-this.cy();
    const ad=Math.abs(pdx),ady=Math.abs(pdy);
    if(this.acd>0)this.acd--;

    if(this.state==='telegraph'){
      this.vx=0;this.st--;
      if(this.st<=0){
        this.state='alert';this.acd=120;
        bPr.push({x:this.cx(),y:this.y+15,vx:this.fc*3.2,vy:0,w:20,h:12,dmg:2,life:70,cero:true});
        AU.play('cero');shk=3;
      }
    } else {
      if(ad<this.chaseRange&&ady<T*3.5){
        this.state='alert';
        this.fc=pdx>0?1:-1;
        if(this.acd<=0&&ad<200&&ady<T*2.5){
          this.state='telegraph';this.st=25;this.vx=0;
        } else {
          this.vx=0;
        }
      } else {
        this.state='patrol';
        if(!this.canWalk(room,this.fc)){this.fc*=-1;this.st=0;}
        this.st++;if(this.st>160){this.fc*=-1;this.st=0;}
        this.vx=this.fc*this.spd*sm;
      }
    }
    this.vy+=G;if(this.vy>MF)this.vy=MF;
    this.x+=this.vx;this.y+=this.vy;this.resFull(room);
  }

  // ────── ADJUCHAS AI ──────
  upAdjuchas(room,sm){
    const pdx=(P.x+P.w/2)-this.cx(),pdy=(P.y+P.h/2)-this.cy();
    const pdist=Math.hypot(pdx,pdy);
    if(this.acd>0)this.acd--;
    if(this.jcd>0)this.jcd--;

    if(this.state==='attack'){
      this.st--;
      if(this.gnd)this.vx*=.92;
      if(this.st<=0){this.state='patrol';this.st=0;}
    } else if(this.state==='telegraph'){
      this.vx=0;this.st--;
      if(this.st<=0){
        this.state='attack';this.st=30;this.acd=80;this.vx=this.fc*4.5*sm;this.vy=-5.5;AU.play('dash');
      }
    } else {
      if(pdist<this.chaseRange&&Math.abs(pdy)<T*3){
        const wantDir=pdx>0?1:-1;
        if(pdist<100&&this.acd<=0&&this.gnd){
          this.state='telegraph';this.st=15;this.fc=wantDir;this.vx=0;
        } else {
          this.state='chase';this.fc=wantDir;
          if(this.canWalk(room,wantDir)){
            if(this.gnd)this.vx=this.fc*this.spd*1.1*sm;
          } else if(this.gnd&&this.jcd<=0){
            this.vy=-8.5;this.jcd=45;
            this.vx=this.fc*this.spd*sm;
          } else if(this.gnd){
            this.vx=0;
          }
        }
      } else {
        this.state='patrol';
        if(!this.canWalk(room,this.fc)){this.fc*=-1;this.st=0;}
        this.st++;if(this.st>80+~~(Math.sin(this.at*.013)*20)){this.fc*=-1;this.st=0;}
        if(this.gnd)this.vx=this.fc*this.spd*0.7*sm;
      }
    }
    this.vy+=G;if(this.vy>MF)this.vy=MF;
    this.x+=this.vx;this.y+=this.vy;this.resFull(room);
  }

  resFull(room){
    this.gnd=false;
    let b=this.bounds();
    // Horizontal wall resolution - uses overlap depth instead of vx sign
    for(let ty=~~(b.top/T);ty<=~~(b.bottom/T);ty++)
      for(let tx=~~(b.left/T);tx<=~~(b.right/T);tx++){
        if(ty<0||ty>=room.h||tx<0||tx>=room.w)continue;
        const tl=room.tiles[ty]?room.tiles[ty][tx]:0;
        if(tl===1||tl===5){
          const r={left:tx*T,top:ty*T,right:(tx+1)*T,bottom:(ty+1)*T};
          if(rO(b,r)){
            const cx=this.x+this.w/2, rcx=r.left+T/2;
            if(cx<rcx){this.x=r.left-this.w;} else {this.x=r.right;}
            this.vx=0;b=this.bounds();
          }
        }
      }
    b=this.bounds();
    for(let ty=~~(b.top/T);ty<=~~(b.bottom/T);ty++)
      for(let tx=~~(b.left/T);tx<=~~(b.right/T);tx++){
        if(ty<0||ty>=room.h||tx<0||tx>=room.w)continue;
        const tl=room.tiles[ty]?room.tiles[ty][tx]:0;
        if(tl===1||tl===5||(tl===2&&this.vy>=0)){
          const h=tl===2?8:T,r={left:tx*T,top:ty*T,right:(tx+1)*T,bottom:ty*T+h};
          if(rO(b,r)&&(tl!==2||(b.bottom-this.vy)<=r.top+8)){
            if(this.vy>0){this.y=r.top-this.h;this.gnd=true;}
            else if(this.vy<0&&tl!==2){this.y=r.bottom;}
            this.vy=0;b=this.bounds();
          }
        }
      }
  }

  draw(c,cx,cy){
    if(this.hp<=0)return;
    const sx=this.x-cx,sy=this.y-cy;
    c.save();
    if(this.hf>0)c.globalAlpha=.5+Math.sin(this.hf*2)*.3;
    // Slow freeze tint
    if(this.slowTimer>0){c.globalAlpha=(c.globalAlpha||1)*.85;}
    if(this.fc===-1){c.translate(sx+this.w,sy);c.scale(-1,1);}else c.translate(sx,sy);
    const f=this.animFrame;

    if(this.type==='hollow'){
      const b=f<2?0:2; // body bob
      c.fillStyle='#2a2a3a';c.fillRect(4,10+b,this.w-8,this.h-12);
      c.fillStyle='#f8f8f0';c.fillRect(6,2+b,this.w-12,14);
      c.fillStyle='#111';c.fillRect(8,6+b,4,4);c.fillRect(this.w-12,6+b,4,4);
      c.fillStyle='#cc0000';c.fillRect(10,4+b,3,2);c.fillRect(this.w-13,4+b,3,2);
      // Legs (frame-driven)
      const ll=f<2?0:3,rl=f<2?3:0;
      c.fillStyle='#1a1a2a';c.fillRect(6,this.h-6,5,6+ll);c.fillRect(this.w-11,this.h-6,5,6+rl);
      // Ice overlay
      if(this.slowTimer>0){c.globalAlpha=.3;c.fillStyle='#aaddff';c.fillRect(0,0,this.w,this.h);c.globalAlpha=1;}
    }
    else if(this.type==='fly'){
      const fw=f<2?-5:5;
      c.fillStyle='#3a2a3a';c.fillRect(-5,4+fw,8,12);c.fillRect(this.w-3,4-fw,8,12);
      c.fillStyle='#2a2a3a';c.beginPath();c.ellipse(this.w/2,this.h/2,this.w/2,this.h/2-2,0,0,Math.PI*2);c.fill();
      c.fillStyle='#f8f8f0';c.fillRect(4,2,this.w-8,10);
      c.fillStyle='#ffdd00';c.fillRect(6,4,4,4);c.fillRect(this.w-10,4,4,4);
      if(this.slowTimer>0){c.globalAlpha=.3;c.fillStyle='#aaddff';c.fillRect(0,0,this.w,this.h);c.globalAlpha=1;}
    }
    else if(this.type==='guard'){
      const ll=f<2?-2:2,rl=f<2?2:-2;
      c.fillStyle='#111128';c.fillRect(5,28+ll,6,10);c.fillRect(13,28+rl,6,10);
      c.fillStyle='#111128';c.fillRect(3,12,18,18);
      c.fillStyle='#e4c0a0';c.fillRect(6,2,12,12);
      c.fillStyle='#1a1a2a';c.fillRect(5,0,14,6);
      c.fillStyle='#553322';c.fillRect(9,6,2,2);c.fillRect(13,6,2,2);
      // Attack swing
      if(this.state==='attack'&&this.st>0){
        const sa=(1-this.st/18)*Math.PI*.7-Math.PI*.35;
        c.save();c.translate(14,18);c.rotate(sa);c.fillStyle='#c0c0d8';c.fillRect(-1,-26,3,26);c.restore();
      } else {c.fillStyle='#c0c0d8';c.fillRect(19,10,3,22);}
      if(this.slowTimer>0){c.globalAlpha=.3;c.fillStyle='#aaddff';c.fillRect(0,0,this.w,this.h);c.globalAlpha=1;}
    }
    else if(this.type==='menos'){
      const b=f<2?0:3;
      c.fillStyle='#0a0a0a';c.fillRect(10,30+b,12,34);c.fillRect(22,30+b,12,34);
      c.fillStyle='#080808';c.fillRect(4,14+b,36,30);
      c.fillStyle='#f8f8f0';c.fillRect(10,4+b,24,16);
      c.fillStyle='#0a0a0a';c.fillRect(14,8+b,6,6);c.fillRect(24,8+b,6,6);
      c.fillStyle='#f8f8f0';c.beginPath();c.moveTo(22,18+b);c.lineTo(18,28+b);c.lineTo(26,28+b);c.fill();
      if(this.acd>80){c.fillStyle=`rgba(255,0,0,${(100-this.acd)/20})`;c.beginPath();c.arc(22,12+b,8,0,Math.PI*2);c.fill();}
      if(this.slowTimer>0){c.globalAlpha=.3;c.fillStyle='#aaddff';c.fillRect(0,0,this.w,this.h);c.globalAlpha=1;}
    }
    else if(this.type==='adjuchas'){
      const ll=f<2?-2:3,rl=f<2?3:-2;
      c.fillStyle='#2a2a3a';c.fillRect(2,18+ll,8,12);c.fillRect(24,18+rl,8,12);
      c.fillStyle='#3a3a4a';c.fillRect(0,6,34,16);
      c.fillStyle='#f8f8f0';c.fillRect(4,2,16,10);
      c.fillStyle='#ff3333';c.fillRect(8,5,4,4);c.fillRect(14,5,4,4);
      c.fillStyle='#4a4a5a';c.fillRect(28,8,8,10);
      c.fillStyle='#f8f8f0';c.beginPath();c.moveTo(6,10);c.lineTo(2,16);c.lineTo(10,10);c.fill();
      if(this.slowTimer>0){c.globalAlpha=.3;c.fillStyle='#aaddff';c.fillRect(0,0,this.w,this.h);c.globalAlpha=1;}
    }
    else if(this.type==='arrancar'){
      const ll=f<2?-2:2,rl=f<2?2:-2;
      c.fillStyle='#eee';c.fillRect(5,28+ll,6,12);c.fillRect(13,28+rl,6,12);
      c.fillStyle='#eee';c.fillRect(3,12,18,18);
      c.fillStyle='#111';c.fillRect(9,12,6,14);
      c.fillStyle='#e0c8a8';c.fillRect(6,2,12,12);
      c.fillStyle='#444';c.fillRect(6,0,12,5);
      c.fillStyle='#f8f8f0';c.fillRect(4,2,4,6);
      c.fillStyle='#00aaaa';c.fillRect(9,6,2,2);c.fillRect(13,6,2,2);
      if(this.state==='attack'&&this.st>0){
        const sa=(1-this.st/18)*Math.PI*.7-Math.PI*.35;
        c.save();c.translate(14,18);c.rotate(sa);c.fillStyle='#c0c0d8';c.fillRect(-1,-24,3,24);c.restore();
      } else {c.fillStyle='#c0c0d8';c.fillRect(19,10,3,20);}
      if(this.slowTimer>0){c.globalAlpha=.3;c.fillStyle='#aaddff';c.fillRect(0,0,this.w,this.h);c.globalAlpha=1;}
    }

    if(this.state==='telegraph'&&~~(fr/4)%2===0){
      c.globalAlpha=0.5;c.fillStyle='#ff8800';c.fillRect(0,0,this.w,this.h);c.globalAlpha=1;
    }

    if(cR&&cR.zone){
      c.globalCompositeOperation='source-atop';
      c.fillStyle=cR.zone==='rukon'?'rgba(0,30,0,0.12)':cR.zone==='seireitei'?'rgba(0,0,40,0.12)':cR.zone==='hueco'?'rgba(50,40,0,0.12)':'rgba(40,10,40,0.12)';
      c.fillRect(-20,-20,this.w+40,this.h+40);
      c.globalCompositeOperation='source-over';
    }

    c.restore();

    // HP bar
    if(this.hp<this.mhp){
      c.fillStyle='#444';c.fillRect(this.x-cx,this.y-cy-8,this.w,4);
      c.fillStyle=this.slowTimer>0?'#88aaff':'#ff5555';
      c.fillRect(this.x-cx,this.y-cy-8,this.w*(this.hp/this.mhp),4);
    }
  }
}

// ─────────────────────────────── BOSS CLASS ───────────────────────────────────
class Bs{
  constructor(x,y,type){
    this.x=x*T;this.y=y*T;this.type=type;this.vx=0;this.vy=0;this.fc=-1;
    this.w=36;this.h=50;this.at=0;this.state='idle';this.st=60;this.phase=1;
    this.hf=0;this.inv=0;this.active=false;this.defeated=false;this.ap=0;this.bar=0;this.gnd=false;this.dmg=1;this.kd=0;
    if(type==='renji'){this.hp=this.mhp=60;this.name='RENJI ABARAI';this.sub='Lieutenant of Squad 6';}
    else if(type==='byakuya'){this.hp=this.mhp=90;this.name='BYAKUYA KUCHIKI';this.sub='Captain of Squad 6';this.w=34;this.h=48;}
    else if(type==='grimmjow'){this.hp=this.mhp=120;this.name='GRIMMJOW JAEGERJAQUEZ';this.sub='Espada #6';this.w=38;this.h=52;}
    else if(type==='ulquiorra'){this.hp=this.mhp=150;this.name='ULQUIORRA CIFER';this.sub='Espada #4';this.w=34;this.h=50;}
  }

  bounds(){return{left:this.x,top:this.y,right:this.x+this.w,bottom:this.y+this.h};}

  takeDmg(n){
    if(this.inv>0||this.defeated)return;
    this.hp-=n;this.hf=10;this.inv=15;AU.play('hit');shk=4;
    sp(this.x+this.w/2,this.y+this.h/2,8,'#ff7755',4,15,3);
    dmgNums.push({x:this.x+this.w/2+(Math.random()-.5)*20,y:this.y-10,v:n,c:'#ffcc22',l:45,ml:45});
    P.sl=Math.min(P.mSl,P.sl+SH*1.5);
    if(P.hasBankai)P.bk=Math.min(100,P.bk+6);
    if(P.hasHollow)P.hm=Math.min(100,P.hm+8);
    if(this.hp<=this.mhp*.66&&this.kd===0){
      this.kd=1;this.state='knockdown';this.st=120;shk=10;AU.play('hit');
      sp(this.x+this.w/2,this.y+this.h/2,20,'#ffffbb',5,30,4,'sp');
      notify(this.name+' is staggered!');
    } else if(this.hp<=this.mhp*.33&&this.kd===1){
      this.kd=2;this.state='knockdown';this.st=120;shk=10;AU.play('hit');
      sp(this.x+this.w/2,this.y+this.h/2,20,'#ffffbb',5,30,4,'sp');
      notify(this.name+' is staggered!');
    }
    if(this.hp<=this.mhp*.5&&this.phase===1){
      this.phase=2;this.state='ptrans';this.st=60;shk=15;AU.play('roar');
      sp(this.x+this.w/2,this.y+this.h/2,25,'#ff3333',6,40,4,'k');
      AU.playTrack('boss');
      if(this.type==='renji')notify('Howl, Zabimaru!');
      else if(this.type==='byakuya')notify('Scatter, Senbonzakura!');
      else if(this.type==='grimmjow')notify('Grind, Pantera!');
      else if(this.type==='ulquiorra')notify('Bind, Murciélago!');
    }
    if(this.hp<=0){
      this.defeated=true;this.state='dead';this.st=120;shk=20;AU.play('roar');
      P.cn+=this.type==='ulquiorra'?200:(this.type==='grimmjow'?150:100);
      notify(this.name+' defeated!');
      if(this.type==='renji'){const rm=RM['boss1'];for(let y=10;y<=11;y++)rm.tiles[y][rm.w-1]=0;rm.trans.push({x:rm.w-1,yA:10,yB:11,to:'post_renji',tx:2,ty:13});}
      if(this.type==='byakuya'){const rm=RM['boss2'];for(let y=10;y<=11;y++)rm.tiles[y][rm.w-1]=0;rm.trans.push({x:rm.w-1,yA:10,yB:11,to:'victory',tx:2,ty:11});}
      if(this.type==='grimmjow'){const rm=RM['boss3'];for(let y=10;y<=11;y++)rm.tiles[y][rm.w-1]=0;rm.trans.push({x:rm.w-1,yA:10,yB:11,to:'post_grimm',tx:2,ty:13});}
      if(this.type==='ulquiorra'){const rm=RM['boss4'];for(let y=12;y<=13;y++)rm.tiles[y][rm.w-1]=0;rm.trans.push({x:rm.w-1,yA:12,yB:13,to:'ending',tx:2,ty:11});}
    }
  }

  activate(){
    if(this.active||this.defeated)return;
    this.active=true;this.bar=0;AU.play('roar');shk=10;
    notify(this.name+' blocks your path!');
    AU.playTrack('boss');
  }

  update(room){
    if(!this.active)return;
    if(this.defeated){this.st--;if(this.st<=0)this.hp=-999;return;}
    this.at++;if(this.hf>0)this.hf--;if(this.inv>0)this.inv--;
    if(this.bar<1)this.bar+=.02;
    this.fc=(P.x>this.x)?1:-1;this.st--;

    if(this.state==='ptrans'){this.vx=0;if(this.st<=0){this.state='idle';this.st=30;}}
    else if(this.state==='knockdown'){this.vx=0;if(this.st<=0){this.state='idle';this.st=20;}}
    else if(this.st<=0){
      let acts;
      if(this.type==='renji')acts=this.phase===1?['dash','jump','zab','idle']:['dash','jump','zab','combo','howl'];
      else if(this.type==='byakuya')acts=this.phase===1?['dash','jump','sakura','idle']:['dash','jump','sakura','sakura_rain','teleport'];
      else if(this.type==='grimmjow')acts=this.phase===1?['dash','jump','claw','idle']:['dash','lunge','claw','desgarron','roar'];
      else if(this.type==='ulquiorra')acts=this.phase===1?['dash','jump','cero','idle']:['teleport','lanza','cero_oscuras','bat_dive'];
      
      if(P.y < this.y - 40 && Math.abs(P.x - this.x) < 80) {
        this.state = 'attack_up';
      } else {
        this.state=acts[this.ap%acts.length];this.ap++;
      }
      
      switch(this.state){
        case'attack_up':this.st=50;this.vx=0;break;
        case'idle':this.st=25+Math.random()*20;break;
        case'dash':this.st=44;this.vx=this.fc*(this.phase===1?2.6:3.5);break;
        case'jump':this.st=54;this.vy=-10;this.vx=this.fc*1.8;break;
        case'zab':this.st=60;this.vx=0;break;
        case'combo':this.st=80;this.vx=0;break;
        case'howl':case'roar':this.st=45;this.vx=0;AU.play('roar');shk=6;break;
        case'sakura':this.st=70;this.vx=0;break;
        case'sakura_rain':this.st=90;this.vx=0;break;
        case'teleport':this.st=58;this.x=P.x+(Math.random()>.5?120:-120);this.vy=-4;this.vx=0;sp(this.x+this.w/2,this.y+this.h/2,15,'#00aa88',4,20,3,'sp');break;
        case'claw':this.st=55;this.vx=this.fc*1.8;break;
        case'lunge':this.st=50;this.vx=this.fc*5.2;this.vy=-3;break;
        case'desgarron':this.st=70;this.vx=0;break;
        case'cero':this.st=60;this.vx=0;break;
        case'cero_oscuras':this.st=80;this.vx=0;break;
        case'lanza':this.st=70;this.vx=0;break;
        case'bat_dive':this.st=64;this.vy=-11;this.vx=this.fc*3;break;
      }
    }

    switch(this.state){
      case'idle':{const dx=(P.x+P.w/2)-(this.x+this.w/2);const ad=Math.abs(dx);if(ad>120)this.vx+=(dx>0?1:-1)*(this.phase===2?0.06:0.04);else if(ad<50)this.vx+=(dx>0?-1:1)*0.03;else this.vx*=0.95;if(Math.abs(this.vx)>1.2)this.vx=Math.sign(this.vx)*1.2;break;}
      case'dash':if(this.st<20)this.vx*=.95;if(fr%3===0)sp(this.x+this.w/2,this.y+this.h/2,2,'#ff5555',2,10,2);break;
      case'jump':if(this.gnd&&this.st<30){this.vx=0;shk=3;}break;
      case'zab':this.vx=0;if(this.st===40)bPr.push({x:this.x+this.w/2+this.fc*20,y:this.y+this.h/2,vx:this.fc*6,vy:0,w:30,h:8,dmg:1,life:25,zab:true});break;
      case'combo':this.vx=this.fc*.6;if(this.st%24===0&&this.st>10)bPr.push({x:this.x+this.w/2+this.fc*20,y:this.y+this.h/2+(Math.random()-.5)*30,vx:this.fc*5,vy:(Math.random()-.5)*1.5,w:25,h:8,dmg:1,life:28,zab:true});break;
      case'howl':case'roar':if(this.st===30)sp(this.x+this.w/2,this.y+this.h/2,20,'#ff3333',5,30,4,'sp');break;
      case'sakura':this.vx=0;if(this.st%10===0&&this.st>20){for(let i=0;i<3;i++)bPr.push({x:this.x+this.w/2+this.fc*(30+i*15),y:this.y+this.h/2+(Math.random()-.5)*40,vx:this.fc*(4+Math.random()*2),vy:(Math.random()-.5)*2,w:8,h:8,dmg:1,life:30,petal:true});}break;
      case'sakura_rain':this.vx=0;if(this.st%6===0)bPr.push({x:P.x+(Math.random()-.5)*100,y:cam.y-10,vx:(Math.random()-.5)*2,vy:3+Math.random()*2,w:8,h:8,dmg:1,life:60,petal:true});break;
      case'claw':if(this.st===30)bPr.push({x:this.x+this.w/2+this.fc*25,y:this.y+this.h/2,vx:this.fc*5.5,vy:0,w:20,h:15,dmg:2,life:30,claw:true});break;
      case'lunge':if(fr%2===0)sp(this.x+this.w/2,this.y+this.h/2,2,'#44aaff',3,12,2);break;
      case'desgarron':if(this.st%16===0&&this.st>20){for(let i=0;i<5;i++)bPr.push({x:this.x+this.w/2+this.fc*30,y:this.y+10+i*10,vx:this.fc*6,vy:(i-2)*.35,w:15,h:4,dmg:2,life:35,claw:true});}break;
      case'cero':this.vx=0;if(this.st===35)bPr.push({x:this.x+this.w/2+this.fc*20,y:this.y+15,vx:this.fc*5.5,vy:0,w:25,h:20,dmg:2,life:55,cero:true});break;
      case'cero_oscuras':this.vx=0;if(this.st===50){bPr.push({x:this.x+this.w/2+this.fc*20,y:this.y+15,vx:this.fc*5.8,vy:0,w:35,h:30,dmg:3,life:65,cero_oscuras:true});AU.play('cero');shk=8;}break;
      case'lanza':this.vx=0;if(this.st===40)bPr.push({x:this.x+this.w/2+this.fc*30,y:this.y+this.h/2,vx:this.fc*7.5,vy:0,w:40,h:8,dmg:3,life:50,lanza:true});break;
      case'bat_dive':if(this.gnd)this.state='idle';break;
      case'attack_up':if(this.st===30){bPr.push({x:this.x+this.w/2-10,y:this.y-10,vx:0,vy:-8,w:20,h:40,dmg:2,life:40,claw:true});AU.play('slash');}break;
    }

    this.vy+=G;if(this.vy>MF)this.vy=MF;
    this.x+=this.vx;this.gnd=false;
    let b=this.bounds();
    for(let ty=~~(b.top/T);ty<=~~(b.bottom/T);ty++)
      for(let tx=~~(b.left/T);tx<=~~(b.right/T);tx++){
        if(ty<0||ty>=room.h||tx<0||tx>=room.w)continue;
        if(room.tiles[ty]&&room.tiles[ty][tx]===1){const r={left:tx*T,top:ty*T,right:(tx+1)*T,bottom:(ty+1)*T};if(rO(b,r)){if(this.vx>0)this.x=r.left-this.w;else if(this.vx<0)this.x=r.right;this.vx=0;b=this.bounds();}}
      }
    this.y+=this.vy;b=this.bounds();
    for(let ty=~~(b.top/T);ty<=~~(b.bottom/T);ty++)
      for(let tx=~~(b.left/T);tx<=~~(b.right/T);tx++){
        if(ty<0||ty>=room.h||tx<0||tx>=room.w)continue;
        const tl=room.tiles[ty]?room.tiles[ty][tx]:0;
        if(tl===1||(tl===2&&this.vy>=0)){
          const h=tl===2?8:T,r={left:tx*T,top:ty*T,right:(tx+1)*T,bottom:ty*T+h};
          if(rO(b,r)&&(tl!==2||(b.bottom-this.vy)<=r.top+8)){
            if(this.vy>0){this.y=r.top-this.h;this.gnd=true;}else if(this.vy<0&&tl!==2){this.y=r.bottom;}
            this.vy=0;b=this.bounds();
          }
        }
      }
  }

  draw(c,cx,cy){
    if(this.hp<=-999)return;
    const sx=this.x-cx,sy=this.y-cy;c.save();
    if(this.hf>0&&~~(this.hf/2)%2===0)c.globalAlpha=.5;
    if(this.state==='knockdown'&&~~(fr/4)%2===0)c.globalAlpha=.6;
    if(this.defeated)c.globalAlpha=this.st/120;
    if(this.type==='renji')this.drRenji(c,sx,sy);
    else if(this.type==='byakuya')this.drByakuya(c,sx,sy);
    else if(this.type==='grimmjow')this.drGrimmjow(c,sx,sy);
    else if(this.type==='ulquiorra')this.drUlquiorra(c,sx,sy);
    c.restore();
    if(this.active&&!this.defeated)this.drBar(c);
  }

  drRenji(c,sx,sy){
    c.save();if(this.fc===-1){c.translate(sx+this.w,sy);c.scale(-1,1);}else c.translate(sx,sy);
    const b=this.at%8<4?0:2;
    if(this.phase===2){c.globalAlpha=.3;c.fillStyle='#ff3333';c.beginPath();c.ellipse(this.w/2,this.h/2,this.w+10,this.h+5,0,0,Math.PI*2);c.fill();c.globalAlpha=1;}
    c.fillStyle='#1a1a2e';c.fillRect(8,36,8,14);c.fillRect(20,36,8,14);
    c.fillStyle='#1a1a2e';c.fillRect(4,18+b,28,20);
    c.fillStyle='#ddd';c.fillRect(14,18+b,8,12);
    c.fillStyle='#e0a878';c.fillRect(10,4+b,16,16);
    c.fillStyle='#cc2222';c.fillRect(8,b-2,20,10);c.fillRect(6,b,6,6);c.fillRect(24,b,6,6);
    c.fillStyle='#111';c.fillRect(8,4+b,20,3);
    c.fillStyle='#442200';c.fillRect(14,10+b,4,4);c.fillRect(20,10+b,4,4);
    c.fillStyle='#c0c0d8';c.fillRect(30,12+b,3,30);
    c.restore();
  }
  drByakuya(c,sx,sy){
    c.save();if(this.fc===-1){c.translate(sx+this.w,sy);c.scale(-1,1);}else c.translate(sx,sy);
    const b=this.at%12<6?0:2;
    if(this.phase===2){c.globalAlpha=.2;c.fillStyle='#ff88cc';c.beginPath();c.ellipse(this.w/2,this.h/2,this.w+15,this.h+8,0,0,Math.PI*2);c.fill();c.globalAlpha=1;}
    c.fillStyle='#111128';c.fillRect(8,36,6,12);c.fillRect(20,36,6,12);
    c.fillStyle='#111128';c.fillRect(4,18+b,26,20);
    c.fillStyle='#e8e8f0';c.fillRect(2,18+b,4,20);c.fillRect(28,18+b,4,20);
    c.fillStyle='#f0d0b0';c.fillRect(9,4+b,16,16);
    c.fillStyle='#0a0a18';c.fillRect(7,b,20,12);c.fillRect(5,6+b,4,14);c.fillRect(25,6+b,4,14);
    c.fillStyle='#c0c0e0';c.fillRect(7,b-2,5,8);c.fillRect(22,b-2,5,8);
    c.fillStyle='#556677';c.fillRect(13,10+b,4,4);c.fillRect(19,10+b,4,4);
    c.restore();
  }
  drGrimmjow(c,sx,sy){
    c.save();if(this.fc===-1){c.translate(sx+this.w,sy);c.scale(-1,1);}else c.translate(sx,sy);
    const b=this.at%6<3?0:2;
    if(this.phase===2){c.globalAlpha=.3;c.fillStyle='#44aaff';c.beginPath();c.ellipse(this.w/2,this.h/2,this.w+12,this.h+6,0,0,Math.PI*2);c.fill();c.globalAlpha=1;}
    c.fillStyle='#eee';c.fillRect(10,38,8,14);c.fillRect(20,38,8,14);
    c.fillStyle='#eee';c.fillRect(4,18+b,30,22);
    c.fillStyle='#e8c8a8';c.fillRect(8,18+b,22,16);c.fillRect(10,4+b,18,18);
    c.fillStyle='#44aaff';c.fillRect(8,b,22,10);c.fillRect(6,b+2,4,6);c.fillRect(28,b+2,4,6);
    c.fillStyle='#00cccc';c.fillRect(14,24+b,4,6);c.fillRect(20,24+b,4,6);
    c.fillStyle='#00dddd';c.fillRect(14,10+b,4,4);c.fillRect(20,10+b,4,4);
    c.fillStyle='#f8f8f0';c.fillRect(this.w-6,8+b,8,14);
    if(this.phase===2){c.fillStyle='#eee';for(let i=0;i<4;i++)c.fillRect(30+i*3,14+b+i*2,8,3);}
    c.restore();
  }
  drUlquiorra(c,sx,sy){
    c.save();if(this.fc===-1){c.translate(sx+this.w,sy);c.scale(-1,1);}else c.translate(sx,sy);
    const b=this.at%10<5?0:1;
    if(this.phase===2){c.globalAlpha=.25;c.fillStyle='#00aa88';c.beginPath();c.ellipse(this.w/2,this.h/2,this.w+15,this.h+10,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
      c.fillStyle='#1a1a1a';c.fillRect(-8,15+b,10,20);c.fillRect(this.w-2,15+b,10,20);}
    c.fillStyle='#eee';c.fillRect(8,36,6,14);c.fillRect(20,36,6,14);
    c.fillStyle='#eee';c.fillRect(4,16+b,26,22);
    c.fillStyle='#111';c.fillRect(12,16+b,10,18);
    c.fillStyle='#e8e8e0';c.fillRect(9,2+b,16,18);
    c.fillStyle='#0a0a0a';c.fillRect(8,b-2,18,10);c.fillRect(6,4+b,4,12);c.fillRect(24,4+b,4,12);
    c.fillStyle='#00aa88';c.fillRect(13,8+b,4,4);c.fillRect(19,8+b,4,4);
    c.fillStyle='#00aa88';c.fillRect(10,16+b,2,14);c.fillRect(22,16+b,2,14);
    if(this.phase===2){c.fillStyle='#f8f8f0';c.fillRect(8,b-6,6,8);c.fillRect(20,b-6,6,8);}
    c.restore();
  }
  drBar(c){
    const bw=320*this.bar,bx=C.width/2-bw/2,by=C.height-55;
    c.globalAlpha=this.bar;c.fillStyle='#fff';c.font='14px Georgia';c.textAlign='center';
    c.fillText(this.name,C.width/2,by-15);c.font='10px Georgia';c.fillStyle='#aaa';
    c.fillText(this.sub,C.width/2,by-3);c.fillStyle='#333';c.fillRect(bx-1,by-1,bw+2,8);
    let col;if(this.type==='renji')col=this.phase===1?'#dd4444':'#ff5555';
    else if(this.type==='byakuya')col=this.phase===1?'#cc88cc':'#ff88dd';
    else if(this.type==='grimmjow')col=this.phase===1?'#4488ff':'#66aaff';
    else col=this.phase===1?'#00aa88':'#00ddaa';
    c.fillStyle=col;c.fillRect(bx,by,bw*(this.hp/this.mhp),6);
    if(this.phase===2){c.shadowColor=col;c.shadowBlur=10;c.fillRect(bx,by,bw*(this.hp/this.mhp),6);c.shadowBlur=0;}
    c.globalAlpha=1;c.textAlign='left';
  }
}

// ─────────────────────────────── BOSS PROJECTILES ─────────────────────────────
let bPr=[];
function upBP(room){
  bPr=bPr.filter(p=>{
    p.x+=p.vx;p.y+=p.vy;p.life--;
    if(p.petal&&fr%3===0)sp(p.x,p.y,1,'#ffaacc',1,8,2,'c');
    if(p.zab&&fr%2===0)sp(p.x,p.y,1,'#dd4444',1,8,2,'k');
    if(p.cero&&fr%2===0)sp(p.x,p.y,2,'#ff0000',2,12,3,'sp');
    if(p.cero_oscuras&&fr%2===0)sp(p.x,p.y,3,'#00ff00',2,15,4,'sp');
    if(p.claw&&fr%2===0)sp(p.x,p.y,1,'#44aaff',1,8,2,'sl');
    if(p.lanza&&fr%2===0)sp(p.x,p.y,2,'#00ffaa',2,12,3,'k');
    const pb=P.bounds();
    if(p.x+p.w>pb.left&&p.x<pb.right&&p.y+p.h>pb.top&&p.y<pb.bottom){P.takeDmg(p.dmg);return false;}
    const tx=~~(p.x/T),ty=~~(p.y/T);
    if(tx>=0&&tx<room.w&&ty>=0&&ty<room.h&&room.tiles[ty]&&room.tiles[ty][tx]===1)return false;
    return p.life>0;
  });
}
function drBP(c,cx,cy){
  for(const p of bPr){const sx=p.x-cx,sy=p.y-cy;
    if(p.petal){c.fillStyle='#ffaacc';c.save();c.translate(sx,sy);c.rotate(p.vx*fr*.05);c.fillRect(-4,-2,8,4);c.restore();}
    else if(p.cero){c.save();c.fillStyle='#ff0000';c.shadowColor='#ff0000';c.shadowBlur=15;c.beginPath();c.arc(sx,sy,p.w/2,0,Math.PI*2);c.fill();c.fillStyle='#ff6666';c.beginPath();c.arc(sx,sy,p.w/4,0,Math.PI*2);c.fill();c.shadowBlur=0;c.restore();}
    else if(p.cero_oscuras){c.save();c.fillStyle='#00aa00';c.shadowColor='#00ff00';c.shadowBlur=20;c.beginPath();c.arc(sx,sy,p.w/2,0,Math.PI*2);c.fill();c.fillStyle='#00ff00';c.beginPath();c.arc(sx,sy,p.w/4,0,Math.PI*2);c.fill();c.shadowBlur=0;c.restore();}
    else if(p.claw){c.fillStyle='#44aaff';c.fillRect(sx-p.w/2,sy-p.h/2,p.w,p.h);c.fillStyle='#88ccff';c.fillRect(sx-p.w/4,sy-p.h/4,p.w/2,p.h/2);}
    else if(p.lanza){c.save();c.fillStyle='#00ffaa';c.shadowColor='#00ffaa';c.shadowBlur=15;c.fillRect(sx-p.w/2,sy-p.h/2,p.w,p.h);c.shadowBlur=0;c.restore();}
    else if(p.zab){c.fillStyle='#c0c0d8';c.fillRect(sx,sy-3,p.w,6);c.fillStyle='#dd4444';c.fillRect(sx+p.w-4,sy-5,4,10);}
  }
}

// ─────────────────────────────── NPC CLASS ────────────────────────────────────
class NC{
  constructor(d){
    this.x=d.x*T;this.y=d.y*T;this.type=d.type;this.w=24;this.h=38;this.at=0;
    const i=NI[d.type]||NI.urahara;
    this.dlg=i.lines;this.nm=i.name;this.shop=i.shop||false;this.healer=i.healer||false;
    this.ability=i.ability||null;this.abilityName=i.abilityName||'';this.abilityDesc=i.abilityDesc||'';
    this.talked=false;this.abilityGiven=false;
    this.animFrame=0;this.animTimer=0;
  }
  update(){this.at++;this.animTimer++;if(this.animTimer>10){this.animTimer=0;this.animFrame=(this.animFrame+1)%4;}}
  near(){const dx=P.x+P.w/2-(this.x+this.w/2),dy=P.y+P.h/2-(this.y+this.h/2);return Math.sqrt(dx*dx+dy*dy)<60;}
  draw(c,cx,cy){
    const sx=this.x-cx,sy=this.y-cy,b=Math.sin(this.at*.05)*2;
    c.save();this.drSprite(c,sx,sy,b);
    if(this.near()){
      c.fillStyle='#ffff88';c.font='bold 12px monospace';c.textAlign='center';
      c.fillText('[E]',sx+this.w/2,sy-14);
      c.globalAlpha=.12+Math.sin(this.at*.1)*.05;c.fillStyle='#ffff44';
      c.beginPath();c.arc(sx+this.w/2,sy+this.h/2,32,0,Math.PI*2);c.fill();c.globalAlpha=1;
    }
    c.restore();
  }
  drSprite(c,sx,sy,b){
    const f=this.animFrame;
    if(this.type.includes('urahara')){
      c.fillStyle='#556655';c.fillRect(sx+4,sy+28+b,6,10);c.fillRect(sx+14,sy+28+b,6,10);
      c.fillStyle='#556655';c.fillRect(sx,sy+14+b,24,16);
      c.fillStyle='#eee';c.fillRect(sx+2,sy+26+b,20,4);
      c.fillStyle='#f5d0a8';c.fillRect(sx+6,sy+6+b,12,10);
      c.fillStyle='#c0b090';c.fillRect(sx+8,sy+14+b,8,3);
      c.fillStyle='#445544';c.fillRect(sx+2,sy+b-2,20,10);
      c.fillStyle='#eee';c.fillRect(sx+2,sy+b+2,20,2);c.fillRect(sx+2,sy+b+6,20,2);
      c.fillStyle='#445544';c.fillRect(sx,sy+b+8,24,3);
      c.fillStyle='#888';c.fillRect(sx+8,sy+10+b,2,2);c.fillRect(sx+14,sy+10+b,2,2);
      if(~~(this.at/60)%2===0){c.fillStyle='#eedd99';c.fillRect(sx+20,sy+18+b,8,10);}
    } else if(this.type==='rukia'){
      const ll=f<2?0:2,rl=f<2?2:0;
      c.fillStyle='#111128';c.fillRect(sx+5,sy+28+ll,5,10);c.fillRect(sx+14,sy+28+rl,5,10);
      c.fillStyle='#111128';c.fillRect(sx+3,sy+14+b,18,16);
      c.fillStyle='#ddd';c.fillRect(sx+9,sy+14+b,4,10);
      c.fillStyle='#f0c8a8';c.fillRect(sx+5,sy+4+b,14,12);
      c.fillStyle='#0a0a1a';c.fillRect(sx+3,sy+b,18,8);c.fillRect(sx+2,sy+4+b,4,10);c.fillRect(sx+18,sy+4+b,4,10);
      c.fillStyle='#0a0a1a';c.fillRect(sx+8,sy+b-2,4,4);
      c.fillStyle='#7744bb';c.fillRect(sx+8,sy+8+b,3,3);c.fillRect(sx+14,sy+8+b,3,3);
    } else if(this.type==='yoruichi'){
      c.fillStyle='#1a1a1a';c.fillRect(sx+5,sy+28+b,5,10);c.fillRect(sx+14,sy+28+b,5,10);
      c.fillStyle='#1a1a1a';c.fillRect(sx+3,sy+14+b,18,16);
      c.fillStyle='#cc8800';c.fillRect(sx+3,sy+14+b,18,2);
      c.fillStyle='#8b5a2b';c.fillRect(sx+5,sy+4+b,14,12);
      c.fillStyle='#2a1a50';c.fillRect(sx+3,sy+b,18,8);c.fillRect(sx+1,sy+4+b,4,12);c.fillRect(sx+19,sy+4+b,4,12);
      c.fillStyle='#2a1a50';c.fillRect(sx+20,sy+14+b,5,14);
      c.fillStyle='#ffcc00';c.fillRect(sx+8,sy+8+b,3,2);c.fillRect(sx+14,sy+8+b,3,2);
    } else if(this.type==='orihime'){
      c.fillStyle='#eee';c.fillRect(sx+5,sy+28+b,5,10);c.fillRect(sx+14,sy+28+b,5,10);
      c.fillStyle='#eee';c.fillRect(sx+3,sy+14+b,18,16);
      c.fillStyle='#f8d8c0';c.fillRect(sx+5,sy+4+b,14,12);
      c.fillStyle='#dd6622';c.fillRect(sx+2,sy+b,20,10);c.fillRect(sx,sy+6+b,4,20);c.fillRect(sx+20,sy+6+b,4,20);
      c.fillStyle='#55bbff';c.fillRect(sx+4,sy+2+b,4,4);c.fillRect(sx+16,sy+2+b,4,4);
      c.fillStyle='#885533';c.fillRect(sx+8,sy+8+b,3,3);c.fillRect(sx+14,sy+8+b,3,3);
    } else if(this.type==='nel'){
      c.fillStyle='#eee';c.fillRect(sx+5,sy+28+b,5,10);c.fillRect(sx+14,sy+28+b,5,10);
      c.fillStyle='#eee';c.fillRect(sx+3,sy+14+b,18,16);
      c.fillStyle='#f0d8c0';c.fillRect(sx+5,sy+6+b,14,10);
      c.fillStyle='#33aa88';c.fillRect(sx+2,sy+b,20,10);c.fillRect(sx,sy+6+b,4,16);c.fillRect(sx+20,sy+6+b,4,16);
      c.fillStyle='#f8f8f0';c.fillRect(sx+4,sy+b-4,6,6);c.fillRect(sx+14,sy+b-4,6,6);
      c.fillStyle='#cc4444';c.fillRect(sx+2,sy+10+b,20,2);
      c.fillStyle='#997755';c.fillRect(sx+8,sy+10+b,3,3);c.fillRect(sx+14,sy+10+b,3,3);
    } else if(this.type==='chad'){
      c.fillStyle='#333';c.fillRect(sx+4,sy+28+b,6,10);c.fillRect(sx+14,sy+28+b,6,10);
      c.fillStyle='#333';c.fillRect(sx+3,sy+14+b,18,16);
      c.fillStyle='#9b7040';c.fillRect(sx+5,sy+4+b,14,12);
      c.fillStyle='#3a2a1a';c.fillRect(sx+4,sy+b,16,10);c.fillRect(sx+2,sy+6+b,6,10);
      c.fillStyle='#3a2a1a';c.fillRect(sx+14,sy+8+b,3,3);
    } else if(this.type==='renji_npc'){
      c.fillStyle='#1a1a2e';c.fillRect(sx+5,sy+28+b,5,10);c.fillRect(sx+14,sy+28+b,5,10);
      c.fillStyle='#1a1a2e';c.fillRect(sx+3,sy+14+b,18,16);
      c.fillStyle='#ddd';c.fillRect(sx+9,sy+14+b,4,10);
      c.fillStyle='#e0a878';c.fillRect(sx+5,sy+4+b,14,12);
      c.fillStyle='#cc2222';c.fillRect(sx+3,sy+b,18,8);c.fillRect(sx+2,sy+b-2,5,5);c.fillRect(sx+17,sy+b-2,5,5);
      c.fillStyle='#111';c.fillRect(sx+3,sy+6+b,18,2);
      c.fillStyle='#ddd';c.fillRect(sx+3,sy+22+b,4,3);c.fillRect(sx+17,sy+20+b,4,3);
    } else if(this.type==='grimmjow_npc'){
      c.fillStyle='#eee';c.fillRect(sx+5,sy+28+b,5,10);c.fillRect(sx+14,sy+28+b,5,10);
      c.fillStyle='#eee';c.fillRect(sx+3,sy+14+b,18,16);
      c.fillStyle='#e8c8a8';c.fillRect(sx+5,sy+4+b,14,12);
      c.fillStyle='#44aaff';c.fillRect(sx+3,sy+b,18,8);c.fillRect(sx+1,sy+b+2,4,5);c.fillRect(sx+19,sy+b+2,4,5);
      c.fillStyle='#00cccc';c.fillRect(sx+6,sy+12+b,4,4);c.fillRect(sx+14,sy+12+b,4,4);
      c.fillStyle='#00dddd';c.fillRect(sx+8,sy+8+b,3,2);c.fillRect(sx+14,sy+8+b,3,2);
      c.fillStyle='#f8f8f0';c.fillRect(sx+18,sy+4+b,6,10);
    } else {
      c.fillStyle='#556688';c.fillRect(sx+4,sy+12+b,16,26);
      c.fillStyle='#e0c0a0';c.fillRect(sx+6,sy+4+b,12,10);
    }
  }
}

// ─────────────────────────────── GAME STATE ───────────────────────────────────
let cR=null,cID='r1',ens=[],npcs=[],boss=null;
let dB=new Set(),vis=new Set();
let dlgA=false,dlgN=null,dlgI=0,dlgT=0;

function loadRoom(id){
  cID=id;const rd=RM[id];if(!rd)return;cR=rd;vis.add(id);
  ens=rd.enemies.map(e=>new En(e.x,e.y,e.type));
  npcs=rd.npcs?rd.npcs.map(n=>new NC(n)):[];
  boss=null;bPr=[];
  if(rd.boss&&!dB.has(id))boss=new Bs(rd.boss.x,rd.boss.y,rd.boss.type);
  projs=[];pts.length=0;
  cam.x=P.x-C.width/2;cam.y=P.y-C.height/2;
  tLock=true;setTimeout(()=>tLock=false,350);
  if(rd.ending){notify('CONGRATULATIONS! You defeated Ulquiorra!');setTimeout(()=>notify('Thanks for playing Bleach: Soul Society Underground!'),3000);}

  // Zone music
  const zone=rd.zone;
  const trackMap={rukon:'rukon',seireitei:'seireitei',hueco:'hueco',lasnoches:'lasnoches'};
  const track=rd.boss?'boss':trackMap[zone];
  // Only switch music if we're in a boss room or different zone music needed
  if(rd.boss){AU.playTrack('boss');}
  else{
    const t=trackMap[zone]||'rukon';
    if(AU.currentTrack!==t)AU.playTrack(t);
  }
}

function doTrans(room,tx,ty){
  if(tLock)return;tLock=true;
  const ov=document.getElementById('transition-overlay');ov.style.opacity='1';
  setTimeout(()=>{P.x=tx;P.y=ty;P.vx=0;P.vy=0;loadRoom(room);setTimeout(()=>ov.style.opacity='0',100);},250);
}

function saveGame(){
  localStorage.setItem('bsave',JSON.stringify({
    r:cID,x:P.x,y:P.y,cn:P.cn,items:P.items,dB:[...dB],vis:[...vis],mHP:P.mHP,
    hasDash:P.hasDash,hasWJ:P.hasWJ,hasGet:P.hasGet,hasCero:P.hasCero,
    hasDJ:P.hasDJ,hasBankai:P.hasBankai,hasHollow:P.hasHollow
  }));
  P.sR=cID;P.sX=P.x;P.sY=P.y;AU.play('save');notify('Progress saved');
}

function loadSv(){
  const s=localStorage.getItem('bsave');if(!s)return false;
  try{
    const d=JSON.parse(s);
    P.cn=d.cn||0;P.items=d.items||[];P.mHP=d.mHP||5;
    P.hasDash=d.hasDash||false;P.hasWJ=d.hasWJ||false;P.hasGet=d.hasGet||false;
    P.hasCero=d.hasCero||false;P.hasDJ=d.hasDJ||false;P.hasBankai=d.hasBankai||false;P.hasHollow=d.hasHollow||false;
    dB=new Set(d.dB||[]);vis=new Set(d.vis||[]);
    P.x=d.x;P.y=d.y;P.sR=d.r;P.sX=d.x;P.sY=d.y;
    loadRoom(d.r);P.reset();return true;
  }catch(e){return false;}
}

function showAbility(name,desc){
  gs=GS.ABILITY;
  document.getElementById('ability-popup').style.display='block';
  document.getElementById('ap-title').textContent=name;
  document.getElementById('ap-desc').textContent=desc;
  AU.play('ability');sp(P.x+P.w/2,P.y+P.h/2,25,'#ffaa33',5,30,4,'sp');
}

function openDlg(npc){
  dlgA=true;dlgN=npc;dlgI=0;dlgT=20;gs=GS.DLG;
  document.getElementById('dialogue-box').style.display='block';
  drawPortrait(npc.type);showLine();
}
function showLine(){document.getElementById('dialogue-name').textContent=dlgN.nm;document.getElementById('dialogue-text').textContent=dlgN.dlg[dlgI];}
function nextLine(){
  if(dlgT>0)return;dlgI++;dlgT=12;AU.play('menu');
  if(dlgI>=dlgN.dlg.length){
    const npcRef=dlgN;const wasShop=npcRef.shop,wasHealer=npcRef.healer,ab=npcRef.ability,abn=npcRef.abilityName,abd=npcRef.abilityDesc,gave=npcRef.abilityGiven;
    npcRef.talked=true;closeDlg();
    if(ab&&!gave){npcRef.abilityGiven=true;if(ab==='walljump')P.hasWJ=true;if(ab==='dash')P.hasDash=true;if(ab==='getsuga')P.hasGet=true;if(ab==='cero')P.hasCero=true;setTimeout(()=>showAbility(abn,abd),200);}
    else if(wasHealer){P.hp=P.mHP;P.sl=P.mSl;sp(P.x+P.w/2,P.y+P.h/2,20,'#ffaa44',4,30,4,'sp');notify('Fully healed!');}
    else if(wasShop)setTimeout(openShop,200);return;
  }showLine();
}
function closeDlg(){dlgA=false;gs=GS.PLAY;document.getElementById('dialogue-box').style.display='none';dlgN=null;dlgT=20;}

// ─────────────────────────────── SHOP ─────────────────────────────────────────
const shopItems=[
  {id:'hp1',name:'Soul Chain Fragment',desc:'+1 Max HP',price:45,fn:()=>{P.mHP++;P.hp=P.mHP;}},
  {id:'hp2',name:'Soul Chain Link',desc:'+1 Max HP',price:80,fn:()=>{P.mHP++;P.hp=P.mHP;}},
  {id:'frozen_blade',name:"Sode no Shirayuki Edge",desc:"Frozen Blade: slows enemies on hit + ice crystals (Rukia-themed)",price:70,fn:()=>{weaponMods.frozenBlade.active=true;}},
  {id:'whip_blade',name:"Zabimaru Extension",desc:"Whip Blade: +55% melee reach, chain segments (Renji-themed)",price:65,fn:()=>{weaponMods.whipBlade.active=true;}},
  {id:'double_jump',name:'Air Walk',desc:'Double jump in air',price:90,fn:()=>{P.hasDJ=true;}},
  {id:'bankai',name:'Bankai Training',desc:'Press B when full!',price:130,fn:()=>{P.hasBankai=true;}},
  {id:'hollow_mask',name:'Hollow Mask',desc:'Press H when full!',price:110,fn:()=>{P.hasHollow=true;}},
  {id:'reiatsu_boost',name:'Reiatsu Amplifier',desc:'+25 Max Reiatsu',price:70,fn:()=>{P.mSl+=25;}},
];

function openShop(){
  gs=GS.SHOP;
  const cont=document.getElementById('shop-items');cont.innerHTML='';
  document.getElementById('shop-coins').textContent=`Kon Coins: ${P.cn}`;
  for(const it of shopItems){
    const owned=P.items.includes(it.id),aff=P.cn>=it.price;
    const d=document.createElement('div');
    d.className='shop-item'+(owned?' sold':'')+((!aff&&!owned)?' cant-afford':'');
    d.innerHTML=`<div><div class="si-name">${it.name}${owned?' ✓':''}</div><div class="si-desc">${it.desc}</div></div><span class="price">${owned?'OWNED':it.price}</span>`;
    if(!owned&&aff)d.addEventListener('click',()=>{P.cn-=it.price;it.fn();P.items.push(it.id);AU.play('pickup');notify('Purchased: '+it.name);openShop();});
    cont.appendChild(d);
  }
  document.getElementById('shop-ui').style.display='block';
}
function closeShop(){gs=GS.PLAY;document.getElementById('shop-ui').style.display='none';}

// ─────────────────────────────── MAP ──────────────────────────────────────────
function drawMap(){
  MX.fillStyle='#0a0518';MX.fillRect(0,0,750,500);
  MX.font='18px Georgia';MX.fillStyle='#9966dd';MX.textAlign='center';
  MX.fillText('SOUL SOCIETY & HUECO MUNDO MAP',375,30);
  const pos={r1:{x:50,y:150},r2:{x:120,y:150},r3:{x:200,y:150},s1:{x:280,y:150},boss1:{x:350,y:150},post_renji:{x:350,y:220},s2:{x:420,y:220},boss2:{x:490,y:220},victory:{x:490,y:290},h1:{x:560,y:290},h2:{x:620,y:290},ln1:{x:680,y:290},boss3:{x:680,y:360},post_grimm:{x:620,y:360},boss4:{x:560,y:360},ending:{x:560,y:420}};
  const conn=[['r1','r2'],['r2','r3'],['r3','s1'],['s1','boss1'],['boss1','post_renji'],['post_renji','s2'],['s2','boss2'],['boss2','victory'],['victory','h1'],['h1','h2'],['h2','ln1'],['ln1','boss3'],['boss3','post_grimm'],['post_grimm','boss4'],['boss4','ending']];
  MX.strokeStyle='#444';MX.lineWidth=2;
  for(const[a,b]of conn)if(vis.has(a)&&vis.has(b)){MX.beginPath();MX.moveTo(pos[a].x,pos[a].y);MX.lineTo(pos[b].x,pos[b].y);MX.stroke();}
  const nm={r1:'Rukon',r2:'Rukia',r3:'Yoruichi',s1:'Seireitei',boss1:'Renji',post_renji:'Recovery',s2:'Inner',boss2:'Byakuya',victory:'Gate',h1:'Desert',h2:'Nel',ln1:'Las Noches',boss3:'Grimmjow',post_grimm:'Depths',boss4:'Ulquiorra',ending:'Victory'};
  for(const[id,p]of Object.entries(pos)){
    if(!vis.has(id))continue;const room=RM[id];if(!room)continue;
    const zc=room.zone==='seireitei'?'#9955dd':room.zone==='hueco'?'#aa9955':room.zone==='lasnoches'?'#666688':'#5577bb';
    MX.fillStyle=id===cID?'#fff':zc;MX.globalAlpha=id===cID?1:.6;
    MX.fillRect(p.x-20,p.y-12,40,24);MX.globalAlpha=1;
    MX.fillStyle='#ddd';MX.font='7px monospace';MX.textAlign='center';
    MX.fillText(nm[id]||id,p.x,p.y+22);
    if(id===cID){MX.fillStyle='#ff7722';MX.beginPath();MX.arc(p.x,p.y,3,0,Math.PI*2);MX.fill();}
  }
  MX.fillStyle='#888';MX.textAlign='center';MX.font='11px monospace';MX.fillText('Press M or ESC to close',375,480);
}

// ─────────────────────────────── TILE DRAWING ─────────────────────────────────
function dTile(c,tl,x,y,zone){
  const z=ZN[zone]||ZN.rukon;
  if(tl===1){
    c.fillStyle=z.wc;c.fillRect(x,y,T,T);
    c.fillStyle=z.wi;c.fillRect(x+1,y+1,T-2,T-2);
    if((x+y)%97<30){c.fillStyle=z.wc;c.fillRect(x+4,y+4,8,8);}
    c.fillStyle=z.wh;c.fillRect(x,y,T,1);c.fillRect(x,y,1,T);
  } else if(tl===2){
    c.fillStyle=z.pc;c.fillRect(x,y,T,6);c.fillStyle=z.pt;c.fillRect(x,y,T,2);
  } else if(tl===3){
    c.fillStyle='#996666';
    for(let i=0;i<4;i++){const sx=x+i*8;c.beginPath();c.moveTo(sx,y+T);c.lineTo(sx+4,y+8);c.lineTo(sx+8,y+T);c.fill();}
    c.fillStyle='#cc7777';for(let i=0;i<4;i++)c.fillRect(x+i*8+3,y+8,2,4);
  } else if(tl===5){
    c.fillStyle='#3a3828';c.fillRect(x,y,T,T);c.fillStyle='#4a4630';c.fillRect(x+1,y+1,T-2,T-2);
    c.strokeStyle='#5a5538';c.lineWidth=1;c.beginPath();c.moveTo(x+5,y+2);c.lineTo(x+15,y+15);c.lineTo(x+10,y+28);c.stroke();
  } else if(tl===6){
    c.fillStyle='#aa9966';c.fillRect(x,y,T,T);c.fillStyle='#998855';c.fillRect(x+2,y+2,T-4,T-4);
    if(fr%20<10){c.fillStyle='#887744';c.fillRect(x+8,y+10,4,4);c.fillRect(x+18,y+20,4,4);}
  } else if(tl===7){
    // Spikes
    c.fillStyle='#888';c.fillRect(x,y+T-8,T,8);
    c.fillStyle='#ccc';
    c.beginPath();c.moveTo(x+4,y+T-8);c.lineTo(x+8,y+T-24);c.lineTo(x+12,y+T-8);c.fill();
    c.beginPath();c.moveTo(x+14,y+T-8);c.lineTo(x+18,y+T-24);c.lineTo(x+22,y+T-8);c.fill();
    c.beginPath();c.moveTo(x+24,y+T-8);c.lineTo(x+28,y+T-24);c.lineTo(x+32,y+T-8);c.fill();
  }
}

// ─────────────────────────────── BG / FG ──────────────────────────────────────
function dBG(c,zone){
  const z=ZN[zone]||ZN.rukon;
  const g=c.createLinearGradient(0,0,0,C.height);g.addColorStop(0,z.bgT);g.addColorStop(1,z.bgB);
  c.fillStyle=g;c.fillRect(0,0,C.width,C.height);
  c.globalAlpha=.1;
  for(let i=0;i<5;i++){
    const px=((i*200-cam.x*.3)%(C.width+200))-100,py=100+i*80;
    if(zone==='seireitei'){c.fillStyle='#2a1a40';c.fillRect(px,py,60,C.height-py);c.fillRect(px+70,py-30,40,C.height-py+30);}
    else if(zone==='hueco'||zone==='lasnoches'){c.fillStyle='#2a2820';c.fillRect(px,py+50,30,C.height-py-50);c.fillRect(px+50,py+20,25,C.height-py-20);}
    else{c.fillStyle='#0a2a10';c.beginPath();c.moveTo(px,py+80);c.lineTo(px+20,py);c.lineTo(px+40,py+80);c.fill();}
  }
  c.globalAlpha=1;
  if(zone==='hueco'||zone==='lasnoches'){c.globalAlpha=.15;c.fillStyle='#ffffcc';c.beginPath();c.arc(C.width-100,80,50,0,Math.PI*2);c.fill();c.globalAlpha=1;}
}
function dFG(c,zone){
  const z=ZN[zone]||ZN.rukon;
  if(fr%30===0)pts.push(new Pt(cam.x+Math.random()*C.width,cam.y+Math.random()*C.height,(Math.random()-.5)*.3,-.2-Math.random()*.3,120+Math.random()*60,z.prt,1+Math.random()*2,'sp'));
  if(zone==='seireitei'&&fr%3===0)pts.push(new Pt(cam.x+Math.random()*C.width,cam.y-10,.5,8+Math.random()*4,30,'rgba(120,120,180,.3)',1,'k'));
  if(zone==='hueco'&&fr%8===0)pts.push(new Pt(cam.x+Math.random()*C.width,cam.y+C.height+10,(Math.random()-.5),-.5-Math.random(),60,'#aa9966',1+Math.random(),'sand'));
  c.fillStyle=z.fc;c.fillRect(0,0,C.width,C.height);
  const v=c.createRadialGradient(C.width/2,C.height/2,C.width*.35,C.width/2,C.height/2,C.width*.7);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.3)');
  c.fillStyle=v;c.fillRect(0,0,C.width,C.height);
}

// ─────────────────────────────── SAVE POINT (ORIHIME) ─────────────────────────
function dSave(c,sv,cx,cy){
  if(!sv)return;
  const sx=sv.x*T-cx,sy=sv.y*T-cy,pu=Math.sin(fr*.05);
  // Healing shield aura
  c.globalAlpha=.12+pu*.06;c.fillStyle='#ffaa44';
  c.beginPath();c.arc(sx+16,sy+14,24+pu*5,0,Math.PI*2);c.fill();
  c.globalAlpha=.08+pu*.03;c.fillStyle='#ffdd88';
  c.beginPath();c.arc(sx+16,sy+14,32+pu*6,0,Math.PI*2);c.fill();
  c.globalAlpha=1;
  // Orihime sprite
  c.fillStyle='#e8c8a0';c.fillRect(sx+10,sy+4,12,12);
  c.fillStyle='#cc5500';c.fillRect(sx+6,sy,20,8);
  c.fillStyle='#cc5500';c.fillRect(sx+4,sy+4,6,18);c.fillRect(sx+22,sy+4,6,18);
  c.fillStyle='#553322';c.fillRect(sx+12,sy+8,3,2);c.fillRect(sx+18,sy+8,3,2);
  c.fillStyle='#eee';c.fillRect(sx+8,sy+16,16,16);
  c.fillStyle='#ddd';c.fillRect(sx+12,sy+16,8,16);
  c.fillStyle=~~(fr/8)%2?'#ffcc44':'#ffee88';
  c.fillRect(sx+6,sy+4,3,3);c.fillRect(sx+23,sy+4,3,3);
  if(fr%12===0)sp(sx+16+cx,sy+cy+(Math.random()-.5)*20,1,'#ffdd88',0.5,25,2,'sp');
  const dx=P.x+P.w/2-(sv.x*T+16),dy=P.y+P.h/2-(sv.y*T+16);
  if(Math.sqrt(dx*dx+dy*dy)<45){
    c.fillStyle='#ffcc66';c.font='10px monospace';c.textAlign='center';
    c.fillText('HEAL & SAVE [E]',sx+16,sy-18);
    c.fillStyle='#ffdd88';c.font='8px monospace';c.fillText('\u2014 Orihime \u2014',sx+16,sy-8);
  }
}

// ─────────────────────────────── HUD ──────────────────────────────────────────
function dHUD(c){
  // HP orbs
  for(let i=0;i<P.mHP;i++){
    const hx=20+i*22,hy=18;
    c.fillStyle='#333';c.strokeStyle='#555';c.lineWidth=2;
    c.beginPath();c.arc(hx+8,hy+8,8,0,Math.PI*2);c.fill();c.stroke();
    if(i<P.hp){
      c.fillStyle='#55dd99';c.shadowColor='#55ffaa';c.shadowBlur=5;
      c.beginPath();c.arc(hx+8,hy+8,6,0,Math.PI*2);c.fill();c.shadowBlur=0;
    }
  }

  // Reiatsu bar
  c.fillStyle='#1a1a30';c.fillRect(20,42,110,6);c.strokeStyle='#3a3a66';c.lineWidth=1;c.strokeRect(20,42,110,6);
  const sp_=P.sl/P.mSl;
  if(sp_>0){
    const barColor=P.charging?'#66aaff':'#5599ff';
    c.fillStyle=barColor;c.fillRect(21,43,108*sp_,4);
    if(P.charging){c.shadowColor='#66aaff';c.shadowBlur=8;c.fillRect(21,43,108*sp_,4);c.shadowBlur=0;}
  }
  c.fillStyle='#7799bb';c.font='7px monospace';c.textAlign='left';
  c.fillText(P.charging?'CHARGING! [C]':'REIATSU',20,40);

  // Bankai bar
  if(P.hasBankai){
    c.fillStyle='#1a0a0a';c.fillRect(20,52,55,4);c.strokeStyle='#663333';c.strokeRect(20,52,55,4);
    const bk=P.bk/100;
    if(bk>0){c.fillStyle=P.bkActive?'#ff4400':'#cc3333';c.fillRect(21,53,53*bk,2);}
    c.fillStyle='#aa6644';c.font='6px monospace';c.fillText(P.bkActive?'BANKAI!':'BNK[B]',20,51);
  }

  // Hollow bar
  if(P.hasHollow){
    c.fillStyle='#1a1a1a';c.fillRect(78,52,52,4);c.strokeStyle='#666';c.strokeRect(78,52,52,4);
    const hm=P.hm/100;
    if(hm>0){c.fillStyle=P.hmActive?'#fff':'#aaa';c.fillRect(79,53,50*hm,2);}
    c.fillStyle='#888';c.font='6px monospace';c.fillText(P.hmActive?'HOLLOW!':'HLW[H]',78,51);
  }

  // Weapon mod indicators
  let modY=60;
  if(weaponMods.frozenBlade.active){c.fillStyle='#88ccff';c.font='7px monospace';c.fillText('❄ FROZEN BLADE',20,modY);modY+=9;}
  if(weaponMods.whipBlade.active){c.fillStyle='#ffaa44';c.font='7px monospace';c.fillText('⛓ WHIP REACH',20,modY);}

  // Coins
  c.fillStyle='#ffdd33';c.font='13px monospace';c.textAlign='right';c.fillText(`${P.cn}`,C.width-20,28);
  c.fillStyle='#ffbb22';c.beginPath();c.arc(C.width-48,23,7,0,Math.PI*2);c.fill();
  c.fillStyle='#ffdd33';c.font='9px monospace';c.textAlign='center';c.fillText('K',C.width-48,27);
  c.textAlign='left';

  // Zone name
  if(cR){c.fillStyle='rgba(255,255,255,.35)';c.font='11px Georgia';c.textAlign='center';c.fillText(ZN[cR.zone]?.name||'',C.width/2,22);c.textAlign='left';}

  // Combo Counter
  if(comboCount>1){
    c.fillStyle=`rgba(255,150,50,${comboTimer/180})`;
    c.font='bold italic 24px sans-serif';
    c.fillText(comboCount+' HITS',C.width/2+100,50);
    if(comboCount>5)c.fillText('BONUS!',C.width/2+100,75);
  }

  // Minimap
  if(cR){
    const mw=120,mh=80,mx=C.width-mw-20,my=50;
    c.fillStyle='rgba(0,0,0,0.6)';c.fillRect(mx,my,mw,mh);
    c.strokeStyle='#555';c.strokeRect(mx,my,mw,mh);
    const sw=mw/cR.w,sh=mh/cR.h;
    c.fillStyle='#445566';
    for(let y=0;y<cR.h;y++){
      for(let x=0;x<cR.w;x++){
        if(cR.tiles[y]&&cR.tiles[y][x])c.fillRect(mx+x*sw,my+y*sh,Math.ceil(sw),Math.ceil(sh));
      }
    }
    // Player dot
    c.fillStyle='#00ff88';
    c.beginPath();c.arc(mx+(P.x/T)*sw,my+(P.y/T)*sh,2.5,0,Math.PI*2);c.fill();
    // Save point dot
    if(cR.save){
      c.fillStyle='#ffaa44';
      c.beginPath();c.arc(mx+cR.save.x*sw,my+cR.save.y*sh,2,0,Math.PI*2);c.fill();
    }
  }
}

// ─────────────────────────────── COMBAT ───────────────────────────────────────
function combat(){
  const pwrMult=P.bkActive?1.4:(P.hmActive?1.25:1);
  let hitLanded=false;
  if(P.aT===AD-1){
    const ab=P.atkBounds();
    const dm=Math.floor((DMG+(P.items.includes('zangetsu_edge')?2:0))*pwrMult);
    for(const e of ens){
      if(e.hp<=0)continue;
      if(rO(ab,e.bounds())){
        e.takeDmg(dm);
        hitLanded=true;
        if(P.aD===1){P.vy=PG;P.gnd=false;}
      }
    }
    if(boss&&boss.hp>0&&boss.active&&rO(ab,boss.bounds())){boss.takeDmg(dm);hitLanded=true;if(P.aD===1){P.vy=PG;P.gnd=false;}}
    if(P.aD===1&&cR){
      const cx=P.x+P.w/2,cy=P.y+P.h+10;
      for(let dx=-1;dx<=1;dx++){
        const stx=~~((cx+dx*8)/T),sty=~~(cy/T);
        if(stx>=0&&stx<cR.w&&sty>=0&&sty<cR.h&&cR.tiles[sty]&&cR.tiles[sty][stx]===3){
          P.vy=PG;P.gnd=false;P.inv=Math.max(P.inv,10);AU.play('hit');shk=3;sp(cx,cy,8,'#ff8866',3,15,2,'k');break;
        }
      }
    }
  }
  
  if(hitLanded){
    comboCount++;comboTimer=180;
    if(comboCount>comboBest)comboBest=comboCount;
  }
  if(comboTimer>0){comboTimer--;if(comboTimer<=0)comboCount=0;}

  // Enemy contact damage
  let tookHit=false;
  for(const e of ens){if(e.hp<=0)continue;if(rO(P.bounds(),e.bounds())){if(P.inv<=0)tookHit=true;P.takeDmg(e.dmg);}}
  // Boss contact
  if(boss&&boss.hp>0&&boss.active&&boss.state!=='ptrans'&&rO(P.bounds(),boss.bounds())){if(P.inv<=0)tookHit=true;P.takeDmg(boss.dmg);}
  
  if(tookHit)comboCount=0;

  // Boss activation
  if(boss&&!boss.active&&!boss.defeated){
    const dx=P.x-boss.x,dy=P.y-boss.y;
    if(Math.sqrt(dx*dx+dy*dy)<200){
      boss.activate();
      gs=GS.BOSS_INTRO;bossIntroTimer=180;
      bossIntroName=boss.name;
      bossIntroLine=boss.type==='renji'?"Tch... So you finally made it.":
                    boss.type==='byakuya'?"You still fail to see the difference in our power.":
                    boss.type==='grimmjow'?"I've been waiting for this, Kurosaki!":
                    boss.type==='ulquiorra'?"Your heart... where is it?":"";
    }
  }
  if(boss&&boss.defeated&&boss.hp<=-999){dB.add(cID);boss=null;}
}

// ─────────────────────────────── NPC CHECK ────────────────────────────────────
function checkNPC(){
  if(!eP||gs!==GS.PLAY)return;
  if(cR?.save){
    const sv=cR.save,dx=P.x+P.w/2-(sv.x*T+16),dy=P.y+P.h/2-(sv.y*T+16);
    if(Math.sqrt(dx*dx+dy*dy)<45){saveGame();P.hp=P.mHP;P.sl=P.mSl;loadRoom(cID);sp(P.x+P.w/2,P.y+P.h/2,20,'#55ffaa',3,30,3,'sp');return;}
  }
  for(const npc of npcs){
    if(npc.near()){
      if(npc.talked&&npc.shop)openShop();
      else if(npc.talked&&npc.healer){P.hp=P.mHP;P.sl=P.mSl;sp(P.x+P.w/2,P.y+P.h/2,20,'#ffaa44',4,30,4,'sp');notify('Healed by '+npc.nm);}
      else openDlg(npc);return;
    }
  }
}

// ─────────────────────────────── UPDATE & RENDER ──────────────────────────────
function update(){
  if(gs!==GS.PLAY||!cR)return;
  P.update(cR);combat();checkNPC();
  for(const e of ens)if(e.hp>0)e.update(cR);
  if(boss)boss.update(cR);
  for(const n of npcs)n.update();
  upPr(cR);upBP(cR);
  for(let i=pts.length-1;i>=0;i--)if(!pts[i].update())pts.splice(i,1);
  
  // Spike Collision
  if(fr%10===0){
    const cx=P.x+P.w/2,cy=P.y+P.h-2,tx=~~(cx/T),ty=~~(cy/T);
    if(cR.tiles[ty]&&cR.tiles[ty][tx]===7&&P.inv<=0){P.takeDmg(2);P.vy=-8;P.gnd=false;}
    for(const e of ens){
      if(e.hp<=0)continue;
      const ex=e.x+e.w/2,ey=e.y+e.h-2,etx=~~(ex/T),ety=~~(ey/T);
      if(cR.tiles[ety]&&cR.tiles[ety][etx]===7){e.takeDmg(2);e.vy=-6;e.gnd=false;}
    }
  }

  cam.update(P.x+P.w/2,P.y+P.h/2,cR.w,cR.h);
  if(shk>0)shk-=.5;if(fls>0)fls--;
  if(IN.pressed('map')){gs=GS.MAP;document.getElementById('map-overlay').style.display='flex';drawMap();}
}

function render(){
  if(!cR)return;
  const c=X;c.save();
  const shkMult=shk*shkIntensity;
  if(shkMult>0)c.translate((Math.random()-.5)*shkMult*2,(Math.random()-.5)*shkMult*2);
  const zone=cR.zone,cx=Math.round(cam.x),cy=Math.round(cam.y);
  dBG(c,zone);
  const stx=Math.max(0,~~(cx/T)),etx=Math.min(cR.w,Math.ceil((cx+C.width)/T)+1);
  const sty=Math.max(0,~~(cy/T)),ety=Math.min(cR.h,Math.ceil((cy+C.height)/T)+1);
  for(let y=sty;y<ety;y++)for(let x=stx;x<etx;x++)if(cR.tiles[y]&&cR.tiles[y][x])dTile(c,cR.tiles[y][x],x*T-cx,y*T-cy,zone);
  dSave(c,cR.save,cx,cy);
  for(const n of npcs)n.draw(c,cx,cy);
  for(const e of ens)if(e.hp>0)e.draw(c,cx,cy);
  if(boss)boss.draw(c,cx,cy);
  drBP(c,cx,cy);P.draw(c,cx,cy);drPr(c,cx,cy);
  for(const p of pts)p.draw(c,cx,cy);
  dFG(c,zone);
  
  // Render floating damage numbers
  for(let i=dmgNums.length-1;i>=0;i--){
    const d=dmgNums[i];
    c.globalAlpha=d.l/d.ml;
    c.fillStyle=d.c;c.font='bold 16px sans-serif';c.textAlign='center';
    c.fillText(d.v,d.x-cx,d.y-cy);
    c.globalAlpha=1;
    d.y-=0.8;d.l--;
    if(d.l<=0)dmgNums.splice(i,1);
  }

  if(fls>0){c.globalAlpha=fls/5*.4;c.fillStyle='#fff';c.fillRect(0,0,C.width,C.height);c.globalAlpha=1;}
  c.restore();
  
  if(gs===GS.BOSS_INTRO){
    const bp=1-(bossIntroTimer/180);
    c.fillStyle='#000';
    c.fillRect(0,0,C.width,80*Math.min(1,bp*3));
    c.fillRect(0,C.height-80*Math.min(1,bp*3),C.width,80);
    if(bp>0.2){
      c.fillStyle='#fff';c.font='bold 32px serif';c.textAlign='center';
      c.fillText(bossIntroName,C.width/2,C.height/2-20);
      c.fillStyle='#ccc';c.font='italic 18px serif';
      c.fillText(`"${bossIntroLine}"`,C.width/2,C.height/2+20);
    }
  } else {
    dHUD(c);
  }
}

// ─────────────────────────────── GAME LOOP ────────────────────────────────────
function gameLoop(){
  IN.poll();
  fr++;if(dlgT>0)dlgT--;
  if(gs===GS.DLG){if(sP||kp['Enter']||clickP)nextLine();if(kp['Escape'])closeDlg();render();}
  else if(gs===GS.SHOP){if(kp['Escape']||eP)closeShop();render();}
  else if(gs===GS.MAP){if(IN.pressed('map')||kp['Escape']){gs=GS.PLAY;document.getElementById('map-overlay').style.display='none';}render();}
  else if(gs===GS.DEAD){if(kp['Enter']||sP||clickP)P.respawn();render();}
  else if(gs===GS.ABILITY){if(sP||kp['Enter']||clickP){gs=GS.PLAY;document.getElementById('ability-popup').style.display='none';}render();}
  else if(gs===GS.BOSS_INTRO){bossIntroTimer--;if(bossIntroTimer<=0)gs=GS.PLAY;render();}
  else if(gs===GS.PLAY){update();render();}
  IN.clear();
  requestAnimationFrame(gameLoop);
}

// ─────────────────────────────── EVENT LISTENERS ──────────────────────────────
document.getElementById('dialogue-box').addEventListener('click',e=>{e.stopPropagation();clickP=true;});
document.getElementById('game-over-screen').addEventListener('click',e=>{e.stopPropagation();clickP=true;});
document.getElementById('ability-popup').addEventListener('click',e=>{e.stopPropagation();clickP=true;});
C.addEventListener('click',()=>{clickP=true;});

function startGame(){
  AU.init();
  const ts=document.getElementById('title-screen');ts.style.opacity='0';
  setTimeout(()=>ts.style.display='none',1000);
  gs=GS.PLAY;
  if(!loadSv()){
    loadRoom('r1');P.x=128;P.y=400;P.reset();P.sR='r1';P.sX=128;P.sY=400;
    AU.playTrack('rukon');
  }
  notify('Welcome to Soul Society, Ichigo  |  Hold C to charge Reiatsu!');
}

document.getElementById('title-screen').addEventListener('click',()=>{if(gs===GS.TITLE)startGame();});
document.addEventListener('keydown',e=>{if(gs===GS.TITLE&&(e.code==='Enter'||e.code==='Space'))startGame();});

gameLoop();
