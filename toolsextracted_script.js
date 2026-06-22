
  /**************************************************************************
   * 메이플 스타일 횡스크롤 플랫폼 멀티플레이 (단일 파일)
   * - Canvas로 픽셀/도트풍 드로잉 (외부 이미지 없이 자체 드로잉)
   * - 물리: 중력, 속도, 충돌(플랫폼 위 착지)
   * - 조작: 좌/우(A,D), 점프(Alt 또는 Space), 상호작용: Space가 상호작용 우선
   * - Firebase Realtime Database로 유저 위치/속도 동기화 및 채팅 유지
   * - 교무실 맵에 교장 NPC 배치, Gemini API 연동 유지
   **************************************************************************/

  // ---------------- Firebase 설정 (빈 값으로 남겨둠) ----------------
  const firebaseConfig = {
    apiKey: "AIzaSyAgQ2jt4DxVA3tenlbx0ljl-soDZtb_z04",
    authDomain: "school-rpg-81be6.firebaseapp.com",
    databaseURL: "https://school-rpg-81be6-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "school-rpg-81be6",
    storageBucket: "school-rpg-81be6.firebasestorage.app",
    messagingSenderId: "75553651134",
    appId: "1:75553651134:web:0ab7e169ea4da06bff61ef",
    measurementId: "G-HQV8DBZW63"
  };
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // ---------------- DOM 요소 ----------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const chatLog = document.getElementById('chat-log');
  const gameLog = document.getElementById('game-log');
  const miniMapCanvas = document.getElementById('mini-map');
  const miniMapCtx = miniMapCanvas ? miniMapCanvas.getContext('2d') : null;
  const nickEl = document.getElementById('nick');
  const mapNameEl = document.getElementById('mini-map-name');
  const hpFillEl = document.getElementById('hp-fill');
  const hpTextEl = document.getElementById('hp-text');
  const hpWrapperEl = hpFillEl ? hpFillEl.parentElement.parentElement : null;
  // enable CSS fade on the sidebar HP wrapper
  try{ if(hpWrapperEl){ hpWrapperEl.style.transition = 'opacity 600ms ease'; hpWrapperEl.style.opacity = '1'; } }catch(e){}
  const goldEl = document.getElementById('gold');
  const attackCoolCanvas = document.getElementById('attack-cool-canvas');
  const attackCoolText = document.getElementById('attack-cool-text');
  const attackCoolCtx = attackCoolCanvas ? attackCoolCanvas.getContext('2d') : null;
  // centralized font family for canvas and UI. To use Nexon Maplestory, place font file at /fonts/NexonMaplestory.woff2
  const FONT_FAMILY = "'NexonMaplestory', 'Gowun Dodum', sans-serif";
  function fontPx(size){ return String(size) + 'px ' + FONT_FAMILY; }

  // draw rounded rectangle helper (fills with current fillStyle)
  function roundRect(ctx, x, y, w, h, r){
    const radius = typeof r === 'number' ? r : 6;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    try{ ctx.fill(); }catch(e){}
  }

  // coordinate overlay for debugging / manual entrance coordinate input
  const coordOverlay = document.createElement('div');
  coordOverlay.id = 'coord-overlay';
  coordOverlay.style.position = 'fixed'; coordOverlay.style.left = '12px'; coordOverlay.style.top = '12px'; coordOverlay.style.background = 'rgba(0,0,0,0.64)'; coordOverlay.style.color = '#e6f0ff'; coordOverlay.style.padding = '8px 10px'; coordOverlay.style.borderRadius = '8px'; coordOverlay.style.zIndex = '2200'; coordOverlay.style.fontSize = '13px'; coordOverlay.style.fontFamily = FONT_FAMILY; coordOverlay.style.pointerEvents = 'auto';
  // hide by default for non-developers
  coordOverlay.style.display = 'none';
  coordOverlay.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px">좌표 디버그</div>
    <div id="coord-map">Map: -</div>
    <div id="coord-player">Player: -</div>
    <div id="coord-entrance">Entrance: -</div>
    <div id="coord-dx">dx: -</div>
    <div id="coord-dy">dy: -</div>
    <div id="coord-hint">Hint: -</div>
    <div style="margin-top:6px">
      <input id="coord-x" placeholder="entrance x" style="width:72px;margin-right:6px"/>
      <input id="coord-y" placeholder="entrance y" style="width:72px;margin-right:6px"/>
      <button id="coord-set" style="padding:3px 6px">설정</button>
      <button id="coord-set-player" style="padding:3px 6px;margin-left:6px">내 위치로</button>
      <button id="coord-set-player-x" style="padding:3px 6px;margin-left:6px">내 X로(auto Y)</button>
    </div>
    <hr style="margin:8px 0;border:none;border-top:1px solid rgba(255,255,255,0.06)">
    <div style="font-weight:700;margin-bottom:6px">Dev: YouTube BGM</div>
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
      <input id="yt-url" placeholder="YouTube URL or ID" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#e6eef8" />
      <button id="yt-play" style="padding:6px 8px">Play</button>
      <button id="yt-stop" style="padding:6px 8px">Stop</button>
    </div>
    <div style="display:flex;gap:8px;align-items:center;font-size:12px">
      <label style="min-width:48px">Volume</label>
      <input id="yt-volume" type="range" min="0" max="1" step="0.01" value="0.8" style="flex:1" />
      <div id="yt-status" style="min-width:80px;text-align:right;color:#dbeafe">Idle</div>
    </div>
    <div id="yt-player-container" style="width:0;height:0;overflow:hidden;visibility:hidden"></div>
  `;
  document.body.appendChild(coordOverlay);
  document.getElementById('coord-set').addEventListener('click', ()=>{ const vx = parseInt(document.getElementById('coord-x').value); const vy = parseInt(document.getElementById('coord-y').value); if(!isNaN(vx)) setEntranceCoords(vx, isNaN(vy)? undefined : vy); });
  document.getElementById('coord-set-player').addEventListener('click', ()=>{ try{ const px = Math.round(player.x + player.w/2); const py = Math.round(player.y); setEntranceCoords(px, py); }catch(e){ console.error('set to player failed', e); } });
  document.getElementById('coord-set-player-x').addEventListener('click', ()=>{ try{ const px = Math.round(player.x + player.w/2); setEntranceCoords(px); }catch(e){ console.error('set to player.x failed', e); } });

  // Developer teleport controls (only effective when player.isDev)
  try{
    const tpBtn = document.createElement('button'); tpBtn.id = 'coord-teleport'; tpBtn.textContent = '텔레포트'; tpBtn.style.marginLeft = '6px'; tpBtn.style.padding = '3px 6px';
    const tpUserBtn = document.createElement('button'); tpUserBtn.id = 'coord-teleport-user'; tpUserBtn.textContent = '유저텔레포트'; tpUserBtn.style.marginLeft = '6px'; tpUserBtn.style.padding = '3px 6px';
    const wrap = coordOverlay.querySelector('div') || coordOverlay;
    wrap.appendChild(tpBtn); wrap.appendChild(tpUserBtn);
    tpBtn.addEventListener('click', ()=>{
      try{
        if(!player.isDev){ addLog('텔레포트: 개발자 모드가 아닙니다.'); return; }
        const vx = parseInt(document.getElementById('coord-x').value); const vy = parseInt(document.getElementById('coord-y').value);
        if(Number.isFinite(vx) && Number.isFinite(vy)){
          player.x = vx; player.y = vy; player.vx = 0; player.vy = 0; scheduleUserUpdate(); addLog('텔레포트: ' + vx + ',' + vy);
        } else addLog('텔레포트: 좌표를 정확히 입력하세요.');
      }catch(e){ console.error('teleport error', e); }
    });
    tpUserBtn.addEventListener('click', ()=>{
      try{
        if(!player.isDev){ addLog('유저텔레포트: 개발자 모드가 아닙니다.'); return; }
        const targetNick = prompt('텔레포트할 유저의 닉네임을 입력하세요'); if(!targetNick) return;
        for(const k in otherUsers){ const u = otherUsers[k]; if(u && (u.nick === targetNick || k === targetNick)) { player.x = u.x || 0; player.y = u.y || 0; player.map = u.map || player.map; scheduleUserUpdate(); addLog('유저텔레포트: ' + targetNick); return; } }
        addLog('유저텔레포트: 사용자 찾을 수 없음');
      }catch(e){ console.error('teleport user error', e); }
    });
  }catch(e){}

  // ---------------- YouTube dev-audio controls ----------------
  // Minimal YouTube IFrame API loader + player wrapper (dev-only)
  (function(){
    let ytApiLoading = false; let ytApiReady = false; let ytPlayer = null; let currentYtId = null;
    let mainBgmWasPlaying = false;
    const statusEl = document.getElementById('yt-status'); const volEl = document.getElementById('yt-volume');
    function getMasterVolume(){
      try{
        // preference order: menu bgm-range control -> localStorage 'bgmVolume' -> yt-volume slider -> default 0.8
        const br = document.getElementById('bgm-range'); if(br && typeof br.value !== 'undefined') return Math.max(0, Math.min(1, parseFloat(br.value) || 0));
        const ls = localStorage.getItem('bgmVolume'); if(ls !== null) return Math.max(0, Math.min(1, parseFloat(ls) || 0));
        if(volEl && typeof volEl.value !== 'undefined') return Math.max(0, Math.min(1, parseFloat(volEl.value) || 0));
      }catch(e){}
      return 0.8;
    }
    // show fallback UI when embed fails for a specific video
    function showYtFallback(id, code){
      try{
        const existing = document.getElementById('yt-fallback'); if(existing) existing.remove();
        const overlay = document.createElement('div'); overlay.id = 'yt-fallback';
        overlay.style.position = 'fixed'; overlay.style.left = '50%'; overlay.style.top = '18%'; overlay.style.transform = 'translateX(-50%)'; overlay.style.zIndex = 13000; overlay.style.background = '#071029'; overlay.style.color = '#e6eef8'; overlay.style.padding = '12px 14px'; overlay.style.borderRadius = '10px'; overlay.style.boxShadow = '0 12px 36px rgba(2,6,23,0.6)'; overlay.style.fontFamily = FONT_FAMILY; overlay.style.maxWidth = '480px';
        const msg = document.createElement('div'); msg.style.marginBottom='8px'; msg.style.fontSize='14px'; msg.textContent = '이 동영상은 임베드 재생이 제한되어 있습니다.' + (code ? (' (code:'+code+')') : ''); overlay.appendChild(msg);
        const btnWrap = document.createElement('div'); btnWrap.style.display='flex'; btnWrap.style.gap='8px';
        const openBtn = document.createElement('button'); openBtn.textContent = 'YouTube에서 열기'; openBtn.style.padding='8px 10px'; openBtn.style.borderRadius='6px'; openBtn.style.background='#0ea5a4'; openBtn.style.color='#012'; openBtn.onclick = ()=>{ window.open('https://www.youtube.com/watch?v='+id, '_blank'); overlay.remove(); };
        const nocookieBtn = document.createElement('button'); nocookieBtn.textContent = 'nocookie로 재시도'; nocookieBtn.style.padding='8px 10px'; nocookieBtn.style.borderRadius='6px'; nocookieBtn.style.background='#2563eb'; nocookieBtn.style.color='#fff'; nocookieBtn.onclick = ()=>{ try{ overlay.remove(); stopYt(); createPlayerForId(id, { tryNoCookie: true }).catch(e=>{ console.warn('nocookie retry failed', e); showYtFallback(id,e && e.toString ? e.toString() : 'err'); }); }catch(e){ console.warn(e); } };
        const closeBtn = document.createElement('button'); closeBtn.textContent = '닫기'; closeBtn.style.padding='8px 10px'; closeBtn.style.borderRadius='6px'; closeBtn.onclick = ()=>{ overlay.remove(); };
        btnWrap.appendChild(openBtn); btnWrap.appendChild(nocookieBtn); btnWrap.appendChild(closeBtn); overlay.appendChild(btnWrap);
        document.body.appendChild(overlay);
      }catch(e){ console.warn('showYtFallback failed', e); }
    }
    function extractYouTubeId(url){ try{ if(!url) return null; // direct ID
        const m = url.match(/(?:v=|\/v\/|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/); if(m && m[1]) return m[1]; if(/^[A-Za-z0-9_-]{6,}$/.test(url)) return url; return null; }catch(e){ return null; } }
    function loadYouTubeApi(){ return new Promise((resolve,reject)=>{
      console.log('loadYouTubeApi: start');
      if(window.YT && window.YT.Player){ ytApiReady = true; console.log('loadYouTubeApi: already ready'); return resolve(); }
      if(ytApiLoading) return reject('YT API loading'); ytApiLoading = true;
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
      window.onYouTubeIframeAPIReady = function(){ ytApiReady = true; ytApiLoading = false; console.log('loadYouTubeApi: ready'); resolve(); };
      s.onerror = ()=>{ ytApiLoading = false; console.error('loadYouTubeApi: script load failed'); reject(new Error('YT API load failed')); };
      document.head.appendChild(s);
    }); }
    function createPlayerForId(id, opts){
      console.log('createPlayerForId called', id, opts);
      if(!id) return Promise.reject('no id');
      opts = opts || {};
      return new Promise((resolve, reject) => {
        if(!ytApiReady) return reject('YT API not ready');
        // destroy existing
        try{ if(ytPlayer){ try{ ytPlayer.stopVideo(); }catch(_){} try{ ytPlayer.destroy(); }catch(_){} ytPlayer = null; currentYtId = null; } }catch(e){}
        const container = document.getElementById('yt-player-container'); if(container) container.innerHTML = '<div id="yt-player"></div>';
        ytPlayer = new YT.Player('yt-player', {
          height: '1', width: '1', videoId: id,
          host: (opts && opts.tryNoCookie) ? 'https://www.youtube-nocookie.com' : undefined,
          playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, playsinline: 1, origin: window.location.origin },
          events: {
            onReady: function(ev){
              try{
                console.log('YT onReady', id);
                // pause main bgm if playing
                try{ if(typeof bgmAudio !== 'undefined' && bgmAudio && !bgmAudio.paused){ mainBgmWasPlaying = true; try{ bgmAudio.pause(); }catch(e){} } }catch(e){}
                try{ if(typeof ev.target.unMute === 'function'){ try{ ev.target.unMute(); console.log('ev.target.unMute() called'); }catch(e){ console.warn('unMute failed', e); } } }catch(e){}
                const v = getMasterVolume(); try{ ev.target.setVolume(Math.round(v * 100)); console.log('setVolume to', Math.round(v*100)); }catch(e){ console.warn('setVolume failed', e); }
                try{ const p = ev.target.playVideo(); if(p && typeof p.then === 'function'){ p.then(()=>{ console.log('playVideo() promise resolved'); }).catch(err=>{ console.warn('playVideo() promise rejected', err); }); } }catch(e){ console.warn('ev.target.playVideo() exception', e); }
                currentYtId = id; if(statusEl) statusEl.textContent = 'Playing';
                resolve(ev.target);
              }catch(e){ reject(e); }
            },
            onStateChange: function(e){
              console.log('YT onStateChange', id, e.data);
              try{
                // When YT starts playing, pause main bgm if it's playing
                if(e.data === YT.PlayerState.PLAYING){
                  try{ if(typeof bgmAudio !== 'undefined' && bgmAudio && !bgmAudio.paused){ mainBgmWasPlaying = true; try{ bgmAudio.pause(); }catch(e){} } }catch(e){}
                  if(statusEl) statusEl.textContent = 'Playing';
                }
                // When ended or paused, restore main bgm if we paused it
                if(e.data === YT.PlayerState.ENDED || e.data === YT.PlayerState.PAUSED){
                  if(statusEl && e.data === YT.PlayerState.ENDED) statusEl.textContent = 'Ended';
                  try{ if(mainBgmWasPlaying && typeof bgmAudio !== 'undefined' && bgmAudio){ bgmAudio.play().catch(()=>{}); mainBgmWasPlaying = false; } }catch(err){}
                }
              }catch(e){ console.warn('onStateChange handling error', e); }
            }
            ,onError: function(e){
              try{
                console.warn('YT onError', e.data);
                // For embedding-restricted errors (101/150), some videos can still play via youtube-nocookie.
                // Try nocookie retry once before showing fallback UI.
                if((e.data === 101 || e.data === 150) && !opts._triedNoCookie && !opts.tryNoCookie){
                  opts._triedNoCookie = true;
                  console.log('YT onError', e.data, ': attempting nocookie retry before fallback');
                  try{ stopYt(); createPlayerForId(id, Object.assign({}, opts, { tryNoCookie: true, _triedNoCookie: true })).catch(err=>{ console.warn('nocookie retry failed', err); showYtFallback(id, err && err.toString ? err.toString() : 'err'); }); }catch(err){ console.warn('nocookie retry exception', err); showYtFallback(id, err && err.toString?err.toString():'err'); }
                  return;
                }
                // other errors: attempt nocookie retry once
                if(!opts._triedNoCookie && !opts.tryNoCookie){ opts._triedNoCookie = true; console.log('YT onError: attempting nocookie retry'); try{ stopYt(); createPlayerForId(id, Object.assign({}, opts, { tryNoCookie: true, _triedNoCookie: true })).catch(err=>{ console.warn('nocookie retry failed', err); showYtFallback(id, err && err.toString ? err.toString() : 'err'); }); }catch(err){ console.warn('nocookie retry exception', err); showYtFallback(id, err && err.toString?err.toString():'err'); }
                } else { showYtFallback(id, e.data); }
              }catch(err){ console.warn('onError handler failed', err); showYtFallback(id, err && err.toString?err.toString():'err'); }
            }
          }
        });
        // if this play was initiated locally (not remote), broadcast to DB for other clients to play
        try{ if(!opts.remote && player.isDev){ const v = getMasterVolume() || 0.8; db.ref('bgm').set({ id: id, owner: uid, client: clientId, volume: v, startTs: Date.now(), ts: Date.now() }).catch(()=>{}); } }catch(e){}
        // expose debug reference and log iframe src and player internals for debugging
        try{ window._ytPlayer = ytPlayer; setTimeout(()=>{
          try{
            const iframe = (ytPlayer && typeof ytPlayer.getIframe === 'function') ? ytPlayer.getIframe() : document.getElementById('yt-player') && document.getElementById('yt-player').querySelector('iframe');
            console.log('YT iframe element:', iframe);
            if(iframe && iframe.src) console.log('YT iframe src:', iframe.src);
            try{ if(iframe && typeof iframe.setAttribute === 'function'){ iframe.setAttribute('allow','autoplay; encrypted-media; picture-in-picture'); iframe.allow = 'autoplay; encrypted-media'; } }catch(e){ console.warn('setting iframe allow failed', e); }
            try{ if(ytPlayer && typeof ytPlayer.getVolume === 'function') console.log('ytPlayer.getVolume()', ytPlayer.getVolume()); }catch(e){}
            try{ if(ytPlayer && typeof ytPlayer.getPlayerState === 'function') console.log('ytPlayer.getPlayerState()', ytPlayer.getPlayerState()); }catch(e){}
            try{ if(ytPlayer && typeof ytPlayer.getCurrentTime === 'function') console.log('ytPlayer.getCurrentTime()', ytPlayer.getCurrentTime()); }catch(e){}
          }catch(e){ console.warn('post-create debug failed', e); }
        }, 1200); }catch(e){}
      });
    }
    function stopYt(){ try{ if(ytPlayer){ try{ ytPlayer.stopVideo(); }catch(_){} try{ ytPlayer.destroy(); }catch(_){} ytPlayer = null; currentYtId = null; } if(statusEl) statusEl.textContent = 'Stopped'; // restore main bgm if it was playing before
        try{ if(mainBgmWasPlaying && typeof bgmAudio !== 'undefined' && bgmAudio){ bgmAudio.play().catch(()=>{}); mainBgmWasPlaying = false; } }catch(e){}
        // if this stop was initiated locally by the owner, remove DB entry
        try{ if(player && player.isDev){ db.ref('bgm').once('value').then(snap=>{ const val = snap.val(); if(val && val.owner === uid && val.client && val.client === clientId) db.ref('bgm').remove().catch(()=>{}); }).catch(()=>{}); } }catch(e){}
      }catch(e){ console.error('stopYt', e); } }
    // wire UI
    try{
      const playBtn = document.getElementById('yt-play'); const stopBtn = document.getElementById('yt-stop'); const urlInput = document.getElementById('yt-url');
        if(playBtn){ playBtn.addEventListener('click', async ()=>{
          console.log('PLAY button clicked');
          if(!player.isDev){ addLog('YouTube 재생은 개발자 모드 전용입니다.'); return; }
          const raw = (urlInput && urlInput.value) ? urlInput.value.trim() : '';
          const id = extractYouTubeId(raw);
          console.log('PLAY handler id extracted:', id, 'window.YT', !!window.YT, 'ytApiReady', typeof ytApiReady !== 'undefined' ? ytApiReady : 'undef');
          if(!id){ addLog('유효한 YouTube URL 또는 ID를 입력하세요.'); if(statusEl) statusEl.textContent = 'Invalid ID'; return; }
          try{
            console.log('calling loadYouTubeApi...');
            await loadYouTubeApi();
            console.log('loadYouTubeApi resolved. calling createPlayerForId...');
            const created = await createPlayerForId(id);
            console.log('createPlayerForId returned', created, 'window.YT', !!window.YT, 'ytPlayer', typeof ytPlayer !== 'undefined' ? ytPlayer : null);
            // explicit play attempt after creation (workaround for autoplay issues)
            try{
              const pinst = (window._ytPlayer || ytPlayer || created);
              console.log('explicit play attempt on', pinst);
              if(pinst && typeof pinst.playVideo === 'function'){
                try{ pinst.playVideo(); console.log('explicit playVideo() called'); }catch(err){ console.warn('explicit playVideo() threw', err); }
              }
              setTimeout(()=>{
                try{
                  const st = (pinst && typeof pinst.getPlayerState === 'function') ? pinst.getPlayerState() : null;
                  console.log('post-explicit-play state=', st);
                  // -1 = unstarted, 0 = ended; try loadVideoById then play
                  if(st === -1 || st === 0){
                    if(pinst && typeof pinst.loadVideoById === 'function'){
                      try{ console.log('calling loadVideoById -> play'); pinst.loadVideoById(id); setTimeout(()=>{ try{ pinst.playVideo(); console.log('retry playVideo after load'); }catch(e){ console.warn('retry playVideo failed', e); } }, 600); }catch(e){ console.warn('loadVideoById failed', e); }
                    }
                  }
                  // log current time/volume
                  try{ if(pinst && typeof pinst.getCurrentTime === 'function') console.log('getCurrentTime()', pinst.getCurrentTime()); }catch(e){}
                  try{ if(pinst && typeof pinst.getVolume === 'function') console.log('getVolume()', pinst.getVolume()); }catch(e){}
                }catch(e){ console.warn('post explicit play check error', e); }
              }, 800);
            }catch(e){ console.warn('explicit play attempt error', e); }
            addLog('YouTube 재생: ' + id);
          }catch(e){ console.error('YT play error', e); addLog('YouTube 재생 실패'); if(statusEl) statusEl.textContent = 'Error'; }
        }); }
      if(stopBtn){ stopBtn.addEventListener('click', ()=>{ if(!player.isDev){ addLog('YouTube 정지는 개발자 모드 전용입니다.'); return; } stopYt(); addLog('YouTube 정지'); }); }
      if(volEl){ volEl.addEventListener('input', ()=>{ try{ const v = parseFloat(volEl.value) || 0; if(ytPlayer && typeof ytPlayer.setVolume === 'function'){ ytPlayer.setVolume(Math.round(v * 100)); } }catch(e){} }); }
    }catch(e){ console.error('yt ui wire failed', e); }

    // ensure playback stops when dev mode disabled
    window.__stopYouTubeDev = stopYt;
    // expose minimal helpers for remote subscription
    try{ window.__yt = { load: loadYouTubeApi, create: createPlayerForId, stop: stopYt, getPlayer: function(){ return typeof ytPlayer !== 'undefined' ? ytPlayer : null; }, statusEl: statusEl, getMasterVolume: getMasterVolume }; }catch(e){}
  })();

  // 게시판 모달 (숨김) - '세기의 방명록'
  const boardModal = document.createElement('div'); boardModal.id = 'board-modal';
  boardModal.style.position = 'fixed'; boardModal.style.left = '50%'; boardModal.style.top = '50%'; boardModal.style.transform = 'translate(-50%,-50%)';
  boardModal.style.zIndex = '6000'; boardModal.style.background = '#fff'; boardModal.style.color = '#06202a'; boardModal.style.padding = '16px'; boardModal.style.borderRadius = '8px'; boardModal.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'; boardModal.style.display = 'none'; boardModal.style.minWidth = '320px';
  boardModal.innerHTML = `
    <div style="font-weight:700;font-size:18px;margin-bottom:8px">세기의 방명록</div>
    <div id="board-content" style="height:240px;overflow:auto;border:1px solid #eee;padding:8px;margin-bottom:8px;background:#fafafa">방명록이 비어있습니다.</div>
    <div style="display:flex;gap:8px;align-items:center">
      <textarea id="board-input" placeholder="방명록에 남길 말을 적어보세요..." style="flex:1;min-height:48px;padding:8px;border:1px solid #ddd;border-radius:6px"></textarea>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button id="board-post" style="padding:8px 12px">작성</button>
        <button id="board-close" style="padding:6px 10px">닫기</button>
      </div>
    </div>`;
  document.body.appendChild(boardModal);
  document.getElementById('board-close').addEventListener('click', ()=>{ boardModal.style.display = 'none'; });
  document.getElementById('board-post').addEventListener('click', postBoardMessage);
  // local fallback cache for board messages when DB push fails
  let localBoardCache = [];
  // board subscription references
  let boardRef = null;
  let boardCallback = null;
  function renderBoardMessages(messages){
    const el = document.getElementById('board-content'); if(!el) return;
    try{
      if(!messages || messages.length === 0){ el.innerHTML = '<div style="color:#6b7280">방명록이 비어있습니다.</div>'; return; }
      el.innerHTML = messages.map(m=>{
        const time = new Date(m.ts||0).toLocaleString();
        const nick = (m.nick||'익명');
        const text = (m.text||'').replace(/</g,'&lt;').replace(/\n/g,'<br>');
        return `<div style="margin-bottom:8px"><div style="font-weight:700;font-size:13px;color:#0f172a">${nick} <span style=\"font-weight:400;font-size:11px;color:#6b7280;margin-left:8px\">${time}</span></div><div style="margin-top:4px;color:#111">${text}</div></div>`;
      }).join('');
      el.scrollTop = el.scrollHeight;
    }catch(e){ console.error('renderBoardMessages error', e); }
  }

  function subscribeBoard(){
    try{
      const ref = db.ref('boards/hallway').orderByChild('ts');
      // detach previous listener if any
      try{ if(boardRef && boardCallback) boardRef.off('value', boardCallback); }catch(e){}
      boardRef = ref;
      boardCallback = (snap)=>{
        try{
          const val = snap.val() || {};
          const arr = Object.keys(val).map(k=>val[k]).sort((a,b)=> (a.ts||0) - (b.ts||0));
          if((!arr || arr.length === 0) && localBoardCache.length > 0){ renderBoardMessages(localBoardCache); }
          else { renderBoardMessages(arr); }
        }catch(e){ console.error('boardCallback error', e); }
      };
      boardRef.on('value', boardCallback);
    }catch(e){ console.warn('subscribeBoard failed', e); }
  }

  function postBoardMessage(){
    try{
      const ta = document.getElementById('board-input'); if(!ta) return;
      const text = (ta.value || '').trim(); if(!text) return;
      const payload = { nick: (player && player.nick) ? player.nick : '익명', text: text, ts: Date.now() };
      const ref = db.ref('boards/hallway');
      // push may fail asynchronously; handle promise rejection
      try{
        const p = ref.push(payload);
        // compat push returns a Reference; write is async but errors may surface via .catch on the returned promise in some SDKs
        if(p && typeof p.then === 'function'){
          p.then(()=>{ ta.value = ''; addLog('방명록 저장됨'); }).catch((e)=>{
            console.warn('DB push failed, falling back to local update', e);
            localBoardCache.push(payload); renderBoardMessages(localBoardCache); ta.value = '';
            addLog('방명록 저장 실패 — 로컬에 임시저장됨');
          });
        } else {
          // best-effort: still clear textarea and notify
          ta.value = ''; addLog('방명록 전송 시도됨');
        }
      }catch(e){ console.warn('DB push exception, falling back to local update', e); localBoardCache.push(payload); renderBoardMessages(localBoardCache); ta.value = ''; addLog('방명록 저장 실패 — 로컬에 임시저장됨'); }
    }catch(e){ console.error('postBoardMessage error', e); }
  }

  function showBoardModal(){ try{ boardModal.style.display = 'block'; subscribeBoard(); const ta = document.getElementById('board-input'); if(ta) ta.focus(); }catch(e){ alert('방명록을 확인합니다.'); } }

  // update overlay periodically
  setInterval(()=>{
    try{
      const cm = document.getElementById('coord-map'); const cp = document.getElementById('coord-player'); const ce = document.getElementById('coord-entrance');
      if(cm) cm.textContent = 'Map: ' + (player.map || '-');
      if(cp) cp.textContent = 'Player: ' + Math.round(player.x) + ',' + Math.round(player.y);
      const b = MAPS.hallway && MAPS.hallway.building ? MAPS.hallway.building : (MAPS[player.map] && MAPS[player.map].building ? MAPS[player.map].building : null);
      const dxEl = document.getElementById('coord-dx'); const dyEl = document.getElementById('coord-dy'); const hintEl = document.getElementById('coord-hint');
      if(ce){
        if(b && (typeof b.entranceX !== 'undefined' || (b.entranceCoord && (typeof b.entranceCoord.x !== 'undefined')))){
          const ex = (typeof b.entranceX !== 'undefined')? b.entranceX : (b.entranceCoord? b.entranceCoord.x : null);
          const eyRaw = (typeof b.entranceY !== 'undefined')? b.entranceY : (b.entranceCoord? b.entranceCoord.y : null);
          const ey = Number.isFinite(eyRaw) ? eyRaw : 'auto';
          ce.textContent = 'Entrance: ' + (Number.isFinite(ex) ? Math.round(ex) : ex) + ',' + ey;
          // compute dx/dy and hint visibility for debugging
          try{
            const pxCenter = Math.round(player.x + player.w/2);
            const dxv = (Number.isFinite(ex) ? Math.abs(pxCenter - ex) : '-');
            const visualY = (typeof b.y === 'number') ? (b.y + (b.offsetY || 0)) : null;
            const buildingBottomY = (visualY !== null) ? Math.round(visualY + (b.h||0)) : null;
            const dyv = (buildingBottomY !== null) ? Math.abs(Math.round((player.y + player.h) - buildingBottomY)) : '-';
            if(dxEl) dxEl.textContent = 'dx: ' + dxv;
            if(dyEl) dyEl.textContent = 'dy: ' + dyv;
            const range = (b.interactRange || 160);
            const dyLimit = 220;
            const hintVisible = (player.map === 'hallway' && Number.isFinite(ex) && dxv !== '-' && dxv <= range && typeof dyv === 'number' && dyv <= dyLimit);
            if(hintEl) hintEl.textContent = 'Hint: ' + (hintVisible ? 'YES' : 'NO');
            if(hintVisible) console.log('Entrance hint conditions met:', { playerX:pxCenter, entranceX:ex, dx:dxv, dy:dyv });
          }catch(e){ if(dxEl) dxEl.textContent = 'dx: err'; if(dyEl) dyEl.textContent = 'dy: err'; if(hintEl) hintEl.textContent = 'Hint: err'; }
        } else { ce.textContent = 'Entrance: -'; if(dxEl) dxEl.textContent='dx: -'; if(dyEl) dyEl.textContent='dy: -'; if(hintEl) hintEl.textContent='Hint: -'; }
      }
    }catch(e){}
  }, 220);

  // expose setter so user can paste coordinates in console or use input
  function setEntranceCoords(x,y){ try{ if(!MAPS.hallway || !MAPS.hallway.building) return; MAPS.hallway.building.entranceX = x;
      if(typeof y === 'undefined' || !Number.isFinite(y)){
        // treat undefined/NaN as automatic Y (use spawnTo as target if available)
        if(MAPS.hallway.building.spawnTo && typeof MAPS.hallway.building.spawnTo.y === 'number'){
          MAPS.hallway.building.entranceY = MAPS.hallway.building.spawnTo.y;
        } else { delete MAPS.hallway.building.entranceY; }
        MAPS.hallway.building.entranceCoord = { x:x, y: null };
        addLog('정문 좌표 설정: ' + x + ', auto');
      } else {
        MAPS.hallway.building.entranceY = y; MAPS.hallway.building.entranceCoord = { x:x, y:y };
        addLog('정문 좌표 설정: ' + x + ',' + y);
      }
    }catch(e){ console.error('setEntranceCoords error', e); } }
  window.setEntranceCoords = setEntranceCoords;

  // set initial entrance coords provided by user
  try{ setEntranceCoords(2650, 656); }catch(e){}

  // HP color interpolation: green -> yellow -> red based on ratio (0..1)
  function hpColor(ratio){
    const r1 = 185, g1 = 28, b1 = 28; // red
    const r2 = 22, g2 = 163, b2 = 74; // green
    // linear interpolate from red (ratio 0) to green (ratio 1)
    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);

    return `rgb(${r},${g},${b})`;
  }

  function updateSidebarHp(){
    try{
      if(!hpFillEl) return;
      const pct = Math.max(0, Math.min(1, (player.hp || 0) / (player.maxHp || 100)));
      // always show HP in the sidebar
      if(hpWrapperEl){ try{ hpWrapperEl.style.opacity = '1'; }catch(e){} }
      hpFillEl.style.width = Math.round(pct * 100) + '%';
      hpFillEl.style.background = hpColor(pct);
      if(hpTextEl) hpTextEl.textContent = (player.hp || 0) + '/' + (player.maxHp || 100);
    }catch(e){ }
  }

  // ---------------- 사용자 초기화 ----------------
  const uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  let nickname = '익명'; nickEl.textContent = nickname;

  // ---------------- Sprite 로드 및 성별 선택 ----------------
  // sprite.png는 프로젝트 루트(현재 index.html과 같은 폴더)에 있어야 합니다.
  const sprite = new Image();
  sprite.src = 'sprite.png';
  let spriteLoaded = false;
  sprite.onload = ()=>{ spriteLoaded = true; addLog('sprite.png 로드 완료'); };

  // 개별 이미지 우선 지원: m0/m1/m2 (남학생 대기/걷기/점프), f0/f1/f2 (여학생)
  const maleImg = new Image(); const maleRunImg = new Image(); const maleJumpImg = new Image();
  const maleCrouchImg = new Image(); const maleCrouchWalkImg = new Image();
  // support multiple individual run frames (m1_0.png, m1_1.png, ...) and crouch-walk frames (m4_0.png...)
  const maleRunFrames = [];
  const maleCrouchWalkFrames = [];
  // female frame arrays
  const femaleRunFrames = [];
  const femaleCrouchWalkFrames = [];
  // frame timing (ms per frame) — increase to slow animation
  const RUN_FRAME_MS = 220;
  const CROUCH_FRAME_MS = 260;
  // visual tweaks
  const CROUCH_IDLE_WIDTH_MULT = 1.3; // idle crouch slightly wider than player box (increased)
  const JUMP_MIN_HEIGHT_FRAC = 0.95; // ensure jump image is at least this fraction of player.h
  const maleDeadImg = new Image(); let maleDeadLoaded = false;
  const maleAttackImg = new Image(); let maleAttackLoaded = false;
  const maleHitImg = new Image(); let maleHitLoaded = false;
  const femaleImg = new Image(); const femaleRunImg = new Image(); const femaleJumpImg = new Image();
  const femaleCrouchImg = new Image(); const femaleCrouchWalkImg = new Image();
  const femaleDeadImg = new Image(); let femaleDeadLoaded = false;
  const femaleAttackImg = new Image(); let femaleAttackLoaded = false;
  const femaleHitImg = new Image(); let femaleHitLoaded = false;
  // decorative props
  const fountainImg = new Image(); let fountainLoaded = false; fountainImg.src = 'fountain.png'; fountainImg.onload = ()=>{ fountainLoaded = true; addLog('fountain.png 로드 완료'); };
  const lampImg = new Image(); let lampLoaded = false; lampImg.src = 'lamp.png'; lampImg.onload = ()=>{ lampLoaded = true; addLog('lamp.png 로드 완료'); };
  const boxImgs = []; let boxImgsLoaded = 0; try{ ['box0.png','box1.png','box2.png','box3.png','box4.png'].forEach((name, idx)=>{ const im=new Image(); im.src = name; im.onload = ()=>{ boxImgsLoaded++; addLog(name + ' 로드 완료'); }; boxImgs.push(im); }); }catch(e){}
  // small icon for cooldown indicator
  const attackIconImg = new Image(); let attackIconLoaded = false;
  let maleLoaded = false, maleRunLoaded = false, maleJumpLoaded = false;
  let maleCrouchLoaded = false, maleCrouchWalkLoaded = false;
  let femaleLoaded = false, femaleRunLoaded = false, femaleJumpLoaded = false;
  let femaleCrouchLoaded = false, femaleCrouchWalkLoaded = false;
  maleImg.src = 'm0.png'; maleRunImg.src = 'm1.png'; maleJumpImg.src = 'm2.png';
  maleCrouchImg.src = 'm3.png'; maleCrouchWalkImg.src = 'm4.png';
  // load specific run frames: base m1.png (already assigned) plus m1_0..m1_2
  try{
    ['m1_0.png','m1_1.png','m1_2.png'].forEach(name=>{
      const im = new Image(); im.src = name; im.onload = ()=>{ maleRunFrames.push(im); addLog(name + ' 로드 완료'); }; im.onerror = ()=>{};
    });
  }catch(e){}
  // load specific crouch-walk frames: base m4.png plus m4_0.png
  try{
    const im4 = new Image(); im4.src = 'm4_0.png'; im4.onload = ()=>{ maleCrouchWalkFrames.push(im4); addLog('m4_0.png 로드 완료'); }; im4.onerror = ()=>{};
  }catch(e){}
  maleDeadImg.src = 'm7.png';
  maleAttackImg.src = 'm5.png';
  maleHitImg.src = 'm6.png';
  // use f0.png as the female base to avoid run-idle mismatch
  femaleImg.src = 'f0.png'; femaleRunImg.src = 'f1.png'; femaleJumpImg.src = 'f2.png';
  femaleCrouchImg.src = 'f3.png'; femaleCrouchWalkImg.src = 'f4.png';
  // load female run frames f1_0..f1_1
  try{ ['f1_0.png','f1_1.png'].forEach(name=>{ const im=new Image(); im.src = name; im.onload = ()=>{ femaleRunFrames.push(im); addLog(name + ' 로드 완료'); }; im.onerror = ()=>{}; }); }catch(e){}
  // load female crouch-walk frames f4_0..f4_2
  try{ ['f4_0.png','f4_1.png','f4_2.png'].forEach(name=>{ const im=new Image(); im.src = name; im.onload = ()=>{ femaleCrouchWalkFrames.push(im); addLog(name + ' 로드 완료'); }; im.onerror = ()=>{}; }); }catch(e){}
  femaleDeadImg.src = 'f7.png';
  femaleAttackImg.src = 'f5.png';
  femaleHitImg.src = 'f6.png';
  attackIconImg.src = 'attack.png';
  maleImg.onload = ()=>{ maleLoaded = true; addLog('m0.png 로드 완료'); };
  maleRunImg.onload = ()=>{ maleRunLoaded = true; try{ if(!maleRunFrames.includes(maleRunImg)) maleRunFrames.unshift(maleRunImg); }catch(e){} addLog('m1.png 로드 완료'); };
  maleJumpImg.onload = ()=>{ maleJumpLoaded = true; addLog('m2.png 로드 완료'); };
  maleCrouchImg.onload = ()=>{ maleCrouchLoaded = true; addLog('m3.png 로드 완료'); };
  maleCrouchWalkImg.onload = ()=>{ maleCrouchWalkLoaded = true; try{ if(!maleCrouchWalkFrames.includes(maleCrouchWalkImg)) maleCrouchWalkFrames.unshift(maleCrouchWalkImg); }catch(e){} addLog('m4.png 로드 완료'); };
  maleDeadImg.onload = ()=>{ maleDeadLoaded = true; addLog('m7.png 로드 완료'); };
  maleAttackImg.onload = ()=>{ maleAttackLoaded = true; addLog('m5.png(타격) 로드 완료'); };
  maleHitImg.onload = ()=>{ maleHitLoaded = true; addLog('m6.png(피격) 로드 완료'); };
  femaleImg.onload = ()=>{ femaleLoaded = true; addLog('f1_1.png 로드 완료'); };
  femaleRunImg.onload = ()=>{ femaleRunLoaded = true; try{ if(!femaleRunFrames.includes(femaleRunImg)) femaleRunFrames.unshift(femaleRunImg); }catch(e){} addLog('f1.png 로드 완료'); };
  femaleJumpImg.onload = ()=>{ femaleJumpLoaded = true; addLog('f2.png 로드 완료'); };
  femaleCrouchImg.onload = ()=>{ femaleCrouchLoaded = true; addLog('f3.png 로드 완료'); };
  femaleCrouchWalkImg.onload = ()=>{ femaleCrouchWalkLoaded = true; try{ if(!femaleCrouchWalkFrames.includes(femaleCrouchWalkImg)) femaleCrouchWalkFrames.unshift(femaleCrouchWalkImg); }catch(e){} addLog('f4.png 로드 완료'); };
  femaleDeadImg.onload = ()=>{ femaleDeadLoaded = true; addLog('f7.png 로드 완료'); };
  femaleAttackImg.onload = ()=>{ femaleAttackLoaded = true; addLog('f5.png(타격) 로드 완료'); };
  femaleHitImg.onload = ()=>{ femaleHitLoaded = true; addLog('f6.png(피격) 로드 완료'); };
  attackIconImg.onload = ()=>{ attackIconLoaded = true; addLog('attack.png 로드 완료'); };

  // optional background with removed bg (transparent or png)
  const bgImg = new Image(); let bgLoaded = false; bgImg.src = 'bg.png'; bgImg.onload = ()=>{ bgLoaded = true; addLog('bg.png 로드 완료'); };

  // custom background / rail / floor images (user provided)
  const backImg = new Image(); let backLoaded = false; backImg.src = 'back0.png'; backImg.onload = ()=>{ backLoaded = true; addLog('back0.png 로드 완료'); };
  // additional wide background for classroom
  const back1Img = new Image(); let back1Loaded = false; back1Img.src = 'back1.png'; back1Img.onload = ()=>{ back1Loaded = true; addLog('back1.png 로드 완료'); };
  // bulletin board image
  const newsImg = new Image(); let newsLoaded = false; newsImg.src = 'news.png'; newsImg.onload = ()=>{ newsLoaded = true; addLog('news.png 로드 완료'); };
  const railImg = new Image(); let railLoaded = false; railImg.src = 'rail.png'; railImg.onload = ()=>{ railLoaded = true; addLog('rail.png 로드 완료'); };
  const floorImg = new Image(); let floorLoaded = false; floorImg.src = 'floor0.png'; floorImg.onload = ()=>{ floorLoaded = true; addLog('floor0.png 로드 완료'); };
  // large school building image
  const schoolImg = new Image(); let schoolLoaded = false; schoolImg.src = 'school.png'; schoolImg.onload = ()=>{ schoolLoaded = true; addLog('school.png 로드 완료'); };

  // name tag background image
  const nameTagImg = new Image(); let nameTagImgLoaded = false; nameTagImg.src = 'name.png'; nameTagImg.onload = ()=>{ nameTagImgLoaded = true; addLog('name.png 로드 완료'); };

  // NPC image for corridor (정보 교사)
  const npcImg = new Image(); let npcLoaded = false; npcImg.src = 'npc0.png'; npcImg.onload = ()=>{ npcLoaded = true; addLog('npc0.png 로드 완료'); };
  // NPC greeting image (when NPC speaks)
  const npcGreetingImg = new Image(); let npcGreetingLoaded = false; npcGreetingImg.src = 'npc0_0.png'; npcGreetingImg.onload = ()=>{ npcGreetingLoaded = true; addLog('npc0_0.png 로드 완료'); };
  // NPC portrait for chat modal (left side)
  const npcPortraitImg = new Image(); let npcPortraitLoaded = false; npcPortraitImg.src = 'npc0_p.png'; npcPortraitImg.onload = ()=>{ npcPortraitLoaded = true; addLog('npc0_p.png 로드 완료'); };
  // teacher1 NPC (class101) - 과학 교사
  const teacher1Img = new Image(); let teacher1Loaded = false; teacher1Img.src = 'teacher1.png'; teacher1Img.onload = ()=>{ teacher1Loaded = true; addLog('teacher1.png 로드 완료'); };
  const teacher1GreetingImg = new Image(); let teacher1GreetingLoaded = false; teacher1GreetingImg.src = 'teacher1_.png'; teacher1GreetingImg.onload = ()=>{ teacher1GreetingLoaded = true; addLog('teacher1_.png 로드 완료'); };
  // no portrait for teacher1 since interaction is disabled
  // teacher2..teacher5 NPCs
  const teacher2Img = new Image(); let teacher2Loaded = false; teacher2Img.src = 'teacher2.png'; teacher2Img.onload = ()=>{ teacher2Loaded = true; addLog('teacher2.png 로드 완료'); };
  const teacher2GreetingImg = new Image(); let teacher2GreetingLoaded = false; teacher2GreetingImg.src = 'teacher2_.png'; teacher2GreetingImg.onload = ()=>{ teacher2GreetingLoaded = true; addLog('teacher2_.png 로드 완료'); };
  const teacher3Img = new Image(); let teacher3Loaded = false; teacher3Img.src = 'teacher3.png'; teacher3Img.onload = ()=>{ teacher3Loaded = true; addLog('teacher3.png 로드 완료'); };
  const teacher3GreetingImg = new Image(); let teacher3GreetingLoaded = false; teacher3GreetingImg.src = 'teacher3_.png'; teacher3GreetingImg.onload = ()=>{ teacher3GreetingLoaded = true; addLog('teacher3_.png 로드 완료'); };
  const teacher4Img = new Image(); let teacher4Loaded = false; teacher4Img.src = 'teacher4.png'; teacher4Img.onload = ()=>{ teacher4Loaded = true; addLog('teacher4.png 로드 완료'); };
  const teacher4GreetingImg = new Image(); let teacher4GreetingLoaded = false; teacher4GreetingImg.src = 'teacher4_.png'; teacher4GreetingImg.onload = ()=>{ teacher4GreetingLoaded = true; addLog('teacher4_.png 로드 완료'); };
  const teacher5Img = new Image(); let teacher5Loaded = false; teacher5Img.src = 'teacher5.png'; teacher5Img.onload = ()=>{ teacher5Loaded = true; addLog('teacher5.png 로드 완료'); };
  const teacher5GreetingImg = new Image(); let teacher5GreetingLoaded = false; teacher5GreetingImg.src = 'teacher5_.png'; teacher5GreetingImg.onload = ()=>{ teacher5GreetingLoaded = true; addLog('teacher5_.png 로드 완료'); };

  

  // classroom background (shared across class maps)
  const classImg = new Image(); let classLoaded = false; classImg.src = 'classroom.png'; classImg.onload = ()=>{ classLoaded = true; addLog('classroom.png 로드 완료');
    try{
      // compute displayed width when scaled to view height
      const tileW = classImg.width || VIEW_W; const tileH = classImg.height || VIEW_H;
      const scale = VIEW_H / tileH; const destW = Math.round(tileW * scale);
      // update classroom maps to match image width so platforms and spawn positions align
      for(let i=1;i<=5;i++){
        const key = 'class10' + String(i).padStart(1,'0');
        if(MAPS[key]){
          MAPS[key].width = destW;
          // update main ground platform width
          try{ if(MAPS[key].platforms && MAPS[key].platforms[0]) MAPS[key].platforms[0].w = destW; }catch(e){}
            // update spawnTo only if not explicitly set (preserve user-defined left-door spawn)
              try{ if(!MAPS[key].spawnTo || typeof MAPS[key].spawnTo.x !== 'number'){ MAPS[key].spawnTo = { x: Math.min(Math.max(120, Math.round(destW/2 - PLAYER_W/2)), destW-200), y: VIEW_H - PLAYER_H - 60 }; } }catch(e){}
        }
      }
    }catch(e){ console.error('classImg.onload update MAPS failed', e); }
  };

  // NPC greeting behavior config
  const NPC_GREETINGS = ['환영합니다~여러분~', '메이플 호찌민입니다~', '여러분 파이썬은 어렵지 않아요~'];
  const NPC_GREETING_MIN_INTERVAL = 8000; // ms
  const NPC_GREETING_MAX_INTERVAL = 16000; // ms
  const NPC_GREETING_DURATION = 3200; // ms (how long the greeting image/text shows)
  // runtime npc state
  const npcState = { nextGreetAt: Date.now() + (Math.random() * (NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL), speakingUntil: 0, currentPhrase: '' };
  // class-specific NPC states (teacher1..teacher5)
  const teacher1State = { nextGreetAt: Date.now() + (Math.random() * (NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL), speakingUntil: 0, currentPhrase: '' };
  const teacher2State = { nextGreetAt: Date.now() + (Math.random() * (NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL), speakingUntil: 0, currentPhrase: '' };
  const teacher3State = { nextGreetAt: Date.now() + (Math.random() * (NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL), speakingUntil: 0, currentPhrase: '' };
  const teacher4State = { nextGreetAt: Date.now() + (Math.random() * (NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL), speakingUntil: 0, currentPhrase: '' };
  const teacher5State = { nextGreetAt: Date.now() + (Math.random() * (NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL), speakingUntil: 0, currentPhrase: '' };

  // 스프라이트 시트 가정: 가로 프레임 4개, 행별로: 0=남학생,1=여학생,2=플랫폼타일,3=오브젝트(칠판)
  const SPR_W = 32, SPR_H = 48; // 각 프레임 크기 (픽셀)
  const RUN_FRAMES = 3; // 달리기 프레임 수 (인덱스 1..3)
  let skinRow = 0; // 0 남학생, 1 여학생
  // 전체적으로 더 크게 표현 (약 3배)
  const SCALE = 3.0;
  // base player collision box (restore to original baseline)
  const PLAYER_W = Math.round(SPR_W * SCALE);
  // male visual tweak: slightly taller appearance (does not change collision box semantics)
  const PLAYER_H = Math.round(SPR_H * SCALE * 1.12);
  // female visual multipliers (only affect sprite rendering, not physics/collision)
  const FEMALE_W_MULT = 0.98;
  const FEMALE_H_MULT = 1.00; // slightly reduce female height
  // vertical adjustment (pixels) applied to female sprite draw positions
  const FEMALE_Y_OFFSET = 0; // moved down slightly compared to -8
  // additional vertical offset applied only when female is crouching (positive moves down)
  const FEMALE_CROUCH_Y_OFFSET = 6;
  // Global sprite draw width multiplier: increases sprite width only (height preserved)
  const SPRITE_DRAW_WIDTH_MULT = 1.4; // increased to strongly stretch female sprites
  // female idle-specific tweak: reduce height, increase width
  const FEMALE_IDLE_W_MULT = 1.2;
  const FEMALE_IDLE_H_MULT = 0.88;
  // female run frames width multiplier (reduce width for f1 and f1_0)
  const FEMALE_RUN_W_MULT = 0.85;
  // female attack (f5) scale multiplier (increase size when attacking)
  const FEMALE_ATTACK_MULT = 1.10;
  // female crouch-walk (f4) multipliers (width and height increase)
  const FEMALE_CROUCHWALK_W_MULT = 1.15;
  const FEMALE_CROUCHWALK_H_MULT = 1.15;
  // male crouch-walk multipliers (separate for base m4.png and frame m4_0.png)
  const MALE_CROUCHWALK_BASE_W_MULT = 1.08; // applies to m4.png
  const MALE_CROUCHWALK_BASE_H_MULT = 1.08;
  const MALE_CROUCHWALK_FRAME_W_MULT = 1.0; // applies to m4_0.png (frames)
  const MALE_CROUCHWALK_FRAME_H_MULT = 1.0;
  // vertical adjustment (pixels, scaled) applied only to base m4.png to nudge it up
  const MALE_M4_Y_ADJUST = Math.round(-4 * SCALE);
  // female crouch idle (f3.png) width reduction multiplier
  const FEMALE_CROUCH_IDLE_W_MULT = 0.85;
  // hit/dead scale multipliers
  const MALE_HIT_DEAD_MULT = 1.1;
  const FEMALE_HIT_DEAD_MULT = 1.2;
  // female jump multiplier for f2.png
  const FEMALE_JUMP_MULT = 1.25;
  // global visual offset to lower all character images slightly
  const SPRITE_Y_OFFSET = Math.round(6 * SCALE);
  // rail styling: gap between rail tiles (px), optional staggered rows, and scale multiplier
  const RAIL_GAP = 8; // smaller gap to make rails denser
  const RAIL_STAGGER = true;
  const RAIL_SCALE = 1.6; // scale multiplier to make rail visuals larger

  // 성별 선택 버튼 바인딩
  document.getElementById('male-btn').addEventListener('click', ()=>{ chooseSkin(0); });
  document.getElementById('female-btn').addEventListener('click', ()=>{ chooseSkin(1); });
  // Start helper: ensures start works even if event listeners fail to attach
  try{ if(typeof window._gameStarted === 'undefined') window._gameStarted = false; }catch(e){}
  function startGame(guest){
    try{ if(window._gameStarted) return; window._gameStarted = true;
      if(guest){ nickname = '게스트'; }
      else { const val = (document.getElementById('start-nick').value || '').trim(); nickname = val || '익명'; }
      nickEl.textContent = nickname;
      try{ if(player){ player.nick = nickname; player.skinRow = skinRow; player.skinType = (skinRow===0? 'm' : 'f'); } }catch(e){}
      const overlay = document.getElementById('sel-overlay'); if(overlay) overlay.style.display = 'none';
      try{
        // fallback: remove overlay from DOM if it still exists
        if(overlay && overlay.parentNode){ overlay.parentNode.removeChild(overlay); }
      }catch(e){ console.warn('overlay removal failed', e); }
      try{ showClickInfo('시작: ' + nickname + ' skin:' + skinRow); }catch(e){}
      try{ if(canvas && typeof canvas.focus === 'function') canvas.focus(); }catch(e){}
      // visual confirmation for debugging
      try{ showClickInfo('startGame called'); }catch(e){}
      const sb = document.getElementById('start-btn'); if(sb){ try{ sb.textContent = 'Starting...'; sb.disabled = true; }catch(e){} }
      try{ scheduleUserUpdate(); addLog('게임 시작: ' + nickname); }catch(e){ console.error('scheduleUserUpdate failed', e); showClickInfo('scheduleUserUpdate error'); }
      tryPlayBgm();
      console.log('startGame called', guest, nickname, skinRow);
    }catch(e){ console.error('startGame error', e); }
  }
  // ensure global reference for inline onclick
  try{ window.startGame = startGame; }catch(e){ console.error('cannot set window.startGame', e); }

  // Click debug helper: shows last clicked element id/class briefly on screen
  (function(){
    window.showClickInfo = function(t){ try{ console.debug('showClickInfo called with:', t); const info = document.getElementById('click-info-toast') || (function(){ const d=document.createElement('div'); d.id='click-info-toast'; d.style.position='fixed'; d.style.left='12px'; d.style.bottom='12px'; d.style.padding='8px 10px'; d.style.background='rgba(2,6,23,0.8)'; d.style.color='#fff'; d.style.borderRadius='8px'; d.style.zIndex='2000'; document.body.appendChild(d); return d; })(); info.textContent = t; info.style.opacity = '1'; setTimeout(()=>{ try{ info.style.transition='opacity 400ms'; info.style.opacity='0'; }catch(e){} },1500); }catch(e){ console.log('click-info error', e); } };
    document.addEventListener('click', (ev)=>{
      const id = ev.target && ev.target.id ? ev.target.id : '(no-id)';
      const cls = ev.target && ev.target.className ? ev.target.className : '(no-class)';
      console.log('DOM click:', id, cls, ev.target);
      if(id === 'start-btn'){ try{ showClickInfo(id + ' ' + cls + ' hasStart:' + (typeof window.startGame)); }catch(e){ showClickInfo(id + ' ' + cls); } }
      else showClickInfo(id + ' ' + cls);
    }, true);
  })();

  // canvas click: if clicking near tablet in aquarium, open tablet modal
  try{
    canvas.addEventListener('click', (ev)=>{
      try{
        if(player.map !== 'aquarium') return;
        const r = canvas.getBoundingClientRect(); const cx = ev.clientX - r.left; const cy = ev.clientY - r.top;
        const worldX = cx + (typeof camPosX !== 'undefined' ? camPosX : 0); const worldY = cy;
        const decs = MAPS.aquarium && MAPS.aquarium.decors ? MAPS.aquarium.decors : [];
        for(const d of decs){ if(d && d.type === 'tablet'){ const dx = d.x || 0; const dy = d.y || 0; const w = d.w || 220; const h = d.h || 120; const distX = Math.abs(worldX - dx); const distY = Math.abs(worldY - dy); if(distX < Math.max(220,w) && distY < Math.max(160,h)){ try{ window.openTabletModal(); }catch(e){} return; } } }
      }catch(e){ console.error('canvas click tablet check failed', e); }
    });
  }catch(e){}
  // Global error / promise rejection handler to surface errors in UI for users
  window.addEventListener('error', function(e){ try{ const msg = (e && e.message) ? e.message : String(e); addLog('Error: ' + msg); try{ showClickInfo('Error: ' + (e && e.message ? e.message : 'unknown')); }catch(_){} }catch(_){} });
  window.addEventListener('unhandledrejection', function(ev){ try{ const reason = ev && ev.reason ? (ev.reason.message || JSON.stringify(ev.reason)) : 'unhandled rejection'; addLog('UnhandledRejection: ' + reason); try{ showClickInfo('Unhandled: ' + (ev && ev.reason && ev.reason.message ? ev.reason.message : 'promise')); }catch(_){} }catch(_){} });
  window.onerror = function(message, source, lineno, colno, error){ try{ const m = message + ' @' + source + ':' + lineno; addLog('onerror: ' + m); try{ showClickInfo('onerror: ' + message); }catch(_){} }catch(_){} };
  // Start button: read nickname and apply selection
  document.getElementById('start-btn').addEventListener('click', ()=>{
    try{ if(window._gameStarted) return;
      const nickElInput = document.getElementById('start-nick');
      const val = nickElInput ? ((nickElInput.value || '').trim()) : '';
      nickname = val || '익명'; nickEl.textContent = nickname;
      try{ if(player){ player.nick = nickname; player.skinRow = skinRow; player.skinType = (skinRow===0?'m':'f'); } }catch(e){}
      const overlayEl = document.getElementById('sel-overlay'); if(overlayEl) overlayEl.style.display = 'none';
      scheduleUserUpdate();
    }catch(e){ console.error('start-btn handler error', e); }
  });
  document.getElementById('start-guest').addEventListener('click', ()=>{
    if(window._gameStarted) return;
    nickname = '게스트'; nickEl.textContent = nickname;
    try{ if(player){ player.nick = nickname; player.skinRow = skinRow; player.skinType = (skinRow===0?'m':'f'); } }catch(e){}
    try{ const overlayEl = document.getElementById('sel-overlay'); if(overlayEl) overlayEl.style.display = 'none'; }catch(e){}
    scheduleUserUpdate();
  });
  // initialize selection preview
  chooseSkin(skinRow);

  function chooseSkin(row){
    skinRow = row;
    // visual active state (style buttons)
    document.querySelectorAll('.skin-btn').forEach(b=>{ b.classList.remove('active'); b.style.background='#f8fafc'; b.style.borderColor='#ccd'; });
    const id = row===0 ? 'male-btn' : 'female-btn';
    const btn = document.getElementById(id); if(btn){ btn.classList.add('active'); btn.style.background='#e6f0ff'; btn.style.borderColor='#2563eb'; }
    // update player if exists
    try{ if(player){ player.skinRow = row; player.skinType = (row===0? 'm' : 'f'); } }catch(e){}
    scheduleUserUpdate();
    // update preview
    const preview = document.getElementById('preview-box'); if(preview){
      if(row===0 && maleImg.src){ preview.innerHTML = `<img src="${maleImg.src}" style="height:72px">`; }
      else if(row===1 && femaleImg.src){ preview.innerHTML = `<img src="${femaleImg.src}" style="height:72px">`; }
      else { preview.textContent = row===0? '남학생 선택됨' : '여학생 선택됨'; }
    }
  }


  // ---------------- 물리 파라미터 ----------------
  const GRAVITY = 0.6;        // 중력
  const FRICTION = 0.85;      // 지면 마찰(수평 감속)
  const MOVE_SPEED = 2.6;     // 좌우 가속
  const MAX_FALL = 18;        // 최대 낙하 속도
  const JUMP_V = -12.5;       // 점프 초기 속도
  // Attack settings
  const ATTACK_RANGE = 120;   // 공격 사거리 (픽셀)
  const ATTACK_DAMAGE = 10;   // 공격 데미지
  const ATTACK_DURATION = 300; // 공격 애니메이션 지속(ms)
  const HIT_ANIM_DURATION = 450; // 피격 애니메이션 지속(ms)
  const ATTACK_COOLDOWN = 4000; // 공격 쿨타임(ms)

  // ---------------- 맵/플랫폼 설계 (각 맵은 월드 좌표 기반) ----------------
  // 캔버스 크기: 1500x840. 각 맵은 가로 길이(예: 2400px)로 설계하여 스크롤.
  const VIEW_W = canvas.width, VIEW_H = canvas.height;

  // Camera smoothing and screen shake
  let camPosX = 0; let camTargetX = 0; const CAM_LERP = 0.12; let camShake = { x:0, y:0, magnitude:0, decay:0.9 };

  // Parallax layers config (uses available background images)
  function getParallaxLayers(mapKey){
    // layers: {img, speed} speed 0..1 (0 = static far, 1 = same as world)
    const layers = [];
    try{
      // corridor and classroom maps should not use parallax layers (draw wide bg instead)
      if(mapKey === 'corridor' || (typeof mapKey === 'string' && mapKey.indexOf('class10') === 0)) return layers;
    }catch(e){}
    try{
      const map = MAPS[mapKey] || {};
      // If map explicitly requests back1, prefer that as sole wide background
      if(map.bgKey === 'back1' && back1Loaded){ layers.push({ img: back1Img, speed: 0.25 }); return layers; }
      // Otherwise include available layers in order of depth
      if(back1Loaded) layers.push({ img: back1Img, speed: 0.25 });
      if(backLoaded) layers.push({ img: backImg, speed: 0.45 });
      if(bgLoaded) layers.push({ img: bgImg, speed: 0.7 });
    }catch(e){ }
    return layers;
  }

  // ---------------- Minimap ----------------
  function drawMiniMap(){
    try{
      if(!miniMapCtx) return;
      const map = MAPS[player.map] || { width: VIEW_W, platforms: [] };
      const w = miniMapCanvas.width, h = miniMapCanvas.height;
      // clear
      miniMapCtx.clearRect(0,0,w,h);
      // background
      miniMapCtx.fillStyle = 'rgba(6,32,42,0.06)'; miniMapCtx.fillRect(0,0,w,h);
      // scale factor from world -> minimap
      const scaleX = Math.max(0.0001, w / (map.width || VIEW_W));
      const offY = 12; const mapGroundY = VIEW_H - 40; // approximate ground
      // draw platforms as thin lines
      miniMapCtx.strokeStyle = 'rgba(2,6,23,0.16)'; miniMapCtx.lineWidth = 2;
      for(const p of (map.platforms||[])){
        const x = Math.round(p.x * scaleX);
        const x2 = Math.round((p.x + p.w) * scaleX);
        const y = Math.round(h - ((mapGroundY - p.y) / VIEW_H) * (h - 24) - offY);
        miniMapCtx.beginPath(); miniMapCtx.moveTo(x, y); miniMapCtx.lineTo(x2, y); miniMapCtx.stroke();
      }
      // draw other players
      const myGroup = (player.group || (otherUsers && otherUsers[uid] && otherUsers[uid].group) || player.party || player.team || null);
      for(const k in otherUsers){ if(!otherUsers.hasOwnProperty(k)) continue; const u = otherUsers[k]; if(!u || u.map !== player.map) continue; const px = Math.round((u.x||0) * scaleX); const py = Math.round(h - ((mapGroundY - (u.y||0)) / VIEW_H) * (h - 24) - offY); const isMe = (k === uid); const radius = isMe ? 5 : 4; let col = isMe ? '#ff4957' : (u.group && myGroup && u.group === myGroup ? '#60a5fa' : '#ffd166'); miniMapCtx.fillStyle = col; miniMapCtx.beginPath(); miniMapCtx.arc(px, py, radius, 0, Math.PI*2); miniMapCtx.fill(); }
      // draw local player on top
      const plx = Math.round((player.x||0) * scaleX); const ply = Math.round(h - ((mapGroundY - (player.y||0)) / VIEW_H) * (h - 24) - offY);
      miniMapCtx.fillStyle = '#ef4444'; miniMapCtx.beginPath(); miniMapCtx.arc(plx, ply, 5, 0, Math.PI*2); miniMapCtx.fill();
      // border
      miniMapCtx.strokeStyle = 'rgba(2,6,23,0.12)'; miniMapCtx.lineWidth = 1; miniMapCtx.strokeRect(0.5,0.5,w-1,h-1);
    }catch(e){ /* non-fatal */ }
  }

  // Particles and text effects
  const particles = []; // {x,y,vx,vy,size,color,life,maxLife}
  const damageEffects = []; // {x,y,text,alpha,dy,created}
  // aquarium-specific bubbles (rising bubbles with pop effect)
  const aquariumBubbles = []; // {x,y,vx,vy,r,alpha,life,maxLife}

  function spawnAquariumBubble(x,y,opts){
    const r = (opts && opts.r) ? opts.r : (Math.random()*6+2);
    const vx = (Math.random()*0.8 - 0.4);
    const vy = -(Math.random()*1.2 + 0.6);
    aquariumBubbles.push({ x:x, y:y, vx:vx, vy:vy, r:r, alpha:1, life:0, maxLife:(opts&&opts.life?opts.life:2000 + Math.random()*2000) });
  }
  // aquarium fish list (spawned from drawing canvas)
  const aquariumFish = []; // {img:Image, x,y,vx,dir,scale, bobAmp, bobSpeed, w,h}

  // preload fish images fish1.png .. fish5.png (mark loaded when onload fires)
  const fishImgs = [];
  for(let i=1;i<=5;i++){
    try{
      const im = new Image();
      im._idx = i-1;
      im.onload = function(){ try{ this._loaded = true; }catch(e){} };
      im.onerror = function(){ try{ this._loaded = false; }catch(e){} };
      im.src = 'fish' + i + '.png';
      fishImgs.push(im);
    }catch(e){ fishImgs.push(null); }
  }

  function spawnFishFromIndex(idx, x, y){
    try{
      const img = fishImgs[idx] || (function(){ const i2=new Image(); i2.src = 'fish' + (idx+1) + '.png'; return i2; })();
      const fish = { img: img, x: x|| (player.x+100), y: y|| (VIEW_H - PLAYER_H - 80), vx: (Math.random()*0.8 + 0.6), dir: (Math.random()>0.5?1:-1), scale: 1.8 + Math.random()*0.4, bobAmp: 6 + Math.random()*8, bobSpeed: 0.6 + Math.random()*0.8, w: 48, h: 32 };
      const onLoadAdjust = ()=>{ try{ const iw = (img.naturalWidth || img.width || 0); const ih = (img.naturalHeight || img.height || 0); if(iw && ih){ fish.w = Math.max(16, Math.round(iw * fish.scale)); fish.h = Math.max(12, Math.round(ih * fish.scale)); } }catch(e){} };
      if(img.complete){ onLoadAdjust(); } else { try{ img.addEventListener('load', onLoadAdjust); }catch(e){} }
      aquariumFish.push(fish);
      return fish;
    }catch(e){ console.error('spawnFishFromIndex failed', e); }
  }

  // spawn a default set of fish (DB-seed) when aquarium loads
  function spawnDefaultFish(){ try{
    if(!fishImgs || fishImgs.length === 0) return;
    const mapW = (MAPS.aquarium && MAPS.aquarium.width) ? MAPS.aquarium.width : VIEW_W;
    // if DB available, seed DB only when empty
    if(window.db){
      db.ref('aquariumFish').once('value').then(snap=>{
        try{
          if(snap && snap.exists()){ window._aquariumSeeded = true; return; }
          for(let i=0;i<fishImgs.length;i++){
            const count = 1 + Math.floor(Math.random()*2);
            for(let k=0;k<count;k++){
              const px = 100 + Math.random() * Math.max(100, mapW - 200);
              const py = (VIEW_H - PLAYER_H - 60) - (Math.random()*120);
              const src = (fishImgs[i] && fishImgs[i].src) ? fishImgs[i].src : ('fish' + (i+1) + '.png');
              dbPushAquariumFish({ src: src, x: px, y: py, kind: 'preset', imgIndex: i });
            }
          }
          window._aquariumSeeded = true; console.log('spawnDefaultFish: seeded DB with fish');
        }catch(e){ console.error('spawnDefaultFish inner error', e); }
      }).catch(e=>{ console.error('spawnDefaultFish.once error', e); });
    } else {
      // fallback: spawn locally
      for(let i=0;i<fishImgs.length;i++){
        const count = 1 + Math.floor(Math.random()*2);
        for(let k=0;k<count;k++){
          const px = 100 + Math.random() * Math.max(100, mapW - 200);
          const py = (VIEW_H - PLAYER_H - 60) - (Math.random()*120);
          spawnFishFromIndex(i, px, py);
        }
      }
      window._aquariumSeeded = true;
      console.log('spawnDefaultFish: spawned locally', aquariumFish.length);
    }
  }catch(e){ console.error('spawnDefaultFish failed', e); } }

  function spawnFishFromDataUrl(dataUrl, x, y){
    try{
      const img = new Image(); img.src = dataUrl;
      const fish = { img: img, x: x|| (player.x+100), y: y|| (VIEW_H - PLAYER_H - 80), vx: (Math.random()*0.8 + 0.6), dir: (Math.random()>0.5?1:-1), scale: 1.8 + Math.random()*0.4, bobAmp: 6 + Math.random()*8, bobSpeed: 0.6 + Math.random()*0.8, w: 48, h: 32 };
      // once image loads, adjust size preserving original aspect ratio
      const onLoadAdjust = ()=>{ try{ const iw = (img.naturalWidth || img.width || 0); const ih = (img.naturalHeight || img.height || 0); if(iw && ih){ fish.w = Math.max(16, Math.round(iw * fish.scale)); fish.h = Math.max(12, Math.round(ih * fish.scale)); } }catch(e){} };
      if(img.complete){ onLoadAdjust(); } else { try{ img.addEventListener('load', onLoadAdjust); }catch(e){} }
      aquariumFish.push(fish);
      return fish;
    }catch(e){ console.error('spawnFishFromDataUrl failed', e); }
  }

  // Create local fish from a DB record (val may contain src,x,y,scale,...)
  function createLocalFishFromRecord(val){
    try{
      if(!val) return null;
      const src = val.src || val.imgSrc || null;
      if(!src) return null;
      // if record references known preset image, reuse preloaded Image object
      let img = null;
      if(typeof val.imgIndex === 'number' && fishImgs[val.imgIndex]){ img = fishImgs[val.imgIndex]; }
      else if(typeof src === 'string'){
        const m = src.match(/fish(\d+)\.png$/);
        if(m){ const idx = parseInt(m[1],10) - 1; if(fishImgs[idx]) img = fishImgs[idx]; }
      }
      if(!img){ img = new Image(); img.src = src; }
      const fish = { img: img, x: (typeof val.x === 'number') ? val.x : (player.x + 100), y: (typeof val.y === 'number') ? val.y : (VIEW_H - PLAYER_H - 80), vx: val.vx || (Math.random()*0.8 + 0.6), dir: val.dir || 1, scale: val.scale || 0.8, bobAmp: val.bobAmp || 8, bobSpeed: val.bobSpeed || 0.7, w: val.w || 48, h: val.h || 32, _id: val._id || val.id || null };
      const onLoadAdjust = ()=>{ try{ const iw = (img.naturalWidth || img.width || 0); const ih = (img.naturalHeight || img.height || 0); if(iw && ih){ fish.w = Math.max(16, Math.round(iw * fish.scale)); fish.h = Math.max(12, Math.round(ih * fish.scale)); } }catch(e){} };
      if(img.complete){ onLoadAdjust(); } else { try{ img.addEventListener('load', onLoadAdjust); }catch(e){} }
      // avoid duplicates: check by _id
      if(fish._id){ const found = aquariumFish.some(f=>f._id && f._id === fish._id); if(found) return null; }
      aquariumFish.push(fish);
      return fish;
    }catch(e){ console.error('createLocalFishFromRecord failed', e); return null; }
  }

  // Push fish record to DB so other clients can create it
  function dbPushAquariumFish(rec){
    try{
      if(!rec) return;
      if(window.db){
        const ref = db.ref('aquariumFish').push();
        // attach id so clients can use it if needed
        const payload = Object.assign({}, rec, { createdAt: Date.now() });
        // assign id for local immediate creation
        payload._id = ref.key;
        // set in DB and also create locally immediately for responsiveness
        return ref.set(payload).then(()=>{ try{ createLocalFishFromRecord(payload); }catch(e){ console.error('createLocalFishFromRecord after push failed', e); } }).catch(e=>{ console.error('dbPushAquariumFish set failed', e); });
      } else {
        // fallback local creation
        const fake = Object.assign({}, rec, { _id: 'local-' + Date.now() });
        return createLocalFishFromRecord(fake);
      }
    }catch(e){ console.error('dbPushAquariumFish error', e); }
  }

  // Listen for DB additions and create local fish for each
  try{
    if(window.db){
      db.ref('aquariumFish').on('child_added', snap=>{
        try{
          const val = snap.val(); if(!val) return; val._id = snap.key;
          // create local fish if not present
          createLocalFishFromRecord(val);
        }catch(e){ console.error('aquariumFish child_added error', e); }
      });
    }
  }catch(e){ console.error('aquariumFish DB listener setup failed', e); }

  function spawnParticles(x,y,count,opts){
    for(let i=0;i<count;i++){
      const ang = (Math.random()*Math.PI*2); const sp = (opts && opts.speed) ? opts.speed : (Math.random()*2+0.6);
      particles.push({ x:x, y:y, vx:Math.cos(ang)*sp + (opts&&opts.vx?opts.vx:0), vy:Math.sin(ang)*sp + (opts&&opts.vy?opts.vy:0), size:(opts&&opts.size?opts.size:Math.random()*3+1), color:(opts&&opts.color?opts.color:'#ffd166'), life:0, maxLife:(opts&&opts.life?opts.life:600 + Math.random()*400) });
    }
  }

  function cameraShake(magnitude){ if(window.__showVisuals === false) return; camShake.magnitude = Math.max(camShake.magnitude, magnitude||4); }

  // Developer toggles
  window.__showFps = false;
  window.__showVisuals = true; // gate particles & shakes
  // parallax scale factor (0.0 - 1.0) smaller => less zoomed background
  window.__parallaxScale = 0.2;

  // FPS tracking (simple)
  (function(){ let last = performance.now(); let frames = 0; window.__fps = 0; function tick(now){ frames++; if(now - last >= 500){ window.__fps = (frames * 1000) / (now - last); frames = 0; last = now; } requestAnimationFrame(tick); } requestAnimationFrame(tick); })();

  function makeMap(name){
    // 플랫폼 배열: {x,y,w,h, type(optional), portalTo(optional)}
  window.toggleDiag = function(){ window.__diagEnabled = !window.__diagEnabled; addLog('Diag ' + (window.__diagEnabled ? 'ON' : 'OFF')); };
  window.addEventListener && window.addEventListener('keydown', (e)=>{ try{ if(e.key === 'F3'){ window.toggleDiag(); } }catch(err){} });
    if(name === 'hallway'){
      return {
        width: 8000,
        // keep only ground; add very large main school building (entrance leads to classroom)
        platforms: [
          {x:0,y: VIEW_H - 40, w:8000,h:40} // ground aligned to bottom
        ],
        // decorative props placed around the hallway
        // NOTE: 'vending' type is a reusable "기능 구조물" — copy this decor object to another map to place the same vending machine there.
        decors: [
          // fountain moved to far right and dramatically enlarged
          {type: 'fountain', x: 7280, y: VIEW_H - 40 - 384, w: 640, h: 384},
          // larger lamps
          {type: 'lamp', x: 1600, y: VIEW_H - 40 - 240, w: 72, h: 240},
          // bigger boxes for visual presence
          {type: 'box', idx:0, x: 2200, y: VIEW_H - 40 - 80, w: 80, h: 80},
          {type: 'box', idx:2, x: 2260, y: VIEW_H - 40 - 96, w: 96, h: 96},
          {type: 'box', idx:4, x: 2328, y: VIEW_H - 40 - 70, w: 70, h: 70},
          {type: 'lamp', x: 3000, y: VIEW_H - 40 - 240, w: 72, h: 240}
          , { type: 'vending', img: 'ven.png', x: 300, y: VIEW_H - 40 - 360, w: 240, h: 360, interactRange: 260, hint: '[spacebar를 눌러 이용하기]' }
        ].flat(),
        // predefine entrance coordinates so users don't need to call setEntranceCoords
        building: { x: 1200, y: VIEW_H - 40 - 2000, w:3000, h:2000, entranceX: 2691, entranceY: 656, toMap: 'corridor', spawnTo: { x: (4000 - PLAYER_W - 40), y: VIEW_H - PLAYER_H - 40 }, offsetY: 200 },
        // bulletin board near the hallway entrance spawn (much larger)
        board: { x: 3300 - 210, y: VIEW_H - 320, w: 420, h: 320, interactRange: 160 }
      }
    }
    if(name === 'corridor'){
      return {
        // make classroom wider so background can tile more naturally
        width: 4000,
        // keep only ground and a door object to exit back to hallway
        platforms: [
          {x:0,y: VIEW_H - 40,w:4000,h:40}
        ],
        // right-edge hallway exit removed as visual door; use Space interaction instead
        // mark that this map prefers a wide background and transparent ground rendering
        transparentGround: true,
        bgKey: 'back1'
      }
    }
    // classroom maps: names like 'class101'..'class105'
    if(typeof name === 'string' && name.indexOf('class10') === 0){
      try{
        // parse index from name (e.g., class101 -> idx 1)
        const suffix = name.slice(5); const num = parseInt(suffix,10); const idx = (!isNaN(num) && num >= 101) ? (num - 100) : 1;
        const mapWidth = 4800; // initial fallback width; will be adjusted when classImg loads
        // corridor door X positions (match user-provided door coords)
        const corridorDoorXs = [612,1303,1937,2610,3263];
        const corridorDoorY = 639; // player Y on corridor when standing at door
        // classroom internal left-door player spawn (common)
        const classLeftSpawn = { x: 55, y: 500 };
        // compute ground y so player's feet align with ground
        const groundY = classLeftSpawn.y + PLAYER_H;
        const doorX = 40; // left-side portal platform x inside classroom (approx)
        const corridorSpawnX = (typeof corridorDoorXs[idx-1] === 'number') ? corridorDoorXs[idx-1] : (160 + (idx-1)*260);
        return {
          width: mapWidth,
          // only ground platform inside classroom; remove any portal/platform door objects
          platforms: [ { x:0, y: groundY, w: mapWidth, h:40 } ],
          bgKey: 'classroom',
          transparentGround: true,
          // spawn point inside classroom (left side)
          spawnTo: { x: classLeftSpawn.x, y: classLeftSpawn.y },
          // special small door coordinate inside classroom for explicit Space interaction
          internalDoor: { x: classLeftSpawn.x, y: classLeftSpawn.y }
        };
      }catch(e){ console.error('makeMap class parse failed', e); }
    }
    // staffroom with principal NPC
    if(name === 'staffroom'){
      return {
        width: 1800,
        // keep only ground
        platforms: [
          {x:0,y: VIEW_H - 40,w:1800,h:40}
        ],
        principal: {x:900,y:180}
      }
    }
    // aquarium (아쿠아리움) - 테스트용 수족관 맵, 전용 물 효과를 캔버스로 생성합니다.
    if(name === 'aquarium'){
      return {
        width: 3200,
        platforms: [
          // large shallow floor at bottom
          { x: 0, y: VIEW_H - 40, w: 3200, h: 40 }
        ],
        // decoration anchors for bubble sources and tank props (visual only)
        decors: [ { type: 'bubblesource', x: 400, y: VIEW_H - 120 }, { type: 'bubblesource', x: 1200, y: VIEW_H - 80 }, { type: 'bubblesource', x: 2200, y: VIEW_H - 140 }, { type: 'tablet', x: 1800, y: VIEW_H - 160, w: 280, h: 160 } ],
        // mark as underwater to enable special render path
        bgKey: 'aquarium',
        transparentGround: true,
        spawnTo: { x: 160, y: VIEW_H - PLAYER_H - 60 }
      };
    }
  }

  const MAPS = { hallway: makeMap('hallway'), corridor: makeMap('corridor'), staffroom: makeMap('staffroom'), aquarium: makeMap('aquarium') };
  // add classroom maps 10-1 .. 10-5
  MAPS.class101 = makeMap('class101'); MAPS.class102 = makeMap('class102'); MAPS.class103 = makeMap('class103'); MAPS.class104 = makeMap('class104'); MAPS.class105 = makeMap('class105');
  // Ensure each classroom has an internalDoor at (55,500)
  try{
    ['class101','class102','class103','class104','class105'].forEach(k=>{
      if(MAPS[k]){
        MAPS[k].internalDoor = { x:55, y:650 };
        MAPS[k].spawnTo = MAPS[k].spawnTo || { x:55, y:650 };
      }
    });
  }catch(e){}
  // If user-provided entrance coords exist from overlay or earlier call, ensure hallway building uses them.
  try{
    if(MAPS.hallway && MAPS.hallway.building){
      if(!MAPS.hallway.building.entranceX && MAPS.hallway.building.entranceCoord && MAPS.hallway.building.entranceCoord.x) {
        MAPS.hallway.building.entranceX = MAPS.hallway.building.entranceCoord.x;
        MAPS.hallway.building.entranceY = MAPS.hallway.building.entranceCoord.y;
      }
    }
  }catch(e){}
  
  // ensure corridor door sits at the corridor's right edge and exiting goes to the hallway entrance area
  try{
    if(MAPS.corridor && MAPS.corridor.door){
      MAPS.corridor.door.x = MAPS.corridor.width - (MAPS.corridor.door.w || 40) - 20;
      if(MAPS.hallway && MAPS.hallway.building && typeof MAPS.hallway.building.entranceX === 'number'){
        MAPS.corridor.door.spawnTo = MAPS.corridor.door.spawnTo || {};
        MAPS.corridor.door.spawnTo.x = MAPS.hallway.building.entranceX; // spawn at the hallway entrance
        MAPS.corridor.door.spawnTo.y = MAPS.corridor.door.spawnTo.y || (VIEW_H - PLAYER_H - 60);
      }
    }
    // position hallway board near (but not on) the building entrance if available
    if(MAPS.hallway && MAPS.hallway.board && MAPS.hallway.building && typeof MAPS.hallway.building.entranceX === 'number'){
      try{
        // place board fully to the left edge of the map so it never overlaps the entrance
        const b = MAPS.hallway.board;
        const leftPad = 40; // padding from left edge
        const mapWidth = MAPS.hallway.width || 8000;
        MAPS.hallway.board.x = Math.max(0, Math.min(mapWidth - (b.w||260), leftPad));
        MAPS.hallway.board.y = Math.round((MAPS.hallway.board.y || (VIEW_H - 260)));
      }catch(e){}
    }
  }catch(e){}
  // Place vending at explicit coordinates in hallway when requested by user
  try{
    if(MAPS.hallway && Array.isArray(MAPS.hallway.decors)){
      const vend = MAPS.hallway.decors.find(d=>d && d.type === 'vending');
      if(vend){
        vend.x = 992; // fixed world X
        vend.y = 639 - 180; // raise the vending up further (100px higher than before)
        vend.w = 240; vend.h = 360; vend.interactRange = 260;
      }
    }
  }catch(e){}
  let currentMap = 'hallway'; mapNameEl.textContent = currentMap;

  // ---------------- 로컬 플레이어 상태 ----------------
  const player = { uid, nick: nickname, x:120, y: VIEW_H - PLAYER_H - 40, vx:0, vy:0, w:PLAYER_W, h:PLAYER_H, facing:1, onGround:false, map: currentMap, gold:200000, skinRow:skinRow, skinType: null };
  player.isCrouching = false;
  // developer mode flag (toggled via chat /adminkjk)
  player.isDev = false;
  player.maxHp = 100; player.hp = 100; player.isDead = false;
  function formatMoney(n){ try{ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }catch(e){ return String(n); } }
  function updateGoldDisplay(){ try{ if(goldEl) goldEl.textContent = formatMoney(player.gold) + ' 동'; }catch(e){} }
  updateGoldDisplay();
  // Inventory UI: render up to 6 slots (square)
  function updateInventoryUI(){
    try{
      const grid = document.getElementById('inventory-grid'); if(!grid) return;
      const slots = 6;
      const items = (player.items && Array.isArray(player.items)) ? player.items : [];
      for(let i=0;i<slots;i++){
        const slot = document.getElementById('inv-slot-' + i);
        if(!slot) continue;
        // clear existing
        slot.innerHTML = '';
        slot.style.background = '#fff';
        if(items[i]){
          const name = items[i];
          const img = document.createElement('img');
          img.src = name;
          img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'contain';
          img.alt = name;
          slot.appendChild(img);
        } else {
          // placeholder: empty slot
          // keep dashed border and white background
        }
      }
    }catch(e){ console.error('updateInventoryUI error', e); }
  }
  // render initial inventory UI
  try{ updateInventoryUI(); }catch(e){}
  // Inventory tooltip and transfer logic
  (function(){
    const tip = document.createElement('div'); tip.id = 'inv-tooltip'; tip.style.position='fixed'; tip.style.padding='8px 10px'; tip.style.background='#071029'; tip.style.color='#e6eef8'; tip.style.borderRadius='8px'; tip.style.fontFamily = FONT_FAMILY; tip.style.fontSize='13px'; tip.style.zIndex='25000'; tip.style.display='none'; tip.style.pointerEvents='none'; document.body.appendChild(tip);

    async function giveItemToNick(idx, nick){ try{
        if(!nick) return; const itemsArr = player.items || []; if(!itemsArr[idx]){ showClickInfo('해당 슬롯에 아이템이 없습니다.'); return; }
        const itemName = itemsArr[idx];
        // find user by nick
        const q = db.ref('users').orderByChild('nick').equalTo(nick);
        const snap = await q.once('value');
        if(!snap.exists()){ showClickInfo('사용자를 찾을 수 없습니다: ' + nick); return; }
        const val = snap.val(); const targetUid = Object.keys(val)[0];
        // push item to target's items list
        try{
          await db.ref('users/' + targetUid + '/items').push(itemName);
          // remove from our inventory
          itemsArr.splice(idx,1);
          player.items = itemsArr;
          try{ scheduleUserUpdate(); }catch(e){}
          updateInventoryUI(); showClickInfo(nick + '님에게 ' + itemName + '을(를) 전달했습니다.'); addLog('아이템 전달: ' + itemName + ' -> ' + nick);
        }catch(e){ console.error('push to target failed', e); showClickInfo('전송 실패'); }
      }catch(e){ console.error('giveItemToNick error', e); showClickInfo('전송 중 오류'); }
    }

    function wireSlots(){ for(let i=0;i<6;i++){ const slot = document.getElementById('inv-slot-' + i); if(!slot) continue;
        slot.addEventListener('mouseenter', (ev)=>{ try{ const itemsArr = player.items || []; const item = itemsArr[i]; if(!item){ tip.style.display='none'; return; } tip.innerHTML = '<div style="font-weight:700">' + escapeHtml(item) + '</div><div style="font-size:12px;color:#a8c6e8;margin-top:6px">설명: ' + escapeHtml(item) + ' 이다.</div>'; tip.style.display='block'; }catch(e){} });
        slot.addEventListener('mousemove', (ev)=>{ try{ tip.style.left = (ev.clientX + 12) + 'px'; tip.style.top = (ev.clientY + 12) + 'px'; }catch(e){} });
        slot.addEventListener('mouseleave', ()=>{ try{ tip.style.display='none'; }catch(e){} });
        slot.addEventListener('click', ()=>{ try{ const itemsArr = player.items || []; if(!itemsArr[i]){ showClickInfo('빈 슬롯입니다.'); return; } openGiveModal(i); }catch(e){ console.error('slot click error', e); } });
    } }
    try{ wireSlots(); }catch(e){ console.error('wireSlots failed', e); }
    // expose for debugging
    try{ window._wireInventorySlots = wireSlots; }catch(e){}

    // Create give modal DOM and helper functions
    function createGiveModal(){
      try{
        if(document.getElementById('give-modal')) return;
        const modal = document.createElement('div'); modal.id = 'give-modal'; modal.style.position='fixed'; modal.style.left='50%'; modal.style.top='50%'; modal.style.transform='translate(-50%,-50%)'; modal.style.zIndex='26000'; modal.style.display='none'; modal.style.background='#fff'; modal.style.padding='12px'; modal.style.borderRadius='10px'; modal.style.boxShadow='0 12px 36px rgba(0,0,0,0.28)'; modal.style.fontFamily = FONT_FAMILY; modal.style.minWidth='360px';
        modal.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-weight:800">아이템 주기</div>
            <button id="give-close" style="padding:6px 8px;border-radius:6px;background:#eef2ff;border:1px solid #dbeafe">닫기</button>
          </div>
          <div style="margin-bottom:8px">받는사람 닉네임: <input id="give-recipient" placeholder="닉네임 입력" style="padding:6px;border:1px solid #e6eef8;border-radius:6px;width:180px"/></div>
          <div id="give-inv-grid" style="display:grid;grid-template-columns:repeat(3,80px);gap:8px;max-height:320px;overflow:auto;padding:6px;border:1px solid #f1f5f9;border-radius:8px;background:#fbfcff"></div>
          <div style="margin-top:8px;color:#475569;font-size:13px">받는사람을 입력한 뒤 인벤토리에서 아이템을 클릭하면 전송됩니다.</div>
        `;
        document.body.appendChild(modal);
        document.getElementById('give-close').addEventListener('click', ()=>{ modal.style.display='none'; });
      }catch(e){ console.error('createGiveModal error', e); }
    }

    function updateGiveModal(preselectIndex){
      try{
        createGiveModal();
        const grid = document.getElementById('give-inv-grid'); if(!grid) return;
        grid.innerHTML = '';
        const itemsArr = (player.items && Array.isArray(player.items)) ? player.items : [];
        for(let i=0;i<6;i++){
          const wrap = document.createElement('div'); wrap.style.width='80px'; wrap.style.height='80px'; wrap.style.border='1px dashed #e6eef8'; wrap.style.borderRadius='6px'; wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.justifyContent='center'; wrap.style.background='#fff'; wrap.style.cursor = 'pointer'; wrap.dataset.index = i;
          if(itemsArr[i]){ const img = document.createElement('img'); img.src = itemsArr[i]; img.style.maxWidth='72px'; img.style.maxHeight='72px'; img.style.objectFit='contain'; wrap.appendChild(img); }
          else { wrap.style.opacity = '0.36'; wrap.textContent = '-'; }
          wrap.addEventListener('click', async ()=>{ try{ const nickEl = document.getElementById('give-recipient'); const nick = nickEl ? nickEl.value.trim() : ''; if(!nick){ showClickInfo('수신자 닉네임을 입력하세요'); return; } const idx = parseInt(wrap.dataset.index,10); await giveItemToNick(idx, nick); document.getElementById('give-modal').style.display='none'; }catch(e){ console.error('give modal click error', e); showClickInfo('전송 실패'); } });
          grid.appendChild(wrap);
        }
      }catch(e){ console.error('updateGiveModal error', e); }
    }

    function openGiveModal(preselectIndex){
      try{
        createGiveModal();
        const modal = document.getElementById('give-modal'); if(!modal) return;
        modal.style.display = 'block';
        try{ const nickEl = document.getElementById('give-recipient'); if(nickEl) nickEl.value = ''; }catch(e){}
        updateGiveModal(preselectIndex);
      }catch(e){ console.error('openGiveModal error', e); }
    }

    // Open give modal with recipient prefilled (targetNick)
    function openGiveModalForTarget(targetNick){
      try{
        createGiveModal(); const modal = document.getElementById('give-modal'); if(!modal) return; modal.style.display='block';
        try{ const nickEl = document.getElementById('give-recipient'); if(nickEl) nickEl.value = targetNick || ''; }catch(e){}
        updateGiveModal();
      }catch(e){ console.error('openGiveModalForTarget error', e); }
    }
    try{ window.openGiveModalForTarget = openGiveModalForTarget; }catch(e){}

    try{ const openBtn = document.getElementById('open-give-btn'); if(openBtn) openBtn.addEventListener('click', ()=>{ try{ openGiveModal(); }catch(e){} }); }catch(e){}
  })();
  try{ updateSidebarHp(); }catch(e){}
  try{ if(hpTextEl) hpTextEl.textContent = player.hp + '/' + player.maxHp; }catch(e){}

  // Global money modal and transfer functions (make accessible from menus)
  function performMoneyTransfer(targetUid, amount){
    try{
      if(!targetUid) return showClickInfo('대상을 찾을 수 없습니다');
      const tgt = otherUsers && otherUsers[targetUid]; const targetNick = tgt && tgt.nick ? tgt.nick : targetUid;
      const prev = player.gold || 0; if(!Number.isFinite(amount) || amount <= 0) return showClickInfo('유효한 액수를 입력하세요');
      if(amount > prev) return showClickInfo('보유 금액이 부족합니다');
      player.gold = prev - amount;
      try{ if(typeof updateGoldDisplay === 'function') updateGoldDisplay(); }catch(e){}
      try{ db.ref('users/' + targetUid + '/gold').transaction(function(curr){ return (curr || 0) + amount; }); }catch(e){ console.error('recipient gold update failed', e); }
      try{ db.ref('users/' + uid + '/gold').transaction(function(curr){ return (curr || prev) - amount; }); }catch(e){ console.error('sender gold update failed', e); }
      addLog('돈 전송: ' + amount + ' 동 -> ' + targetNick);
      showClickInfo('전송 완료: ' + amount + ' 동');
    }catch(e){ console.error('performMoneyTransfer failed', e); showClickInfo('전송 실패'); }
  }

  function createMoneyModal(){
    try{
      if(document.getElementById('money-modal')) return;
      const modal = document.createElement('div'); modal.id = 'money-modal'; modal.style.position='fixed'; modal.style.left='50%'; modal.style.top='50%'; modal.style.transform='translate(-50%,-50%)'; modal.style.zIndex='26000'; modal.style.display='none'; modal.style.background='#fff'; modal.style.padding='12px'; modal.style.borderRadius='10px'; modal.style.boxShadow='0 12px 36px rgba(0,0,0,0.28)'; modal.style.fontFamily = FONT_FAMILY; modal.style.minWidth='320px';
      modal.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:800">돈 주기</div>
          <button id="money-close" style="padding:6px 8px;border-radius:6px;background:#eef2ff;border:1px solid #dbeafe">닫기</button>
        </div>
        <div style="margin-bottom:8px">받는사람: <span id="money-recipient" style="font-weight:700"></span></div>
        <div style="margin-bottom:8px">금액(동): <input id="money-amount" placeholder="숫자만 입력" style="padding:6px;border:1px solid #e6eef8;border-radius:6px;width:140px"/></div>
        <div style="display:flex;justify-content:flex-end;gap:8px"><button id="money-cancel">취소</button><button id="money-send" style="background:#2563eb;color:#fff;border:none;padding:6px 10px;border-radius:6px">전송</button></div>
      `;
      document.body.appendChild(modal);
      document.getElementById('money-close').addEventListener('click', ()=>{ modal.style.display='none'; });
      document.getElementById('money-cancel').addEventListener('click', ()=>{ modal.style.display='none'; });
      document.getElementById('money-send').addEventListener('click', ()=>{
        try{
          const amtEl = document.getElementById('money-amount'); const amtStr = amtEl ? amtEl.value : ''; const amount = parseInt(String(amtStr).replace(/[.,\s]/g,''),10);
          const recEl = document.getElementById('money-recipient'); const targetUid = recEl ? recEl.dataset.uid : null;
          if(!amount || !Number.isFinite(amount) || amount <= 0){ showClickInfo('유효한 액수를 입력하세요'); return; }
          if(!targetUid){ showClickInfo('대상을 찾을 수 없습니다'); return; }
          performMoneyTransfer(targetUid, amount);
          modal.style.display='none';
        }catch(e){ console.error('money-send click failed', e); showClickInfo('전송 실패'); }
      });
    }catch(e){ console.error('createMoneyModal error', e); }
  }

  function openMoneyModal(targetUid){
    try{
      createMoneyModal(); const modal = document.getElementById('money-modal'); if(!modal) return; const rec = document.getElementById('money-recipient'); if(rec){ const tgt = otherUsers && otherUsers[targetUid]; const nick = tgt && tgt.nick ? tgt.nick : targetUid; rec.textContent = nick; rec.dataset.uid = targetUid; } const amt = document.getElementById('money-amount'); if(amt) amt.value = '';
      modal.style.display = 'block';
    }catch(e){ console.error('openMoneyModal failed', e); }
  }

  // DB refs and onDisconnect
  const userRef = db.ref('users/' + uid);
  userRef.onDisconnect().remove();
  function pushInitial(){ userRef.set({x:player.x,y:player.y,vx:player.vx,vy:player.vy,map:player.map,nick:player.nick,skinRow:player.skinRow,skinType:player.skinType,isCrouching:player.isCrouching,onGround:player.onGround,hp:player.hp,isDead:player.isDead,ts:Date.now()}); }
  pushInitial();
  window.addEventListener('beforeunload', ()=>{ try{ db.ref('users/' + uid).remove(); }catch(e){} });

  // ---------------- 입력 ----------------
  const keys = {};

  // Helper: attempt direct enter into corridor door coords (used as fallback on Space)
  function enterCorridorDoorIfNearby(){
    try{
      if(player.map !== 'corridor') return false;
      const doorCoords = [
        { x: 612,  y: 639, toMap: 'class101' },
        { x: 1303, y: 639, toMap: 'class102' },
        { x: 1937, y: 639, toMap: 'class103' },
        { x: 2610, y: 639, toMap: 'class104' },
        { x: 3263, y: 639, toMap: 'class105' },
        // corridor right-edge exit (spacebar interaction)
        { x: (MAPS.corridor ? MAPS.corridor.width - 40 - 20 : 3940), y: VIEW_H - 120, toMap: 'hallway', spawnTo: { x: 7600, y: VIEW_H - PLAYER_H - 60 } }
      ];
      const pxCenter = player.x + (player.w||32)/2; const pyFeet = player.y + (player.h||48);
      for(const dc of doorCoords){ const dx2 = Math.abs(pxCenter - dc.x); const dy2 = Math.abs(pyFeet - dc.y);
        // relaxed dy threshold and debug to diagnose why standing players miss the door
        if(dx2 < 160 && dy2 < 360){ if(dc.toMap && MAPS[dc.toMap]){
        const spawn = MAPS[dc.toMap].spawnTo || { x: Math.min(Math.max(120, Math.round(MAPS[dc.toMap].width/2 - PLAYER_W/2)), MAPS[dc.toMap].width-200), y: VIEW_H - PLAYER_H - 60 };
        // set map then snap to a platform top if available to avoid falling through
        player.map = dc.toMap; player.x = spawn.x; player.vx = 0; player.vy = 0; player.onGround = false;
        try{
          const destMap = MAPS[dc.toMap]; if(destMap && Array.isArray(destMap.platforms)){
            for(const p of destMap.platforms){ if(!p) continue; if(p.portalTo || (spawn.x >= p.x && spawn.x <= p.x + (p.w||0))){ player.y = p.y - player.h; player.onGround = true; player.vy = 0; break; } }
          }
        }catch(e){}
        try{ player.teleportIgnoreUntil = Date.now() + 600; }catch(e){}
        mapNameEl.textContent = player.map; scheduleUserUpdate(); addLog('교실로 들어갑니다: ' + player.map);
        console.debug && console.debug('enterCorridorDoorIfNearby', { map: player.map, spawn, pxCenter, pyFeet, dx2, dy2 });
        return true;
      } }
      }
    }catch(e){ console.error('enterCorridorDoorIfNearby error', e); }
    return false;
  }
  window.addEventListener('keydown', (e)=>{
    const active = document.activeElement;
    const inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.id === 'chat-input' || active.isContentEditable);
    try{ console.debug('keydown event', {key:e.key, code:e.code, inInput:!!inInput, activeTag: active && active.tagName, playerMap: player && player.map}); }catch(_e){}
    // Prevent default only when NOT typing in an input/chat
    if(!inInput && ['ArrowLeft','ArrowRight',' ','a','A','d','D','w','W','s','S'].includes(e.key)) e.preventDefault();
    // Only map game keys when not focused on input
    if(!inInput) {
      keys[e.key] = true;
      // Space = interaction (attempt once on keydown). Support different browser key values.
      if(e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar'){
        const handled = tryInteraction();
        if(!handled){ // fallback: attempt corridor door coords directly
          enterCorridorDoorIfNearby();
        }
      }
      // Attack: J 키로 전방 공격 (교내에서는 경고 텍스트만 표시)
      if(e.key === 'j' || e.key === 'J' || e.code === 'KeyJ'){
        try{
          console.debug('J key branch reached', {key:e.key, code:e.code, playerMap: player && player.map});
          if(player && (player.map === 'corridor' || (typeof player.map === 'string' && player.map.indexOf('class10') === 0))){
            console.debug('Showing school warning toast');
            showClickInfo('교내에서는 폭력이 금지됩니다!');
          } else {
            console.debug('Calling startAttack from J');
            startAttack();
          }
        }catch(err){
          console.error('J key handling error', err);
          try{ startAttack(); }catch(e){}
        }
      }
      // debug: K 키로 데미지 적용 (테스트용) -- removed
      // Enter to send chat when not focused on input
      if(e.key === 'Enter') sendChatFromInput();
    } else {
      // when in input, allow normal typing; Enter is handled by input handler
    }
  });
  window.addEventListener('keyup', (e)=>{ keys[e.key] = false; });

  // ---------------- 충돌 검사 유틸 ----------------
  function rectIntersect(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  // ---------------- 물리 업데이트 ----------------
  function physicsStep(dt){
    // detect landing: if we were in air and now land, spawn dust
    if(typeof window._prevOnGround === 'undefined') window._prevOnGround = !!player.onGround;
    // If dead, prevent movement and physics
    if(player.isDead){ player.vx = 0; player.vy = 0; return; }
    // If in a battle, immobilize player
    if(player.isInBattle){ try{ player.vx = 0; player.vy = 0; }catch(e){} return; }
    // Horizontal input
    let ax = 0;
    if(keys['ArrowLeft'] || keys['a'] || keys['A']){ ax = -MOVE_SPEED; player.facing = -1; } 
    if(keys['ArrowRight'] || keys['d'] || keys['D']){ ax = MOVE_SPEED; player.facing = 1; } 

    // Crouch handling: S to crouch (affects movement)
    const isCrouch = !!(keys['s'] || keys['S']); player.isCrouching = isCrouch;

    // Apply horizontal velocity (reduced when crouching)
    const crouchSpeedFactor = player.isCrouching ? 0.55 : 1.0;
    player.vx += ax * 0.6 * crouchSpeedFactor;
    player.vx *= 0.92; // air/ground drag
    if(Math.abs(player.vx) < 0.05) player.vx = 0;

    // Jump handling: W is jump key. Spacebar is reserved for interaction (handled on keydown).
    const wantJump = keys['w'] || keys['W']; 
    // allow infinite jumping in developer mode
    if(wantJump && (player.onGround || player.isDev)){ player.vy = JUMP_V; player.onGround = false; } 

    // Gravity
    player.vy += GRAVITY;
    if(player.vy > MAX_FALL) player.vy = MAX_FALL;

    // Integrate and collide with platforms
    // Move X then resolve
    player.x += player.vx * (dt/16);
    const platforms = MAPS[player.map].platforms;
    // use reduced horizontal hitbox while crouching so player can fit through narrow gaps
    const hitW = player.isCrouching ? Math.max(2, Math.round(player.w * 0.6)) : player.w;
    const hitOffsetX = Math.round((player.w - hitW) / 2);
    for(const p of platforms){
      if(p && p.passable) continue;
      const rect = {x:p.x,y:p.y,w:p.w,h:p.h};
      const plBox = {x: player.x + hitOffsetX, y: player.y, w: hitW, h: player.h};
      if(rectIntersect(plBox,rect)){
        // resolve X overlap using hitbox dimensions
        if(player.vx > 0) player.x = p.x - hitW - 0.1 - hitOffsetX;
        else if(player.vx < 0) player.x = p.x + p.w + 0.1 - hitOffsetX;
        player.vx = 0;
      }
    }

    // Move Y then resolve
    player.y += player.vy * (dt/16);
    player.onGround = false;
    for(const p of platforms){
      const rect = {x:p.x,y:p.y,w:p.w,h:p.h};
      const plBox = {x: player.x + hitOffsetX, y: player.y, w: hitW, h: player.h};
      if(rectIntersect(plBox,rect)){
        // from top (use full player height for vertical positioning)
        if(player.vy > 0 && (player.y + player.h) - player.vy <= p.y + 2){
          player.y = p.y - player.h; player.vy = 0; player.onGround = true;
          // landing event
          if(!window._prevOnGround){
            // spawn dust particles at feet
            if(window.__showVisuals !== false){ spawnParticles(player.x + player.w/2, player.y + player.h, 12, { color: '#a88a52', speed:1.6, size:2, life:500 }); cameraShake(3); }
          }
        } else if(player.vy < 0){
          player.y = p.y + p.h + 0.1; player.vy = 0;
        }
      }
    }

    // Clamp to world
    if(player.x < 0) player.x = 0;
    if(player.x > MAPS[player.map].width - player.w) player.x = MAPS[player.map].width - player.w;
    if(player.y > VIEW_H) { player.y = VIEW_H- player.h; player.vy = 0; player.onGround = true; }

    // Portal check (automatic portals only when platform explicitly marked `autoPortal`)
    for(const p of platforms){
      // do not allow auto-portals while inside classroom maps (prevent automatic exit)
      if(player.map && typeof player.map === 'string' && player.map.indexOf('class10') === 0) continue;
      if(p.portalTo && p.autoPortal){ const px = p.x, py = p.y, pw = p.w, ph = p.h; if(player.x + player.w > px && player.x < px+pw && player.y + player.h > py && player.y < py+ph){
      const to = p.portalTo; const spawn = p.spawn || {x:100,y:0}; player.map = to; player.x = spawn.x; player.y = spawn.y; player.vx=0; player.vy=0; try{ player.teleportIgnoreUntil = Date.now() + 600; }catch(e){} mapNameEl.textContent = player.map; addLog('포탈 이동: '+player.map); break; } }
    }

    // Update DB throttled (simple timer)
    scheduleUserUpdate();
    window._prevOnGround = !!player.onGround;
  }

  // ---------------- Interaction: vending/principal ----------------
  // Vending modal / jackpot spin UI
  window.openVendingModal = function(decor){
    try{
      if(!decor) return;
      // prevent multiple modals
      if(document.getElementById('vending-modal-overlay')) return;
      const cost = 50000;
      const items = [
        'item_banana0.png','item_banana.png','item_attack_armor.png','item_attack.png','item_armor.png',
        'item_500.jpg','item_50.jpg','item_5.jpg','item_200.jpg','item_20.jpg','item_2.jpg','item_100.jpg','item_10.jpg','item_1.jpg',
        'item_wheel.png','item_sunchipg.png','item_kancho.png','item_sunchip.png','item_jump.png','item_speed.png','item_ice.png','item_power.png','item_fly.png',
        'item_poporo.png','item_cup.png','item_pepero.png','item_c2.png','item_blood.png','item_bananas.png','item_bananam.png','item_bananal.png'
      ];
      const overlay = document.createElement('div'); overlay.id = 'vending-modal-overlay';
      overlay.style.position = 'fixed'; overlay.style.left = '0'; overlay.style.top = '0'; overlay.style.right = '0'; overlay.style.bottom = '0'; overlay.style.background = 'rgba(0,0,0,0.6)'; overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center'; overlay.style.zIndex='20000';
      const box = document.createElement('div'); box.style.width='520px'; box.style.maxWidth='calc(100% - 40px)'; box.style.background='#fff'; box.style.borderRadius='10px'; box.style.padding='16px'; box.style.boxShadow='0 12px 40px rgba(2,6,23,0.4)'; box.style.fontFamily = FONT_FAMILY;
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-weight:800;font-size:18px">자판기 잭팟</div>
          <button id="vending-close" style="background:#f3f4f6;border:none;padding:6px 8px;border-radius:6px;cursor:pointer">닫기</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:260px;height:360px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid #e6eef8;background:#f8fafc;overflow:hidden;position:relative">
            <div id="vending-spin-window" style="width:220px;height:320px;overflow:hidden;display:block;position:relative">
              <div id="vending-spin-column" style="position:absolute;left:0;top:0;width:100%"></div>
            </div>
            <div style="position:absolute;left:0;right:0;top:50%;height:0;margin-top:-60px;pointer-events:none;border-top:2px solid rgba(0,0,0,0.06);"></div>
          </div>
          <div style="flex:1">
            <div style="margin-bottom:8px">회전 비용: <strong>${formatMoney(cost)} 동</strong></div>
            <div style="margin-bottom:8px">보유: <span id="vending-player-gold">${formatMoney(player.gold)} 동</span></div>
            <div style="margin-bottom:10px;color:#475569">스핀 버튼을 눌러 잭팟을 돌려 아이템을 획득하세요.</div>
            <div style="display:flex;gap:8px">
              <button id="vending-spin-btn" style="flex:1;padding:10px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer">스핀 (${formatMoney(cost)} 동)</button>
              <button id="vending-quickclose" style="padding:10px;background:#eef2ff;border:1px solid #dbeafe;border-radius:8px;cursor:pointer">취소</button>
            </div>
            <div id="vending-result" style="margin-top:12px;font-weight:700"></div>
          </div>
        </div>
      `;
      overlay.appendChild(box); document.body.appendChild(overlay);

      const spinImg = box.querySelector('#vending-spin-img'); const spinBtn = box.querySelector('#vending-spin-btn'); const closeBtn = box.querySelector('#vending-close'); const quickClose = box.querySelector('#vending-quickclose'); const resultEl = box.querySelector('#vending-result'); const goldDisplay = box.querySelector('#vending-player-gold');
      function closeModal(){ try{ overlay.parentNode && overlay.parentNode.removeChild(overlay); }catch(e){} }
      closeBtn.addEventListener('click', closeModal); quickClose.addEventListener('click', closeModal);

      let spinning = false; let animTimeout = null;
      const win = box.querySelector('#vending-spin-window'); const col = box.querySelector('#vending-spin-column');
      // build a tall column of images (repeat items) and return the DOM elements
      function buildColumn(repeatCount){ col.innerHTML = ''; const slotH = 120; const imgs = [];
        // prepare a repeated sequence to allow long scroll
        const seq = [];
        for(let r=0;r<repeatCount;r++){ for(const it of items){ seq.push(it); } }
        // shuffle a bit to make visual more varied
        for(let i=0;i<seq.length;i++){ const j = i + Math.floor(Math.random()*(seq.length - i)); const t = seq[i]; seq[i]=seq[j]; seq[j]=t; }
        for(let i=0;i<seq.length;i++){ const s = seq[i]; const img = document.createElement('img'); img.src = s; img.style.display='block'; img.style.width='100%'; img.style.height=slotH+'px'; img.style.objectFit='contain'; img.style.padding='6px 12px'; img.style.boxSizing='border-box'; col.appendChild(img); imgs.push(img); }
        // set column width/position
        col.style.width = '100%'; col.style.top = '0px'; col.style.left = '0px'; col.style.transition = 'none'; return { imgs, slotH, seq };
      }

      function performSpin(){
        if(spinning) return; if(player.gold < cost){ showClickInfo('동이 부족합니다.'); return; }
        // prepare column
        const repeat = 6; const built = buildColumn(repeat); const seq = built.seq || built.seq; const slotH = built.slotH || 120; // select a random target from base items
        // deduct cost
        player.gold -= cost; updateGoldDisplay(); try{ scheduleUserUpdate(); }catch(e){}
        goldDisplay.textContent = formatMoney(player.gold) + ' 동';
        spinning = true; resultEl.textContent = '';
        // choose a random target item (from original items), then find matching indices in seq
        const desired = items[Math.floor(Math.random()*items.length)];
        // find all indices in column matching desired
        const imgs = Array.from(col.querySelectorAll('img'));
        const matches = imgs.map((el, idx)=> ({ el, idx, src: el.src })).filter(x=>{ try{ return x.src.indexOf(desired) !== -1 || x.src.endsWith('/'+desired); }catch(e){ return false; } });
        // fallback: if no exact match found (due to absolute path differences), match by filename substring
        let pickIdx = -1;
        if(matches.length > 0){ const choose = matches[Math.floor(Math.random()*matches.length)]; pickIdx = choose.idx; }
        else { // try filename contains
          for(let i=0;i<imgs.length;i++){ try{ const s = imgs[i].src || ''; if(s.indexOf(desired) !== -1 || s.endsWith('/'+desired)) { pickIdx = i; break; } }catch(e){} }
        }
        if(pickIdx < 0) pickIdx = Math.floor(Math.random()*imgs.length);

        // compute translate so that picked image centers in the window
        const winH = 320; const centerOffset = Math.round((winH / 2) - (slotH/2));
        const targetTop = pickIdx * slotH; const translateY = -(targetTop - centerOffset);
        // apply initial offset so column appears from above (startY)
        const startY = Math.round(- (Math.random()*imgs.length*slotH * 0.35) - (slotH*8));
        col.style.transform = 'translateY(' + startY + 'px)';
        // force reflow then animate
        void col.offsetHeight;
        // duration and easing for slow-down effect
        const duration = 3000 + Math.floor(Math.random()*2200);
        col.style.transition = 'transform ' + duration + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
        col.style.transform = 'translateY(' + translateY + 'px)';
        // after animation completes
        animTimeout = setTimeout(()=>{
          try{
            spinning = false; animTimeout = null;
            // find picked image src
            const pickedEl = imgs[Math.max(0, Math.min(imgs.length-1, pickIdx))]; const pickedSrc = (pickedEl && pickedEl.src) ? pickedEl.src : items[0];
            // normalize filename portion for display
            const parts = pickedSrc.split('/'); const picked = parts[parts.length-1];
            resultEl.textContent = '획득: ' + picked; addLog('자판기 획득: ' + picked);
            try{ player.items = player.items || []; player.items.push(picked); scheduleUserUpdate(); try{ updateInventoryUI(); }catch(e){} }catch(e){}
          }catch(e){ console.error('vending spin finish error', e); }
        }, duration + 80);
      }

      spinBtn.addEventListener('click', ()=>{ try{ performSpin(); }catch(e){ console.error('spin error', e); } });
    }catch(e){ console.error('openVendingModal failed', e); }
  };

  function tryInteraction(){
    const map = MAPS[player.map];
    console.debug && console.debug('tryInteraction called', { keyMap: Object.keys(keys).filter(k=>keys[k]) });
    // Principal interaction in staffroom
    if(player.map === 'staffroom' && map.principal){
      const dx = Math.abs((player.x + player.w/2) - map.principal.x);
      const dy = Math.abs((player.y + player.h/2) - map.principal.y);
      if(dx < 60 && dy < 60){ handlePrincipalInteraction(); return true; }
    }

    // Enter main building from hallway by interacting at the entrance (use visual offset if present)
    if(player.map === 'hallway' && map.building){
      // ignore entrance checks briefly after teleporting from corridor to avoid immediate re-entry
      if(Date.now() < (player.teleportIgnoreUntil || 0)) { console.debug && console.debug('Skipping entrance check due to recent teleport'); }
      else {
      const entranceX = (typeof map.building.entranceX === 'number') ? map.building.entranceX : (map.building.x + map.building.w/2);
      const visualY = map.building.y + (map.building.offsetY || 0);
      const pxCenter = (player.x + player.w/2);
      const dx = Math.abs(pxCenter - entranceX);
      const buildingBottomY = visualY + map.building.h;
      const dyAbs = Math.abs((player.y + player.h + SPRITE_Y_OFFSET) - buildingBottomY);
      const range = (map.building.interactRange || 160);
      const dyLimit = 220;
      console.debug && console.debug('entrance check', { entranceX, pxCenter, dx, dyAbs, range, dyLimit, playerMap: player.map });
      if(dx <= range && dyAbs <= dyLimit){
        const target = map.building.toMap || 'corridor';
        player.map = target; player.x = map.building.spawnTo ? map.building.spawnTo.x : 220; player.y = map.building.spawnTo ? map.building.spawnTo.y : VIEW_H - PLAYER_H - 40;
        player.vx = 0; player.vy = 0; mapNameEl.textContent = player.map; scheduleUserUpdate(); addLog('건물로 들어갔습니다.');
        return true;
      }
      else {
        console.debug && console.debug('Entrance interaction failed', { dx: dx, dyAbs: dyAbs, range: range, dyLimit: dyLimit, playerMap: player.map, entranceX: entranceX });
      }
      }
    }

    // Bulletin board interaction (any map with board)
    if(map.board){
      const bxCenter = map.board.x + (map.board.w/2);
      const dx = Math.abs((player.x + player.w/2) - bxCenter);
      const byCenter = map.board.y + (map.board.h/2);
      const dy = Math.abs((player.y + player.h + SPRITE_Y_OFFSET) - byCenter);
      if(dx <= (map.board.interactRange || 160) && dy <= 220){
        // open board modal
        try{ showBoardModal(); }catch(e){ alert('세기의 방명록'); }
        return true;
      }
    }

    // Exit classroom via door interaction
    if(player.map === 'corridor' && map.door){
      const door = map.door;
      const dx = Math.abs((player.x + player.w/2) - (door.x + door.w/2));
      const dy = Math.abs((player.y + player.h + SPRITE_Y_OFFSET) - (door.y + door.h/2));
      if(dx < 48 && dy < 64){
        const target = door.toMap || 'hallway';
        player.map = target; player.x = door.spawnTo ? door.spawnTo.x : 1040; player.y = door.spawnTo ? door.spawnTo.y : VIEW_H - PLAYER_H - 60;
        // set short ignore so entrance interaction doesn't immediately trigger when spawning at entrance
        try{ player.teleportIgnoreUntil = Date.now() + 600; }catch(e){}
        player.vx = 0; player.vy = 0; mapNameEl.textContent = player.map; scheduleUserUpdate(); addLog('문으로 나갔습니다.');
        return true;
      }
    }

    // Corridor NPC interaction (정보 교사) - press Space when near left-side NPC
    if(player.map === 'corridor'){
      try{
        const npcWorldX = 160; const pxCenter = player.x + player.w/2;
        const dx = Math.abs(pxCenter - npcWorldX);
        const platformTopY = VIEW_H - 40; const dy = Math.abs((player.y + player.h + SPRITE_Y_OFFSET) - platformTopY);
        if(dx < 80 && dy < 100){ handleNpcInteraction(); return true; }
      }catch(e){}
    }

    // Exit classroom via Spacebar when near the internal door coordinate (requires explicit interaction)
    if(typeof player.map === 'string' && player.map.indexOf('class10') === 0){
      try{
        const map = MAPS[player.map];
        const door = (map && map.internalDoor) ? map.internalDoor : null;
        if(!door){ console.debug && console.debug('classExitCheck: internalDoor disabled for', player.map); }
        else {
          const pxCenter = player.x + player.w/2; const pyFeet = player.y + player.h + SPRITE_Y_OFFSET;
          const dx = Math.abs(pxCenter - door.x); const dy = Math.abs(pyFeet - door.y);
          console.debug && console.debug('DBG: classExitCheck', { playerMap: player.map, playerX: Math.round(player.x), playerY: Math.round(player.y), pxCenter: Math.round(pxCenter), pyFeet: Math.round(pyFeet), doorX: door.x, doorY: door.y, dx: Math.round(dx), dy: Math.round(dy) });
          if(dx < 100 && dy < 140){
            const idx = parseInt(player.map.slice(5),10) - 100; const corridorDoorXs = [612,1303,1937,2610,3263]; const corridorDoorY = 639;
            const destX = (typeof corridorDoorXs[idx-1] === 'number') ? corridorDoorXs[idx-1] : 612;
            player.map = 'corridor'; player.x = destX; player.y = corridorDoorY; player.vx = 0; player.vy = 0;
            try{ player.teleportIgnoreUntil = Date.now() + 600; }catch(e){}
            mapNameEl.textContent = player.map; scheduleUserUpdate(); addLog('교실에서 복도로 나갑니다.');
            return true;
          }
        }
      }catch(e){}
    }

    // Corridor: user-provided door coordinates (background) interaction
    if(player.map === 'corridor'){
      try{
        const doorCoords = [
          { x: 612,  y: 639, toMap: 'class101' },
          { x: 1303, y: 639, toMap: 'class102' },
          { x: 1937, y: 639, toMap: 'class103' },
          { x: 2610, y: 639, toMap: 'class104' },
          { x: 3263, y: 639, toMap: 'class105' },
          // corridor right-edge exit as Space interaction
          { x: (MAPS.corridor ? MAPS.corridor.width - 40 - 20 : 3940), y: VIEW_H - 120, toMap: 'hallway', spawnTo: { x: 7600, y: VIEW_H - PLAYER_H - 60 } }
        ];
        const pxCenter = player.x + (player.w||32)/2; const pyFeet = player.y + (player.h||48) + SPRITE_Y_OFFSET;
        console.debug && console.debug('DBG: corridorDoorBgCheck', { playerMap: player.map, playerX: Math.round(player.x), playerY: Math.round(player.y), pxCenter: Math.round(pxCenter), pyFeet: Math.round(pyFeet) });
        for(const dc of doorCoords){ const dx2 = Math.abs(pxCenter - dc.x); const dy2 = Math.abs(pyFeet - dc.y);
          // relaxed thresholds: some clients have slightly different VIEW_H/ground offsets
          console.debug && console.debug('DBG: corridorDoorIter', { dcX: dc.x, dcY: dc.y, dx2: Math.round(dx2), dy2: Math.round(dy2) });
          if(dx2 < 160 && dy2 < 360){ try{ if(dc.toMap && MAPS[dc.toMap]){ const spawn = MAPS[dc.toMap].spawnTo || { x: Math.min(Math.max(120, Math.round(MAPS[dc.toMap].width/2 - PLAYER_W/2)), MAPS[dc.toMap].width-200), y: VIEW_H - PLAYER_H - 60 }; // move player into map
              console.debug && console.debug('corridor door check passed', { pxCenter, pyFeet, dc, dx2, dy2 });
              player.map = dc.toMap;
              player.x = spawn.x;
              player.vx = 0; player.vy = 0; player.onGround = false;
              try{
                const destMap = MAPS[dc.toMap]; if(destMap && Array.isArray(destMap.platforms)){
                  for(const p of destMap.platforms){ if(!p) continue; if(p.portalTo || (spawn.x >= p.x && spawn.x <= p.x + (p.w||0))){ player.y = p.y - player.h; player.onGround = true; player.vy = 0; break; } }
                }
              }catch(e){}
              try{ player.teleportIgnoreUntil = Date.now() + 600; }catch(e){}
              mapNameEl.textContent = player.map;
              scheduleUserUpdate(); addLog('교실로 들어갑니다: ' + player.map + ' spawn=' + spawn.x + ',' + spawn.y);
              // debug assist: ensure spawn overlaps are visible in console
              console.debug && console.debug('EnterClass spawn', { map: player.map, spawn: spawn, playerY: player.y, PLAYER_H: PLAYER_H });
          } }catch(e){ console.error('corridor door enter failed', e); } return true; } }
      }catch(e){}
    }

    // Aquarium tablet interaction
    if(player.map === 'aquarium'){
      try{
        const mapDec = MAPS.aquarium && MAPS.aquarium.decors ? MAPS.aquarium.decors : [];
        for(const d of mapDec){ 
          if(!d) continue;
          const tx = d.x; const ty = d.y; const pxCenter = player.x + (player.w||32)/2; const dyFeet = player.y + (player.h||48) + SPRITE_Y_OFFSET; const dx = Math.abs(pxCenter - tx); const dy = Math.abs(dyFeet - ty);
          console.debug && console.debug('DBG: aquariumDecoCheck', { tx, ty, pxCenter: Math.round(pxCenter), dyFeet: Math.round(dyFeet), dx: Math.round(dx), dy: Math.round(dy) });
          if(d.type === 'tablet'){ if(dx < Math.max(220, (d.w||120)) && dy < Math.max(160, (d.h||80))){ openTabletModal(); return true; } }
        }
      }catch(e){}
      // spawn default fish once when entering aquarium
      try{ if(!window._aquariumSeeded){ spawnDefaultFish(); } }catch(e){}
    }

    // hallway vending approximate position (legacy)
    if(player.map === 'hallway'){
      try{
        const mapDec = MAPS.hallway && MAPS.hallway.decors ? MAPS.hallway.decors : [];
        for(const d of mapDec){ if(!d) continue; if(d.type === 'classdoor'){ const pxCenter = player.x + (player.w||32)/2; const dyFeet = player.y + (player.h||48); const dx = Math.abs(pxCenter - d.x); const dy = Math.abs(dyFeet - d.y);
            // Instead of auto-teleporting, only show an entrance hint. Require explicit Space to enter.
            if(dx < Math.max(120, (d.w||80)) && dy < Math.max(160, (d.h||120))){ try{ const target = d.toMap || d.map || null; if(target && MAPS[target]){
                const m = (target && target.match(/class10(\d+)/)) ? target.match(/class10(\d+)/)[1] : null; const label = m ? ('10-' + m) : '교실'; const hint = '[spacebar를 눌러 ' + label + ' 들어가기]'; const hintWorldX = d.x; const hintWorldY = (d.y||0) - 120 + SPRITE_Y_OFFSET; window.__entranceHint = { text: hint, worldX: hintWorldX, worldY: hintWorldY, map: player.map, toMap: target };
                // do not auto-teleport here; let tryInteraction handle Space -> portal logic
              } }catch(e){ console.error('classdoor hint failed', e); } }
          }
        }
      }catch(e){}
      // hallway vending interaction (placeholder): show hint/toast when Space pressed near vending decor
      try{
        const mapDec2 = MAPS.hallway && MAPS.hallway.decors ? MAPS.hallway.decors : [];
        for(const d of mapDec2){ if(!d) continue; if(d.type === 'vending'){
            const pxCenter = player.x + (player.w||32)/2; const dyFeet = player.y + (player.h||48) + SPRITE_Y_OFFSET;
            const dx = Math.abs(pxCenter - d.x); const dy = Math.abs(dyFeet - d.y);
            if(dx < (d.interactRange || 100) && dy < Math.max(160, (d.h||96))){ try{ openVendingModal(d); }catch(e){ console.error('open vending failed', e); } return true; }
        } }
      }catch(e){}
    }

    return false;
  }

  // Apply damage to player (global API)
  function applyDamage(amount){
    try{
      if(!player || player.isDead) return;
      player.hp -= Math.abs(amount);
      // mark hit time to block regen
      player.hitTs = Date.now();
      try{ db.ref('users/' + uid).update({ hp: player.hp, hitTs: player.hitTs }); }catch(e){}
      if(player.hp < 0) player.hp = 0;
      try{ updateSidebarHp(); }catch(e){}
      scheduleUserUpdate();
      try{ // spawn damage particles + float
        spawnParticles(player.x + player.w/2, player.y + player.h/2, 14, { color: '#ff6b6b', speed:2.2, size:2, life:700 });
        damageEffects.push({ x: player.x + player.w/2, y: player.y - 10 + SPRITE_Y_OFFSET, text: '-' + Math.abs(amount), alpha:1.0, dy:-0.6, created: Date.now() });
        cameraShake(4);
      }catch(e){}
      if(player.hp <= 0){ handleDeath(); }
    }catch(e){ console.error('applyDamage error', e); }
  }

  function handleDeath(){
    try{
      if(player.isDead) return;
      player.isDead = true; player.vx = 0; player.vy = 0; player.hp = 0;
      try{ updateSidebarHp(); }catch(e){}
      addLog('당신은 죽었습니다.'); try{ showClickInfo('당신은 죽었습니다.'); }catch(e){}
      // show death overlay with countdown
      const respawnSeconds = 10; let remain = respawnSeconds;
      const d = document.createElement('div'); d.id='dead-overlay'; d.style.position='fixed'; d.style.left='0'; d.style.top='0'; d.style.right='0'; d.style.bottom='0'; d.style.display='flex'; d.style.alignItems='center'; d.style.justifyContent='center'; d.style.zIndex='2000'; d.style.background='rgba(2,6,23,0.6)';
      d.innerHTML = `<div style="background:#fff;padding:18px 28px;border-radius:10px;text-align:center"><div style='font-weight:800;color:#b91c1c;font-size:22px;margin-bottom:8px'>당신은 죽었습니다.</div><div id='respawn-count' style='font-size:16px;color:#0f172a'>${remain}초 뒤 부활합니다.</div></div>`;
      document.body.appendChild(d);
      scheduleUserUpdate();
      // countdown interval
      const intervalId = setInterval(()=>{
        try{
          remain -= 1;
          const el = document.getElementById('respawn-count'); if(el) el.textContent = remain > 0 ? (remain + '초 뒤 부활합니다.') : '곧 부활합니다...';
          if(remain <= 0){ clearInterval(intervalId);
            // revive
            try{ player.isDead = false; player.hp = player.maxHp; try{ updateSidebarHp(); }catch(e){}
              player.map = checkpoint.map; player.x = checkpoint.x; player.y = checkpoint.y; player.vx = 0; player.vy = 0; mapNameEl.textContent = player.map;
              const ol = document.getElementById('dead-overlay'); if(ol && ol.parentNode) ol.parentNode.removeChild(ol);
              addLog('체크포인트에서 부활했습니다.'); try{ showClickInfo('부활했습니다.'); }catch(e){}
              scheduleUserUpdate(); }catch(e){ console.error('revive error', e); }
          }
        }catch(e){ console.error('death countdown error', e); }
      }, 1000);
    }catch(e){ console.error('handleDeath error', e); }
  }

  // Helper: recent timestamp
  function isRecent(ts, windowMs){ return (typeof ts === 'number') && (Date.now() - ts <= windowMs); }

  // Listen for changes to our own DB record so external hits (다른 플레이어가 데미지를 적용) 반영
  userRef.on('value', snap=>{
    try{
      const data = snap.val(); if(!data) return;
      if(typeof data.hp === 'number' && data.hp !== player.hp){ player.hp = data.hp; try{ if(hpFillEl) hpFillEl.style.width = Math.max(0, Math.min(100, Math.round(player.hp / player.maxHp * 100))) + '%'; }catch(e){} try{ if(hpTextEl) hpTextEl.textContent = player.hp + '/' + player.maxHp; }catch(e){} }
      if(typeof data.isDead === 'boolean' && data.isDead && !player.isDead){ handleDeath(); }
      if(typeof data.hitTs === 'number'){ player.hitTs = data.hitTs; }
      if(typeof data.attackTs === 'number'){ player.attackTs = data.attackTs; }
      if(typeof data.lastAttack === 'number'){ player.lastAttack = data.lastAttack; }
      // update items if present (array or object form)
      if(data.items){ try{ if(Array.isArray(data.items)) player.items = data.items; else if(typeof data.items === 'object') player.items = Object.values(data.items); else player.items = []; try{ updateInventoryUI(); }catch(e){} }catch(e){ console.error('apply items update failed', e); } }
      // update gold if present
      if(typeof data.gold === 'number'){ try{ player.gold = data.gold; try{ updateGoldDisplay(); }catch(e){} }catch(e){} }
    }catch(e){ console.error('userRef on value handler error', e); }
  });

  // Passive regen: if not hit for 15s, heal 10 HP per second (send DB update)
  setInterval(()=>{
    try{
      if(!player || player.isDead) return;
      const lastHit = player.hitTs || 0; const since = Date.now() - lastHit;
      if(since >= 15000 && player.hp < player.maxHp){
        const heal = 10;
        player.hp = Math.min(player.maxHp, (player.hp || 0) + heal);
        // show floating green ++ effect above player
        healEffects.push({ x: player.x + player.w/2, y: player.y - 40 + SPRITE_Y_OFFSET, uid: uid, alpha: 1.0, dy: -0.6, created: Date.now(), text: '+' + heal });
        try{ updateSidebarHp(); }catch(e){}
        try{ db.ref('users/' + uid).update({ hp: player.hp, healTs: Date.now() }); }catch(e){}
        scheduleUserUpdate();
      }
    }catch(e){ console.error('regen interval error', e); }
  }, 1000);

  // Start an attack: animate locally, notify DB, and attempt to damage nearby players
  function startAttack(){
    try{
      if(!player || player.isDead) return;
      // disable attacks inside corridor and classrooms (do not show toast here)
      if(player.map === 'corridor' || (typeof player.map === 'string' && player.map.indexOf('class10') === 0)){
        return;
      }
      const now = Date.now();
      // Cooldown check (bypass when in dev mode)
      const last = player.lastAttack || 0; const since = now - last;
      if(!player.isDev && last && since < ATTACK_COOLDOWN){ const remainMs = ATTACK_COOLDOWN - since; const sec = Math.ceil(remainMs/1000); try{ showClickInfo('타격 쿨타임: ' + (remainMs/1000).toFixed(1) + 's'); }catch(e){} return; }
      player.lastAttack = now; player.attackTs = now; // local flags
      try{ db.ref('users/' + uid).update({ attackTs: now, lastAttack: now }); }catch(e){}
      // check other users in same map and in front
      for(const k in otherUsers){ if(k === uid) continue; const u = otherUsers[k]; if(!u) continue; if(u.map !== player.map) continue;
          const uw = (typeof u.w === 'number') ? u.w : PLAYER_W; const uh = (typeof u.h === 'number') ? u.h : PLAYER_H;
          const uxCenter = (u.x || 0) + uw/2; const pxCenter = player.x + player.w/2;
          const inFront = (player.facing > 0) ? (uxCenter > pxCenter && uxCenter - pxCenter <= ATTACK_RANGE) : (uxCenter < pxCenter && pxCenter - uxCenter <= ATTACK_RANGE);
          const yOverlap = Math.abs((u.y + uh/2) - (player.y + player.h/2)) < Math.max(48, player.h/2);
          if(inFront && yOverlap){
            const prevHp = (typeof u.hp === 'number') ? u.hp : 100; const newHp = Math.max(0, prevHp - ATTACK_DAMAGE);
            try{ db.ref('users/' + k).update({ hp: newHp, isDead: newHp <= 0, hitTs: Date.now() }); }catch(e){ console.error('apply remote hit failed', e); }
            addLog('타격: ' + (u.nick || k) + ' -' + ATTACK_DAMAGE);
            try{
              // spawn hit particles at target
              if(window.__showVisuals !== false){ spawnParticles((u.x || 0) + uw/2, (u.y || 0) + uh/2, 10, { color: '#ff6b6b', speed: 2.2, size: 2, life: 700 }); cameraShake(2.5); }
              // local damage text for visual (will render on local clients when otherUsers updated)
            }catch(e){}
          }
      }
      // clear attack flag after duration
      setTimeout(()=>{ try{ player.attackTs = null; db.ref('users/' + uid).update({ attackTs: null }); }catch(e){} }, ATTACK_DURATION + 20);
    }catch(e){ console.error('startAttack error', e); }
  }

  // ---------------- Principal (Gemini) interaction ----------------
  let geminiApiKey = null;
  async function handlePrincipalInteraction(){
    if(!geminiApiKey){ geminiApiKey = prompt('교장과 대화하려면 Gemini API 키를 입력하세요 (임시 저장)') || ''; if(!geminiApiKey){ addLog('교장: API 키가 제공되지 않았습니다.'); return; } }
    const question = prompt('교장님께 무엇을 물어보시겠습니까?'); if(!question) return;
    addLog('교장에게 질문: '+question);
    try{ const ans = await callGemini(question); addChat('교장', '교장: '+ans); }catch(e){ addLog('교장 API 실패: '+e.message); }
  }

  async function callGemini(question){
    // send to local proxy at /api/gemini (server should be run separately with GEMINI_KEY env var)
    const proxy = '/api/gemini';
    const body = { prompt:{ messages:[ {role:'system',content:'너는 학교 RPG의 교장선생님이야. 허허, ~하구나 말투를 쓰며 2문장 이내로 짧게 대답해.'}, {role:'user',content:question} ] }, maxOutputTokens:120 };
    try{
      const res = await fetch(proxy, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if(!res.ok) throw new Error('프록시 응답 '+res.status);
      const data = await res.json();
      try{ if(data && data.candidates && data.candidates[0] && data.candidates[0].content) return data.candidates[0].content[0].text || JSON.stringify(data.candidates[0].content); if(data.output && data.output[0] && data.output[0].content) return data.output[0].content[0].text; }catch(e){}
      return JSON.stringify(data).slice(0,200);
    }catch(e){
      // fallback to direct call if proxy unavailable
      const endpoint = 'https://api.generative.google/v1/models/gemini-1.5-flash:generate';
      const fallbackRes = await fetch(endpoint, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+geminiApiKey }, body: JSON.stringify(body) });
      if(!fallbackRes.ok) throw new Error('API 응답 '+fallbackRes.status);
      const fallbackData = await fallbackRes.json();
      try{ if(fallbackData && fallbackData.candidates && fallbackData.candidates[0] && fallbackData.candidates[0].content) return fallbackData.candidates[0].content[0].text || JSON.stringify(fallbackData.candidates[0].content); if(fallbackData.output && fallbackData.output[0] && fallbackData.output[0].content) return fallbackData.output[0].content[0].text; }catch(e){}
      return JSON.stringify(fallbackData).slice(0,200);
    }
  }

  // ---------------- NPC (정보 교사) chat modal and interaction ----------------
  // Create modal DOM (hidden) for NPC chat; portrait on left, chat log + input on right
  (function createNpcChatModal(){
    const modal = document.createElement('div'); modal.id = 'npc-chat-modal';
    modal.style.position = 'fixed'; modal.style.left = '50%'; modal.style.top = '50%'; modal.style.transform = 'translate(-50%,-50%)';
    modal.style.width = '680px'; modal.style.maxWidth = '94vw'; modal.style.background = '#fff'; modal.style.borderRadius = '10px'; modal.style.boxShadow = '0 12px 36px rgba(2,6,23,0.28)';
    modal.style.zIndex = 2200; modal.style.display = 'none'; modal.style.padding = '12px'; modal.style.fontFamily = FONT_FAMILY;
    modal.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:124px;flex:0 0 124px;display:flex;flex-direction:column;align-items:center">
          <img id="npc-portrait" src="npc0_p.png" style="width:96px;height:auto;border-radius:8px;border:2px solid #ddd;background:#fff" />
          <div style="font-weight:800;margin-top:8px">정보 교사</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column">
          <div id="npc-chat-log" style="height:240px;overflow:auto;padding:8px;background:#f6f9ff;border-radius:8px;border:1px solid rgba(2,6,23,0.04)"></div>
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
            <input id="npc-chat-input" placeholder="메시지를 입력하세요" style="flex:1;padding:8px;border-radius:6px;border:1px solid #e2e8f0" />
            <button id="npc-chat-send" style="padding:8px 10px;border-radius:6px;background:#2563eb;color:#fff;border:none">전송</button>
            <button id="npc-chat-close" style="padding:8px 10px;border-radius:6px;background:#eef2ff;border:1px solid #dbeafe">닫기</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // NOTE: fish gallery thumbnails removed per user request
    // wire up buttons
    document.getElementById('npc-chat-close').addEventListener('click', closeNpcChat);
    document.getElementById('npc-chat-send').addEventListener('click', ()=>{ sendNpcChatMessage(); });
    document.getElementById('npc-chat-input').addEventListener('keydown', (e)=>{ if(e.key === 'Enter') { e.preventDefault(); sendNpcChatMessage(); } });
  })();

  // Create Tablet drawing modal (hidden) for aquarium fish creation
  (function createTabletModal(){
    const modal = document.createElement('div'); modal.id = 'tablet-modal';
    modal.style.position='fixed'; modal.style.left='50%'; modal.style.top='50%'; modal.style.transform='translate(-50%,-50%)'; modal.style.zIndex=23000;
    modal.style.background='#fff'; modal.style.padding='12px'; modal.style.borderRadius='10px'; modal.style.boxShadow='0 12px 36px rgba(0,0,0,0.28)'; modal.style.display='none'; modal.style.fontFamily = FONT_FAMILY;
    modal.innerHTML = `
      <div style="font-weight:800;font-size:16px;margin-bottom:8px">물고기 추가하기</div>
      <div style="display:flex;gap:12px">
        <canvas id="fish-canvas" width="360" height="240" style="border:1px solid #e6eef8;background:#fff"></canvas>
        <div style="display:flex;flex-direction:column;gap:8px;min-width:160px">
          <label>브러쉬 색</label>
          <input id="fish-color" type="color" value="#ff6b6b" />
          <label>굵기</label>
          <input id="fish-size" type="range" min="1" max="24" value="6" />
          <button id="fish-clear" style="padding:8px">지우기</button>
          <div style="flex:1"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="fish-cancel" style="padding:8px">취소</button>
            <button id="fish-add" style="padding:8px;background:#10b981;color:#fff;border:none;border-radius:6px">추가하기</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // wiring
    const canvasEl = document.getElementById('fish-canvas'); const ctxFish = canvasEl.getContext('2d'); let drawing=false; let lastX=0,lastY=0; const colorEl = document.getElementById('fish-color'); const sizeEl = document.getElementById('fish-size');
    function setComposite(){ ctxFish.lineCap='round'; ctxFish.lineJoin='round'; ctxFish.strokeStyle = colorEl.value; ctxFish.lineWidth = parseInt(sizeEl.value,10); }
    setComposite(); colorEl.addEventListener('input', setComposite); sizeEl.addEventListener('input', setComposite);
    canvasEl.addEventListener('mousedown', (e)=>{ drawing=true; const r=canvasEl.getBoundingClientRect(); lastX = e.clientX - r.left; lastY = e.clientY - r.top; });
    window.addEventListener('mousemove', (e)=>{ if(!drawing) return; const r=canvasEl.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top; ctxFish.beginPath(); ctxFish.moveTo(lastX,lastY); ctxFish.lineTo(x,y); ctxFish.stroke(); lastX = x; lastY = y; });
    window.addEventListener('mouseup', ()=>{ drawing=false; });
    document.getElementById('fish-clear').addEventListener('click', ()=>{ ctxFish.clearRect(0,0,canvasEl.width,canvasEl.height); ctxFish.fillStyle='#ffffff00'; });
    document.getElementById('fish-cancel').addEventListener('click', ()=>{ modal.style.display='none'; });
    document.getElementById('fish-add').addEventListener('click', ()=>{
      try{
        // find tablet decor world pos
        const decs = MAPS.aquarium && MAPS.aquarium.decors ? MAPS.aquarium.decors : [];
        let sx = player.x + 120, sy = VIEW_H - PLAYER_H - 80;
        for(const d of decs){ if(d && d.type === 'tablet'){ sx = d.x + 20; sy = d.y + (d.h? d.h/2 : 0); break; } }
        // always use drawn canvas (gallery removed)
        const recBase = { x: sx, y: sy, vx: (Math.random()*0.8 + 0.6), dir: (Math.random()>0.5?1:-1), scale: (1.8 + Math.random()*0.4), bobAmp: (6 + Math.random()*8), bobSpeed: (0.6 + Math.random()*0.8) };
        const data = canvasEl.toDataURL('image/png'); const rec = Object.assign({}, recBase, { src: data, kind: 'drawn' }); dbPushAquariumFish(rec); addLog('물고기 추가 요청 전송 (그림판)');
      }catch(e){ console.error('fish add failed', e); addLog('물고기 추가 실패'); }
      modal.style.display='none';
    });
    // expose helper to open modal from game code
    try{ window.openTabletModal = function(){ modal.style.display = 'block'; // clear small canvas to transparent white
        try{ ctxFish.clearRect(0,0,canvasEl.width,canvasEl.height); ctxFish.fillStyle = '#ffffff00'; }catch(e){}
        try{ canvasEl.focus(); }catch(e){} }; }catch(e){}
  })();

  // openTabletModal fallback if called before modal creation
  if(typeof window.openTabletModal === 'undefined') window.openTabletModal = function(){ const m = document.getElementById('tablet-modal'); if(m) m.style.display='block'; };

  function openNpcChat(){
    const modal = document.getElementById('npc-chat-modal'); if(!modal) return;
    modal.style.display = 'block';
    const logEl = document.getElementById('npc-chat-log'); if(logEl) { logEl.innerHTML = ''; }
    // initial NPC greeting
    appendNpcChatMessage('npc', '안녕하세요! 무엇을 도와드릴까요?');
    const input = document.getElementById('npc-chat-input'); if(input){ input.value = ''; input.focus(); }
  }

  function closeNpcChat(){ const modal = document.getElementById('npc-chat-modal'); if(modal) modal.style.display = 'none'; }

  function appendNpcChatMessage(who, text){
    const logEl = document.getElementById('npc-chat-log'); if(!logEl) return;
    const wrap = document.createElement('div'); wrap.style.marginBottom = '8px';
    if(who === 'npc'){
      wrap.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-start"><img src="npc0_p.png" style="width:40px;height:40px;border-radius:6px;border:1px solid rgba(0,0,0,0.06)"/><div style="background:#fff;padding:8px;border-radius:8px;border:1px solid rgba(2,6,23,0.04);max-width:84%">${escapeHtml(text)}</div></div>`;
    } else {
      wrap.style.textAlign = 'right'; wrap.innerHTML = `<div style="display:inline-block;background:#2563eb;color:#fff;padding:8px;border-radius:8px;max-width:84%">${escapeHtml(text)}</div>`;
    }
    logEl.appendChild(wrap); logEl.scrollTop = logEl.scrollHeight;
  }

  function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function sendNpcChatMessage(){
    const input = document.getElementById('npc-chat-input'); if(!input) return; const txt = (input.value||'').trim(); if(!txt) return;
    appendNpcChatMessage('user', txt);
    input.value = ''; input.disabled = true; document.getElementById('npc-chat-send').disabled = true;
    try{
      if(!geminiApiKey){ geminiApiKey = prompt('대화를 위해 Gemini API 키를 입력하세요 (임시 저장)') || ''; if(!geminiApiKey){ appendNpcChatMessage('npc','(API 키가 없어 응답할 수 없습니다)'); input.disabled = false; document.getElementById('npc-chat-send').disabled = false; return; } }
      const reply = await callGeminiNpc(txt);
      appendNpcChatMessage('npc', reply);
    }catch(e){ appendNpcChatMessage('npc', '응답 실패: ' + (e && e.message ? e.message : String(e))); }
    finally{ input.disabled = false; document.getElementById('npc-chat-send').disabled = false; input.focus(); }
  }

  async function callGeminiNpc(question){
    const proxy = '/api/gemini';
    const body = { prompt:{ messages:[ {role:'system',content:'너는 학교의 정보 교사 "정보 교사"이다. 친절하고 이해하기 쉽게 설명하며, 한국어로 대답하되 길지 않게(2-3문장) 답변해라.'}, {role:'user',content:question} ] }, maxOutputTokens:240 };
    try{
      const res = await fetch(proxy, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if(!res.ok) throw new Error('프록시 응답 '+res.status);
      const data = await res.json();
      try{ if(data && data.candidates && data.candidates[0] && data.candidates[0].content) return data.candidates[0].content[0].text || JSON.stringify(data.candidates[0].content); if(data.output && data.output[0] && data.output[0].content) return data.output[0].content[0].text; }catch(e){}
      return JSON.stringify(data).slice(0,300);
    }catch(e){
      // fallback to direct call
      const endpoint = 'https://api.generative.google/v1/models/gemini-1.5-flash:generate';
      const res = await fetch(endpoint, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+geminiApiKey }, body: JSON.stringify(body) });
      if(!res.ok) throw new Error('API 응답 '+res.status);
      const data = await res.json();
      try{ if(data && data.candidates && data.candidates[0] && data.candidates[0].content) return data.candidates[0].content[0].text || JSON.stringify(data.candidates[0].content); if(data.output && data.output[0] && data.output[0].content) return data.output[0].content[0].text; }catch(e){}
      return JSON.stringify(data).slice(0,300);
    }
  }

  // Debug helper: test Gemini connectivity from browser and log detailed errors
  window.testGeminiConnection = async function(){
    try{
      const key = geminiApiKey || (prompt('테스트용 Gemini API 키를 입력하세요 (임시)')||'');
      if(!key){ console.warn('No Gemini key provided'); addLog('Gemini 테스트: 키 없음'); return; }
      addLog('Gemini 테스트: 요청 전송 중...');
      const endpoint = 'https://api.generative.google/v1/models/gemini-1.5-flash:generate';
      const body = { prompt:{ messages:[ {role:'system',content:'테스트용 연결 확인'}, {role:'user',content:'ping'} ] }, maxOutputTokens:20 };
      const res = await fetch(endpoint, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+key }, body: JSON.stringify(body) });
      console.log('fetch returned', res);
      if(!res.ok){ const txt = await res.text().catch(()=>'<no body>'); addLog('Gemini 테스트 실패: HTTP '+res.status + ' ' + res.statusText + ' — ' + txt); console.error('Gemini bad status', res.status, res.statusText, txt); return; }
      const data = await res.json(); addLog('Gemini 테스트 성공: 응답 도착 (콘솔 확인)'); console.log('Gemini response', data);
    }catch(err){ addLog('Gemini 테스트 오류: ' + (err && err.message ? err.message : String(err))); console.error('Gemini test error', err); }
  };

  function handleNpcInteraction(){
    try{
      openNpcChat();
    }catch(e){ console.error('handleNpcInteraction error', e); }
  }

  // ---------------- Rendering ----------------
  // Sprite sheet 기반 플레이어 렌더러 (스케일/플립 처리)
  function drawSpritePlayer(x,y,facing,skinRowLocal, u){
    // apply global visual offset so sprites sit lower relative to collision box
    y = y + SPRITE_Y_OFFSET;
    // helper: draw image while increasing width only; keeps height unchanged
    // W_MULT will be set after skinTypeLocal is known
    let W_MULT = 1.0;
    function drawImgScaled(img, drawX, drawY, drawW, drawH){
      const finalW = Math.max(1, Math.round(drawW * W_MULT));
      const finalH = drawH; // preserve height
      const finalX = drawX + Math.round((drawW - finalW) / 2);
      try{
        if(facing < 0){ ctx.save(); ctx.translate(finalX + finalW, drawY); ctx.scale(-1,1); ctx.drawImage(img,0,0,(img.width||1),(img.height||1),0,0,finalW,finalH); ctx.restore(); }
        else { ctx.drawImage(img,0,0,(img.width||1),(img.height||1),finalX,drawY,finalW,finalH); }
      }catch(e){ /* ignore draw errors */ }
    }
    function drawSpriteSheetScaled(sheet, sx, sy, sW, sH, drawX, drawY, drawW, drawH){
      const finalW = Math.max(1, Math.round(drawW * W_MULT));
      const finalH = drawH;
      const finalX = drawX + Math.round((drawW - finalW) / 2);
      try{
        if(facing < 0){ ctx.save(); ctx.translate(finalX + finalW, drawY); ctx.scale(-1,1); ctx.drawImage(sheet, sx, sy, sW, sH, 0,0, finalW, finalH); ctx.restore(); }
        else { ctx.drawImage(sheet, sx, sy, sW, sH, finalX, drawY, finalW, finalH); }
      }catch(e){ }
    }
    // skinRowLocal: 0 남학생, 1 여학생
    // 우선순위: u.skinType(서버) -> 전달된 skinRowLocal 파라미터 -> 로컬 player.skinType -> 기본 'm'
    const skinTypeLocal = (u && u.skinType) ? u.skinType : (typeof skinRowLocal === 'number' ? (skinRowLocal === 1 ? 'f' : 'm') : (player && player.skinType ? player.skinType : 'm'));
    // apply female-only global width multiplier after determining skin type
    if(skinTypeLocal === 'f') W_MULT = (typeof SPRITE_DRAW_WIDTH_MULT === 'number') ? SPRITE_DRAW_WIDTH_MULT : 1.0;
    const vxLocal = (u?u.vx:player.vx); const vyLocal = (u?u.vy:player.vy); const onGroundLocal = (u?u.onGround:player.onGround);
    const isCrouchLocal = (u ? !!u.isCrouching : !!player.isCrouching);
    // Determine state: jump > run > idle
    const isJump = Math.abs(vyLocal) > 1 && !onGroundLocal;
    const isRun = Math.abs(vxLocal) > 0.3 && onGroundLocal;

    // draw soft drop shadow under the sprite (screen coords: x,y already adjusted by caller)
    try{
      const shadowCx = Math.round(x + player.w/2);
      const shadowCy = Math.round(y + player.h - 8);
      // shadow scales: on ground = full, airborne = smaller based on vertical speed
      const speedFactor = Math.min(1, Math.abs(vyLocal) / 18);
      const shadowScale = onGroundLocal ? 1.0 : Math.max(0.35, 1 - speedFactor);
      const baseW = player.w * (isCrouchLocal ? 0.6 : 1.0);
      const rx = Math.max(8, Math.round((baseW * 0.5) * (0.9 * shadowScale)));
      const ry = Math.max(4, Math.round(rx * 0.35));
      const alpha = Math.max(0.18, 0.6 * shadowScale);
      // draw two-layer ellipse for soft look
      ctx.save(); ctx.translate(0,0); ctx.fillStyle = 'rgba(0,0,0,' + (alpha*0.6).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(shadowCx, shadowCy, Math.round(rx*1.15), Math.round(ry*1.2), 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,' + alpha.toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(shadowCx, shadowCy, rx, ry, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }catch(e){}

    // If user/entity is dead, draw dead pose if available
    const isDeadLocal = (u ? (!!u.isDead) : !!player.isDead) || (u ? (typeof u.hp === 'number' && u.hp <= 0) : (player.hp <= 0));
      if(isDeadLocal){
      // Draw dead pose using original image dimensions (no horizontal stretching)
      if((u && u.skinType === 'f') || (!u && player.skinType === 'f')){
        if(femaleDeadLoaded){ const imgW = femaleDeadImg.width, imgH = femaleDeadImg.height; const fitScale = Math.min(player.w / imgW, player.h / imgH); const scale = Math.min(0.9, Math.max(0.4, fitScale * 0.5)); let drawW = Math.max(1, Math.round(imgW * scale)); let drawH = Math.max(1, Math.round(imgH * scale)); drawW = Math.max(1, Math.round(drawW * FEMALE_HIT_DEAD_MULT)); drawH = Math.max(1, Math.round(drawH * FEMALE_HIT_DEAD_MULT)); const drawX = x + Math.round((player.w - drawW)/2); const drawY = y + (player.h - drawH);
        if(facing<0){ ctx.save(); ctx.translate(drawX + drawW, drawY); ctx.scale(-1,1); ctx.drawImage(femaleDeadImg,0,0,imgW,imgH,0,0,drawW,drawH); ctx.restore(); } else ctx.drawImage(femaleDeadImg,0,0,imgW,imgH,drawX,drawY,drawW,drawH); return; }
      } else {
        if(maleDeadLoaded){ const imgW = maleDeadImg.width, imgH = maleDeadImg.height; const fitScale = Math.min(player.w / imgW, player.h / imgH); const scale = Math.min(0.9, Math.max(0.4, fitScale * 0.5)); let drawW = Math.max(1, Math.round(imgW * scale)); let drawH = Math.max(1, Math.round(imgH * scale)); drawW = Math.max(1, Math.round(drawW * MALE_HIT_DEAD_MULT)); drawH = Math.max(1, Math.round(drawH * MALE_HIT_DEAD_MULT)); const drawX = x + Math.round((player.w - drawW)/2); const drawY = y + (player.h - drawH);
        if(facing<0){ ctx.save(); ctx.translate(drawX + drawW, drawY); ctx.scale(-1,1); ctx.drawImage(maleDeadImg,0,0,imgW,imgH,0,0,drawW,drawH); ctx.restore(); } else ctx.drawImage(maleDeadImg,0,0,imgW,imgH,drawX,drawY,drawW,drawH); return; }
      }
      // fallback to gray box if no dead image
      ctx.fillStyle = '#6b7280'; ctx.fillRect(x,y,player.w,player.h); return;
    }

    // Handle hit and attack visuals: hit takes precedence and will replace primary sprite with hit image (m6/f6), then attack
    try{
      const attackTs = u ? u.attackTs : player.attackTs;
      const hitTs = u ? u.hitTs : player.hitTs;
      const skinIsFemale = (skinTypeLocal === 'f');
      // If recently hit, replace primary sprite with hit image
      if(isRecent(hitTs, HIT_ANIM_DURATION)){
        const img = skinIsFemale ? femaleHitImg : maleHitImg;
        const loaded = skinIsFemale ? femaleHitLoaded : maleHitLoaded;
        if(loaded && img.width > 0){
          const imgW = img.width, imgH = img.height;
          const fitScale = Math.min((player.w * 0.9) / imgW, (player.h * 0.9) / imgH);
          const scale = Math.max(0.45, Math.min(0.95, fitScale * 0.85));
          let drawW = Math.max(1, Math.round(imgW * scale));
          let drawH = Math.max(1, Math.round(imgH * scale));
          // apply sex-specific multiplier
          if(skinIsFemale){ drawW = Math.max(1, Math.round(drawW * FEMALE_HIT_DEAD_MULT)); drawH = Math.max(1, Math.round(drawH * FEMALE_HIT_DEAD_MULT)); }
          else { drawW = Math.max(1, Math.round(drawW * MALE_HIT_DEAD_MULT)); drawH = Math.max(1, Math.round(drawH * MALE_HIT_DEAD_MULT)); }
          const drawX = x + Math.round((player.w - drawW) / 2);
          const drawY = y + Math.round((player.h - drawH) / 2);
          if(facing < 0){ ctx.save(); ctx.translate(drawX + drawW, drawY); ctx.scale(-1,1); ctx.drawImage(img,0,0,imgW,imgH,0,0,drawW,drawH); ctx.restore(); }
          else { ctx.drawImage(img,0,0,imgW,imgH,drawX,drawY,drawW,drawH); }
          return; // don't draw underlying frames while showing hit pose
        }
      }
      // If attacking recently, replace the entity's primary sprite with the attack image (no underlying walk/jump)
      if(isRecent(attackTs, ATTACK_DURATION)){
        const img = skinIsFemale ? femaleAttackImg : maleAttackImg;
        const loaded = skinIsFemale ? femaleAttackLoaded : maleAttackLoaded;
        if(loaded && img.width > 0){
          const imgW = img.width, imgH = img.height;
          const fitScale = Math.min((player.w * 1.0) / imgW, (player.h * 1.0) / imgH);
          const scale = Math.max(0.45, Math.min(0.95, fitScale * 0.8));
          let drawW = Math.max(1, Math.round(imgW * scale));
          let drawH = Math.max(1, Math.round(imgH * scale));
          if(skinIsFemale){ // enlarge female attack visuals
            drawW = Math.max(1, Math.round(drawW * FEMALE_ATTACK_MULT));
            drawH = Math.max(1, Math.round(drawH * FEMALE_ATTACK_MULT));
          }
          const drawY = y + Math.round((player.h - drawH) / 2);
          const baseCenterX = x + Math.round((player.w - drawW) / 2);
          const forwardOffset = Math.round(player.w * 0.08); // 조금만 앞으로 이동
          const drawX = (facing > 0) ? (baseCenterX + forwardOffset) : (baseCenterX - forwardOffset);
          if(facing < 0){ ctx.save(); ctx.translate(drawX + drawW, drawY); ctx.scale(-1,1); ctx.drawImage(img,0,0,imgW,imgH,0,0,drawW,drawH); ctx.restore(); }
          else { ctx.drawImage(img,0,0,imgW,imgH,drawX,drawY,drawW,drawH); }
          return; // don't draw underlying walk/jump frames while attacking
        }
      }
    }catch(e){ /* non-fatal drawing error */ }

    // male images
    if(skinTypeLocal === 'm'){
      // crouch-walk (crouching and moving)
      if(isCrouchLocal && isRun){
        // draw crouch-walk frames preserving image aspect (avoid vertical squash)
        if(maleCrouchWalkFrames && maleCrouchWalkFrames.length > 0){
          const idx = Math.floor((Date.now()/CROUCH_FRAME_MS) % maleCrouchWalkFrames.length);
          const img = maleCrouchWalkFrames[idx];
          if(img && img.width > 0){
            const imgW = img.width, imgH = img.height;
            // keep image aspect, fit to player width, cap height to player.h
            const baseW = player.w;
            const drawH = Math.max(8, Math.min(player.h, Math.round(imgH * (baseW / imgW))));
            const baseX = x;
            const baseY = y + (player.h - drawH);
            // apply adjustable width/height multipliers for base vs frame images
            try{
              const src = (img.src || '').toLowerCase();
              const isFrame = src.indexOf('m4_') !== -1; // e.g. m4_0.png
              const widthMult = isFrame ? MALE_CROUCHWALK_FRAME_W_MULT : MALE_CROUCHWALK_BASE_W_MULT;
              const heightMult = isFrame ? MALE_CROUCHWALK_FRAME_H_MULT : MALE_CROUCHWALK_BASE_H_MULT;
              const prevW = W_MULT;
              W_MULT = (typeof widthMult === 'number') ? widthMult : W_MULT;
              const adjDrawH = Math.max(8, Math.min(player.h, Math.round(drawH * (typeof heightMult === 'number' ? heightMult : 1))));
              // compute final Y based on adjusted draw height; apply small upward nudge for base m4.png
              let yAdjust = 0;
              try{ const lowerSrc = src || ''; if(!isFrame && lowerSrc.indexOf('m4.png') !== -1){ yAdjust = (typeof MALE_M4_Y_ADJUST === 'number') ? MALE_M4_Y_ADJUST : 0; } }catch(e){}
              const finalBaseY = y + (player.h - adjDrawH) + yAdjust;
              drawImgScaled(img, baseX, finalBaseY, baseW, adjDrawH);
              W_MULT = prevW;
            }catch(e){ drawImgScaled(img, baseX, baseY, baseW, drawH); }
            return;
          }
        }
        if(maleCrouchWalkLoaded){ const img = maleCrouchWalkImg; const imgW = img.width, imgH = img.height; const baseW = player.w; const drawH = Math.max(8, Math.min(player.h, Math.round(imgH * (baseW / imgW)))); const baseX = x; const baseY = y + (player.h - drawH); try{ const prevW = W_MULT; W_MULT = (typeof MALE_CROUCHWALK_BASE_W_MULT === 'number') ? MALE_CROUCHWALK_BASE_W_MULT : W_MULT; const adjDrawH = Math.max(8, Math.min(player.h, Math.round(drawH * (typeof MALE_CROUCHWALK_BASE_H_MULT === 'number' ? MALE_CROUCHWALK_BASE_H_MULT : 1)))); drawImgScaled(img, baseX, baseY, baseW, adjDrawH); W_MULT = prevW; }catch(e){ drawImgScaled(img, baseX, baseY, baseW, drawH); } return; }
      }
      // crouch idle
      if(isCrouchLocal && maleCrouchLoaded){
        const img = maleCrouchImg; const imgW = img.width, imgH = img.height;
        // slightly enlarge idle crouch width and center it, preserve aspect and cap height
        const baseW = Math.max(1, Math.round(player.w * CROUCH_IDLE_WIDTH_MULT));
        const drawH = Math.max(8, Math.min(player.h, Math.round(imgH * (baseW / imgW))));
        const baseX = x + Math.round((player.w - baseW) / 2);
        const baseY = y + (player.h - drawH);
        drawImgScaled(img, baseX, baseY, baseW, drawH);
        return;
      }
      if(isJump && maleJumpLoaded){
        const img = maleJumpImg; const imgW = img.width, imgH = img.height;
        const baseW = player.w;
        const naturalH = Math.round(imgH * (baseW / imgW));
        const drawH = Math.max(Math.round(player.h * JUMP_MIN_HEIGHT_FRAC), Math.min(player.h, naturalH));
        const baseX = x + Math.round((player.w - baseW) / 2);
        const baseY = y + (player.h - drawH);
        drawImgScaled(img, baseX, baseY, baseW, drawH);
        return;
      }
      if(isRun){
        if(maleRunFrames && maleRunFrames.length > 0){ const idx = Math.floor((Date.now()/RUN_FRAME_MS) % maleRunFrames.length); const img = maleRunFrames[idx]; if(img && img.width>0){ drawImgScaled(img, x, y, player.w, player.h); return; } }
        if(maleRunLoaded){ drawImgScaled(maleRunImg, x, y, player.w, player.h); return; }
      }
      if(maleLoaded){ drawImgScaled(maleImg, x, y, player.w, player.h); return; }
    }
    // female images
    if(skinTypeLocal === 'f'){
      const femaleVisualW = Math.max(1, Math.round(player.w * FEMALE_W_MULT));
      const femaleVisualH = Math.max(1, Math.round(player.h * FEMALE_H_MULT));
      // crouch-walk (female)
      if(isCrouchLocal && isRun){
        if(femaleCrouchWalkFrames && femaleCrouchWalkFrames.length > 0){
          const idx = Math.floor((Date.now()/CROUCH_FRAME_MS) % femaleCrouchWalkFrames.length);
          const img = femaleCrouchWalkFrames[idx];
          if(img && img.width > 0){
            const imgW = img.width, imgH = img.height;
            const drawW = Math.max(1, Math.round(femaleVisualW * FEMALE_CROUCHWALK_W_MULT));
            const drawH = Math.max(8, Math.min(Math.round(player.h * 1.5), Math.round(imgH * (drawW / imgW) * FEMALE_CROUCHWALK_H_MULT)));
            const drawX = x + Math.round((player.w - drawW) / 2);
            const drawY = y + (player.h - drawH) + FEMALE_Y_OFFSET + FEMALE_CROUCH_Y_OFFSET;
            if(facing < 0){ ctx.save(); ctx.translate(drawX + drawW, drawY); ctx.scale(-1,1); ctx.drawImage(img,0,0,imgW,imgH,0,0,drawW,drawH); ctx.restore(); }
            else { ctx.drawImage(img,0,0,imgW,imgH,drawX,drawY,drawW,drawH); }
            return;
          }
        }
        if(femaleCrouchWalkLoaded){ const img = femaleCrouchWalkImg; const imgW = img.width, imgH = img.height; const drawW = Math.max(1, Math.round(femaleVisualW * FEMALE_CROUCHWALK_W_MULT)); const drawH = Math.max(8, Math.min(Math.round(player.h * 1.5), Math.round(imgH * (drawW / imgW) * FEMALE_CROUCHWALK_H_MULT))); const drawX = x + Math.round((player.w - drawW) / 2); const drawY = y + (player.h - drawH) + FEMALE_Y_OFFSET + FEMALE_CROUCH_Y_OFFSET; if(facing < 0){ ctx.save(); ctx.translate(drawX + drawW, drawY); ctx.scale(-1,1); ctx.drawImage(img,0,0,imgW,imgH,0,0,drawW,drawH); ctx.restore(); } else { ctx.drawImage(img,0,0,imgW,imgH,drawX,drawY,drawW,drawH); } return; }
      }
      // crouch idle (female)
      if(isCrouchLocal && femaleCrouchLoaded){
        const img = femaleCrouchImg; const imgW = img.width, imgH = img.height;
        let drawW = Math.max(1, Math.round(femaleVisualW * CROUCH_IDLE_WIDTH_MULT));
        try{ if((img.src||'').indexOf('f3.png')!==-1) drawW = Math.max(1, Math.round(drawW * FEMALE_CROUCH_IDLE_W_MULT)); }catch(e){}
        const drawH = Math.max(8, Math.min(player.h, Math.round(imgH * (drawW / imgW))));
        const drawX = x + Math.round((player.w - drawW) / 2);
        const drawY = y + (player.h - drawH) + FEMALE_Y_OFFSET + FEMALE_CROUCH_Y_OFFSET;
        if(facing < 0){ ctx.save(); ctx.translate(drawX + drawW, drawY); ctx.scale(-1,1); ctx.drawImage(img,0,0,imgW,imgH,0,0,drawW,drawH); ctx.restore(); }
        else { ctx.drawImage(img,0,0,imgW,imgH,drawX,drawY,drawW,drawH); }
        return;
      }
      if(isJump && femaleJumpLoaded){
        const img = femaleJumpImg; const imgW = img.width, imgH = img.height;
        let drawW = femaleVisualW;
        try{ if((img.src||'').indexOf('f2.png')!==-1) drawW = Math.max(1, Math.round(drawW * FEMALE_JUMP_MULT)); }catch(e){}
        const naturalH = Math.round(imgH * (drawW / imgW));
        const drawH = Math.max(Math.round(player.h * JUMP_MIN_HEIGHT_FRAC), Math.min(player.h, naturalH));
        const drawX = x + Math.round((player.w - drawW) / 2);
        const drawY = y + (player.h - drawH) + FEMALE_Y_OFFSET;
        if(facing<0){ ctx.save(); ctx.translate(drawX + drawW, drawY); ctx.scale(-1,1); ctx.drawImage(img,0,0,imgW,imgH,0,0,drawW,drawH); ctx.restore(); }
        else { ctx.drawImage(img,0,0,imgW,imgH,drawX,drawY,drawW,drawH); }
        return;
      }
      if(isRun){
        if(femaleRunFrames && femaleRunFrames.length > 0){ const idx = Math.floor((Date.now()/RUN_FRAME_MS) % femaleRunFrames.length); const img = femaleRunFrames[idx]; if(img && img.width>0){
            let runDrawW = femaleVisualW;
            try{
              const src = (img.src||'');
              if(src.indexOf('f1.png')!==-1 || src.indexOf('f1_0.png')!==-1) runDrawW = Math.max(1, Math.round(femaleVisualW * FEMALE_RUN_W_MULT));
            }catch(e){}
            const runDrawX = x + Math.round((player.w - runDrawW)/2);
            drawImgScaled(img, runDrawX, y + FEMALE_Y_OFFSET, runDrawW, femaleVisualH); return; } }
        if(femaleRunLoaded){
          let runDrawW = femaleVisualW;
          try{ if((femaleRunImg.src||'').indexOf('f1.png')!==-1) runDrawW = Math.max(1, Math.round(femaleVisualW * FEMALE_RUN_W_MULT)); }catch(e){}
          const runDrawX = x + Math.round((player.w - runDrawW)/2);
          drawImgScaled(femaleRunImg, runDrawX, y + FEMALE_Y_OFFSET, runDrawW, femaleVisualH); return; }
      }
      if(femaleLoaded){
        // always use configured femaleImg (f0.png) as idle
        const img = femaleImg; const imgW = img.width || 1, imgH = img.height || 1;
        const drawW = femaleVisualW;
        const drawH = femaleVisualH;
        const drawY = y + FEMALE_Y_OFFSET;
        drawImgScaled(img, x, drawY, drawW, drawH);
        return;
      }
    }

    // optional background or platform tile fallback handled elsewhere
    // fallback to sprite sheet animation if available
    if(spriteLoaded){
      const now = Date.now();
      let anim = 0;
      if(isJump) anim = 0; // use idle frame or sprite jump not defined
      else if(isRun) anim = 1 + Math.floor((now/120) % RUN_FRAMES);
      else anim = 0;
      const sx = anim * SPR_W; const sy = (skinRowLocal||0) * SPR_H;
      drawSpriteSheetScaled(sprite, sx, sy, SPR_W, SPR_H, x, y, player.w, player.h);
      return;
    }

    // 마지막 fallback: 단색 박스
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(x,y,player.w,player.h);
  }

  // Update attack cooldown UI (sidebar canvas)
  function updateAttackCooldownUI(now){
    try{
      if(!attackCoolCtx) return;
      const last = player.lastAttack || 0; const elapsed = Math.max(0, now - last);
      const remaining = Math.max(0, ATTACK_COOLDOWN - elapsed);
      const frac = Math.max(0, Math.min(1, remaining / ATTACK_COOLDOWN)); // 1 -> full cooldown remaining
      // clear
      const cw = attackCoolCanvas.width, ch = attackCoolCanvas.height; attackCoolCtx.clearRect(0,0,cw,ch);
      // background circle
      const cx = cw/2, cy = ch/2, r = Math.min(cw, ch)/2 - 4;
      attackCoolCtx.beginPath(); attackCoolCtx.arc(cx, cy, r, 0, Math.PI*2); attackCoolCtx.fillStyle = '#eef2f1'; attackCoolCtx.fill();
      // foreground arc: draw from top clockwise according to frac
      if(remaining > 0){ const start = -Math.PI/2; const end = start + (Math.PI*2) * frac; attackCoolCtx.beginPath(); attackCoolCtx.moveTo(cx,cy); attackCoolCtx.fillStyle = '#2563eb'; attackCoolCtx.arc(cx, cy, r, start, end); attackCoolCtx.closePath(); attackCoolCtx.fill(); }
      // inner circle to make it donut
      attackCoolCtx.beginPath(); attackCoolCtx.arc(cx, cy, r*0.65, 0, Math.PI*2); attackCoolCtx.fillStyle = '#fff'; attackCoolCtx.fill();
      // draw the attack icon fixed in the center of the wedge (stationary, larger)
      try{
        if(attackIconLoaded && attackIconImg.width > 0){
          const ix = cx; const iy = cy; // fixed center
          // make the icon bolder/larger but cap to canvas size
          const desired = Math.round(r * 1.4);
          const maxAllowed = Math.min(cw - 8, ch - 8);
          const iconSize = Math.max(18, Math.min(desired, maxAllowed));
          const iw = attackIconImg.width, ih = attackIconImg.height;
          const drawIW = iconSize; const drawIH = iconSize;
          attackCoolCtx.save(); attackCoolCtx.translate(ix - drawIW/2, iy - drawIH/2);
          attackCoolCtx.drawImage(attackIconImg, 0,0, iw, ih, 0,0, drawIW, drawIH);
          attackCoolCtx.restore();
        }
      }catch(e){ /* ignore icon draw errors */ }
      // seconds text
      if(remaining > 0){ attackCoolText.textContent = (remaining/1000).toFixed(1) + 's'; }
      else { attackCoolText.textContent = 'Ready'; }
    }catch(e){ /* ignore UI draw errors */ }
  }

  function render(){
    const __diagStart = performance.now();
    // camera smoothing + shake
    const map = MAPS[player.map];
    // If in corridor, clear entrance/board hints (avoid stale hints)
    try{ if(player.map === 'corridor'){ window.__entranceHint = null; window.__boardHint = null; } }catch(e){}
    // determine our current group id for in-game group markers
    const myGroup = (player.group || (otherUsers && otherUsers[uid] && otherUsers[uid].group) || player.party || player.team || null);
    camTargetX = Math.max(0, Math.min(map.width - VIEW_W, player.x - VIEW_W/2 + player.w/2));
    camPosX += (camTargetX - camPosX) * CAM_LERP;
    // update shake offsets
    if(camShake.magnitude > 0){ camShake.x = (Math.random() * 2 - 1) * camShake.magnitude; camShake.y = (Math.random() * 2 - 1) * camShake.magnitude; camShake.magnitude *= camShake.decay; if(camShake.magnitude < 0.02) { camShake.magnitude = 0; camShake.x = 0; camShake.y = 0; } }
    const camX = Math.max(0, Math.min(map.width - VIEW_W, camPosX)) + (camShake.x || 0);
    // clear
    ctx.clearRect(0,0,VIEW_W,VIEW_H);
    // optional FPS & debug overlay
    if(window.__showFps){ ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(8,8,96,36); ctx.fillStyle='#fff'; ctx.font = fontPx(14); ctx.textAlign='left'; ctx.fillText('FPS: ' + Math.round(window.__fps||0), 14, 28); ctx.restore(); }
    // draw background image if available (map-specific or back0.png)
    // Parallax: draw layered backgrounds that move smoothly with the camera
    let parallaxHandled = false;
    try{
      const layers = getParallaxLayers(player.map || player.map);
      if(window.__showVisuals !== false && layers && layers.length){
        parallaxHandled = true;
        if(!window.__parallaxState) window.__parallaxState = new Array(layers.length).fill(0);
        const PAR_LERP = 0.08;
        for(let i=0;i<layers.length;i++){
          try{
            const layer = layers[i]; if(!layer || !layer.img) continue;
            const img = layer.img; if(!img.width) continue;
            const tileW = img.width || VIEW_W; const tileH = img.height || VIEW_H;
            const baseScale = Math.max((MAPS[player.map].width || VIEW_W) / tileW, VIEW_H / tileH);
            const scale = (typeof window.__parallaxScale === 'number') ? baseScale * window.__parallaxScale : baseScale;
            const destW = Math.round(tileW * scale); const destH = Math.round(tileH * scale);
            const speed = (typeof layer.speed === 'number') ? layer.speed : 0.5;
            const target = -camPosX * speed;
            window.__parallaxState[i] = (window.__parallaxState[i] || 0) + (target - (window.__parallaxState[i]||0)) * PAR_LERP;
            let startX = Math.round(window.__parallaxState[i] % destW);
            if(startX > 0) startX -= destW;
            for(let x = startX; x < VIEW_W; x += destW){ ctx.drawImage(img, 0,0,tileW,tileH, x, 0, destW, destH); }
          }catch(e){}
        }
      }
    }catch(e){}
    // Aquarium special background/effects
    try{
      if((map && map.bgKey === 'aquarium') || player.map === 'aquarium'){
        parallaxHandled = true;
        // deep water gradient
        const g = ctx.createLinearGradient(0,0,0,VIEW_H);
        g.addColorStop(0, '#022b45'); g.addColorStop(0.4, '#013b5a'); g.addColorStop(1, '#001a2b');
        ctx.fillStyle = g; ctx.fillRect(0,0,VIEW_W,VIEW_H);
        // moving caustics (light bands)
        const now = Date.now();
        const seed = (now % 10000) / 10000;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18;
        for(let i=0;i<6;i++){
          const band = Math.sin((now*0.001*(0.4 + i*0.06)) + i*1.2) * 18;
          const y = 60 + i*48 + band;
          const bandW = VIEW_W * 1.2;
          ctx.fillStyle = (i%2===0) ? 'rgba(120,200,255,0.08)' : 'rgba(80,160,220,0.06)';
          ctx.beginPath(); ctx.ellipse(VIEW_W/2 + Math.sin(now*0.0007 + i)*60, y, bandW, 28 + Math.cos(now*0.0009 + i)*8, 0, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();

        // subtle surface ripples across top
        try{
          ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#9fd9ff'; ctx.lineWidth = 1.2;
          for(let xOff=0;xOff<VIEW_W;xOff+=40){ const amp = 6 + Math.sin((now*0.002)+(xOff*0.03))*4; ctx.beginPath(); for(let x=0;x<=40;x+=4){ const xx = xOff + x; const yy = 12 + Math.sin((xx*0.02)+(now*0.002))*amp; if(x===0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); } ctx.stroke(); }
          ctx.restore();
        }catch(e){}

        // spawn bubbles from decor anchors occasionally
        try{
          if(map && map.decors){ for(const d of map.decors){ if(d && d.type === 'bubblesource'){ if(Math.random() < 0.012){ const sx = d.x - camX + (Math.random()*24-12); const sy = d.y + (Math.random()*8 - 4); spawnAquariumBubble(sx + camX, sy); } } } }
        }catch(e){}

        // update and draw aquarium bubbles (rising)
        try{
          for(let i=aquariumBubbles.length-1;i>=0;i--){ const b = aquariumBubbles[i]; b.life += 16; if(b.life >= b.maxLife || b.alpha <= 0.02){ aquariumBubbles.splice(i,1); continue; } b.x += b.vx; b.y += b.vy; b.vx += (Math.random()*0.02-0.01); b.alpha = Math.max(0, 1 - (b.life / b.maxLife)); // screen coords: b.x is world x
              const sx = Math.round(b.x - camX); const sy = Math.round(b.y);
              if(sx < -40 || sx > VIEW_W + 40) continue;
              ctx.save(); ctx.globalAlpha = Math.max(0.08, b.alpha * 0.95);
              ctx.fillStyle = 'rgba(220,245,255,0.85)'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, Math.round(b.r)), 0, Math.PI*2); ctx.fill();
              ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
              // small highlight
              ctx.globalAlpha = Math.min(0.6, b.alpha); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(sx - Math.round(b.r/3), sy - Math.round(b.r/3), Math.max(1, Math.round(b.r/3)), 0, Math.PI*2); ctx.fill();
              ctx.restore(); }
        }catch(e){}
      }
    }catch(e){}
      if(!parallaxHandled && map.bgKey === 'classroom' && classLoaded){
        // draw a single classroom image scaled to fit view height (preserve aspect), centered in world
        const tileW = classImg.width || VIEW_W; const tileH = classImg.height || VIEW_H;
        const scale = VIEW_H / tileH;
        const destW = Math.round(tileW * scale); const destH = Math.round(tileH * scale);
        const worldX = Math.round((map.width - destW) / 2);
        const sx = worldX - camX; const sy = Math.round((VIEW_H - destH) / 2);
        ctx.drawImage(classImg, 0,0, tileW, tileH, sx, sy, destW, destH);
      } else if(!parallaxHandled && map.bgKey === 'back1' && back1Loaded){
        const tileW = back1Img.width || VIEW_W; const tileH = back1Img.height || VIEW_H;
        // draw background image scaled to cover the map width and view height (preserve aspect ratio)
        const scale = Math.max(map.width / tileW, VIEW_H / tileH);
        const destW = Math.round(tileW * scale); const destH = Math.round(tileH * scale);
        const worldX = Math.round((map.width - destW) / 2);
        const sx = worldX - camX; const sy = Math.round((VIEW_H - destH) / 2);
        ctx.drawImage(back1Img, 0,0, tileW, tileH, sx, sy, destW, destH);
      } else if(!parallaxHandled && backLoaded){
      ctx.drawImage(backImg, 0,0, backImg.width, backImg.height, 0, 0, VIEW_W, VIEW_H);
    } else if(!parallaxHandled && bgLoaded){
      // stretch bg to view
      ctx.drawImage(bgImg, 0,0, bgImg.width, bgImg.height, 0, 0, VIEW_W, VIEW_H);
    } else if(!parallaxHandled){
      // distant hills fallback (slower movement for distance)
      ctx.fillStyle = '#8ecae6'; ctx.fillRect(0 - Math.round(camX*0.08), 250, map.width, 150);
    }

    // draw building (hallway) or door (classroom) visuals before platforms
    if(map.building){
      const bx = map.building.x - camX;
      const byBase = map.building.y;
      const by = byBase + (map.building.offsetY || 0);
      const bw = map.building.w, bh = map.building.h;
      if(schoolLoaded){
        ctx.drawImage(schoolImg, 0,0, schoolImg.width, schoolImg.height, bx, by, bw, bh);
      } else {
        // simple building: base, roof, windows, entrance marker
        ctx.fillStyle = '#d1b280'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#a77e3a'; ctx.fillRect(bx, by, bw, Math.round(bh*0.18)); // roof band
        // windows
        ctx.fillStyle = '#fff3cc';
        for(let wx=bx+12; wx < bx + bw - 24; wx += 48){ ctx.fillRect(wx, by + 24, 28, 24); }
        // entrance marker
        const ex = map.building.entranceX - camX; ctx.fillStyle = '#6b4b2a'; ctx.fillRect(ex - 10, by + bh - 40, 20, 36);
        ctx.fillStyle = '#06202a'; ctx.font = fontPx(16); ctx.fillText('학교', bx + 12, by + 22);
        
      }
    }
    // (Removed persistent 'no violence' overlay; warnings are shown via toast on key press)

    // compute and store entrance hint regardless of whether a school image is loaded
    try{
      if(map.building){
        const pxCenter = player.x + player.w/2;
        const ex = map.building.entranceX;
        const dx = Math.abs(pxCenter - ex);
        const visualY = map.building.y + (map.building.offsetY || 0);
        const buildingBottomY = visualY + map.building.h;
        const dyAbs = Math.abs((player.y + player.h) - buildingBottomY);
        const range = (map.building.interactRange || 160);
        const dyLimit = 220;
        if(Number.isFinite(ex) && dx <= range && dyAbs <= dyLimit){
          const hint = '[spacebar를 눌러 상호작용]';
          const hintWorldX = ex;
          const hintWorldY = buildingBottomY - 120 + SPRITE_Y_OFFSET;
          window.__entranceHint = { text: hint, worldX: hintWorldX, worldY: hintWorldY };
        } else { window.__entranceHint = null; }
      }
    }catch(e){}

    if(map.door){
      const dx = map.door.x - camX, dy = map.door.y, dw = map.door.w, dh = map.door.h;
      ctx.fillStyle = '#6b4b2a'; ctx.fillRect(dx, dy, dw, dh);
      ctx.fillStyle = '#fff'; ctx.font = fontPx(12); ctx.fillText('문', dx + 6, dy - 6);
    }

    // draw platforms: prefer tiled floor image if provided, else sprite tile, else solid fill
    const PLAT_SRC_H = Math.floor(SPR_H/3);
    // compute lowest platform y to deterministically mark bottom rails
    const bottomY = map.platforms.reduce((mx, pp) => Math.max(mx, pp.y), -Infinity);
    for(const p of map.platforms){
      const sx = p.x - camX, sy = p.y, sw = p.w, sh = p.h;
      // if map requests transparent ground (e.g., classroom), skip drawing filled ground
      if(map.transparentGround){
        // optionally draw subtle guide line so platforms are still visible to player
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy+1); ctx.lineTo(sx+sw, sy+1); ctx.stroke();
        // still render rails if provided (tiled with gaps)
        if(railLoaded){ const isBottom = (p.y === bottomY); if(!isBottom){ const railH = Math.max(6, Math.round(railImg.height * (sh / Math.max(8, (floorImg.width||8))) * RAIL_SCALE)); const tileW = railImg.width; const gap = RAIL_GAP; const offset = (RAIL_STAGGER && (Math.floor(p.x / (tileW + gap)) % 2) === 1) ? Math.floor((tileW + gap)/2) : 0; for(let rx = -offset; rx < sw; rx += tileW + gap){ if(rx < 0) continue; const remaining = sw - rx; if(remaining <= 0) break; const srcW = Math.min(tileW, remaining); const drawX = sx + rx; ctx.drawImage(railImg, 0,0, srcW, railImg.height, drawX, sy - railH + 2, srcW, railH); } } }
        else { // placeholder rails when image not loaded
          const isBottom = (p.y === bottomY);
          if(!isBottom){ const phTile = Math.max(12, Math.round(24 * RAIL_SCALE)); const phH = Math.max(6, Math.round(6 * RAIL_SCALE)); const gap = RAIL_GAP; const offset = (RAIL_STAGGER && (Math.floor(p.x / (phTile + gap)) % 2) === 1) ? Math.floor((phTile + gap)/2) : 0; ctx.fillStyle = '#a85b2a'; for(let rx = -offset; rx < sw; rx += phTile + gap){ if(rx < 0) continue; const remaining = sw - rx; if(remaining <= 0) break; const drawW = Math.min(phTile, remaining); const drawX = sx + rx; ctx.fillRect(drawX, sy - phH + 2, drawW, phH); } }
        }
        continue; }
      if(floorLoaded){
        const tileW = floorImg.width; const tileH = floorImg.height;
        for(let tx=0; tx<sw; tx+=tileW){
          const dw = Math.min(tileW, sw-tx);
          ctx.drawImage(floorImg, 0, 0, tileW, tileH, sx+tx, sy, dw, sh);
        }
        // rail overlay above platform if available (skip rails on true bottom)
        if(railLoaded){
          const isBottom = (p.y === bottomY);
            if(!isBottom){
            const railH = Math.max(6, Math.round(railImg.height * (sh / Math.max(8,tileH)) * RAIL_SCALE));
            const tileW = railImg.width; const gap = RAIL_GAP; const offset = (RAIL_STAGGER && (Math.floor(p.x / (tileW + gap)) % 2) === 1) ? Math.floor((tileW + gap)/2) : 0; for(let rx = -offset; rx < sw; rx += tileW + gap){ if(rx < 0) continue; const remaining = sw - rx; if(remaining <= 0) break; const srcW = Math.min(tileW, remaining); const drawX = sx + rx; ctx.drawImage(railImg, 0,0, srcW, railImg.height, drawX, sy - railH + 2, srcW, railH); }
          }
        } else {
          const isBottom = (p.y === bottomY);
          if(!isBottom){ const phTile = Math.max(12, Math.round(24 * RAIL_SCALE)); const phH = Math.max(6, Math.round(6 * RAIL_SCALE)); const gap = RAIL_GAP; const offset = (RAIL_STAGGER && (Math.floor(p.x / (phTile + gap)) % 2) === 1) ? Math.floor((phTile + gap)/2) : 0; ctx.fillStyle = '#a85b2a'; for(let rx = -offset; rx < sw; rx += phTile + gap){ if(rx < 0) continue; const remaining = sw - rx; if(remaining <= 0) break; const drawW = Math.min(phTile, remaining); const drawX = sx + rx; ctx.fillRect(drawX, sy - phH + 2, drawW, phH); } }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx+4, sy+2, Math.max(0, sw-8), 4);
      } else if(spriteLoaded){
        // 반복해서 타일을 깔아준다
        const tileW = SPR_W; const tileH = PLAT_SRC_H;
        for(let tx=0; tx<sw; tx+=tileW){
          const dw = Math.min(tileW, sw-tx);
          ctx.drawImage(sprite, 0, 2*SPR_H, SPR_W, tileH, sx+tx, sy, dw, sh);
        }
        // rail overlay if available (skip rails on true bottom)
        if(railLoaded){
          const isBottom = (p.y === bottomY);
          if(!isBottom){
            const railH = Math.max(6, Math.round(railImg.height * (sh / Math.max(8,PLAT_SRC_H)) * RAIL_SCALE));
            const tileW = railImg.width; const gap = RAIL_GAP;
            const offset = (RAIL_STAGGER && (Math.floor(p.x / (tileW + gap)) % 2) === 1) ? Math.floor((tileW + gap)/2) : 0;
            for(let rx = -offset; rx < sw; rx += tileW + gap){ if(rx < 0) continue; const remaining = sw - rx; if(remaining <= 0) break; const srcW = Math.min(tileW, remaining); const drawX = sx + rx; ctx.drawImage(railImg, 0,0, srcW, railImg.height, drawX, sy - railH + 2, srcW, railH); }
          }
        } else {
          const isBottom = (p.y === bottomY);
          if(!isBottom){ const phTile = Math.max(12, Math.round(24 * RAIL_SCALE)); const phH = Math.max(6, Math.round(6 * RAIL_SCALE)); const gap = RAIL_GAP; const offset = (RAIL_STAGGER && (Math.floor(p.x / (phTile + gap)) % 2) === 1) ? Math.floor((phTile + gap)/2) : 0; ctx.fillStyle = '#a85b2a'; for(let rx = -offset; rx < sw; rx += phTile + gap){ if(rx < 0) continue; const remaining = sw - rx; if(remaining <= 0) break; const drawW = Math.min(phTile, remaining); const drawX = sx + rx; ctx.fillRect(drawX, sy - phH + 2, drawW, phH); } }
        }
        // highlight
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx+4, sy+2, Math.max(0, sw-8), 4);
      } else {
        ctx.fillStyle = '#8258ff'; ctx.fillRect(sx, sy, sw, sh);
        if(railLoaded){
          const isBottom = (p.y === bottomY);
          if(!isBottom){
            const railH = Math.max(6, Math.round(railImg.height * RAIL_SCALE)); const tileW = railImg.width; const gap = RAIL_GAP; const offset = (RAIL_STAGGER && (Math.floor(p.x / (tileW + gap)) % 2) === 1) ? Math.floor((tileW + gap)/2) : 0;
            for(let rx = -offset; rx < sw; rx += tileW + gap){ if(rx < 0) continue; const remaining = sw - rx; if(remaining <= 0) break; const srcW = Math.min(tileW, remaining); const drawX = sx + rx; ctx.drawImage(railImg, 0,0, srcW, railImg.height, drawX, sy - railH + 2, srcW, railH); }
          }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx+4, sy+2, Math.max(0, sw-8), 4);
      }
    }

    // draw bulletin board for corridor (if present)
    try{
      if(map.board && newsLoaded){
        const bx = map.board.x - camX; const by = map.board.y; const bw = map.board.w; const bh = map.board.h;
        ctx.drawImage(newsImg, 0,0, newsImg.width || bw, newsImg.height || bh, bx, by, bw, bh);
        // board title above
        ctx.fillStyle = '#06202a'; ctx.font = fontPx(Math.max(14, Math.round(16 * SCALE))); ctx.textAlign = 'center'; ctx.fillText('세기의 방명록', bx + bw/2, by - 12);
      }
    }catch(e){}

    // (Removed classroom door overlay drawing — portals are interaction-only now)

    // draw decorative props (map.decors)
    try{
      if(map.decors && map.decors.length){
        for(const d of map.decors){
          const dx = (d.x || 0) - camX; const dy = d.y || 0; const dw = d.w || 32; const dh = d.h || 32;
          if(d.type === 'fountain'){
            if(fountainLoaded && fountainImg.width>0) ctx.drawImage(fountainImg, 0,0, fountainImg.width, fountainImg.height, dx, dy, dw, dh);
            else { ctx.fillStyle='#4aa3d8'; ctx.fillRect(dx, dy, dw, dh); }
          } else if(d.type === 'lamp'){
            if(lampLoaded && lampImg.width>0) ctx.drawImage(lampImg, 0,0, lampImg.width, lampImg.height, dx, dy, dw, dh);
            else { ctx.fillStyle='#ffd166'; ctx.fillRect(dx+Math.round(dw/2)-2, dy, 4, dh); ctx.beginPath(); ctx.arc(dx+Math.round(dw/2), dy+6, 6, 0, Math.PI*2); ctx.fill(); }
          } else if(d.type === 'box'){
            const idx = (typeof d.idx === 'number') ? d.idx : 0; const img = boxImgs[idx] || boxImgs[0]; if(img && img.width>0) ctx.drawImage(img, 0,0, img.width, img.height, dx, dy, dw, dh); else { ctx.fillStyle='#7c4a2f'; ctx.fillRect(dx, dy, dw, dh); }
          } else if(d.type === 'tablet'){
            // draw tablet prop: use tablet.png if available, else simple stand
            try{
              const tImg = window._tabletImg;
              if(!tImg){ window._tabletImg = new Image(); window._tabletImg.src = 'tablet.png'; }
              const ti = window._tabletImg;
              if(ti && ti.width > 0){ const tw = dw; const th = dh; ctx.drawImage(ti, 0,0, ti.width, ti.height, dx, dy, tw, th); }
              else {
                ctx.fillStyle = '#2b6cb0'; ctx.fillRect(dx, dy, dw, dh);
                ctx.fillStyle = '#fff'; ctx.font = fontPx(12); ctx.textAlign='center'; ctx.fillText('Tablet', dx + dw/2, dy + dh/2 - 6);
                ctx.fillText('물고기 추가', dx + dw/2, dy + dh/2 + 8);
              }
            }catch(e){ ctx.fillStyle='#2b6cb0'; ctx.fillRect(dx, dy, dw, dh); }
            // if player is near, show interaction hint
            try{
              const pxCenter = player.x + (player.w||32)/2; const pyFeet = player.y + (player.h||48);
              const worldTx = (d.x || 0); const worldTy = (d.y || 0);
              const distX = Math.abs(pxCenter - worldTx); const distY = Math.abs(pyFeet - worldTy);
              if(distX < Math.max(180, dw) && distY < Math.max(140, dh)){
                // draw prompt above tablet
                ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = fontPx(14); ctx.textAlign='center'; const px = dx + dw/2; const py = dy - 10;
                roundRect(ctx, px-86, py-28, 172, 28, 8, true, false);
                ctx.fillStyle = '#fff'; ctx.fillText('Space 또는 클릭: 물고기 추가', px, py-6);
              }
            }catch(e){}
          } else if(d.type === 'classdoor'){
            // classdoor visuals removed: show nothing (hint handled elsewhere)
            try{ /* intentionally empty */ }catch(e){}
          } else if(d.type === 'vending'){
            try{
              if(!window._vendingImg){ window._vendingImg = new Image(); window._vendingImg.onload = function(){ console.log('vending image loaded:', window._vendingImg.src); }; window._vendingImg.onerror = function(){ console.warn('vending image failed to load:', window._vendingImg.src); };
                window._vendingImg.src = d.img || 'ven.png';
              }
              const vImg = window._vendingImg;
              if(vImg && vImg.width > 0){ ctx.drawImage(vImg, 0,0, vImg.width, vImg.height, dx, dy, dw, dh); }
              else { ctx.fillStyle = '#b0bec5'; ctx.fillRect(dx, dy, dw, dh); ctx.fillStyle='#334455'; ctx.font = fontPx(12); ctx.textAlign='center'; ctx.fillText('VEND', dx + dw/2, dy + dh/2); }
              // hint when player near
              try{
                const pxCenter = player.x + (player.w||32)/2; const pyFeet = player.y + (player.h||48) + SPRITE_Y_OFFSET;
                const distX = Math.abs(pxCenter - (d.x||0)); const distY = Math.abs(pyFeet - (d.y||0));
                if(distX < (d.interactRange || 100) && distY < Math.max(140, (d.h||96))){ ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.font = fontPx(14); ctx.textAlign='center'; const px = dx + dw/2; const py = dy - 10; roundRect(ctx, px-86, py-28, 172, 28, 8, true, false); ctx.fillStyle='#fff'; ctx.fillText(d.hint || '[spacebar를 눌러 이용하기]', px, py-6); }
              }catch(e){}
            }catch(e){}
          } else {
            // generic placeholder
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(dx, dy, dw, dh);
          }
          
        }
      }
    }catch(e){ /* non-fatal */ }

    // class101: 과학 교사 (teacher1) - greeting NPC at world coords (1121,500)
    try{
      if((currentMap === 'class101' || player.map === 'class101')){
        const tX = 1121, tY = 650;
        const nowT = Date.now();
        const tState = teacher1State;
        const speaking = (tState.speakingUntil || 0) > nowT;
        const img = (speaking && teacher1GreetingLoaded) ? teacher1GreetingImg : (teacher1Loaded ? teacher1Img : null);
        if(img && img.width > 0){
          const imgW = img.width, imgH = img.height;
          const drawW = Math.max(24, Math.round(player.w * 1.0));
          const drawH = Math.max(24, Math.round(imgH * (drawW / imgW)));
          const drawX = tX - camX;
          // use fixed teacher world Y so teacher doesn't move when player jumps
          const drawY = tY - drawH;
          try{ ctx.drawImage(img, 0,0, imgW, imgH, drawX, drawY, drawW, drawH); }catch(e){}
          // label
          ctx.fillStyle = 'yellow'; ctx.font = fontPx(Math.max(12, Math.round(12 * SCALE))); ctx.textAlign = 'center';
          ctx.fillText('과학 교사', drawX + Math.round(drawW/2), drawY - 8);
          // speech bubble
          if(speaking && tState.currentPhrase){
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            const txt = tState.currentPhrase;
            ctx.font = fontPx(Math.max(12, Math.round(12 * SCALE)));
            const metrics = ctx.measureText(txt);
            const pad = Math.round(6 * SCALE);
            const boxW = Math.round(metrics.width) + pad * 2;
            const boxX = drawX + Math.round(drawW/2) - Math.round(boxW/2);
            const boxY = drawY - 28 - Math.round(12 * SCALE);
            roundRect(ctx, boxX, boxY, boxW, Math.round(20 * SCALE), 6);
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, drawX + Math.round(drawW/2), boxY + Math.round(14 * SCALE));
          }
        }
        // schedule teacher greeting
        if(teacher1Loaded && nowT >= (tState.nextGreetAt || 0)){
          const TEACHER1_GREETINGS = ['얘들아, 조용하자', '자습하세요. 자습.', '안녕하세요~'];
          const idx = Math.floor(Math.random() * TEACHER1_GREETINGS.length);
          tState.currentPhrase = TEACHER1_GREETINGS[idx];
          tState.speakingUntil = nowT + NPC_GREETING_DURATION;
          tState.nextGreetAt = nowT + (Math.random() * (NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL);
        }
      }
    }catch(e){}

    // teacher2..teacher5: fixed teachers for class102~class105
    try{
      // teacher2 - class102
      if((currentMap === 'class102' || player.map === 'class102')){
        const tX = 1121, tY = 650; const nowT2 = Date.now(); const tState2 = teacher2State;
        const speaking2 = (tState2.speakingUntil || 0) > nowT2;
        const img2 = (speaking2 && teacher2GreetingLoaded) ? teacher2GreetingImg : (teacher2Loaded ? teacher2Img : null);
        if(img2 && img2.width > 0){ const imgW = img2.width, imgH = img2.height; const drawW = Math.max(24, Math.round(player.w * 1.0)); const drawH = Math.max(24, Math.round(imgH * (drawW / imgW))); const drawX = tX - camX; const drawY = tY - drawH; try{ ctx.drawImage(img2,0,0,imgW,imgH,drawX,drawY,drawW,drawH); }catch(e){} ctx.fillStyle='yellow'; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); ctx.textAlign='center'; ctx.fillText('한국사 교사', drawX + Math.round(drawW/2), drawY - 8); if(speaking2 && tState2.currentPhrase){ ctx.fillStyle='rgba(0,0,0,0.6)'; const txt=tState2.currentPhrase; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); const metrics = ctx.measureText(txt); const pad = Math.round(6 * SCALE); const boxW = Math.round(metrics.width) + pad * 2; const boxX = drawX + Math.round(drawW/2) - Math.round(boxW/2); const boxY = drawY - 28 - Math.round(12 * SCALE); roundRect(ctx, boxX, boxY, boxW, Math.round(20 * SCALE), 6); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(txt, drawX + Math.round(drawW/2), boxY + Math.round(14 * SCALE)); } }
        if(teacher2Loaded && nowT2 >= (tState2.nextGreetAt || 0)){ const GREETS = ['하이~','시험 공부해라~','즐거운 한국사~']; const idx = Math.floor(Math.random()*GREETS.length); tState2.currentPhrase = GREETS[idx]; tState2.speakingUntil = nowT2 + NPC_GREETING_DURATION; tState2.nextGreetAt = nowT2 + (Math.random()*(NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL); }
      }
    }catch(e){}

    try{
      // teacher3 - class103
      if((currentMap === 'class103' || player.map === 'class103')){
        const tX = 1121, tY = 650; const nowT3 = Date.now(); const tState3 = teacher3State;
        const speaking3 = (tState3.speakingUntil || 0) > nowT3;
        const img3 = (speaking3 && teacher3GreetingLoaded) ? teacher3GreetingImg : (teacher3Loaded ? teacher3Img : null);
        if(img3 && img3.width > 0){ const imgW = img3.width, imgH = img3.height; const drawW = Math.max(24, Math.round(player.w * 1.0)); const drawH = Math.max(24, Math.round(imgH * (drawW / imgW))); const drawX = tX - camX; const drawY = tY - drawH; try{ ctx.drawImage(img3,0,0,imgW,imgH,drawX,drawY,drawW,drawH); }catch(e){} ctx.fillStyle='yellow'; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); ctx.textAlign='center'; ctx.fillText('영어 교사', drawX + Math.round(drawW/2), drawY - 8); if(speaking3 && tState3.currentPhrase){ ctx.fillStyle='rgba(0,0,0,0.6)'; const txt=tState3.currentPhrase; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); const metrics = ctx.measureText(txt); const pad = Math.round(6 * SCALE); const boxW = Math.round(metrics.width) + pad * 2; const boxX = drawX + Math.round(drawW/2) - Math.round(boxW/2); const boxY = drawY - 28 - Math.round(12 * SCALE); roundRect(ctx, boxX, boxY, boxW, Math.round(20 * SCALE), 6); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(txt, drawX + Math.round(drawW/2), boxY + Math.round(14 * SCALE)); } }
        else {
          const drawW = Math.max(24, Math.round(player.w * 1.0)); const phH = Math.max(36, Math.round(drawW * 1.2)); const drawX = tX - camX; const drawY = tY - phH;
          ctx.save(); ctx.fillStyle = '#6b7280'; roundRect(ctx, drawX, drawY, drawW, phH, 6); ctx.restore();
          ctx.fillStyle='yellow'; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); ctx.textAlign='center'; ctx.fillText('영어 교사', drawX + Math.round(drawW/2), drawY - 8);
          if(speaking3 && tState3.currentPhrase){ ctx.fillStyle='rgba(0,0,0,0.6)'; const txt=tState3.currentPhrase; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); const metrics = ctx.measureText(txt); const pad = Math.round(6 * SCALE); const boxW = Math.round(metrics.width) + pad * 2; const boxX = drawX + Math.round(drawW/2) - Math.round(boxW/2); const boxY = drawY - 28 - Math.round(12 * SCALE); roundRect(ctx, boxX, boxY, boxW, Math.round(20 * SCALE), 6); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(txt, drawX + Math.round(drawW/2), boxY + Math.round(14 * SCALE)); }
        }
        if(teacher3Loaded && nowT3 >= (tState3.nextGreetAt || 0)){ const GREETS = ['조','현','수']; const idx = Math.floor(Math.random()*GREETS.length); tState3.currentPhrase = GREETS[idx]; tState3.speakingUntil = nowT3 + NPC_GREETING_DURATION; tState3.nextGreetAt = nowT3 + (Math.random()*(NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL); }
      }
    }catch(e){}

    try{
      // teacher4 - class104
      if((currentMap === 'class104' || player.map === 'class104')){
        const tX = 1121, tY = 650; const nowT4 = Date.now(); const tState4 = teacher4State;
        const speaking4 = (tState4.speakingUntil || 0) > nowT4;
        const img4 = (speaking4 && teacher4GreetingLoaded) ? teacher4GreetingImg : (teacher4Loaded ? teacher4Img : null);
        if(img4 && img4.width > 0){ const imgW = img4.width, imgH = img4.height; const isGreetingImg = (speaking4 && teacher4GreetingLoaded) && img4 === teacher4GreetingImg; const drawW = isGreetingImg ? Math.max(28, Math.round(player.w * 1.2)) : Math.max(24, Math.round(player.w * 1.0)); const drawH = Math.max(24, Math.round(imgH * (drawW / imgW))); const drawX = tX - camX; const drawY = tY - drawH; try{ ctx.drawImage(img4,0,0,imgW,imgH,drawX,drawY,drawW,drawH); }catch(e){} ctx.fillStyle='yellow'; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); ctx.textAlign='center'; ctx.fillText('수학 교사', drawX + Math.round(drawW/2), drawY - 8); if(speaking4 && tState4.currentPhrase){ ctx.fillStyle='rgba(0,0,0,0.6)'; const txt=tState4.currentPhrase; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); const metrics = ctx.measureText(txt); const pad = Math.round(6 * SCALE); const boxW = Math.round(metrics.width) + pad * 2; const boxX = drawX + Math.round(drawW/2) - Math.round(boxW/2); const boxY = drawY - 28 - Math.round(12 * SCALE); roundRect(ctx, boxX, boxY, boxW, Math.round(20 * SCALE), 6); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(txt, drawX + Math.round(drawW/2), boxY + Math.round(14 * SCALE)); } }
        else {
          const drawW = Math.max(24, Math.round(player.w * 1.0)); const phH = Math.max(36, Math.round(drawW * 1.2)); const drawX = tX - camX; const drawY = tY - phH;
          ctx.save(); ctx.fillStyle = '#6b7280'; roundRect(ctx, drawX, drawY, drawW, phH, 6); ctx.restore();
          ctx.fillStyle='yellow'; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); ctx.textAlign='center'; ctx.fillText('수학 교사', drawX + Math.round(drawW/2), drawY - 8);
          if(speaking4 && tState4.currentPhrase){ ctx.fillStyle='rgba(0,0,0,0.6)'; const txt=tState4.currentPhrase; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); const metrics = ctx.measureText(txt); const pad = Math.round(6 * SCALE); const boxW = Math.round(metrics.width) + pad * 2; const boxX = drawX + Math.round(drawW/2) - Math.round(boxW/2); const boxY = drawY - 28 - Math.round(12 * SCALE); roundRect(ctx, boxX, boxY, boxW, Math.round(20 * SCALE), 6); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(txt, drawX + Math.round(drawW/2), boxY + Math.round(14 * SCALE)); }
        }
        if(teacher4Loaded && nowT4 >= (tState4.nextGreetAt || 0)){ const GREETS = ['안녕하십니까','근','범']; const idx = Math.floor(Math.random()*GREETS.length); tState4.currentPhrase = GREETS[idx]; tState4.speakingUntil = nowT4 + NPC_GREETING_DURATION; tState4.nextGreetAt = nowT4 + (Math.random()*(NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL); }
      }
    }catch(e){}

    try{
      // teacher5 - class105
      if((currentMap === 'class105' || player.map === 'class105')){
        const tX = 1121, tY = 650; const nowT5 = Date.now(); const tState5 = teacher5State;
        const speaking5 = (tState5.speakingUntil || 0) > nowT5;
        const img5 = (speaking5 && teacher5GreetingLoaded) ? teacher5GreetingImg : (teacher5Loaded ? teacher5Img : null);
        if(img5 && img5.width > 0){ const imgW = img5.width, imgH = img5.height; const drawW = Math.max(24, Math.round(player.w * 1.0)); const drawH = Math.max(24, Math.round(imgH * (drawW / imgW))); const drawX = tX - camX; const drawY = tY - drawH; try{ ctx.drawImage(img5,0,0,imgW,imgH,drawX,drawY,drawW,drawH); }catch(e){} ctx.fillStyle='yellow'; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); ctx.textAlign='center'; ctx.fillText('국어 교사', drawX + Math.round(drawW/2), drawY - 8); if(speaking5 && tState5.currentPhrase){ ctx.fillStyle='rgba(0,0,0,0.6)'; const txt=tState5.currentPhrase; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); const metrics = ctx.measureText(txt); const pad = Math.round(6 * SCALE); const boxW = Math.round(metrics.width) + pad * 2; const boxX = drawX + Math.round(drawW/2) - Math.round(boxW/2); const boxY = drawY - 28 - Math.round(12 * SCALE); roundRect(ctx, boxX, boxY, boxW, Math.round(20 * SCALE), 6); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(txt, drawX + Math.round(drawW/2), boxY + Math.round(14 * SCALE)); } }
        else {
          const drawW = Math.max(24, Math.round(player.w * 1.0)); const phH = Math.max(36, Math.round(drawW * 1.2)); const drawX = tX - camX; const drawY = tY - phH;
          ctx.save(); ctx.fillStyle = '#6b7280'; roundRect(ctx, drawX, drawY, drawW, phH, 6); ctx.restore();
          ctx.fillStyle='yellow'; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); ctx.textAlign='center'; ctx.fillText('국어 교사', drawX + Math.round(drawW/2), drawY - 8);
          if(speaking5 && tState5.currentPhrase){ ctx.fillStyle='rgba(0,0,0,0.6)'; const txt=tState5.currentPhrase; ctx.font=fontPx(Math.max(12, Math.round(12 * SCALE))); const metrics = ctx.measureText(txt); const pad = Math.round(6 * SCALE); const boxW = Math.round(metrics.width) + pad * 2; const boxX = drawX + Math.round(drawW/2) - Math.round(boxW/2); const boxY = drawY - 28 - Math.round(12 * SCALE); roundRect(ctx, boxX, boxY, boxW, Math.round(20 * SCALE), 6); ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(txt, drawX + Math.round(drawW/2), boxY + Math.round(14 * SCALE)); }
        }
        if(teacher5Loaded && nowT5 >= (tState5.nextGreetAt || 0)){ const GREETS = ['좋아~','좋습니다~','일']; const idx = Math.floor(Math.random()*GREETS.length); tState5.currentPhrase = GREETS[idx]; tState5.speakingUntil = nowT5 + NPC_GREETING_DURATION; tState5.nextGreetAt = nowT5 + (Math.random()*(NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL); }
      }
    }catch(e){}

    // Corridor door hints: draw near-background prompts when player is close to provided door coords
    try{
      if((currentMap === 'corridor' || player.map === 'corridor')){
        const doorCoords = [
          { x: 612,  y: 639, toMap: 'class101' },
          { x: 1303, y: 639, toMap: 'class102' },
          { x: 1937, y: 639, toMap: 'class103' },
          { x: 2610, y: 639, toMap: 'class104' },
          { x: 3263, y: 639, toMap: 'class105' },
          // right-edge hallway exit hint
          { x: (MAPS.corridor ? MAPS.corridor.width - 40 - 20 : 3940), y: VIEW_H - 120, toMap: 'hallway' }
        ];
        const pxCenter = player.x + (player.w||32)/2; const pyFeet = player.y + (player.h||48);
        let found = false;
        for(const dc of doorCoords){ const dx2 = Math.abs(pxCenter - dc.x); const dy2 = Math.abs(pyFeet - dc.y); if(dx2 < 260 && dy2 < 560){ let hint;
          if(dc.toMap === 'hallway'){
            hint = '[spacebar를 눌러 밖으로 나가기]';
          } else {
            const m = (dc.toMap && dc.toMap.match(/class10(\d+)/)) ? dc.toMap.match(/class10(\d+)/)[1] : null; const label = m ? ('10-' + m) : '교실';
            hint = '[spacebar를 눌러 ' + label + ' 들어가기]';
          }
          const hintWorldX = dc.x; const hintWorldY = dc.y - 120 + SPRITE_Y_OFFSET; window.__entranceHint = { text: hint, worldX: hintWorldX, worldY: hintWorldY }; found = true; break; } }
        if(!found){ window.__entranceHint = window.__entranceHint && window.__entranceHint.text && window.__entranceHint.text.indexOf('10-') === -1 ? window.__entranceHint : null; }
      }

      // classroom internal door hint: when inside class10*, show hint at internalDoor coordinate (skip if internalDoor removed)
      try{
        if(typeof player.map === 'string' && player.map.indexOf('class10') === 0){
          const pm = MAPS[player.map];
          const door = (pm && pm.internalDoor) ? pm.internalDoor : null;
          if(door){
            const pxCenter = player.x + (player.w||32)/2;
            const pyFeet = player.y + (player.h||48);
            const dx2 = Math.abs(pxCenter - door.x);
            const dy2 = Math.abs(pyFeet - door.y);
            if(dx2 < 260 && dy2 < 560){
              const idx = parseInt(player.map.slice(5),10) - 100;
              const label = isNaN(idx) ? '교실' : ('10-' + idx);
              window.__entranceHint = { text: '[spacebar를 눌러 ' + label + ' 나가기]', worldX: door.x, worldY: door.y - 120 + SPRITE_Y_OFFSET };
            }
          }
        }
      }catch(e){}
    }catch(e){}

    // Corridor NPC: 정보 교사 (left side of corridor), drawn facing right with yellow label and greeting behavior
    try{
      if((currentMap === 'corridor' || player.map === 'corridor')){
        const npcWorldX = 160; // left-side position in world coordinates
        const platformTopY = VIEW_H - 40; // platforms in corridor sit at VIEW_H - 40
        // decide which image to draw: greeting image if speaking, else base image
        const now = Date.now();
        const speaking = (npcState.speakingUntil || 0) > now;
        const img = (speaking && npcGreetingLoaded) ? npcGreetingImg : npcImg;
        if(img && img.width > 0){
          const imgW = img.width, imgH = img.height;
          const drawW = Math.max(24, Math.round(player.w * 1.0));
          const drawH = Math.max(24, Math.round(imgH * (drawW / imgW)));
          const drawX = npcWorldX - camX;
          const drawY = platformTopY - drawH;
          // draw flipped so NPC faces right
          ctx.save(); ctx.translate(drawX + drawW, drawY); ctx.scale(-1,1); ctx.drawImage(img, 0,0, imgW, imgH, 0,0, drawW, drawH); ctx.restore();
          // label above NPC
          ctx.fillStyle = 'yellow'; ctx.font = fontPx(Math.max(12, Math.round(12 * SCALE))); ctx.textAlign = 'center';
          ctx.fillText('정보 교사', drawX + Math.round(drawW/2), drawY - 8);
          // if speaking, draw speech text box above label
          if(speaking && npcState.currentPhrase){
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            const txt = npcState.currentPhrase;
            ctx.font = fontPx(Math.max(12, Math.round(12 * SCALE)));
            const metrics = ctx.measureText(txt);
            const pad = Math.round(6 * SCALE);
            const boxW = Math.round(metrics.width) + pad * 2;
            const boxX = drawX + Math.round(drawW/2) - Math.round(boxW/2);
            const boxY = drawY - 28 - Math.round(12 * SCALE);
            roundRect(ctx, boxX, boxY, boxW, Math.round(20 * SCALE), 6); // helper draws filled rect with stroke
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, drawX + Math.round(drawW/2), boxY + Math.round(14 * SCALE));
          }
        }
        // schedule greeting if time
        if(npcLoaded && now >= (npcState.nextGreetAt || 0)){
          // pick random phrase and set speaking window
          const idx = Math.floor(Math.random() * NPC_GREETINGS.length);
          npcState.currentPhrase = NPC_GREETINGS[idx];
          npcState.speakingUntil = now + NPC_GREETING_DURATION;
          npcState.nextGreetAt = now + (Math.random() * (NPC_GREETING_MAX_INTERVAL - NPC_GREETING_MIN_INTERVAL) + NPC_GREETING_MIN_INTERVAL);
          // optionally swap to greeting image immediately (handled by render via speaking flag)
        }
      }
    }catch(e){ /* non-fatal */ }

    // principal in staffroom (draw blackboard/object from sprite sheet row 3)
    if(map.principal){ const px = map.principal.x - camX, py = map.principal.y; // draw principal using male sprite row (skinRow 0) as NPC
    drawSpritePlayer(px,py,1,0); ctx.fillStyle='#061826'; ctx.font=fontPx(12); ctx.fillText('교장', px+10, py-6); }

    // Update and render aquarium fish (simple swimming behavior)
    try{
      if(player.map === 'aquarium' && aquariumFish && aquariumFish.length){
        for(const f of aquariumFish){
          // simple horizontal movement with bobbing
          f.x += (f.vx || 0.8) * (f.dir || 1);
          // bounce off tank edges
          if(f.x < 40){ f.dir = 1; }
          if(f.x > (MAPS.aquarium.width - 40)){ f.dir = -1; }
          // vertical bobbing
          f.y += Math.sin((Date.now() * 0.001) * (f.bobSpeed || 0.8) + f.x * 0.01) * 0.6;
          // draw fish image centered on world position
          const sx = Math.round(f.x - camX); const sy = Math.round(f.y);
          try{
            // Draw if image has loaded (naturalWidth) or we have explicit w/h
            if(f.img && ((f.img.naturalWidth && f.img.naturalWidth>0) || (f.w && f.w>0))){
              const drawW = f.w || Math.round(48 * (f.scale||1)); const drawH = f.h || Math.round(32 * (f.scale||1)); ctx.save();
              try{
                const iw = (f.img.naturalWidth || f.img.width || drawW);
                const ih = (f.img.naturalHeight || f.img.height || drawH);
                if((f.dir||1) < 0){ ctx.translate(sx + drawW, sy); ctx.scale(-1,1); ctx.drawImage(f.img, 0,0, iw, ih, 0, -drawH/2, drawW, drawH); }
                else { ctx.drawImage(f.img, 0,0, iw, ih, sx, sy - drawH/2, drawW, drawH); }
              }catch(e){ try{ ctx.drawImage(f.img, sx, sy - drawH/2, drawW, drawH); }catch(e){} }
              ctx.restore();
            }
            else { // placeholder fish
              ctx.save(); ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(sx, sy, 12, 8, 0, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
          }catch(e){}
        }
      }
    }catch(e){}

    // draw other users
    for(const k in otherUsers){
      if(k === uid) continue;
      const u = otherUsers[k];
      if(!u || u.map !== player.map) continue;
      // use interpolated display position when available
      const du = displayUsers[k];
      if(du){
        // lerp display towards target
        const LERP_SPEED = 0.14; // tweak for smoothness
        du.x += (du.targetX - du.x) * LERP_SPEED;
        du.y += (du.targetY - du.y) * LERP_SPEED;
      }
      const ox = (du ? du.x : (u.x||0)) - camX, oy = (du ? du.y : (u.y||0));
      const uFacing = (typeof u.facing === 'number')?u.facing:1;
      const uSkin = (typeof u.skinRow === 'number')?u.skinRow:0;
      drawSpritePlayer(ox, oy, uFacing, uSkin, u);
      // draw HP bar above other user with fade animation
      try{
        if(typeof u.hp === 'number'){
          const pct = Math.max(0, Math.min(1, u.hp / (u.maxHp || player.maxHp || 100)));
          const target = pct < 1 ? 1 : 0;
          if(!hpFadeMap[k]) hpFadeMap[k] = { opacity: target };
          // interpolate opacity toward target
          hpFadeMap[k].opacity += (target - hpFadeMap[k].opacity) * 0.12;
          const op = Math.max(0, Math.min(1, hpFadeMap[k].opacity));
          if(op > 0.02){
            const barW = Math.max(28, Math.round(player.w * 0.9));
            const barH = Math.max(6, Math.round(8 * SCALE));
            const bx = ox + Math.round((player.w - barW)/2);
            const by = oy - 24 + SPRITE_Y_OFFSET;
            ctx.save(); ctx.globalAlpha = op;
            // background
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(bx-1, by-1, barW+2, barH+2);
            // fill
            ctx.fillStyle = hpColor(pct); ctx.fillRect(bx, by, Math.round(barW * pct), barH);
            // border
            ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.strokeRect(bx, by, barW, barH);
            ctx.restore();
          }
        }
      }catch(e){}
      // name tag background
      const name = u.nick || '---';
      const nameFont = Math.max(12, Math.round(12 * SCALE)); ctx.font = fontPx(nameFont);
      const textW = ctx.measureText(name).width; const pad = Math.round(18 * SCALE);
      const cx = ox + player.w/2; const rx = cx - (textW/2) - pad; const ry = oy - nameFont - Math.round(36 * SCALE) + SPRITE_Y_OFFSET;
      const nameBgW = textW + pad*2; const nameBgH = nameFont + Math.round(24 * SCALE);
      if(nameTagImgLoaded){ ctx.drawImage(nameTagImg, 0,0, nameTagImg.width, nameTagImg.height, rx, ry, nameBgW, nameBgH); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(rx, ry, nameBgW, nameBgH); }
      // vertically center text inside the name background so only the background is moved
      const textY = ry + Math.round((nameBgH - nameFont) / 2) + 4;
      ctx.fillStyle = '#06202a'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(name, rx + pad, textY);
      // draw a small blue group marker to the left of the name tag when this user is in our group
      try{
        if(u && u.group && myGroup && u.group === myGroup){
          const markerX = rx - Math.round(12 * SCALE);
          const markerY = ry + Math.round(nameBgH/2);
          ctx.save();
          ctx.beginPath(); ctx.fillStyle = '#60a5fa'; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
          ctx.arc(markerX, markerY, Math.max(3, Math.round(4 * (SCALE/3))), 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
      }catch(e){}
      // chat bubble if exists
      const bubble = chatBubbles[k];
      if(bubble && bubble.expires > Date.now()){
        const btext = bubble.text;
        const bfont = Math.max(14, Math.round(14 * SCALE)); ctx.font = fontPx(bfont);
        const bw = ctx.measureText(btext).width + pad*2; const bh = bfont + 10;
        const bx = cx - bw/2; const by = ry - bh - 8;
        // bubble background
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(bx, by, bw, bh);
        // pointer
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.moveTo(cx - 6, by + bh); ctx.lineTo(cx + 6, by + bh); ctx.lineTo(cx, by + bh + 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#06202a'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(btext, bx + pad, by + 4);
      }
    }

    // draw local player (sprite + name tag)
    const localX = player.x - camX;
    drawSpritePlayer(localX, player.y, player.facing, player.skinRow);
    // draw local player's HP bar above the character with fade animation
    try{
      const pct = Math.max(0, Math.min(1, player.hp / (player.maxHp || 100)));
      const key = uid;
      const target = pct < 1 ? 1 : 0;
      if(!hpFadeMap[key]) hpFadeMap[key] = { opacity: target };
      hpFadeMap[key].opacity += (target - hpFadeMap[key].opacity) * 0.12;
      const op = Math.max(0, Math.min(1, hpFadeMap[key].opacity));
      if(op > 0.02){
        const barW = Math.max(40, Math.round(player.w * 1.0));
        const barH = Math.max(8, Math.round(10 * SCALE));
        const bx = localX + Math.round((player.w - barW)/2);
        const by = player.y - 34; // slightly above head, below name tag
        ctx.save(); ctx.globalAlpha = op;
        // background
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(bx-1, by-1, barW+2, barH+2);
        ctx.fillStyle = hpColor(pct); ctx.fillRect(bx, by, Math.round(barW * pct), barH);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.strokeRect(bx, by, barW, barH);
        ctx.restore();
      }
    }catch(e){}
    // local name tag with background (slightly higher)
    const localName = player.nick || '---';
    const localFont = Math.max(18, Math.round(18 * SCALE)); ctx.font = fontPx(localFont);
    const localW = ctx.measureText(localName).width; const lpad = Math.round(20 * SCALE);
    const lcx = localX + player.w/2; const lrx = lcx - (localW/2) - lpad; const lry = player.y - localFont - Math.round(44 * SCALE) + SPRITE_Y_OFFSET;
    const localBgW = localW + lpad*2; const localBgH = localFont + Math.round(28 * SCALE);
    if(nameTagImgLoaded){ ctx.drawImage(nameTagImg, 0,0, nameTagImg.width, nameTagImg.height, lrx, lry, localBgW, localBgH); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(lrx, lry, localBgW, localBgH); }
    // vertically center local name text inside the background
    const localTextY = lry + Math.round((localBgH - localFont) / 2) + 4;
    ctx.fillStyle = '#06202a'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(localName, lrx + lpad, localTextY);
    // local chat bubble
    const myBubble = chatBubbles[uid];
    if(myBubble && myBubble.expires > Date.now()){
      const btext = myBubble.text; const bfont = Math.max(14, Math.round(14 * SCALE)); ctx.font = fontPx(bfont);
      const bw = ctx.measureText(btext).width + lpad*2; const bh = bfont + 10; const bx = lcx - bw/2; const by = lry - bh - 8;
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.moveTo(lcx - 6, by + bh); ctx.lineTo(lcx + 6, by + bh); ctx.lineTo(lcx, by + bh + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#06202a'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(btext, bx + lpad, by + 4);
    }

    // draw entrance hint (if set) after drawing players/name tags so it isn't occluded
    // compute bulletin board hint visibility
    try{
      if(map.board && player.map !== 'corridor'){
        const bxCenter = map.board.x + (map.board.w/2);
        const dx = Math.abs((player.x + player.w/2) - bxCenter);
        const byCenter = map.board.y + (map.board.h/2);
        const dy = Math.abs((player.y + player.h) - byCenter);
        if(dx <= (map.board.interactRange || 160) && dy <= 220){
          window.__boardHint = { text: '[spacebar를 눌러 상호작용]', worldX: bxCenter, worldY: map.board.y - 120 };
        } else { window.__boardHint = null; }
      } else { window.__boardHint = null; }
    }catch(e){}

    try{
      if(window.__entranceHint){
        const h = window.__entranceHint;
        const sx = Math.round(h.worldX - camX);
        const rawSy = h.worldY;
        // clamp vertically so hint is always visible on screen
        const sy = Math.max(16, Math.min(VIEW_H - 48, Math.round(rawSy)));
        if(sx > -400 && sx < VIEW_W + 400){
          const text = h.text || '[spacebar를 눌러 상호작용]';
          ctx.font = fontPx(18);
          const tw = ctx.measureText(text).width + 18;
          const hx = sx - tw/2; const hy = sy;
          ctx.fillStyle = 'rgba(2,6,23,0.88)'; ctx.beginPath(); const rr = 8; ctx.moveTo(hx+rr, hy); ctx.arcTo(hx+tw, hy, hx+tw, hy+36, rr); ctx.arcTo(hx+tw, hy+36, hx, hy+36, rr); ctx.arcTo(hx, hy+36, hx, hy, rr); ctx.arcTo(hx, hy, hx+tw, hy, rr); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, sx, hy + 18);
        }
      }
        // draw debug marker for entrance hint (visible red dot + yellow text) to verify rendering
        
      // also draw board hint if present
      if(window.__boardHint){
        const b = window.__boardHint; const sx = Math.round(b.worldX - camX); const sy = b.worldY;
        if(sx > -400 && sx < VIEW_W + 400){
          const text = b.text || '[spacebar를 눌러 상호작용]'; ctx.font = fontPx(16);
          const tw = ctx.measureText(text).width + 16; const hx = sx - tw/2; const hy = sy; const rr = 8;
          ctx.fillStyle = 'rgba(4,8,16,0.9)'; ctx.beginPath(); ctx.moveTo(hx+rr, hy); ctx.arcTo(hx+tw, hy, hx+tw, hy+32, rr); ctx.arcTo(hx+tw, hy+32, hx, hy+32, rr); ctx.arcTo(hx, hy+32, hx, hy, rr); ctx.arcTo(hx, hy, hx+tw, hy, rr); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, sx, hy + 16);
        }
      }
    }catch(e){}

    try{ updateAttackCooldownUI(Date.now()); }catch(e){}
    // draw heal floating effects (green ++) above healed players
    try{
      // update and draw particles
      for(let i = particles.length - 1; i >= 0; --i){ const p = particles[i]; p.life += 16; if(p.life >= p.maxLife){ particles.splice(i,1); continue; } p.x += p.vx * (16/16); p.y += p.vy * (16/16); p.vy += 0.06; const alpha = Math.max(0, 1 - (p.life / p.maxLife)); if(p.x - camX + 0 < -200 || p.x - camX > VIEW_W + 200) continue; ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = p.color || '#fff'; const s = Math.max(1, p.size * (1 - p.life / p.maxLife)); ctx.beginPath(); ctx.arc(Math.round(p.x - camX), Math.round(p.y), s, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
      // draw damage floating texts
      for(let i = damageEffects.length - 1; i >= 0; --i){ const ef = damageEffects[i]; const sx = ef.x - camX; const age = Date.now() - ef.created; ef.y += ef.dy; ef.alpha = Math.max(0, 1 - (age / 900)); if(ef.alpha <= 0){ damageEffects.splice(i,1); continue; } ctx.save(); ctx.globalAlpha = ef.alpha; ctx.fillStyle = '#ff6b6b'; ctx.font = fontPx(Math.max(14, Math.round(16 * SCALE))); ctx.textAlign = 'center'; ctx.fillText(ef.text, sx, ef.y); ctx.restore(); }
      for(let i = healEffects.length - 1; i >= 0; --i){ const ef = healEffects[i]; const screenX = ef.x - camX; const screenY = ef.y; const age = Date.now() - ef.created;
        // animate: rise and fade
        ef.y += ef.dy; ef.alpha = Math.max(0, (1200 - age) / 1200);
        if(ef.alpha <= 0){ healEffects.splice(i,1); continue; }
        if(screenX + 0 < -200 || screenX > VIEW_W + 200) continue; // offscreen skip
        ctx.save(); ctx.globalAlpha = ef.alpha; ctx.fillStyle = '#16a34a'; ctx.font = fontPx(Math.max(14, Math.round(16 * SCALE)));
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ef.text || '+', screenX, screenY);
        ctx.restore(); }
    }catch(e){}
    // diagnostics: record frame time
    try{
      const __diagEnd = performance.now(); const __frameMs = (__diagEnd - __diagStart);
      if(window.__diagEnabled){ window.__diagHistory.push(__frameMs); if(window.__diagHistory.length > window.__diagSamples) window.__diagHistory.shift(); const sum = window.__diagHistory.reduce((a,b)=>a+b,0); window.__diagAvg = sum / window.__diagHistory.length; window.__diagMax = Math.max(window.__diagMax, __frameMs); if(__frameMs > window.__diagThreshold) console.warn('Slow frame', Math.round(__frameMs) + 'ms');
        // draw diag overlay
        ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = 'rgba(0,0,0,0.6)'; const dx = VIEW_W - 220; const dy = 8; ctx.fillRect(dx, dy, 212, 64); ctx.fillStyle = '#fff'; ctx.font = fontPx(12); ctx.textAlign='left'; ctx.fillText('Frame: ' + __frameMs.toFixed(1) + ' ms', dx + 8, dy + 18); ctx.fillText('Avg: ' + (window.__diagAvg||0).toFixed(1) + ' ms', dx + 8, dy + 34); ctx.fillText('Max: ' + (window.__diagMax||0).toFixed(1) + ' ms', dx + 8, dy + 50); ctx.restore(); }
    }catch(e){}
    // draw minimap in sidebar
    try{ if(window.__showVisuals !== false) drawMiniMap(); }catch(e){}
    requestAnimationFrame(render);
  }

  // ---------------- Multiplayer sync ----------------
  let otherUsers = {};
  // displayUsers holds interpolated positions for smoother rendering
  const displayUsers = {};
  db.ref('users').on('value', snap=>{
    const fresh = snap.val() || {};
    // update otherUsers reference
    otherUsers = fresh;
    // initialize displayUsers for any new entries, preserve existing display positions
    for(const k in fresh){ if(!fresh.hasOwnProperty(k)) continue; if(k === uid) continue; const u = fresh[k]; if(!displayUsers[k]){ displayUsers[k] = { x: (u.x||0), y: (u.y||0), lastTs: Date.now(), targetX: (u.x||0), targetY: (u.y||0) }; } else { displayUsers[k].targetX = (u.x||0); displayUsers[k].targetY = (u.y||0); displayUsers[k].lastTs = Date.now(); } }
    // remove displayUsers for entries no longer present
    for(const k in displayUsers){ if(!fresh[k]) delete displayUsers[k]; }
  });

  // ---------------- Player interaction / context menu ----------------
  // Utility: convert screen (canvas) coords to world coords using player's camera logic
  function screenToWorld(screenX, screenY){
    try{
      const map = MAPS[player.map] || MAPS.hallway || { width: VIEW_W, height: VIEW_H };
      const camX = Math.max(0, Math.min((map.width || VIEW_W) - VIEW_W, (player.x || 0) - VIEW_W/2 + ((player.w||32)/2)));
      const worldX = Math.round(camX + screenX);
      // vertical camera is centered in render; for most maps y in canvas equals world y
      const worldY = Math.round(screenY);
      return { x: worldX, y: worldY };
    }catch(e){ return { x: screenX, y: screenY }; }
  }

  // Find a user at world coordinates (simple AABB hit test)
  function getUserAtWorld(wx, wy){
    try{
      // Prefer the closest user within an expanded hit area (center-distance check)
      let best = null; let bestDist = Infinity;
      for(const k in otherUsers){
        if(!otherUsers.hasOwnProperty(k)) continue;
        if(k === uid) continue; // skip self
        const u = otherUsers[k]; if(!u) continue;
        if(u.map !== player.map) continue;
        const uw = u.w || PLAYER_W || 48; const uh = u.h || PLAYER_H || 64;
        const ux = (u.x || 0); const uy = (u.y || 0);
        const cx = ux + uw/2; const cy = uy + uh/2;
        // dynamic padding: at least 40x40, scale with player size for larger sprites
        const padX = Math.max(40, Math.round(uw * 0.9));
        const padY = Math.max(48, Math.round(uh * 0.9));
        const dx = Math.abs(wx - cx); const dy = Math.abs(wy - cy);
        if(dx <= padX && dy <= padY){
          const dist = Math.hypot(dx, dy);
          if(dist < bestDist){ bestDist = dist; best = { uid: k, user: u }; }
        }
      }
      return best;
    }catch(e){ console.warn('getUserAtWorld failed', e); }
    return null;
  }

  // Create context menu element (lazy)
  function ensurePlayerContextMenu(){
    if(document.getElementById('player-context-menu')) return document.getElementById('player-context-menu');
    const el = document.createElement('div'); el.id = 'player-context-menu';
    el.style.position = 'fixed'; el.style.background = '#0b1220'; el.style.color = '#e6eef8'; el.style.padding = '8px'; el.style.borderRadius = '8px'; el.style.boxShadow = '0 8px 24px rgba(2,6,23,0.5)'; el.style.zIndex = 14000; el.style.minWidth = '160px'; el.style.fontFamily = FONT_FAMILY; el.style.display = 'none';
    el.style.fontSize = '13px';
    function menuItem(label, onClick){ const b = document.createElement('div'); b.textContent = label; b.style.padding = '10px 12px'; b.style.cursor = 'pointer'; b.style.borderRadius = '6px'; b.style.margin = '6px 0'; b.style.fontSize = '15px'; b.style.fontWeight = '600'; b.addEventListener('click', onClick); b.addEventListener('mouseenter', ()=>{ b.style.background = 'rgba(255,255,255,0.05)'; }); b.addEventListener('mouseleave', ()=>{ b.style.background = 'transparent'; }); return b; }
    el.appendChild(menuItem('프로필 보기', ()=>{ hideContextMenu(); openPlayerProfile(currentContextTargetUid); }));
    el.appendChild(menuItem('귓속말 보내기', ()=>{ hideContextMenu(); try{ openWhisperModal(currentContextTargetUid); }catch(e){ console.error('openWhisperModal failed', e); } }));
    el.appendChild(menuItem('아이템 주기', ()=>{ hideContextMenu(); try{ const tgt = otherUsers && otherUsers[currentContextTargetUid]; const nick = tgt && tgt.nick ? tgt.nick : null; if(nick){ try{ openGiveModalForTarget(nick); }catch(e){ console.error('openGiveModalForTarget missing', e); openGiveModal(); } } else { openGiveModal(); } }catch(e){ console.error('player context item give failed', e); } }));
    el.appendChild(menuItem('돈 주기', ()=>{ hideContextMenu(); try{ openMoneyModal(currentContextTargetUid); }catch(e){ console.error('돈 주기 click failed', e); } }));
    el.appendChild(menuItem('그룹에 초대', ()=>{ hideContextMenu(); addLog('그룹 초대 클릭'); }));
    el.appendChild(menuItem('배틀 요청', ()=>{ hideContextMenu(); openBattleRequestModal(currentContextTargetUid); }));
    el.style.minWidth = '220px';
    document.body.appendChild(el);
    return el;
  }

  // Hover tip for clickable players
  let currentHoverUid = null;
  function ensureHoverTip(){
    let t = document.getElementById('player-hover-tip'); if(t) return t;
    t = document.createElement('div'); t.id = 'player-hover-tip'; t.textContent = '[클릭하기]';
    t.style.position = 'fixed'; t.style.background = 'rgba(2,6,23,0.94)'; t.style.color = '#e6eef8'; t.style.padding = '10px 14px'; t.style.borderRadius = '8px'; t.style.fontFamily = FONT_FAMILY; t.style.fontSize = '16px'; t.style.zIndex = 26000; t.style.display = 'none'; t.style.pointerEvents = 'none'; t.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)'; t.style.fontWeight = '700'; t.style.minWidth = '86px'; t.style.textAlign = 'center';
    // subtle scale for readability on high-DPI
    t.style.transformOrigin = 'left top';
    document.body.appendChild(t);
    return t;
  }

  function showContextMenuAt(x,y,targetUid){
    try{
      const el = ensurePlayerContextMenu(); currentContextTargetUid = targetUid; el.style.left = (x + 6) + 'px'; el.style.top = (y + 6) + 'px'; el.style.display = 'block';
    }catch(e){}
  }
  function hideContextMenu(){ try{ const el = document.getElementById('player-context-menu'); if(el) el.style.display = 'none'; currentContextTargetUid = null; }catch(e){} }

  // Battle request modal (tabs)
  let currentContextTargetUid = null;
  function openBattleRequestModal(targetUid){
    try{
      if(!targetUid) return addLog('대상을 찾을 수 없습니다.');
      // lazy create
      let modal = document.getElementById('battle-request-modal');
      if(!modal){
        modal = document.createElement('div'); modal.id = 'battle-request-modal'; modal.style.position = 'fixed'; modal.style.left = '50%'; modal.style.top = '50%'; modal.style.transform = 'translate(-50%,-50%)'; modal.style.background = '#fff'; modal.style.color = '#061426'; modal.style.padding = '12px'; modal.style.borderRadius = '10px'; modal.style.zIndex = 15000; modal.style.minWidth = '320px'; modal.style.boxShadow='0 12px 36px rgba(0,0,0,0.3)';
        modal.innerHTML = `
          <div style="font-weight:700;margin-bottom:8px">배틀 요청</div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <button class="br-tab" data-type="clicker">광클 배틀</button>
            <button class="br-tab" data-type="typing">타자 배틀</button>
            <button class="br-tab" data-type="duel">맞짱</button>
          </div>
          <div id="br-note" style="margin-bottom:8px;color:#475569">배틀 유형을 선택하세요.</div>
          <div style="display:flex;gap:8px;justify-content:flex-end"><button id="br-cancel">취소</button><button id="br-send" style="background:#2563eb;color:#fff;border:none;padding:6px 10px;border-radius:6px">전송</button></div>
        `;
        document.body.appendChild(modal);
        modal.querySelectorAll('.br-tab').forEach(b=>{ b.style.padding='8px'; b.style.border='1px solid #e6eef8'; b.style.background='#f8fafc'; b.style.borderRadius='6px'; b.style.cursor='pointer'; b.addEventListener('click', ()=>{ modal.querySelectorAll('.br-tab').forEach(tb=>tb.style.background='#f8fafc'); b.style.background='#dbeafe'; document.getElementById('br-note').textContent = '선택: ' + b.textContent; modal.dataset.selected = b.getAttribute('data-type'); }); });
        document.getElementById('br-cancel').addEventListener('click', ()=>{ modal.style.display='none'; });
        document.getElementById('br-send').addEventListener('click', ()=>{ const t = modal.dataset.selected || 'clicker'; sendBattleRequest(currentContextTargetUid, t); modal.style.display='none'; });
      }
      modal.dataset.selected = 'clicker'; modal.querySelectorAll('.br-tab').forEach(tb=>tb.style.background='#f8fafc'); modal.querySelector('.br-tab[data-type="clicker"]').style.background='#dbeafe'; document.getElementById('br-note').textContent = '선택: 광클 배틀'; modal.style.display = 'block'; currentContextTargetUid = targetUid;
    }catch(e){ console.warn('openBattleRequestModal failed', e); }
  }

  // store last context coordinates for positioning profile modal
  let lastContextClientX = null, lastContextClientY = null;
  // override showContextMenuAt to remember coords
  const _origShowContext = showContextMenuAt;
  showContextMenuAt = function(x,y,targetUid){ try{ lastContextClientX = x; lastContextClientY = y; _origShowContext(x,y,targetUid); }catch(e){ try{ _origShowContext(x,y,targetUid); }catch(_){} } };

  // Player profile modal (shows above click point, includes image)
  function openPlayerProfile(targetUid){
    try{
      if(!targetUid) return addLog('대상을 찾을 수 없습니다.');
      const u = otherUsers[targetUid] || null;
      // create modal
      let modal = document.getElementById('player-profile-modal-' + targetUid);
      if(modal){ modal.style.display = 'block'; return; }
      modal = document.createElement('div'); modal.id = 'player-profile-modal-' + targetUid; modal.style.position = 'fixed'; modal.style.zIndex = 17000; modal.style.background = '#fff'; modal.style.color = '#06202a'; modal.style.padding = '12px'; modal.style.borderRadius = '10px'; modal.style.boxShadow = '0 12px 36px rgba(0,0,0,0.28)'; modal.style.minWidth = '280px'; modal.style.fontFamily = FONT_FAMILY;
      const imgSrc = (u && (typeof u.skinRow !== 'undefined') && u.skinRow === 0) ? 'm0.png' : 'f0.png';
      modal.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <img id="pp-img" src="${imgSrc}" style="width:96px;height:96px;border-radius:8px;object-fit:cover;border:1px solid #e6eef8" />
          <div style="flex:1">
            <div style="font-weight:800;font-size:16px;margin-bottom:4px">${(u && u.nick) ? u.nick : '익명'}</div>
            <div style="color:#475569;margin-bottom:6px">성별: ${((u && typeof u.skinRow !== 'undefined') ? (u.skinRow === 0 ? '남' : '여') : '알수없음')}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button id="pp-battle" style="padding:8px 10px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer">배틀 요청</button>
              <button id="pp-whisper" style="padding:8px 10px;background:#0ea5a4;color:#012;border:none;border-radius:6px;cursor:pointer">귓속말</button>
              <button id="pp-item" style="padding:8px 10px;background:#f59e0b;color:#012;border:none;border-radius:6px;cursor:pointer">아이템 주기</button>
              <button id="pp-gold" style="padding:8px 10px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer">골드 주기</button>
              <button id="pp-group" style="padding:8px 10px;background:#7c3aed;color:#fff;border:none;border-radius:6px;cursor:pointer">그룹에 초대</button>
            </div>
          </div>
        </div>
        <div style="text-align:right;margin-top:8px"><button id="pp-close" style="padding:6px 8px;border-radius:6px;border:1px solid #e6eef8;background:#fff;cursor:pointer">닫기</button></div>
      `;
      document.body.appendChild(modal);
      // position above last context point if available
      try{
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
        const cx = lastContextClientX || (vw/2); const cy = lastContextClientY || (vh/2);
        // default offset upward
        const offY = 160; let left = cx - 140; let top = cy - offY - 20;
        if(left < 8) left = 8; if(left + 280 > vw - 8) left = vw - 8 - 280; if(top < 8) top = 8;
        modal.style.left = left + 'px'; modal.style.top = top + 'px';
      }catch(e){}
      // wire actions
      document.getElementById('pp-close').addEventListener('click', ()=>{ try{ modal.remove(); }catch(e){} });
      document.getElementById('pp-battle').addEventListener('click', ()=>{ try{ openBattleRequestModal(targetUid); modal.remove(); }catch(e){} });
      document.getElementById('pp-whisper').addEventListener('click', ()=>{ try{ openWhisperModal(targetUid); modal.remove(); }catch(e){} });
      document.getElementById('pp-item').addEventListener('click', ()=>{ try{ const nick = (u && u.nick) ? u.nick : ''; openGiveModalForTarget(nick); modal.remove(); }catch(e){} });
      document.getElementById('pp-gold').addEventListener('click', ()=>{ try{ openMoneyModal(targetUid); modal.remove(); }catch(e){} });
      document.getElementById('pp-group').addEventListener('click', ()=>{ try{ sendGroupInvite(targetUid); modal.remove(); }catch(e){} });
    }catch(e){ console.error('openPlayerProfile failed', e); }
  }

  // Whisper modal and DB send
  function openWhisperModal(targetUid){
    try{
      if(!targetUid) return addLog('대상이 없습니다.');
      let wm = document.getElementById('whisper-modal-' + targetUid);
      if(wm){ wm.style.display = 'block'; return; }
      wm = document.createElement('div'); wm.id = 'whisper-modal-' + targetUid; wm.style.position='fixed'; wm.style.zIndex=18000; wm.style.left='50%'; wm.style.top='50%'; wm.style.transform='translate(-50%,-50%)'; wm.style.background='#fff'; wm.style.color='#06202a'; wm.style.padding='12px'; wm.style.borderRadius='10px'; wm.style.boxShadow='0 12px 36px rgba(0,0,0,0.28)'; wm.style.minWidth='360px'; wm.style.fontFamily=FONT_FAMILY;
      const other = otherUsers[targetUid] || {};
      wm.innerHTML = `
        <div style="font-weight:700;margin-bottom:8px">귓속말 to ${(other.nick||targetUid)}</div>
        <textarea id="whisper-input-${targetUid}" style="width:100%;min-height:84px;padding:8px;border:1px solid #e6eef8;border-radius:6px"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button id="whisper-cancel-${targetUid}" style="padding:8px 10px">취소</button>
          <button id="whisper-send-${targetUid}" style="padding:8px 12px;background:#2563eb;color:#fff;border:none;border-radius:6px">전송</button>
        </div>
      `;
      document.body.appendChild(wm);
      document.getElementById('whisper-cancel-' + targetUid).addEventListener('click', ()=>{ try{ wm.remove(); }catch(e){} });
      document.getElementById('whisper-send-' + targetUid).addEventListener('click', ()=>{
        try{
          const ta = document.getElementById('whisper-input-' + targetUid); if(!ta) return;
          const txt = (ta.value || '').trim(); if(!txt) return;
          const ref = db.ref('whispers/' + targetUid);
          const payload = { fromUid: uid, fromNick: (player && player.nick) ? player.nick : '익명', text: txt, ts: Date.now() };
          ref.push(payload).then(()=>{
            // optionally show sender a confirmation in their chat
            const el = document.createElement('div'); el.innerHTML = `<em>[귓속말(보냄) to ${escapeHtml(other.nick||targetUid)}]</em>: ${escapeHtml(txt)}`; chatLog.appendChild(el); chatLog.scrollTop = chatLog.scrollHeight;
          }).catch((e)=>{ addLog('귓속말 전송 실패'); console.error(e); });
          try{ wm.remove(); }catch(e){}
        }catch(e){ console.error('whisper send failed', e); }
      });
    }catch(e){ console.error('openWhisperModal failed', e); }
  }

  // Listen for whispers addressed to this user and display in chat with special format
  try{
    db.ref('whispers/' + uid).on('child_added', snap=>{
      try{
        const m = snap.val(); if(!m) return;
        const el = document.createElement('div'); el.innerHTML = `<strong>[귓속말:${escapeHtml(m.fromNick)}]</strong>: ${escapeHtml(m.text)}`; chatLog.appendChild(el); chatLog.scrollTop = chatLog.scrollHeight;
        // remove after delivering to avoid duplicate deliveries
        try{ snap.ref.remove().catch(()=>{}); }catch(e){}
      }catch(e){ console.error('whisper child_added handler failed', e); }
    });
  }catch(e){ console.warn('attach whispers listener failed', e); }

  // ---------------- Battles: global listener & handlers ----------------
  // floating widgets per battle+player: visible above players' heads for all clients
  const activeBattleWidgets = {}; // keys: `${bId}_${uid}` -> { el, raf }
  function ensureBattleWidget(bId, targetUid, targetNick){
    const key = bId + '_' + targetUid;
    if(activeBattleWidgets[key]) return activeBattleWidgets[key];
    const el = document.createElement('div'); el.id = 'battle-widget-' + key; el.style.position='fixed'; el.style.zIndex=19020; el.style.pointerEvents='none'; el.style.fontFamily = FONT_FAMILY; el.style.transition = 'transform 120ms linear';
    el.style.display = 'flex'; el.style.flexDirection = 'column'; el.style.alignItems = 'center';
    const box = document.createElement('div'); box.style.background = 'linear-gradient(180deg,#fffaf0,#fff6ee)'; box.style.border = '4px solid rgba(249,115,22,0.95)'; box.style.borderRadius = '10px'; box.style.padding = '6px 8px'; box.style.boxShadow = '0 8px 20px rgba(0,0,0,0.28)'; box.style.display = 'flex'; box.style.flexDirection='column'; box.style.alignItems='center'; box.style.minWidth = '160px';
    const title = document.createElement('div'); title.textContent = (targetNick||targetUid); title.style.fontWeight='800'; title.style.fontSize='12px'; title.style.marginBottom='6px'; title.style.color = '#0b1220';
    const hitText = document.createElement('div'); hitText.textContent = '미친듯이 누르세요!'; hitText.style.fontWeight='900'; hitText.style.fontSize='14px'; hitText.style.marginBottom='6px'; hitText.style.color = '#b45309';
    const countEl = document.createElement('div'); countEl.id = 'battle-widget-count-' + key; countEl.textContent = '0'; countEl.style.fontSize='20px'; countEl.style.fontWeight='900'; countEl.style.color='#051025';
    box.appendChild(title); box.appendChild(hitText); box.appendChild(countEl); el.appendChild(box);
    document.body.appendChild(el);

    // if this widget belongs to local player, make it clickable
    if(targetUid === uid){ box.style.pointerEvents = 'auto'; box.style.cursor = 'pointer'; box.addEventListener('click', ()=>{ try{ // increment local count and write to DB
        if(!player.isInBattle || player.currentBattleId !== bId) return; const cur = parseInt(countEl.textContent||'0')||0; const next = cur + 1; countEl.textContent = next; db.ref('battles/' + bId + '/counts/' + uid).set(next).catch(()=>{});
      }catch(e){ console.error('local widget click failed', e); } });
    }

    // position updater
    let raf = null;
    function update(){
      try{
        const who = (targetUid === uid) ? player : otherUsers[targetUid];
        if(!who) { el.style.display = 'none'; } else {
          el.style.display = 'flex';
          const mapW = (MAPS && MAPS[who.map] && MAPS[who.map].width) ? MAPS[who.map].width : VIEW_W;
          const camX = Math.max(0, Math.min(mapW - VIEW_W, (player.x || 0) - VIEW_W/2 + (player.w||PLAYER_W)/2));
          const screenX = (who.x || 0) - camX;
          const pageLeft = (screenX + (window.innerWidth - VIEW_W)/2 + ((who.w||PLAYER_W)/2));
          const pageTop = Math.round((who.y || 0) - el.offsetHeight - 12 + (window.innerHeight - VIEW_H)/2);
          // offset widget slightly left and up for better visibility (moved further left)
          const OFF_X = -195; const OFF_Y = -200;
          el.style.left = Math.round(pageLeft - (el.offsetWidth/2) + OFF_X) + 'px'; el.style.top = (pageTop + OFF_Y) + 'px';
        }
      }catch(e){}
      raf = requestAnimationFrame(update);
    }
    update();
    activeBattleWidgets[key] = { el: el, raf: raf };
    return activeBattleWidgets[key];
  }

  function updateBattleWidgetCount(bId, uidToUpdate, count){
    try{ const key = bId + '_' + uidToUpdate; const c = document.getElementById('battle-widget-count-' + key); if(c) c.textContent = String(count||0); }catch(e){}
  }

  function removeBattleWidgetsForBattle(bId){
    try{ Object.keys(activeBattleWidgets).forEach(k=>{ if(k.indexOf(bId + '_') === 0){ const obj = activeBattleWidgets[k]; try{ if(obj.raf) cancelAnimationFrame(obj.raf); }catch(e){} try{ if(obj.el) obj.el.remove(); }catch(e){} delete activeBattleWidgets[k]; } }); }catch(e){}
  }

  // handle new battle session
  db.ref('battles').on('child_added', snap=>{
    try{
      const b = snap.val(); const id = snap.key; if(!b) return;
      // create floating widgets above both participants so everyone can see hitbox text and counts
      try{ ensureBattleWidget(id, b.initiator, b.initiatorNick || b.initiator); ensureBattleWidget(id, b.target, b.targetNick || b.target); }catch(e){}
      // start local handling if this client is participant
      if(b.initiator === uid || b.target === uid) startLocalBattle(id,b);
    }catch(e){ console.error('battles child_added handler', e); }
  });

  // listen for changes (counts/status)
  db.ref('battles').on('child_changed', snap=>{
    try{
      const b = snap.val(); const id = snap.key; if(!b) return;
      // update floating widget counts for both participants
      try{ const counts = b.counts || {}; updateBattleWidgetCount(id, b.initiator, counts[b.initiator] || 0); updateBattleWidgetCount(id, b.target, counts[b.target] || 0); }catch(e){}
      // if finished, show result overlays and cleanup
      if(b.status === 'finished'){
        showBattleResult(id,b);
      }
    }catch(e){ console.error('battles child_changed handler', e); }
  });

  function startLocalBattle(bId, b){
    try{
      // mark local state
      player.currentBattleId = bId; player.isInBattle = true; player.vx = 0; player.vy = 0;
      scheduleUserUpdate();
      // teleport initiator to target position if I'm initiator
      if(uid === b.initiator){
        const tx = (b.targetPos && typeof b.targetPos.x === 'number') ? b.targetPos.x : player.x;
        const ty = (b.targetPos && typeof b.targetPos.y === 'number') ? b.targetPos.y : player.y;
        const newX = tx + (PLAYER_W + 24); const newY = ty;
        player.x = newX; player.y = newY; player.vx = 0; player.vy = 0;
        // face each other
        player.facing = (player.x < tx) ? 1 : -1;
        scheduleUserUpdate();
        // update DB for initiator position
        try{ db.ref('users/' + uid).update({ x: Math.round(player.x), y: Math.round(player.y), vx:0, vy:0 }).catch(()=>{}); }catch(e){}
      }
      // if I'm the target, ensure I'm at the position designated (snap to targetPos)
      if(uid === b.target){
        if(b.targetPos && typeof b.targetPos.x === 'number'){ player.x = b.targetPos.x; player.y = b.targetPos.y; player.vx = 0; player.vy = 0; scheduleUserUpdate(); }
      }

      // prepare overlays: countdown; hitboxes will be created as floating widgets above each player
      const startAt = b.startAt || (Date.now() + 2000);
      const duration = b.duration || 10000;
      createBattleCountdownAndHitbox(bId, b, startAt, duration);
    }catch(e){ console.error('startLocalBattle failed', e); }
  }

  function createBattleCountdownAndHitbox(bId, b, startAt, duration){
    try{
      // create big overlay
      const ovId = 'battle-overlay-' + bId; let ov = document.getElementById(ovId);
      if(ov) ov.remove(); ov = document.createElement('div'); ov.id = ovId; ov.style.position='fixed'; ov.style.left='50%'; ov.style.top='20%'; ov.style.transform='translateX(-50%)'; ov.style.zIndex=19000; ov.style.pointerEvents='none'; ov.style.fontFamily=FONT_FAMILY; document.body.appendChild(ov);
      // show numeric countdown based on startAt
      const numEl = document.createElement('div'); numEl.style.fontSize='120px'; numEl.style.fontWeight='900'; numEl.style.color='#fff'; numEl.style.textAlign='center'; numEl.style.textShadow='0 8px 24px rgba(2,6,23,0.8)'; ov.appendChild(numEl);
      // countdown loop — when countdown ends, ensure floating widgets exist for both participants
      const tick = ()=>{
        const now = Date.now();
        const diff = Math.ceil((startAt - now) / 1000);
        if(now < startAt){
          const num = Math.max(1, diff);
          numEl.textContent = String(num);
          requestAnimationFrame(tick);
          return;
        }
        // start: hide big number, create floating widgets for both participants (visible to all)
        numEl.textContent = '';
        ov.style.display = 'none';
        try{
          ensureBattleWidget(bId, b.initiator, b.initiatorNick || b.initiator);
          ensureBattleWidget(bId, b.target, b.targetNick || b.target);
          // initialize DB counts to 0 for both participants (best-effort)
          try{ db.ref('battles/' + bId + '/counts/' + b.initiator).set(0).catch(()=>{}); }catch(e){}
          try{ db.ref('battles/' + bId + '/counts/' + b.target).set(0).catch(()=>{}); }catch(e){}
        }catch(e){ console.error('ensureBattleWidget on start failed', e); }
        // schedule end
        setTimeout(()=>{ finishBattle(bId); }, duration);
      };

      // Money modal and transfer helpers are defined globally to be accessible from context menus
      requestAnimationFrame(tick);
    }catch(e){ console.error('createBattleCountdownAndHitbox failed', e); }
  }

  // finish battle: compute winner and update DB
  function finishBattle(bId){
    try{
      const ref = db.ref('battles/' + bId + '/counts');
      ref.once('value').then(snap=>{
        const counts = snap.val() || {};
        const battleRef = db.ref('battles/' + bId);
        // determine participants from parent
        db.ref('battles/' + bId).once('value').then(snapb=>{
          const b = snapb.val() || {};
          const a = counts[b.initiator] || 0; const c = counts[b.target] || 0;
          let winner = null; if(a > c) winner = b.initiator; else if(c > a) winner = b.target; else winner = 'draw';
          battleRef.update({ status: 'finished', winner: winner, finalCounts: counts, endedAt: Date.now() }).catch(()=>{});
        }).catch(()=>{});
      }).catch(e=>{ console.error('finishBattle counts read failed', e); });
    }catch(e){ console.error('finishBattle failed', e); }
  }

  function showBattleResult(bId,b){
    try{
      // remove overlays and floating widgets
      const ov = document.getElementById('battle-overlay-' + bId); if(ov) ov.remove();
      try{ // remove any remaining local hitbox id
        const hb = document.getElementById('battle-hitbox-' + bId); if(hb) hb.remove();
      }catch(e){}
      // show floating labels above players
      const showLabel = (uidToShow, text)=>{
        try{
          // prefer to position label at the same screen coords as the battle widget if available
          const key = bId + '_' + uidToShow;
          const widget = document.getElementById('battle-widget-' + key);
          const lab = document.createElement('div'); lab.style.position='fixed'; lab.style.zIndex=20000; lab.style.pointerEvents='none'; lab.style.fontFamily=FONT_FAMILY; lab.style.fontWeight='900'; lab.style.textAlign='center'; lab.style.padding='6px 10px'; lab.style.borderRadius='8px'; lab.style.background = 'transparent';
          // color and big font
          const t = ('' + (text||'')).toLowerCase();
          if(t.indexOf('Win') !== -1){ lab.style.color = '#3b82f6'; }
          else if(t.indexOf('Lose') !== -1){ lab.style.color = '#ef4444'; }
          else { lab.style.color = '#f59e0b'; }
          lab.style.fontSize = '140px'; lab.style.letterSpacing = '2px'; lab.style.lineHeight = '1';
          lab.style.textShadow = '0 18px 48px rgba(2,6,23,0.72), 0 6px 12px rgba(0,0,0,0.5)';
          lab.style.webkitTextStroke = '3px rgba(2,6,23,0.28)'; lab.style.padding = '8px 12px'; lab.style.zIndex = 22000;
          lab.textContent = text;
          document.body.appendChild(lab);
          // immediate positioning so the label appears instantly
          try{
            const LABEL_OFF_X = -220; const LABEL_OFF_Y = -140;
            const keyRect = widget ? widget.getBoundingClientRect() : null;
            if(keyRect){
              const cx = keyRect.left + (keyRect.width/2) + LABEL_OFF_X;
              lab.style.left = Math.round(cx) + 'px'; lab.style.transform = 'translateX(-50%)';
              const ty = Math.round(keyRect.top - (lab.offsetHeight || 140) - 20 + LABEL_OFF_Y);
              lab.style.top = ty + 'px';
            } else {
              const who = (uidToShow === uid) ? player : otherUsers[uidToShow];
              if(who){ const mapW = (MAPS && MAPS[who.map] && MAPS[who.map].width) ? MAPS[who.map].width : VIEW_W; const camX = Math.max(0, Math.min(mapW - VIEW_W, (player.x || 0) - VIEW_W/2 + (player.w||PLAYER_W)/2)); const screenX = (who.x || 0) - camX; const pageLeft = (screenX + (window.innerWidth - VIEW_W)/2 + ((who.w||PLAYER_W)/2)); const pageTop = Math.round((who.y || 0) - (lab.offsetHeight || 140) - 12 + (window.innerHeight - VIEW_H)/2); lab.style.left = Math.round(pageLeft + LABEL_OFF_X) + 'px'; lab.style.transform = 'translateX(-50%)'; lab.style.top = Math.round(pageTop + LABEL_OFF_Y) + 'px'; }
            }
          }catch(e){}
          // follow widget or player position for a short duration
          const start = Date.now();
          const iv = setInterval(()=>{
            try{
              let rect = null;
              if(widget){ rect = widget.getBoundingClientRect(); }
              else {
                const who = (uidToShow === uid) ? player : otherUsers[uidToShow]; if(!who) return;
                const mapW = (MAPS && MAPS[who.map] && MAPS[who.map].width) ? MAPS[who.map].width : VIEW_W;
                const camX = Math.max(0, Math.min(mapW - VIEW_W, (player.x || 0) - VIEW_W/2 + (player.w||PLAYER_W)/2));
                const screenX = (who.x || 0) - camX; const screenY = (who.y || 0);
                const pageLeft = (screenX + (window.innerWidth - VIEW_W)/2 + ((who.w||PLAYER_W)/2));
                const pageTop = Math.round((who.y || 0) - (lab.offsetHeight || 48) - 12 + (window.innerHeight - VIEW_H)/2);
                rect = { left: pageLeft - 0, top: pageTop, width: 0, height: 0 };
              }
              if(rect){
                // center text over widget and nudge up; shift left to align with widget offset
                const LABEL_OFF_X = -200;
                const centerX = rect.left + (rect.width/2) + LABEL_OFF_X;
                lab.style.left = Math.round(centerX) + 'px'; lab.style.transform = 'translateX(-50%)';
                const top = Math.round(rect.top - (lab.offsetHeight || 48) - 6);
                lab.style.top = top + 'px';
              }
            }catch(e){}
            if(Date.now() - start > 4000){ clearInterval(iv); try{ lab.remove(); }catch(e){} }
          }, 80);
        }catch(e){ console.error('showLabel error', e); }
      };
      if(b.winner === 'draw'){ showLabel(b.initiator, 'draw'); showLabel(b.target, 'draw'); }
      else { if(b.winner) showLabel(b.winner, 'Win!'); const loser = (b.winner === b.initiator) ? b.target : (b.winner === b.target ? b.initiator : null); if(loser) showLabel(loser, 'Lose!'); }
      // cleanup local state
      if(player.currentBattleId === bId){ player.isInBattle = false; player.currentBattleId = null; scheduleUserUpdate(); }
      // remove HUD
      removeBattleWidgetsForBattle(bId);
    }catch(e){ console.error('showBattleResult failed', e); }
  }

  // send battle request to DB (target-centric queue)
  function sendBattleRequest(targetUid, type){
    try{
      if(!targetUid) return addLog('대상 없음');
      const typeMap = { clicker: '광클 배틀', typing: '타자 배틀', duel: '맞짱' };
      const typeLabel = typeMap[type] || type || '배틀';
      const ref = db.ref('battleRequests/' + targetUid);
      const payload = { fromUid: uid, fromNick: (player && player.nick) ? player.nick : '익명', type: type || 'clicker', typeLabel: typeLabel, ts: Date.now(), expiresAt: Date.now() + 20000, status: 'pending' };
      const p = ref.push(payload);
      if(p && p.key){ addLog('배틀 요청 전송됨 -> ' + typeLabel + ' to ' + targetUid); }
    }catch(e){ console.error('sendBattleRequest failed', e); addLog('배틀 요청 실패'); }
  }

  // send group invite to target via DB
  function sendGroupInvite(targetUid){
    try{
      if(!targetUid) return addLog('대상 없음');
      // ensure inviter has a group id (leader id)
      let groupId = (player && player.group) ? player.group : (uid);
      if(!player.group){
        // assign inviter to a new group id
        try{ db.ref('users/' + uid + '/group').set(groupId); }catch(e){}
      }
      const ref = db.ref('groupInvites/' + targetUid);
      const payload = { fromUid: uid, fromNick: (player && player.nick) ? player.nick : '익명', groupId: groupId, ts: Date.now(), expiresAt: Date.now() + 30000, status: 'pending' };
      const p = ref.push(payload);
      // reflect local group membership immediately so minimap and UI update without waiting for DB round-trip
      try{ player.group = groupId; if(otherUsers && otherUsers[uid]) otherUsers[uid].group = groupId; }catch(e){}
      if(p && p.key){ addLog('그룹 초대 전송됨 -> ' + ((otherUsers[targetUid] && otherUsers[targetUid].nick) || targetUid)); }
    }catch(e){ console.error('sendGroupInvite failed', e); addLog('그룹 초대 실패'); }
  }

  // Incoming groupInvites listener for current user
  try{
    db.ref('groupInvites/' + uid).on('child_added', snap=>{
      try{
        const req = snap.val(); const reqId = snap.key; if(!req) return; if(req.status && req.status !== 'pending') return;
        showIncomingGroupInvite(reqId, req);
      }catch(e){ console.error('incoming group invite handler error', e); }
    });
  }catch(e){ console.warn('attach groupInvites listener failed', e); }

  function showIncomingGroupInvite(reqId, req){
    try{
      if(document.getElementById('gi-notify-' + reqId)) return;
      const wrap = document.createElement('div'); wrap.id = 'gi-notify-' + reqId; wrap.style.position='fixed'; wrap.style.left='12px'; wrap.style.bottom='12px'; wrap.style.zIndex=16000; wrap.style.background='linear-gradient(180deg,#0b3b2d,#064b38)'; wrap.style.color='#e6eef8'; wrap.style.padding='10px'; wrap.style.borderRadius='8px'; wrap.style.boxShadow='0 8px 24px rgba(0,0,0,0.35)'; wrap.style.minWidth='260px'; wrap.style.fontFamily=FONT_FAMILY;
      const title = document.createElement('div'); title.style.fontWeight='700'; title.style.marginBottom='6px'; title.textContent = (req.fromNick || '누군가') + '님이 그룹에 초대했습니다.';
      const btns = document.createElement('div'); btns.style.display='flex'; btns.style.gap='8px'; btns.style.justifyContent='flex-end'; btns.style.marginTop='8px';
      const accept = document.createElement('button'); accept.textContent='수락'; accept.style.background='#10b981'; accept.style.color='#fff'; accept.style.border='none'; accept.style.padding='6px 10px'; accept.style.borderRadius='6px'; accept.style.cursor='pointer';
      const reject = document.createElement('button'); reject.textContent='거절'; reject.style.background='#ef4444'; reject.style.color='#fff'; reject.style.border='none'; reject.style.padding='6px 10px'; reject.style.borderRadius='6px'; reject.style.cursor='pointer';
      btns.appendChild(reject); btns.appendChild(accept);
      wrap.appendChild(title); wrap.appendChild(btns); document.body.appendChild(wrap);
      accept.addEventListener('click', ()=>{
        try{
          // set our user's group to payload.groupId
          // update local state immediately
          try{ player.group = req.groupId; if(otherUsers && otherUsers[uid]) otherUsers[uid].group = req.groupId; }catch(e){}
          db.ref('users/' + uid + '/group').set(req.groupId).then(()=>{
            addLog('그룹 초대 수락');
            // inform inviter via simple log entry under their own groupInvites node
            try{ db.ref('groupInvites/' + req.fromUid + '/' + reqId).update({ status: 'accepted', responderUid: uid, responderNick: (player&&player.nick)?player.nick:'' }); }catch(e){}
          }).catch(()=>{ addLog('그룹 수락 실패'); });
        }catch(e){ console.error('accept group invite error', e); }
        wrap.remove();
      });
      reject.addEventListener('click', ()=>{ try{ db.ref('groupInvites/' + uid + '/' + reqId).update({ status: 'rejected', responderUid: uid, responderNick: (player&&player.nick)?player.nick:'', respondedAt: Date.now() }).catch(()=>{}); }catch(e){} wrap.remove(); });
    }catch(e){ console.error('showIncomingGroupInvite failed', e); }
  }

  // Incoming battleRequests listener for current user
  try{
    db.ref('battleRequests/' + uid).on('child_added', snap=>{
      try{
        const req = snap.val(); const reqId = snap.key; if(!req) return;
        // ignore non-pending
        if(req.status && req.status !== 'pending') return;
        showIncomingBattleRequest(reqId, req);
      }catch(e){ console.error('incoming request handler error', e); }
    });
  }catch(e){ console.warn('attach battleRequests listener failed', e); }

  function showIncomingBattleRequest(reqId, req){
    try{
      // avoid duplicate UI
      if(document.getElementById('br-notify-' + reqId)) return;
      const wrap = document.createElement('div'); wrap.id = 'br-notify-' + reqId; wrap.style.position='fixed'; wrap.style.left='12px'; wrap.style.bottom='12px'; wrap.style.zIndex=16000; wrap.style.background='linear-gradient(180deg,#04273a,#063247)'; wrap.style.color='#e6eef8'; wrap.style.padding='10px'; wrap.style.borderRadius='8px'; wrap.style.boxShadow='0 8px 24px rgba(0,0,0,0.35)'; wrap.style.minWidth='260px'; wrap.style.fontFamily=FONT_FAMILY;
      const typeMap = { clicker: '광클 배틀', typing: '타자 배틀', duel: '맞짱' };
      const label = req.typeLabel || typeMap[req.type] || (req.type || '배틀');
      const title = document.createElement('div'); title.style.fontWeight='700'; title.style.marginBottom='6px'; title.textContent = (req.fromNick || '누군가') + '님이 ' + label + '을 요청합니다.';
      const btns = document.createElement('div'); btns.style.display='flex'; btns.style.gap='8px'; btns.style.justifyContent='flex-end'; btns.style.marginTop='8px';
      const accept = document.createElement('button'); accept.textContent='수락'; accept.style.background='#10b981'; accept.style.color='#fff'; accept.style.border='none'; accept.style.padding='6px 10px'; accept.style.borderRadius='6px'; accept.style.cursor='pointer';
      const reject = document.createElement('button'); reject.textContent='거절'; reject.style.background='#ef4444'; reject.style.color='#fff'; reject.style.border='none'; reject.style.padding='6px 10px'; reject.style.borderRadius='6px'; reject.style.cursor='pointer';
      const timerBar = document.createElement('div'); timerBar.style.height='6px'; timerBar.style.background='rgba(255,255,255,0.08)'; timerBar.style.borderRadius='4px'; timerBar.style.marginTop='8px'; const timerInner = document.createElement('div'); timerInner.style.height='100%'; timerInner.style.width='100%'; timerInner.style.background='#60a5fa'; timerInner.style.borderRadius='4px'; timerBar.appendChild(timerInner);
      btns.appendChild(reject); btns.appendChild(accept);
      wrap.appendChild(title); wrap.appendChild(timerBar); wrap.appendChild(btns);
      document.body.appendChild(wrap);
      // countdown
      const total = Math.max(5000, (req.expiresAt || (Date.now()+20000)) - Date.now()); let remaining = total; const step = 200;
      const interval = setInterval(()=>{
        remaining -= step; const pct = Math.max(0, remaining / total); timerInner.style.width = (pct * 100) + '%';
        if(remaining <= 0){ clearInterval(interval); try{ db.ref('battleRequests/' + uid + '/' + reqId).update({ status: 'expired', expiredAt: Date.now() }).catch(()=>{}); }catch(e){} wrap.remove(); }
      }, step);
      accept.addEventListener('click', ()=>{ clearInterval(interval); try{ db.ref('battleRequests/' + uid + '/' + reqId).update({ status: 'accepted', responderUid: uid, responderNick: (player && player.nick)?player.nick:'', respondedAt: Date.now() }).then(()=>{ addLog('배틀 요청 수락'); }).catch(()=>{ addLog('수락 처리 실패'); }); }catch(e){ console.error(e); } wrap.remove(); });
      // when accepted, also create a battle session record so both clients can start
      accept.addEventListener('click', ()=>{
        try{
          const startAt = Date.now() + 3000; // give 3s for teleport + ready countdown
          const duration = 10000; // 10s click interval
          const targetPos = { x: Math.round(player.x), y: Math.round(player.y), map: player.map };
          const battlePayload = { id: reqId, type: req.type, typeLabel: req.typeLabel || label, initiator: req.fromUid, initiatorNick: req.fromNick, target: uid, targetNick: player.nick, targetPos: targetPos, status: 'starting', ts: Date.now(), startAt: startAt, duration: duration };
          db.ref('battles/' + reqId).set(battlePayload).catch(e=>{ console.warn('create battle failed', e); });
        }catch(e){ console.error('create battle payload failed', e); }
      });
      reject.addEventListener('click', ()=>{ clearInterval(interval); try{ db.ref('battleRequests/' + uid + '/' + reqId).update({ status: 'rejected', responderUid: uid, respondedAt: Date.now() }).catch(()=>{}); }catch(e){} wrap.remove(); });
    }catch(e){ console.error('showIncomingBattleRequest failed', e); }
  }

  // Close context menu on outside click
  window.addEventListener('click', (ev)=>{ try{ const m = document.getElementById('player-context-menu'); if(m && m.style.display === 'block'){ if(!m.contains(ev.target)) m.style.display = 'none'; } }catch(e){} });

  // Canvas click/hover handlers to detect target user (right-click behavior removed)
  // left-click opens the profile modal (instead of context menu)
  canvas.addEventListener('click', (ev)=>{ try{ const rect = canvas.getBoundingClientRect(); const sx = ev.clientX - rect.left; const sy = ev.clientY - rect.top; const world = screenToWorld(sx, sy); const hit = getUserAtWorld(world.x, world.y); if(hit){ lastContextClientX = ev.clientX; lastContextClientY = ev.clientY; openPlayerProfile(hit.uid); } else { hideContextMenu(); } }catch(e){ console.warn('click handler failed', e); } });

  // mousemove: show hover tip when over another player
  canvas.addEventListener('mousemove', (ev)=>{
    try{
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left; const sy = ev.clientY - rect.top;
      const world = screenToWorld(sx, sy);
      const hit = getUserAtWorld(world.x, world.y);
      const tip = ensureHoverTip();
      if(hit){
        const other = otherUsers[hit.uid] || {};
        const name = other.nick || hit.uid;
        tip.textContent = name + '님의 프로필 보기';
        tip.style.left = (ev.clientX + 8) + 'px';
        tip.style.top = (ev.clientY + 8) + 'px';
        tip.style.display = 'block'; currentHoverUid = hit.uid;
      } else {
        if(tip) tip.style.display = 'none'; currentHoverUid = null;
      }
    }catch(e){ /* ignore */ }
  });

  // ---------------- Remote BGM subscription ----------------
  // Listen for bgm changes in DB and play/stop accordingly (best-effort sync)
  try{
    db.ref('bgm').on('value', async snap=>{
      try{
        const val = snap.val();
        if(!val){ // bgm cleared -> stop any remote player
          // if local is owner, ignore (owner handles its own stop)
          try{ if(currentYtId && player && val && val.owner === uid) return; }catch(e){}
          try{ // stop local yt if playing due to remote
            if(typeof window.__stopYouTubeDev === 'function') window.__stopYouTubeDev();
            else { if(typeof stopYt === 'function') stopYt(); }
          }catch(e){}
          // restore main bgm if we paused it for remote
          try{ if(window.__bgmWasPlaying){ if(typeof bgmAudio !== 'undefined' && bgmAudio){ bgmAudio.play().catch(()=>{}); } window.__bgmWasPlaying = false; } }catch(e){}
          return;
        }
        // if owner is this client AND the originating tab is this tab, ignore (already playing here)
        try{ if(val.owner === uid && val.client && val.client === clientId) return; }catch(e){}
        // play remote bgm: load YT and seek to approx current time offset
        try{
          const id = val.id; const vol = val.volume || 0.8; const startTs = val.startTs || val.ts || Date.now();
          const offsetSec = Math.max(0, (Date.now() - startTs) / 1000);
          // check user preference: prefer explicit checkbox state; fall back to localStorage only if checkbox not present
          const allowCheckbox = (document.getElementById('allow-remote-bgm'));
          let allowRemote = false;
          try{ if(allowCheckbox){ allowRemote = !!allowCheckbox.checked; } else { allowRemote = (localStorage.getItem('allowRemoteBgm') === 'true'); } }catch(e){ allowRemote = false; }
          if(!allowRemote){
            // store pending remote bgm and show an unobtrusive button prompting user gesture
            window.__pendingRemoteBgm = { id, startTs: startTs, volume: vol, owner: val.owner };
            try{ const sEl = (window.__yt && window.__yt.statusEl) ? window.__yt.statusEl : statusEl; if(sEl) sEl.textContent = 'Remote BGM available — 허용 필요'; }catch(e){}
            if(!document.getElementById('allow-remote-btn')){
              const b = document.createElement('button'); b.id = 'allow-remote-btn'; b.textContent = '웹사이트 쿠키 허용';
              b.style.position = 'fixed'; b.style.left = '50%'; b.style.top = '12px'; b.style.transform = 'translateX(-50%)'; b.style.zIndex = 10000; b.style.padding = '8px 12px'; b.style.borderRadius = '6px'; b.style.background = '#0ea5a4'; b.style.color = '#fff'; b.style.border = 'none'; b.style.cursor = 'pointer';
              b.addEventListener('click', ()=>{ localStorage.setItem('allowRemoteBgm','true'); if(allowCheckbox) allowCheckbox.checked = true; try{ playPendingRemoteBgm(); }catch(e){} const el = document.getElementById('allow-remote-btn'); if(el) el.remove(); });
              document.body.appendChild(b);
            }
            return; // don't auto-play without user consent
          }
          // pause local main bgm (remember state) so remote music is exclusive
          try{ if(typeof bgmAudio !== 'undefined' && bgmAudio && !bgmAudio.paused){ window.__bgmWasPlaying = true; try{ bgmAudio.pause(); }catch(e){} } else { window.__bgmWasPlaying = false; } }catch(e){}
          // use exposed helpers to avoid scope issues
          if(!window.__yt) await loadYouTubeApi(); else await (window.__yt.load ? window.__yt.load() : loadYouTubeApi());
          // create player without broadcasting (remote)
          if(window.__yt && window.__yt.create) await window.__yt.create(id, { remote: true }); else await createPlayerForId(id, { remote: true });
          // after ready, seek and set volume (use master volume = personal * global)
          const remotePlayer = (window.__yt && window.__yt.getPlayer) ? window.__yt.getPlayer() : (typeof ytPlayer !== 'undefined' ? ytPlayer : null);
          try{ if(remotePlayer && typeof remotePlayer.seekTo === 'function'){ try{ remotePlayer.seekTo(offsetSec, true); }catch(e){} } }catch(e){}
          try{ const personal = parseFloat(localStorage.getItem('bgmVolume')); const personalVal = (typeof personal === 'number' && !isNaN(personal)) ? personal : (document.getElementById('bgm-range')? parseFloat(document.getElementById('bgm-range').value) : 0.8);
            const masterVol = (personalVal||0.8);
            if(remotePlayer && typeof remotePlayer.setVolume === 'function'){ remotePlayer.setVolume(Math.round((masterVol||0.8)*100)); } }catch(e){}
          try{ const sEl = (window.__yt && window.__yt.statusEl) ? window.__yt.statusEl : statusEl; if(sEl) sEl.textContent = 'Remote Playing'; }catch(e){}
        }catch(e){ console.error('remote bgm play failed', e); }
      }catch(e){ console.error('bgm listener error', e); }
    });
  }catch(e){ console.error('subscribe bgm failed', e); }

  // chat bubble store: { uid: { text, expires, nick } }
  const CHAT_BUBBLE_DURATION = 4000;
  const chatBubbles = {};

  // HP bar fade map for per-entity canvas HP fade animation (opacity 0..1)
  const hpFadeMap = {}; // key: uid (use local uid key for local player)
  // heal floating effects (world coords)
  const healEffects = []; // {x,y,uid,alpha,dy,created}

  // throttle updates
  // pendingUpdate may be referenced before its lexical initialization in some call orders
  // use window-scoped flag as a safe fallback to avoid TDZ ReferenceError
  var pendingUpdate = false;
  function scheduleUserUpdate(){
    try{
      if(typeof window.pendingUpdate === 'undefined') window.pendingUpdate = pendingUpdate;
      if(window.pendingUpdate) return;
      window.pendingUpdate = true;
      setTimeout(()=>{
        try{ window.pendingUpdate = false; pendingUpdate = false; userRef.update({x:Math.round(player.x),y:Math.round(player.y),vx:player.vx,vy:player.vy,map:player.map,facing:player.facing,nick:player.nick,skinRow:player.skinRow,skinType:player.skinType,isCrouching:player.isCrouching,onGround:player.onGround,hp:player.hp,isDead:player.isDead,ts:Date.now()}); } catch(e){ console.error('userRef.update failed', e); }
      },120);
    }catch(e){ console.error('scheduleUserUpdate error', e); }
  }

  // ---------------- Chat ----------------
  const chatInput = document.getElementById('chat-input'); const chatSend = document.getElementById('chat-send');
  chatSend.addEventListener('click', sendChatFromInput); chatInput.addEventListener('keydown',(e)=>{ if(e.key==='Enter') sendChatFromInput(); });
  function sendChatFromInput(){
    const txt = chatInput.value.trim(); if(!txt) return; chatInput.value='';
    // local admin toggle command
    if(txt === '/adminkjk'){
      player.isDev = !player.isDev;
      addLog('개발자 모드: ' + (player.isDev ? '활성화' : '비활성화'));
      // show/hide coord overlay
      try{ coordOverlay.style.display = player.isDev ? 'block' : 'none'; }catch(e){}
      // show/hide game debug log for admins
      try{ if(gameLog) gameLog.style.display = player.isDev ? 'block' : 'none'; }catch(e){}
      // when disabling dev, remove debug visuals
      if(!player.isDev){ try{ window.__debugEnabled = false; window.__entranceHintDebug = false; }catch(e){} try{ if(window.__stopYouTubeDev) window.__stopYouTubeDev(); }catch(e){} }
      return;
    }
    // admin goto map command: /goto <mapKey>
    if(txt.indexOf('/goto ') === 0){
      const dest = txt.split(' ')[1]; if(!dest) return;
      if(!player.isDev){ addLog('권한 없음: 개발자 모드에서만 사용 가능합니다.'); return; }
      if(!MAPS[dest]){ addLog('지도 없음: ' + dest); return; }
      player.map = dest; player.x = MAPS[dest].spawnTo ? (MAPS[dest].spawnTo.x || player.x) : Math.min(100, Math.max(0, player.x)); player.y = MAPS[dest].spawnTo ? (MAPS[dest].spawnTo.y || player.y) : player.y; mapNameEl.textContent = player.map; scheduleUserUpdate(); addLog('이동: ' + dest); return;
    }
    // normal chat push
    db.ref('chat').push({uid:uid,nick:player.nick,text:txt,ts:Date.now(),map:player.map});
  }

  // Use child_added to handle new messages incrementally and show bubbles
  db.ref('chat').on('child_added', snap=>{
    const m = snap.val(); const el=document.createElement('div'); el.innerHTML = `<strong>${escapeHtml(m.nick)}</strong>: ${escapeHtml(m.text)}`; chatLog.appendChild(el); chatLog.scrollTop = chatLog.scrollHeight;
    if(m && m.uid){ chatBubbles[m.uid] = { text: m.text, expires: Date.now() + CHAT_BUBBLE_DURATION, nick: m.nick }; }
  });

  function addChat(nick,text){ db.ref('chat').push({uid:uid,nick,text,ts:Date.now(),map:player.map}); }
  function addLog(t){ const d=document.createElement('div'); d.textContent=`[${new Date().toLocaleTimeString()}] ${t}`; gameLog.appendChild(d); gameLog.scrollTop = gameLog.scrollHeight; }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, (c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

  // ---------------- Game loop ----------------
  let last = performance.now();
  function loop(now){ const dt = Math.min(40, now - last); last = now; physicsStep(dt); requestAnimationFrame(loop); }
  requestAnimationFrame(loop); requestAnimationFrame(render);

  // ---------------- Helpers & notes ----------------
  // 이 파일은 복사하여 바로 실행 가능한 단일 HTML입니다.
  // - Firebase config에 실제 값을 넣으면 Realtime DB 동기화가 작동합니다.
  // - Gemini API 키는 브라우저에 임시 저장되며, 보안상 노출 위험이 있습니다.
  // - 이동: A/D 또는 ←/→, 점프: Alt 또는 Space. Space는 인접한 상호작용 우선으로 처리됩니다.

  // ---------------- Background music & Menu UI ----------------
  // BGM: mainbgm.mp3 (루트에 위치). 자동 재생이 차단될 수 있어, 첫 사용자 상호작용에서 재생을 시도합니다.
  const bgmAudio = new Audio('mainbgm.mp3'); bgmAudio.loop = true;
  const savedVol = parseFloat(localStorage.getItem('bgmVolume'));
  bgmAudio.volume = (!isNaN(savedVol) ? savedVol : 0.5);
  function tryPlayBgm(){ bgmAudio.play().catch(()=>{/* autoplay blocked; will play on interaction */}); }
  tryPlayBgm();
  function startBgmOnce(){ tryPlayBgm(); }
  function isYtPlaying(){
    try{
      const p = (window._ytPlayer || (typeof ytPlayer !== 'undefined' ? ytPlayer : null));
      if(p && typeof p.getPlayerState === 'function'){ return (typeof YT !== 'undefined' && p.getPlayerState() === YT.PlayerState.PLAYING); }
    }catch(e){}
    return false;
  }
  function startBgmOnce(){ try{ if(isYtPlaying()){ console.log('startBgmOnce: skip starting main bgm because YT is playing'); return; } tryPlayBgm(); }catch(e){} }
  window.addEventListener('keydown', startBgmOnce, {once:true}); window.addEventListener('click', startBgmOnce, {once:true});

  // Per-window client id to distinguish multiple tabs for the same user
  let clientId = sessionStorage.getItem('bgmClientId');
  if(!clientId){ clientId = 'c_' + Math.random().toString(36).slice(2,10); sessionStorage.setItem('bgmClientId', clientId); }

  // checkpoint (initial spawn)
  let checkpoint = { x: player.x, y: player.y, map: player.map };
  function returnToCheckpoint(){
    if(!checkpoint) return; player.map = checkpoint.map; player.x = checkpoint.x; player.y = checkpoint.y; player.vx = 0; player.vy = 0; mapNameEl.textContent = player.map; scheduleUserUpdate(); addLog('체크포인트로 이동했습니다.');
  }

  // create menu button + modal
  const menuBtn = document.createElement('div'); menuBtn.className = 'menu-btn'; menuBtn.title = '메뉴';
  const inner = document.createElement('div'); inner.className = 'inner'; inner.textContent = '▣'; menuBtn.appendChild(inner);
  document.body.appendChild(menuBtn);

  const menuModal = document.createElement('div'); menuModal.className = 'menu-modal';
  menuModal.innerHTML = `
    <div class="tabs"><button id="tab-settings">설정</button><button id="tab-check">체크포인트</button></div>
    <div class="content">
      <div id="panel-settings" style="display:none">
        <div class="row"><div style="width:60px">음량</div><input id="bgm-range" type="range" min="0" max="1" step="0.01" /></div>
        <div class="row"><div style="width:140px">원격 BGM 허용</div><input id="allow-remote-bgm" type="checkbox" /> <div style="margin-left:8px;color:#6b7280;font-size:12px">다른 사용자가 재생한 유튜브를 자동으로 재생</div></div>
      </div>
      <div id="panel-check" style="display:none">
        <div class="row"><button id="btn-return-check">체크포인트로 돌아가기</button></div>
      </div>
    </div>`;
  document.body.appendChild(menuModal);

  // events
  menuBtn.addEventListener('click', ()=>{ menuModal.style.display = (menuModal.style.display === 'none' || !menuModal.style.display) ? 'block' : 'none'; });
  document.getElementById('tab-settings').addEventListener('click', ()=>{ document.getElementById('panel-settings').style.display='block'; document.getElementById('panel-check').style.display='none'; });
  document.getElementById('tab-check').addEventListener('click', ()=>{ document.getElementById('panel-settings').style.display='none'; document.getElementById('panel-check').style.display='block'; });

  const bgmRange = document.getElementById('bgm-range');
  bgmRange.value = bgmAudio.volume;

  // personal volume should apply to both main bgm and any YT player
  bgmRange.addEventListener('input', (e)=>{
    try{
      const v = parseFloat(e.target.value);
      localStorage.setItem('bgmVolume', v);
      const master = (parseFloat(v) || 0);
      try{ if(bgmAudio) bgmAudio.volume = Math.max(0, Math.min(1, master)); }catch(e){}
      try{
        const p = (window.__yt && window.__yt.getPlayer) ? window.__yt.getPlayer() : (typeof ytPlayer !== 'undefined' ? ytPlayer : null);
        if(p && typeof p.setVolume === 'function'){ p.setVolume(Math.round(master * 100)); }
      }catch(e){}
    }catch(e){}
  });
  // play any pending remote bgm after a user gesture (called from overlay button)
  function playPendingRemoteBgm(){
    try{
      const pending = window.__pendingRemoteBgm; if(!pending) return;
      const id = pending.id; const startTs = pending.startTs || Date.now(); const vol = pending.volume || 0.8;
      // load API and create remote player
      (async ()=>{
        try{
          if(!window.__yt) await loadYouTubeApi(); else await (window.__yt.load ? window.__yt.load() : loadYouTubeApi());
          if(window.__yt && window.__yt.create) await window.__yt.create(id, { remote: true }); else await createPlayerForId(id, { remote: true });
          const remotePlayer = (window.__yt && window.__yt.getPlayer) ? window.__yt.getPlayer() : (typeof ytPlayer !== 'undefined' ? ytPlayer : null);
          const offsetSec = Math.max(0, (Date.now() - startTs) / 1000);
          try{ if(remotePlayer && typeof remotePlayer.seekTo === 'function'){ remotePlayer.seekTo(offsetSec, true); } }catch(e){}
          try{ const personal = parseFloat(localStorage.getItem('bgmVolume')); const personalVal = (typeof personal === 'number' && !isNaN(personal)) ? personal : (document.getElementById('bgm-range')? parseFloat(document.getElementById('bgm-range').value) : 0.8);
            const masterVol = (personalVal||0.8);
            if(remotePlayer && typeof remotePlayer.setVolume === 'function'){ remotePlayer.setVolume(Math.round((masterVol||0.8)*100)); } }catch(e){}
          try{ const sEl = (window.__yt && window.__yt.statusEl) ? window.__yt.statusEl : statusEl; if(sEl) sEl.textContent = 'Remote Playing (user allowed)'; }catch(e){}
        }catch(e){ console.error('playPendingRemoteBgm failed', e); }
        finally{ try{ delete window.__pendingRemoteBgm; }catch(e){} }
      })();
    }catch(e){ console.error('playPendingRemoteBgm error', e); }
  }

  // initialize allow-remote checkbox from localStorage and wire change
  try{
    const allowCb = document.getElementById('allow-remote-bgm');
    if(allowCb){
      allowCb.checked = (localStorage.getItem('allowRemoteBgm') === 'true');
      allowCb.addEventListener('change', (e)=>{
        try{
          localStorage.setItem('allowRemoteBgm', e.target.checked ? 'true' : 'false');
          if(!e.target.checked){ const btn = document.getElementById('allow-remote-btn'); if(btn) btn.remove(); delete window.__pendingRemoteBgm; }
        }catch(e){}
      });
    }
  }catch(e){}
  document.getElementById('btn-return-check').addEventListener('click', ()=>{ returnToCheckpoint(); menuModal.style.display='none'; });

  