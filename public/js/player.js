// player.js — Full music player logic
const Player = (() => {
  let queue = [];
  let currentIndex = -1;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 0; // 0=off 1=all 2=one
  let volume = 0.8;
  let isMuted = false;
  let streamTimeout = null;

  const audio = document.getElementById('audioElement');

  // ── Mini bar elements ───────────────────────────────────────
  const cover        = document.getElementById('playerCover');
  const titleEl      = document.getElementById('playerTitle');
  const artistEl     = document.getElementById('playerArtist');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn      = document.getElementById('prevBtn');
  const nextBtn      = document.getElementById('nextBtn');
  const shuffleBtn   = document.getElementById('shuffleBtn');
  const repeatBtn    = document.getElementById('repeatBtn');
  const likeBtn      = document.getElementById('playerLikeBtn');
  const progressFill = document.getElementById('progressFill');
  const progressBar  = document.getElementById('progressBar');
  const currentTimeEl= document.getElementById('currentTime');
  const totalTimeEl  = document.getElementById('totalTime');
  const volumeFill   = document.getElementById('volumeFill');
  const volumeBar    = document.getElementById('volumeBar');
  const muteBtn      = document.getElementById('muteBtn');
  const queueList    = document.getElementById('queueList');
  const queuePanel   = document.getElementById('queuePanel');
  const downloadBtn  = document.getElementById('downloadPlayerBtn');

  // ── Fullscreen elements ─────────────────────────────────────
  const fsEl          = document.getElementById('playerFullscreen');
  const fsCover       = document.getElementById('fsCover');
  const fsTitleEl     = document.getElementById('fsTitle');
  const fsArtistEl    = document.getElementById('fsArtist');
  const fsArtwork     = document.getElementById('fsArtwork');
  const fsPlayPause   = document.getElementById('fsPlayPauseBtn');
  const fsPrevBtn     = document.getElementById('fsPrevBtn');
  const fsNextBtn     = document.getElementById('fsNextBtn');
  const fsShuffleBtn  = document.getElementById('fsShuffleBtn');
  const fsRepeatBtn   = document.getElementById('fsRepeatBtn');
  const fsLikeBtn     = document.getElementById('fsLikeBtn');
  const fsProgressBar = document.getElementById('fsProgressBar');
  const fsProgressFill= document.getElementById('fsProgressFill');
  const fsCurrentTime = document.getElementById('fsCurrentTime');
  const fsTotalTime   = document.getElementById('fsTotalTime');
  const fsVolumeBar   = document.getElementById('fsVolumeBar');
  const fsVolumeFill  = document.getElementById('fsVolumeFill');
  const fsMuteBtn     = document.getElementById('fsMuteBtn');
  const fsDownloadBtn = document.getElementById('fsDownloadBtn');

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2,'0')}`;
  };

  const getArtwork = (song) => {
    if (song.artwork)       return API.artworkUrl(song.artwork);
    if (song.album_artwork) return API.artworkUrl(song.album_artwork);
    return '/images/default-cover.svg';
  };

  // ── Update both mini and fullscreen UI ──────────────────────
  const updateUI = () => {
    if (currentIndex < 0 || !queue[currentIndex]) return;
    const song = queue[currentIndex];
    const art  = getArtwork(song);
    const name = song.stage_name || song.artist_name || 'Unknown Artist';

    // Mini bar
    cover.src       = art;
    titleEl.textContent  = song.title;
    artistEl.textContent = name;
    document.title  = `${song.title} — Etokwa Music`;
    _syncPlayBtn(playPauseBtn, isPlaying);
    likeBtn.querySelector('i').className = song.liked ? 'fas fa-heart' : 'far fa-heart';
    likeBtn.style.color = song.liked ? 'var(--accent)' : '';
    const sharePlayerBtn = document.getElementById('sharePlayerBtn');
    if (sharePlayerBtn) {
      sharePlayerBtn.style.display = 'block';
      sharePlayerBtn.onclick = () => {
        if (typeof App !== 'undefined') App.openShare('song', song.uuid, song.title);
      };
    }

    if (song.is_downloadable) {
      downloadBtn.style.display = 'inline-flex';
      downloadBtn.onclick = () => downloadSong(song);
    } else {
      downloadBtn.style.display = 'none';
    }

    // Fullscreen
    if (fsCover)   fsCover.src = art;
    if (fsTitleEl) fsTitleEl.textContent  = song.title;
    if (fsArtistEl)fsArtistEl.textContent = name;
    if (fsLikeBtn) {
      fsLikeBtn.querySelector('i').className = song.liked ? 'fas fa-heart' : 'far fa-heart';
      fsLikeBtn.classList.toggle('liked', !!song.liked);
    }
    if (fsDownloadBtn) {
      fsDownloadBtn.style.display = song.is_downloadable ? 'inline-flex' : 'none';
      if (song.is_downloadable) fsDownloadBtn.onclick = () => downloadSong(song);
    }
    _syncPlayBtn(fsPlayPause, isPlaying);
    if (fsArtwork) fsArtwork.classList.toggle('playing', isPlaying);

    renderQueue();
    highlightPlayingRow();
  };

  const _syncPlayBtn = (btn, playing) => {
    if (!btn) return;
    btn.querySelector('i').className = playing ? 'fas fa-pause' : 'fas fa-play';
  };

  const highlightPlayingRow = () => {
    document.querySelectorAll('.song-row').forEach(r => r.classList.remove('playing'));
    if (currentIndex < 0 || !queue[currentIndex]) return;
    document.querySelectorAll(`.song-row[data-uuid="${queue[currentIndex].uuid}"]`)
      .forEach(r => r.classList.add('playing'));
  };

  // ── Core play function ──────────────────────────────────────
  // FIX: always force-load when song changes; await canplaythrough before play
  const play = async (song, queueSongs = null) => {
    if (queueSongs && queueSongs.length) {
      queue = [...queueSongs];
    } else if (!queue.length) {
      queue = [song];
    }

    const idx = queue.findIndex(s => s.uuid === song.uuid);
    if (idx >= 0) {
      currentIndex = idx;
    } else {
      queue.unshift(song);
      currentIndex = 0;
    }

    // file_path is now a full Cloudinary URL or a legacy filename
    const newSrc = API.songUrl(song.file_path);
    // Always set src and reload — fixes queue/history not playing
    audio.src = newSrc;
    audio.load();

    updateUI();
    recordStream(song);

    try {
      await audio.play();
      isPlaying = true;
    } catch (e) {
      // Autoplay blocked — wait for user interaction
      console.warn('Autoplay blocked, waiting for interaction');
      isPlaying = false;
    }
    _syncPlayBtn(playPauseBtn, isPlaying);
    _syncPlayBtn(fsPlayPause, isPlaying);
    if (fsArtwork) fsArtwork.classList.toggle('playing', isPlaying);
  };

  const playByIndex = async (idx) => {
    if (!queue[idx]) return;
    currentIndex = idx;
    const song = queue[idx];
    // If this is a stub from DOM (no file_path), fetch full song first
    if (!song.file_path) {
      try {
        const res = await API.getSong(song.uuid);
        queue[idx] = { ...queue[idx], ...res.song };
      } catch (e) { console.warn('Could not fetch song details:', e.message); return; }
    }
    audio.src = API.songUrl(queue[idx].file_path);
    audio.load();
    updateUI();
    recordStream(queue[idx]);
    try {
      await audio.play();
      isPlaying = true;
    } catch (e) { isPlaying = false; }
    _syncPlayBtn(playPauseBtn, isPlaying);
    _syncPlayBtn(fsPlayPause, isPlaying);
    if (fsArtwork) fsArtwork.classList.toggle('playing', isPlaying);
  };

  const toggle = async () => {
    if (!queue.length) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      try { await audio.play(); isPlaying = true; } catch (e) {}
    }
    _syncPlayBtn(playPauseBtn, isPlaying);
    _syncPlayBtn(fsPlayPause, isPlaying);
    if (fsArtwork) fsArtwork.classList.toggle('playing', isPlaying);
  };

  const next = () => {
    if (!queue.length) return;
    currentIndex = isShuffle
      ? Math.floor(Math.random() * queue.length)
      : (currentIndex + 1) % queue.length;
    playByIndex(currentIndex);
  };

  const prev = () => {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    currentIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    playByIndex(currentIndex);
  };

  const setVolume = (v) => {
    volume = Math.max(0, Math.min(1, v));
    audio.volume = volume;
    isMuted = volume === 0;
    const pct = `${volume * 100}%`;
    volumeFill.style.width = pct;
    if (fsVolumeFill) fsVolumeFill.style.width = pct;
    const icon = volume === 0 ? 'mute' : volume < 0.5 ? 'down' : 'up';
    const cls = `fas fa-volume-${icon}`;
    muteBtn.querySelector('i').className = cls;
    if (fsMuteBtn) fsMuteBtn.querySelector('i').className = cls;
  };

  const recordStream = (song) => {
    clearTimeout(streamTimeout);
    streamTimeout = setTimeout(async () => {
      try { await API.streamSong(song.uuid); } catch (e) {}
    }, 30000);
  };

  const downloadSong = async (song) => {
    try {
      const token = localStorage.getItem('kumam_token');
      if (!token) return App.showNotification('Sign in to download songs', 'error');
      const res = await fetch(`/api/songs/${song.uuid}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return App.showNotification(j.error || 'Cannot download', 'error');
      }
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `Etokwa_Music - ${song.title}.mp3`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      App.showNotification(`Downloading: ${filename}`);
    } catch (e) {
      App.showNotification('Download failed', 'error');
    }
  };

  const renderQueue = () => {
    if (!queueList) return;
    queueList.innerHTML = queue.map((s, i) => `
      <div class="queue-item ${i === currentIndex ? 'active' : ''}" onclick="Player.jumpTo(${i})">
        <img src="${getArtwork(s)}" onerror="this.src='/images/default-cover.svg'" alt=""/>
        <div class="queue-item-info">
          <div class="queue-item-title">${s.title}</div>
          <div class="queue-item-artist">${s.stage_name || s.artist_name || ''}</div>
        </div>
        ${i === currentIndex ? '<i class="fas fa-music text-accent"></i>' : ''}
      </div>`).join('');
  };

  // ── Audio events ─────────────────────────────────────────────
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = `${pct}%`;
    currentTimeEl.textContent = fmt(audio.currentTime);
    if (fsProgressFill) fsProgressFill.style.width = `${pct}%`;
    if (fsCurrentTime) fsCurrentTime.textContent = fmt(audio.currentTime);
    document.querySelector('.player')?.style.setProperty('--mini-progress', `${pct}%`);
  });

  audio.addEventListener('loadedmetadata', () => {
    totalTimeEl.textContent = fmt(audio.duration);
    if (fsTotalTime) fsTotalTime.textContent = fmt(audio.duration);
  });

  audio.addEventListener('ended', () => {
    if (repeatMode === 2) { audio.currentTime = 0; audio.play(); }
    else next();
  });

  audio.addEventListener('play', () => {
    isPlaying = true;
    _syncPlayBtn(playPauseBtn, true);
    _syncPlayBtn(fsPlayPause, true);
    if (fsArtwork) fsArtwork.classList.add('playing');
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    _syncPlayBtn(playPauseBtn, false);
    _syncPlayBtn(fsPlayPause, false);
    if (fsArtwork) fsArtwork.classList.remove('playing');
  });

  // ── Mini player controls ─────────────────────────────────────
  playPauseBtn.addEventListener('click', toggle);
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    if (fsShuffleBtn) fsShuffleBtn.classList.toggle('active', isShuffle);
  });

  repeatBtn.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    const active = repeatMode > 0;
    repeatBtn.classList.toggle('active', active);
    repeatBtn.querySelector('i').className = repeatMode === 2 ? 'fas fa-redo-alt' : 'fas fa-redo';
    if (fsRepeatBtn) {
      fsRepeatBtn.classList.toggle('active', active);
      fsRepeatBtn.querySelector('i').className = repeatMode === 2 ? 'fas fa-redo-alt' : 'fas fa-redo';
    }
  });

  likeBtn.addEventListener('click', async () => {
    const user = typeof App !== 'undefined' ? App.getUser() : null;
    if (!user) return Auth.showSignIn();
    const song = queue[currentIndex];
    if (!song) return;
    try {
      const res = await API.likeSong(song.uuid);
      song.liked = res.liked;
      likeBtn.querySelector('i').className = res.liked ? 'fas fa-heart' : 'far fa-heart';
      likeBtn.style.color = res.liked ? 'var(--accent)' : '';
      if (fsLikeBtn) {
        fsLikeBtn.querySelector('i').className = res.liked ? 'fas fa-heart' : 'far fa-heart';
        fsLikeBtn.classList.toggle('liked', res.liked);
      }
      document.querySelectorAll(`.like-btn-song[data-uuid="${song.uuid}"]`).forEach(btn => {
        btn.querySelector('i').className = res.liked ? 'fas fa-heart' : 'far fa-heart';
        btn.classList.toggle('liked', res.liked);
      });
    } catch (e) { App.showNotification('Failed to like song', 'error'); }
  });

  progressBar.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });

  volumeBar.addEventListener('click', (e) => {
    const rect = volumeBar.getBoundingClientRect();
    setVolume((e.clientX - rect.left) / rect.width);
  });

  muteBtn.addEventListener('click', () => {
    if (isMuted) { setVolume(volume > 0 ? volume : 0.8); }
    else { setVolume(0); }
  });

  document.getElementById('queueBtn').addEventListener('click', () => {
    queuePanel.classList.toggle('hidden');
    if (!queuePanel.classList.contains('hidden')) renderQueue();
  });
  document.getElementById('closeQueueBtn').addEventListener('click', () => {
    queuePanel.classList.add('hidden');
  });

  // ── Fullscreen controls ─────────────────────────────────────
  const openFullscreen  = () => { if (window.innerWidth <= 768) fsEl?.classList.add('open'); };
  const closeFullscreen = () => fsEl?.classList.remove('open');

  document.getElementById('fsCloseBtn')?.addEventListener('click', closeFullscreen);
  document.getElementById('playerArtwork')?.addEventListener('click', () => {
    if (window.innerWidth <= 768 && queue.length) openFullscreen();
  });

  if (fsPlayPause)  fsPlayPause.addEventListener('click', toggle);
  if (fsPrevBtn)    fsPrevBtn.addEventListener('click', prev);
  if (fsNextBtn)    fsNextBtn.addEventListener('click', next);

  if (fsShuffleBtn) fsShuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    fsShuffleBtn.classList.toggle('active', isShuffle);
  });

  if (fsRepeatBtn) fsRepeatBtn.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    const active = repeatMode > 0;
    repeatBtn.classList.toggle('active', active);
    fsRepeatBtn.classList.toggle('active', active);
    const cls = repeatMode === 2 ? 'fas fa-redo-alt' : 'fas fa-redo';
    repeatBtn.querySelector('i').className = cls;
    fsRepeatBtn.querySelector('i').className = cls;
  });

  if (fsLikeBtn) fsLikeBtn.addEventListener('click', () => likeBtn.click());

  if (fsProgressBar) fsProgressBar.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = fsProgressBar.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });

  if (fsVolumeBar) fsVolumeBar.addEventListener('click', (e) => {
    const rect = fsVolumeBar.getBoundingClientRect();
    setVolume((e.clientX - rect.left) / rect.width);
  });

  if (fsMuteBtn) fsMuteBtn.addEventListener('click', () => muteBtn.click());

  document.getElementById('fsQueueBtn')?.addEventListener('click', () => {
    closeFullscreen();
    queuePanel.classList.toggle('hidden');
    if (!queuePanel.classList.contains('hidden')) renderQueue();
  });

  // ── Sidebar + overlay ────────────────────────────────────────
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  });
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay')?.classList.toggle('active');
  });

  // ── Init volume ──────────────────────────────────────────────
  audio.volume = volume;
  setVolume(volume);

  return {
    play,
    toggle,
    next,
    prev,
    jumpTo:       (idx)   => playByIndex(idx),
    setQueue:     (songs) => { queue = [...songs]; renderQueue(); },
    getQueue:     ()      => queue,
    getCurrent:   ()      => queue[currentIndex],
    isPlaying:    ()      => isPlaying,
    getArtwork,
    openFullscreen,
    closeFullscreen,
  };
})();
