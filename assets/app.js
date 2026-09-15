
(() => {

  const siteLoader = document.getElementById('siteLoader');
  function startLoader(){
    if(!siteLoader) return;
    setTimeout(() => {
      siteLoader.classList.add('is-leaving');
      const remove = () => siteLoader.remove();
      siteLoader.addEventListener('transitionend', e => {
        if(e.target === siteLoader && e.propertyName === 'opacity') remove();
      });
      setTimeout(remove, 460);
    }, 1500);
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', startLoader, {once:true});
  }else{
    startLoader();
  }

  const tones = [...document.querySelectorAll('.hit-zone')];
  document.querySelectorAll('.pan-image').forEach(image => {
    const decode = () => {
      if(typeof image.decode === 'function') image.decode().catch(() => {});
    };
    if(image.complete) decode();
    else image.addEventListener('load', decode, {once:true});
  });

  const SILVER_LAYOUT = {
    D3:[50.0,49.5],
    A3:[35.1,17.5],
    Bb3:[65.4,17.5],
    C4:[82.7,33.7],
    D4:[83.6,59.9],
    E4:[66.1,81.4],
    F4:[34.2,81.5],
    G4:[16.6,59.8],
    A4:[17.3,34.0]
  };

  const ARTPLAY_LAYOUT = {
    D3:[51.0,50.0],
    A3:[36.9,18.0],
    Bb3:[65.5,18.0],
    C4:[83.1,34.2],
    D4:[84.2,59.5],
    E4:[66.4,81.0],
    F4:[36.2,81.2],
    G4:[18.0,59.8],
    A4:[18.8,34.6]
  };

  function applyHitLayout(layout){
    tones.forEach(tone => {
      const p = layout[tone.dataset.note];
      if(!p) return;
      tone.style.setProperty('--x', p[0] + '%');
      tone.style.setProperty('--y', p[1] + '%');
    });
  }

  applyHitLayout(SILVER_LAYOUT);



  const audioDot = document.getElementById('audioDot');
  const artplayToggle = document.getElementById('artplayToggle');
  let artplayMode = false;
  const symbolsBtn = document.getElementById('symbolsBtn');
  const motionBtn = document.getElementById('motionBtn');
  const panWrap = document.querySelector('.pan-image-wrap');
  const specularDisc = document.querySelector('.specular-disc');

  // Lower, warmer D Kurd-like register.
  const noteFreq = {
    D3:146.83,
    A3:220.00,
    Bb3:233.08,
    C4:261.63,
    D4:293.66,
    E4:329.63,
    F4:349.23,
    G4:392.00,
    A4:440.00
  };

  let ctx, master, reverb, bodyBus, shimmerBus;

  function ensureAudio(){
    if(!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)({latencyHint:'interactive'});

      master = ctx.createGain();
      master.gain.value = 0.62;

      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = "lowshelf";
      lowShelf.frequency.value = 420;
      lowShelf.gain.value = 4.2;

      const highShelf = ctx.createBiquadFilter();
      highShelf.type = "highshelf";
      highShelf.frequency.value = 2800;
      highShelf.gain.value = -7.0;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -22;
      comp.knee.value = 22;
      comp.ratio.value = 2.4;
      comp.attack.value = .008;
      comp.release.value = .5;

      reverb = ctx.createConvolver();
      reverb.buffer = createImpulse(ctx, 1.65, 3.2);

      const wet = ctx.createGain();
      wet.gain.value = .13;

      const dry = ctx.createGain();
      dry.gain.value = .97;

      bodyBus = ctx.createGain();
      bodyBus.gain.value = 1.0;

      shimmerBus = ctx.createGain();
      shimmerBus.gain.value = .38;

      bodyBus.connect(master);
      shimmerBus.connect(master);

      master.connect(dry).connect(lowShelf).connect(highShelf).connect(comp);
      master.connect(reverb).connect(wet).connect(comp);
      comp.connect(ctx.destination);

      audioDot.classList.add('on');
    }
    if(ctx.state === 'suspended') ctx.resume().catch(err => console.warn('Audio resume:', err));
  }

  function createImpulse(context, duration, decay){
    const len = Math.floor(context.sampleRate * duration);
    const impulse = context.createBuffer(2, len, context.sampleRate);
    for(let ch = 0; ch < 2; ch++){
      const data = impulse.getChannelData(ch);
      for(let i = 0; i < len; i++){
        const envelope = Math.pow(1 - i / len, decay);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }
    }
    return impulse;
  }

  function strike(freq, isDing=false){
    ensureAudio();
    const t = ctx.currentTime;

    const strikeBus = ctx.createGain();
    strikeBus.gain.setValueAtTime(0.0001, t);
    strikeBus.gain.exponentialRampToValueAtTime(isDing ? .64 : .56, t + (isDing ? .014 : .006));
    strikeBus.gain.exponentialRampToValueAtTime(0.0001, t + (isDing ? 5.8 : 4.2));
    strikeBus.connect(bodyBus);

    // Handpan modal structure: strong fundamental, octave and fifth-like body,
    // reduced upper partials to avoid bell-like / overly bright timbre.
    const bodyPartials = isDing
      ? [
          [0.50, .18, 4.2],
          [1.00, 1.00, 5.8],
          [1.50, .11, 3.8],
          [2.00, .13, 3.0],
          [2.98, .028, 1.8]
        ]
      : [
          [1.00, 1.00, 4.0],
          [1.50, .14, 2.7],
          [2.00, .19, 2.25],
          [2.97, .06, 1.35]
        ];

    let partialsLeft = bodyPartials.length;
    bodyPartials.forEach(([ratio, amp, decay], idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * ratio, t);
      osc.detune.setValueAtTime((Math.random()*2 - 1) * (idx === 0 ? 0.7 : 2.2), t);

      gain.gain.setValueAtTime(.0001, t);
      gain.gain.exponentialRampToValueAtTime(amp, t + (idx === 0 ? .008 : .004));
      gain.gain.exponentialRampToValueAtTime(.0001, t + decay);

      osc.connect(gain).connect(strikeBus);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        if(--partialsLeft === 0) strikeBus.disconnect();
      };
      osc.start(t);
      osc.stop(t + decay + .08);
    });

    // Very short, muted finger/metal contact instead of bright click.
    const noiseLen = Math.floor(ctx.sampleRate * .035);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for(let i=0;i<d.length;i++){
      d[i] = (Math.random()*2 - 1) * Math.pow(1 - i/d.length, 4.2);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = isDing ? 760 : Math.min(1500, freq * 4.2);
    band.Q.value = 1.1;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(isDing ? .012 : .038, t);
    ng.gain.exponentialRampToValueAtTime(.0001, t + .045);

    noise.connect(band).connect(ng).connect(shimmerBus);
    noise.onended = () => { noise.disconnect(); band.disconnect(); ng.disconnect(); };
    noise.start(t);

    // Low shell resonance gives the instrument more physical body.
    const shell = ctx.createOscillator();
    const shellGain = ctx.createGain();
    shell.type = 'sine';
    shell.frequency.setValueAtTime(isDing ? 72 : 92, t);
    shellGain.gain.setValueAtTime(.0001, t);
    shellGain.gain.exponentialRampToValueAtTime(isDing ? .085 : .045, t + .018);
    shellGain.gain.exponentialRampToValueAtTime(.0001, t + (isDing ? .95 : .72));
    shell.connect(shellGain).connect(bodyBus);
    shell.onended = () => { shell.disconnect(); shellGain.disconnect(); };
    shell.start(t);
    shell.stop(t + (isDing ? 1.02 : .8));
  }

  const toneTimers = new WeakMap();
  function animateTone(tone){
    clearTimeout(toneTimers.get(tone));
    tone.classList.add('hit');
    toneTimers.set(tone, setTimeout(() => {
      tone.classList.remove('hit');
      toneTimers.delete(tone);
    }, 220));
  }

  let underglowTimer = 0;
  function triggerUnderglow(){
    clearTimeout(underglowTimer);
    panWrap.classList.add('glow-hit');
    underglowTimer = setTimeout(() => panWrap.classList.remove('glow-hit'), 180);
  }






  function envNoise(duration=.7, type='white'){
    ensureAudio();
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for(let i=0;i<len;i++){
      let v = Math.random()*2-1;
      if(type === 'brown'){
        last = (last + 0.02*v) / 1.02;
        v = last * 3.2;
      } else if(type === 'pink'){
        v = (v + last*0.72) * .58;
        last = v;
      }
      d[i] = Math.max(-1, Math.min(1, v));
    }
    return buf;
  }

  function playCarNoise(){
    ensureAudio();
    const t=ctx.currentTime;

    const engine=ctx.createOscillator();
    const eg=ctx.createGain();
    engine.type='sawtooth';
    engine.frequency.setValueAtTime(74,t);
    engine.frequency.linearRampToValueAtTime(96,t+.65);
    eg.gain.setValueAtTime(.0001,t);
    eg.gain.exponentialRampToValueAtTime(.09,t+.04);
    eg.gain.exponentialRampToValueAtTime(.0001,t+.8);
    engine.connect(eg).connect(master);
    engine.start(t); engine.stop(t+.85);

    const n=ctx.createBufferSource();
    n.buffer=envNoise(.8,'pink');
    const bp=ctx.createBiquadFilter();
    bp.type='bandpass'; bp.frequency.value=520; bp.Q.value=.65;
    const g=ctx.createGain();
    g.gain.setValueAtTime(.12,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.8);
    n.connect(bp).connect(g).connect(master);
    n.start(t);
  }

  function playConstruction(){
    ensureAudio();
    const t=ctx.currentTime;
    for(let i=0;i<4;i++){
      const when=t+i*.11+Math.random()*.035;
      const o=ctx.createOscillator();
      const g=ctx.createGain();
      o.type='square';
      o.frequency.value=58+Math.random()*35;
      g.gain.setValueAtTime(.0001,when);
      g.gain.exponentialRampToValueAtTime(.18,when+.004);
      g.gain.exponentialRampToValueAtTime(.0001,when+.07);
      o.connect(g).connect(master);
      o.start(when); o.stop(when+.09);

      const n=ctx.createBufferSource();
      n.buffer=envNoise(.07,'white');
      const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1200;
      const ng=ctx.createGain();
      ng.gain.setValueAtTime(.08,when);
      ng.gain.exponentialRampToValueAtTime(.0001,when+.06);
      n.connect(hp).connect(ng).connect(master);
      n.start(when);
    }
  }

  function playTrainArrival(){
    ensureAudio();
    const t=ctx.currentTime;

    const rumble=ctx.createOscillator();
    const rg=ctx.createGain();
    rumble.type='sawtooth';
    rumble.frequency.setValueAtTime(42,t);
    rumble.frequency.linearRampToValueAtTime(56,t+.9);
    rg.gain.setValueAtTime(.0001,t);
    rg.gain.exponentialRampToValueAtTime(.11,t+.08);
    rg.gain.exponentialRampToValueAtTime(.0001,t+1.0);
    rumble.connect(rg).connect(master);
    rumble.start(t); rumble.stop(t+1.05);

    const n=ctx.createBufferSource();
    n.buffer=envNoise(1.0,'pink');
    const bp=ctx.createBiquadFilter();
    bp.type='bandpass';
    bp.frequency.setValueAtTime(380,t);
    bp.frequency.linearRampToValueAtTime(780,t+.9);
    bp.Q.value=.7;
    const g=ctx.createGain();
    g.gain.setValueAtTime(.02,t);
    g.gain.linearRampToValueAtTime(.14,t+.65);
    g.gain.exponentialRampToValueAtTime(.0001,t+1.0);
    n.connect(bp).connect(g).connect(master);
    n.start(t);
  }

  function playCafe(){
    ensureAudio();
    const t=ctx.currentTime;

    const n=ctx.createBufferSource();
    n.buffer=envNoise(.75,'pink');
    const bp=ctx.createBiquadFilter();
    bp.type='bandpass'; bp.frequency.value=1100; bp.Q.value=.5;
    const g=ctx.createGain();
    g.gain.setValueAtTime(.07,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.75);
    n.connect(bp).connect(g).connect(master);
    n.start(t);

    for(let i=0;i<6;i++){
      const when=t+Math.random()*.55;
      const o=ctx.createOscillator(), og=ctx.createGain();
      o.type='sine';
      o.frequency.value=250+Math.random()*700;
      og.gain.setValueAtTime(.0001,when);
      og.gain.exponentialRampToValueAtTime(.025,when+.01);
      og.gain.exponentialRampToValueAtTime(.0001,when+.08+Math.random()*.08);
      o.connect(og).connect(master);
      o.start(when); o.stop(when+.18);
    }
  }

  function playPlaneLanding(){
    ensureAudio();
    const t=ctx.currentTime;

    const n=ctx.createBufferSource();
    n.buffer=envNoise(1.05,'brown');
    const lp=ctx.createBiquadFilter();
    lp.type='lowpass';
    lp.frequency.setValueAtTime(950,t);
    lp.frequency.linearRampToValueAtTime(420,t+1.0);
    const g=ctx.createGain();
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.18,t+.12);
    g.gain.exponentialRampToValueAtTime(.0001,t+1.05);
    n.connect(lp).connect(g).connect(master);
    n.start(t);

    const o=ctx.createOscillator(), og=ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(82,t);
    o.frequency.linearRampToValueAtTime(58,t+1.0);
    og.gain.setValueAtTime(.0001,t);
    og.gain.exponentialRampToValueAtTime(.07,t+.1);
    og.gain.exponentialRampToValueAtTime(.0001,t+1.0);
    o.connect(og).connect(master);
    o.start(t); o.stop(t+1.05);
  }

  function playChildren(){
    ensureAudio();
    const t=ctx.currentTime;
    for(let i=0;i<7;i++){
      const when=t+Math.random()*.62;
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='triangle';
      const f=520+Math.random()*680;
      o.frequency.setValueAtTime(f,when);
      o.frequency.linearRampToValueAtTime(f*(.86+Math.random()*.28),when+.12);
      g.gain.setValueAtTime(.0001,when);
      g.gain.exponentialRampToValueAtTime(.035+Math.random()*.02,when+.015);
      g.gain.exponentialRampToValueAtTime(.0001,when+.13+Math.random()*.09);
      o.connect(g).connect(master);
      o.start(when); o.stop(when+.25);
    }
  }

  function playNeighborBanging(){
    ensureAudio();
    const t=ctx.currentTime;
    const hits=[0,.16,.39];
    hits.forEach((off,i)=>{
      const when=t+off;
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='sine';
      o.frequency.value=72+i*8;
      g.gain.setValueAtTime(.0001,when);
      g.gain.exponentialRampToValueAtTime(.24,when+.004);
      g.gain.exponentialRampToValueAtTime(.0001,when+.18);
      o.connect(g).connect(master);
      o.start(when); o.stop(when+.2);

      const n=ctx.createBufferSource();
      n.buffer=envNoise(.12,'brown');
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=330;
      const ng=ctx.createGain();
      ng.gain.setValueAtTime(.09,when);
      ng.gain.exponentialRampToValueAtTime(.0001,when+.12);
      n.connect(lp).connect(ng).connect(master);
      n.start(when);
    });
  }

  function playFirecracker(){
    ensureAudio();
    const t=ctx.currentTime;
    for(let i=0;i<2;i++){
      const when=t+i*.10+Math.random()*.025;
      const n=ctx.createBufferSource();
      n.buffer=envNoise(.11,'white');
      const hp=ctx.createBiquadFilter();
      hp.type='highpass'; hp.frequency.value=1800+Math.random()*900;
      const g=ctx.createGain();
      g.gain.setValueAtTime(.18,when);
      g.gain.exponentialRampToValueAtTime(.0001,when+.08);
      n.connect(hp).connect(g).connect(master);
      n.start(when);
    }
  }


  const ARTPLAY_SAMPLES = {
    A3: {
      label:'street traffic',
      url:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Ambient_sound_street_traffic_Berlin_2026-05-17.oga',
      duration:3.0,
      start:() => Math.random()*25
    },
    Bb3: {
      label:'construction site',
      url:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Construction.ogg',
      duration:3.0,
      start:() => 8 + Math.random()*185
    },
    C4: {
      label:'train arriving',
      url:'https://commons.wikimedia.org/wiki/Special:Redirect/file/GO_Train_arrives_at_Guildwood_GO_Station_(Freesound).ogg',
      duration:3.0,
      start:() => 20 + Math.random()*36
    },
    D4: {
      label:'busy cafe',
      url:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Cafe_ambiance.ogg',
      duration:3.0,
      start:() => 15 + Math.random()*1150
    },
    E4: {
      label:'airplane landing',
      url:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Jet_airliner_overhead.ogg',
      duration:3.0,
      start:() => 18 + Math.random()*38
    },
    F4: {
      label:'children playing',
      url:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Ambient_sound_children_playing_in_a_park_2026-05-19.oga',
      duration:3.0,
      start:() => Math.random()*25
    },
    G4: {
      label:'banging / hammering',
      url:'https://commons.wikimedia.org/wiki/Special:Redirect/file/WWS_Shoemakerhammeringwoodennails.ogg',
      duration:3.0,
      start:() => 2 + Math.random()*38
    },
    A4: {
      label:'car alarm triggered on street',
      url:'https://commons.wikimedia.org/wiki/Special:Redirect/file/GT3_RS_Acceleration_Sound_-_Sets_Off_Car_Alarm.webm',
      duration:3.0,
      start:() => 4.8
    }
  };

  const samplePools = new Map();

  function createSamplePool(note){
    const entry = {pool:[], index:0};
    samplePools.set(note, entry);
    return entry;
  }
  function createSampleVoice(note){
    const cfg = ARTPLAY_SAMPLES[note];
    const a = new Audio();
    a.preload = 'none';
    a.volume = note === 'A4' ? 1.0 : (note === 'E4' ? .90 : .78);
    a.playsInline = true;
    a.src = cfg.url;
    return a;
  }

  // Samples are created lazily on first use.


  function playRealSample(note){
    const cfg = ARTPLAY_SAMPLES[note];
    if(!cfg || !cfg.url) return false;
    const entry = samplePools.get(note) || createSamplePool(note);
    const index = entry.index;
    entry.index = (index + 1) % 2;
    const a = entry.pool[index] || (entry.pool[index] = createSampleVoice(note));

    if(a._cancelPlayback) a._cancelPlayback();
    a.pause();
    let startAt = cfg.start();
    if(note === 'A4'){
      const loudStarts = [1.2, 3.4, 5.8, 8.1, 10.6, 13.2, 16.0, 18.4];
      startAt = loudStarts[(Math.random()*loudStarts.length)|0];
    }
    let active = true;
    let stopTimer = 0;
    let metadataReady = false;
    const listeners = [];
    const on = (event, fn) => {
      a.addEventListener(event, fn);
      listeners.push([event,fn]);
    };
    const cancel = () => {
      if(!active) return;
      active = false;
      clearTimeout(stopTimer);
      listeners.forEach(([event,fn]) => a.removeEventListener(event,fn));
      a._cancelPlayback = null;
    };
    const finish = () => { cancel(); a.pause(); };
    const fail = () => {
      if(!active) return;
      finish();
      playArtplayFallback(note);
    };
    const seek = () => {
      if(!active || metadataReady) return;
      metadataReady = true;
      try{
        const limit = Number.isFinite(a.duration)
          ? Math.max(0, a.duration - cfg.duration - .1) : startAt;
        startAt = Math.max(0, Math.min(startAt, limit));
        a.currentTime = startAt;
      }catch(err){ console.warn('Sample seek:', err); }
    };
    const armStop = () => {
      if(!active || !metadataReady) return;
      clearTimeout(stopTimer);
      const played = Math.max(0, a.currentTime - startAt);
      stopTimer = setTimeout(finish, Math.max(0,cfg.duration - played)*1000);
    };
    a._cancelPlayback = cancel;
    on('loadedmetadata', seek);
    on('playing', armStop);
    on('waiting', () => clearTimeout(stopTimer));
    on('timeupdate', () => {
      if(active && metadataReady && a.currentTime - startAt >= cfg.duration) finish();
    });
    on('ended', finish);
    on('error', fail);
    if(a.readyState >= 1) seek();
    try{
      // Stay inside the original click/touch gesture for mobile autoplay rules.
      const promise = a.play();
      if(promise && promise.catch) promise.catch(() => { if(active) fail(); });
      return true;
    }catch(err){
      cancel();
      console.warn('Sample playback:', err);
      return false;
    }
  }

  function playArtplayFallback(note){
    switch(note){
      case 'A3': playCarNoise(); break;
      case 'Bb3': playConstruction(); break;
      case 'C4': playTrainArrival(); break;
      case 'D4': playCafe(); break;
      case 'E4': playPlaneLanding(); break;
      case 'F4': playChildren(); break;
      case 'G4': playNeighborBanging(); break;
      case 'A4': playFirecracker(); break;
    }
  }







  function strikeArtplay(note){
    const played = playRealSample(note);
    if(!played){
      playArtplayFallback(note);
    }
  }


  artplayToggle.addEventListener('click', () => {
    artplayMode = !artplayMode;
    document.body.classList.toggle('artplay-mode', artplayMode);
    artplayToggle.setAttribute('aria-pressed', artplayMode ? 'true' : 'false');
    applyHitLayout(artplayMode ? ARTPLAY_LAYOUT : SILVER_LAYOUT);
  });

  function playTone(tone){
    const note = tone.dataset.note;

    if(artplayMode && note === 'D3'){
      window.location.href = 'https://www.instagram.com/likhoy_art/';
      animateTone(tone);
      triggerUnderglow();
      return;
    }

    if(artplayMode){
      strikeArtplay(note);
    }else{
      strike(noteFreq[note], tone.classList.contains('ding-zone'));
    }

    animateTone(tone);
    triggerUnderglow();
  }

  tones.forEach(tone => {
    tone.addEventListener('pointerdown', e => {
      e.preventDefault();
      playTone(tone);
    });
  });

  symbolsBtn.addEventListener('click', () => {
    document.body.classList.toggle('hide-symbols');
    symbolsBtn.setAttribute('aria-pressed', String(!document.body.classList.contains('hide-symbols')));
    symbolsBtn.textContent = document.body.classList.contains('hide-symbols')
      ? 'show symbols'
      : 'hide symbols';
  });




  let motionEnabled = false;
  let motionPermissionGranted = false;

  let highlightFrame = 0;
  let pendingHighlight = null;
  let pendingPointer = null;
  function paintHighlight(){
    highlightFrame = 0;
    if(document.hidden) return;
    let point = pendingHighlight;
    if(pendingPointer){
      const r = panWrap.getBoundingClientRect();
      point = [((pendingPointer[0]-r.left)/r.width-.5)*2,
               ((pendingPointer[1]-r.top)/r.height-.5)*2];
    }
    pendingPointer = null;
    if(!point) return;
    const [nx,ny] = point;
    specularDisc.style.setProperty('--glow-x', `${50+nx*22}%`);
    specularDisc.style.setProperty('--glow-y', `${48+ny*20}%`);
    specularDisc.style.setProperty('--glow-angle', `${125+nx*28-ny*16}deg`);
  }
  function scheduleHighlight(){
    if(!highlightFrame && !document.hidden){
      highlightFrame = requestAnimationFrame(paintHighlight);
    }
  }
  function setHighlightFromNormalized(nx, ny){
    pendingPointer = null;
    pendingHighlight = [nx,ny];
    scheduleHighlight();
  }

  function handleOrientation(e){
    if(!motionEnabled) return;
    const gamma = Math.max(-40, Math.min(40, Number(e.gamma) || 0)) / 40;
    const betaRaw = Number(e.beta) || 0;

    // Normalize portrait / typical handheld tilt.
    let beta = 0;
    if(betaRaw > 45 && betaRaw < 135){
      beta = (betaRaw - 90) / 45;
    }else{
      beta = Math.max(-40, Math.min(40, betaRaw)) / 40;
    }

    setHighlightFromNormalized(gamma, Math.max(-1, Math.min(1, beta)));
  }

  async function requestMotionAccess(){
    try{
      const requests = [];
      if(typeof DeviceOrientationEvent !== 'undefined' &&
         typeof DeviceOrientationEvent.requestPermission === 'function'){
        requests.push(DeviceOrientationEvent.requestPermission());
      }
      if(typeof DeviceMotionEvent !== 'undefined' &&
         typeof DeviceMotionEvent.requestPermission === 'function'){
        requests.push(DeviceMotionEvent.requestPermission());
      }
      const granted = (await Promise.all(requests)).every(result => result === 'granted');

      if(!granted){
        motionEnabled = false;
        motionPermissionGranted = false;
        motionBtn.textContent = 'motion blocked';
        panWrap.classList.add('motion-disabled');
        return false;
      }

      motionPermissionGranted = true;
      motionEnabled = true;
      panWrap.classList.remove('motion-disabled');
      motionBtn.textContent = 'motion on';
      return true;
    }catch(err){
      console.warn('Motion permission failed', err);
      motionEnabled = false;
      motionBtn.textContent = 'motion unavailable';
      panWrap.classList.add('motion-disabled');
      return false;
    }
  }

  window.addEventListener('deviceorientation', handleOrientation, true);

  // Desktop fallback: reflection follows the pointer.
  panWrap.addEventListener('pointermove', e => {
    if(e.pointerType === 'touch') return;
    pendingPointer = [e.clientX,e.clientY];
    scheduleHighlight();
  }, {passive:true});
  document.addEventListener('visibilitychange', () => {
    if(document.hidden && highlightFrame){
      cancelAnimationFrame(highlightFrame);
      highlightFrame = 0;
    }
  });

  panWrap.addEventListener('pointerleave', e => {
    if(e.pointerType !== 'touch'){
      setHighlightFromNormalized(-.35, -.35);
    }
  });

  motionBtn.textContent = 'enable motion';

  motionBtn.addEventListener('click', async () => {
    if(!motionPermissionGranted){
      await requestMotionAccess();
      return;
    }

    motionEnabled = !motionEnabled;
    panWrap.classList.toggle('motion-disabled', !motionEnabled);
    motionBtn.textContent = motionEnabled ? 'motion on' : 'motion off';
  });

  window.addEventListener('keydown', e => {
    if(e.repeat) return;
    const key = e.code === 'Space' ? 'space' : e.key.toLowerCase();
    const tone = tones.find(t => t.dataset.key === key);
    if(tone){
      e.preventDefault();
      playTone(tone);
    }
  });

})();
