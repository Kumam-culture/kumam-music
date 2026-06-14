// player.js — Full music player logic
const Player = (() => {
  let queue = [];
  let currentIndex = -1;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 0; // 0=off, 1=all, 2=one
  let volume = 0.8;
  let isMuted = false;
  let pendingStream = null;
  let streamTimeout = null;

  const audio = document.getElementById('audioElement');
  const cover = document.getElementById('playerCover');
  const title = document.getElementById('playerTitle');
  const artist = document.getElementById('playerArtist');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const likeBtn = document.getElementById('playerLikeBtn');
  const progressFill = document.getElementById('progressFill');
  const progressBar = document.getElementById('progressBar');
  const currentTimeEl = document.getElementById('currentTime');
  const totalTimeEl = document.getElementById('totalTime');
  const volumeFill = document.getElementById('volumeFill');
  const volumeBar = document.getElementById('volumeBar');
  const muteBtn = document.getElementById('muteBtn');
  const queueList = document.getElementById('queueList');
  const queuePanel = document.getElementById('queuePanel');
  const downloadBtn = document.getElementById('downloadPlayerBtn');

  const formatTime = (s) => {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const getArtwork = (song) => {
    if (song.artwork) return `/uploads/artwork/${song.artwork}`;
    if (song.album_artwork) return `/uploads/artwork/${song.album_artwork}`;
    return '/images/default-cover.svg';
  };

  const updateUI = () => {
    if (currentIndex < 0 || !queue[currentIndex]) return;
    const song = queue[currentIndex];
    cover.src = getArtwork(song);
    title.textContent = song.title;
    artist.textContent = song.stage_name || song.artist_name || 'Unknown Artist';
    document.title = `${song.title} — Kumam Music`;
    playPauseBtn.innerHTML = isPlaying
      ? '<i class="fas fa-pause"></i>'
      : '<i class="fas fa-play"></i>';

    // Like button
    likeBtn.querySelector('i').className = song.liked ? 'fas fa-heart' : 'far fa-heart';
    likeBtn.style.color = song.liked ? 'var(--accent)' : '';

    // Download btn
    if (song.is_downloadable) {
      downloadBtn.style.display = 'block';
      downloadBtn.onclick = () => downloadSong(song);
    } else {
      downloadBtn.style.display = 'none';
    }

    renderQueue();
    highlightPlayingRow();
  };

  const highlightPlayingRow = () => {
    document.querySelectorAll('.song-row').forEach(r => r.classList.remove('playing'));
    if (currentIndex < 0) return;
    const song = queue[currentIndex];
    const rows = document.querySelectorAll(`.song-row[data-uuid="${song.uuid}"]`);
    rows.forEach(r => r.classList.add('playing'));
  };

  const play = async (song, queueSongs = null) => {
    if (queueSongs) queue = [...queueSongs];
    const idx = queue.findIndex(s => s.uuid === song.uuid);
    currentIndex = idx >= 0 ? idx : 0;
    if (idx < 0) queue.unshift(song);

    const src = `/uploads/songs/${song.file_path}`;
    if (audio.src !== window.location.origin + src) {
      audio.src = src;
      audio.load();
    }

    try {
      await audio.play();
      isPlaying = true;
    } catch (e) {
      console.warn('Autoplay blocked:', e);
    }

    updateUI();
    recordStream(song);
  };

  const recordStream = (song) => {
    clearTimeout(streamTimeout);
    streamTimeout = setTimeout(async () => {
      try { await API.streamSong(song.uuid); } catch (e) {}
    }, 30000); // count after 30s
  };

  const toggle = async () => {
    if (!queue.length) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      await audio.play();
      isPlaying = true;
    }
    playPauseBtn.innerHTML = isPlaying
      ? '<i class="fas fa-pause"></i>'
      : '<i class="fas fa-play"></i>';
  };

  const next = () => {
    if (!queue.length) return;
    if (isShuffle) {
      currentIndex = Math.floor(Math.random() * queue.length);
    } else {
      currentIndex = (currentIndex + 1) % queue.length;
    }
    playByIndex(currentIndex);
  };

  const prev = () => {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    currentIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    playByIndex(currentIndex);
  };

  const playByIndex = async (idx) => {
    currentIndex = idx;
    const song = queue[idx];
    if (!song) return;
    audio.src = `/uploads/songs/${song.file_path}`;
    audio.load();
    try { await audio.play(); isPlaying = true; } catch (e) {}
    updateUI();
    recordStream(song);
  };

  const setVolume = (v) => {
    volume = Math.max(0, Math.min(1, v));
    audio.volume = volume;
    isMuted = volume === 0;
    volumeFill.style.width = `${volume * 100}%`;
    muteBtn.querySelector('i').className =
      volume === 0 ? 'fas fa-volume-mute'
      : volume < 0.5 ? 'fas fa-volume-down'
      : 'fas fa-volume-up';
  };

  const downloadSong = async (song) => {
    try {
      const token = localStorage.getItem('kumam_token');
      if (!token) return App.showNotification('Sign in to download songs', 'error');
      const res = await fetch(`/api/songs/${song.uuid}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const j = await res.json();
        return App.showNotification(j.error || 'Cannot download', 'error');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${song.title}.mp3`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      App.showNotification('Download failed', 'error');
    }
  };

  const renderQueue = () => {
    queueList.innerHTML = queue.map((s, i) => `
      <div class="queue-item ${i === currentIndex ? 'active' : ''}" onclick="Player.jumpTo(${i})">
        <img src="${getArtwork(s)}" onerror="this.src='/images/default-cover.svg'" alt=""/>
        <div class="queue-item-info">
          <div class="queue-item-title">${s.title}</div>
          <div class="queue-item-artist">${s.stage_name || s.artist_name || ''}</div>
        </div>
        ${i === currentIndex ? '<i class="fas fa-music text-accent"></i>' : ''}
      </div>
    `).join('');
  };

  // Audio events
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = `${pct}%`;
    currentTimeEl.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', () => {
    totalTimeEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('ended', () => {
    if (repeatMode === 2) {
      audio.currentTime = 0;
      audio.play();
    } else {
      next();
    }
  });

  audio.addEventListener('play', () => {
    isPlaying = true;
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  });

  // Progress bar click
  progressBar.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });

  // Volume bar click
  volumeBar.addEventListener('click', (e) => {
    const rect = volumeBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    setVolume(pct);
  });

  muteBtn.addEventListener('click', () => {
    if (isMuted) { setVolume(volume || 0.8); }
    else { audio.volume = 0; isMuted = true; volumeFill.style.width = '0%'; muteBtn.querySelector('i').className = 'fas fa-volume-mute'; }
  });

  playPauseBtn.addEventListener('click', toggle);
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
  });

  repeatBtn.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.classList.toggle('active', repeatMode > 0);
    repeatBtn.querySelector('i').className = repeatMode === 2 ? 'fas fa-redo-alt' : 'fas fa-redo';
    repeatBtn.title = ['Repeat Off', 'Repeat All', 'Repeat One'][repeatMode];
  });

  likeBtn.addEventListener('click', async () => {
    const user = App.getUser();
    if (!user) return Auth.showSignIn();
    const song = queue[currentIndex];
    if (!song) return;
    try {
      const res = await API.likeSong(song.uuid);
      song.liked = res.liked;
      likeBtn.querySelector('i').className = res.liked ? 'fas fa-heart' : 'far fa-heart';
      likeBtn.style.color = res.liked ? 'var(--accent)' : '';
      // Update row buttons
      document.querySelectorAll(`.like-btn-song[data-uuid="${song.uuid}"]`).forEach(btn => {
        btn.querySelector('i').className = res.liked ? 'fas fa-heart' : 'far fa-heart';
        btn.classList.toggle('liked', res.liked);
      });
    } catch (e) { App.showNotification('Failed to like song', 'error'); }
  });

  // Queue toggle
  document.getElementById('queueBtn').addEventListener('click', () => {
    queuePanel.classList.toggle('hidden');
    if (!queuePanel.classList.contains('hidden')) renderQueue();
  });

  document.getElementById('closeQueueBtn').addEventListener('click', () => {
    queuePanel.classList.add('hidden');
  });

  // Set initial volume
  audio.volume = volume;
  setVolume(volume);

  return {
    play,
    toggle,
    next,
    prev,
    jumpTo: (idx) => playByIndex(idx),
    setQueue: (songs) => { queue = [...songs]; renderQueue(); },
    getQueue: () => queue,
    getCurrent: () => queue[currentIndex],
    isPlaying: () => isPlaying,
    getArtwork,
  };
})();
