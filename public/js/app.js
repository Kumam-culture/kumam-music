// app.js — Main application controller
const App = (() => {
  let currentUser = null;
  let currentPage = null;
  let allSongs = []; // cache for play-from-row
  let currentSongUuid = null; // for add-to-playlist

  // ── State ────────────────────────────────────────────────
  const getUser = () => currentUser;
  const setUser = (u) => {
    currentUser = u;
    updateNavForUser(u);
    if (u) loadNotifications();
    else {
      const banner = document.getElementById('notificationsBanner');
      if (banner) { banner.innerHTML = ''; banner.classList.add('hidden'); }
    }
  };

  // ── Boot ─────────────────────────────────────────────────
  const init = async () => {
    const token = localStorage.getItem('kumam_token');
    if (token) {
      try {
        const res = await API.getMe();
        setUser(res.user);
      } catch (e) {
        localStorage.removeItem('kumam_token');
      }
    }
    updateNavForUser(currentUser);
    navigate('home');
    initSearch();
    initSidebar();
    initPlaylistModal();
  };

  // ── Navigation ───────────────────────────────────────────
  const navigate = async (page) => {
    currentPage = page;
    const content = document.getElementById('pageContent');

    // Update active nav
    document.querySelectorAll('.nav-link[data-page]').forEach(l => {
      l.classList.toggle('active', l.dataset.page === page);
    });

    // Route
    if (page === 'home') await Pages.renderHome(content, currentUser);
    else if (page === 'discover') await Pages.renderDiscover(content);
    else if (page === 'genres') await Pages.renderGenres(content);
    else if (page === 'charts') await Pages.renderCharts(content);
    else if (page === 'library') {
      if (!requireAuth()) return;
      await Pages.renderLibrary(content);
    }
    else if (page === 'liked') {
      if (!requireAuth()) return;
      await Pages.renderLiked(content);
    }
    else if (page === 'history') {
      if (!requireAuth()) return;
      await Pages.renderHistory(content);
    }
    else if (page === 'playlists') {
      if (!requireAuth()) return;
      await Pages.renderPlaylists(content);
    }
    else if (page === 'profile') {
      if (!requireAuth()) return;
      await Pages.renderProfile(content);
    }
    else if (page === 'settings') {
      if (!requireAuth()) return;
      Pages.renderSettings(content);
    }
    else if (page === 'subscription') {
      if (!requireAuth()) return;
      Pages.renderSubscription(content);
    }
    else if (page === 'artist-dashboard') {
      if (!requireAuth(['artist'])) return;
      await Pages.renderArtistDashboard(content);
    }
    else if (page === 'upload') {
      if (!requireAuth(['artist'])) return;
      // Check artist subscription
      if (currentUser?.role === 'artist') {
        try {
          const subRes = await API.getMySubscription();
          if (!subRes.active) {
            Auth.showSubscription('artist_annual', 'Activate Artist Account', 'You need an active subscription to upload music.');
            return;
          }
        } catch (e) {}
      }
      await Pages.renderUpload(content);
    }
    else if (page === 'my-songs') {
      if (!requireAuth(['artist'])) return;
      await Pages.renderMySongs(content);
    }
    else if (page === 'my-albums') {
      if (!requireAuth(['artist'])) return;
      content.innerHTML = '<div class="section"><p class="text-muted">Loading albums…</p></div>';
      try {
        const res = await API.getMyAlbums();
        content.innerHTML = `
          <div class="section">
            <div class="section-header">
              <h2 class="section-title"><i class="fas fa-compact-disc"></i> My Albums</h2>
              <button class="btn btn-primary btn-sm" onclick="App.navigate('upload')"><i class="fas fa-plus"></i> New Album</button>
            </div>
            <div class="albums-grid">
              ${(res.albums||[]).map(al => Pages.albumCard(al)).join('') || '<p class="text-muted">No albums yet. Create one from the upload page.</p>'}
            </div>
          </div>`;
      } catch (e) { content.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`; }
    }
    else if (page === 'admin') {
      if (!requireAuth(['admin'])) return;
      await Pages.renderAdmin(content);
    }
    else if (page.startsWith('artist:')) {
      const uuid = page.split(':')[1];
      await Pages.renderArtist(content, uuid);
    }
    else if (page.startsWith('album:')) {
      const uuid = page.split(':')[1];
      await Pages.renderAlbum(content, uuid);
    }
    else if (page.startsWith('playlist:')) {
      const uuid = page.split(':')[1];
      await Pages.renderPlaylist(content, uuid);
    }
    else if (page.startsWith('genre:')) {
      const slug = page.split(':')[1];
      await Pages.renderGenreDetail(content, slug);
    }
    else {
      content.innerHTML = `<div class="section"><p class="text-muted">Page not found</p></div>`;
    }

    content.scrollTop = 0;
  };

  const requireAuth = (roles = []) => {
    if (!currentUser) {
      Auth.showSignIn();
      return false;
    }
    if (roles.length && !roles.includes(currentUser.role)) {
      showNotification('Access denied', 'error');
      return false;
    }
    return true;
  };

  // ── Nav updates ──────────────────────────────────────────
  const updateNavForUser = (user) => {
    const guestEl = document.getElementById('guestActions');
    const userEl = document.getElementById('userMenu');
    const nameEl = document.getElementById('userNameDisplay');
    const imgEl = document.getElementById('userAvatarImg');

    if (user) {
      guestEl.classList.add('hidden');
      userEl.classList.remove('hidden');
      nameEl.textContent = user.name.split(' ')[0];
      imgEl.src = user.avatar ? `/uploads/profiles/${user.avatar}` : '/images/default-avatar.svg';
    } else {
      guestEl.classList.remove('hidden');
      userEl.classList.add('hidden');
    }

    // Show/hide nav items
    document.querySelectorAll('.auth-required').forEach(el => {
      el.classList.toggle('hidden', !user);
    });
    document.querySelectorAll('.artist-only').forEach(el => {
      el.classList.toggle('hidden', user?.role !== 'artist');
    });
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', user?.role !== 'admin');
    });
  };

  // ── Nav links ────────────────────────────────────────────
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.page);
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
      }
    });
  });

  // ── Search ───────────────────────────────────────────────
  const initSearch = () => {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchDropdown');
    let debounceTimer;

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (q.length < 2) { dropdown.classList.add('hidden'); return; }
      debounceTimer = setTimeout(() => performSearch(q), 350);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { dropdown.classList.add('hidden'); input.value = ''; }
    });

    document.addEventListener('click', (e) => {
      if (!document.querySelector('.search-bar').contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  };

  const performSearch = async (q) => {
    const dropdown = document.getElementById('searchDropdown');
    dropdown.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i></div>';
    dropdown.classList.remove('hidden');
    try {
      const res = await API.search(q);
      const { songs = [], artists = [], albums = [] } = res.results;
      let html = '';

      if (songs.length) {
        html += `<div class="search-section-title">Songs</div>`;
        html += songs.slice(0, 4).map(s => `
          <div class="search-item" onclick="App.playFromSearch(${JSON.stringify(s).replace(/"/g,'&quot;')})">
            <img class="search-item-img" src="${s.artwork?`/uploads/artwork/${s.artwork}`:'/images/default-cover.svg'}" onerror="this.src='/images/default-cover.svg'" alt=""/>
            <div class="search-item-info">
              <div class="title">${s.title}</div>
              <div class="sub">${s.stage_name||s.artist_name||''} · ${s.genre_name||''}</div>
            </div>
          </div>`).join('');
      }

      if (artists.length) {
        html += `<div class="search-section-title">Artists</div>`;
        html += artists.slice(0, 3).map(a => `
          <div class="search-item" onclick="App.navigate('artist:${a.uuid}');document.getElementById('searchDropdown').classList.add('hidden');document.getElementById('searchInput').value=''">
            <img class="search-item-img round" src="${a.avatar?`/uploads/profiles/${a.avatar}`:'/images/default-avatar.svg'}" alt=""/>
            <div class="search-item-info">
              <div class="title">${a.name}</div>
              <div class="sub">${a.stage_name||''} · ${(a.follower_count||0).toLocaleString()} followers</div>
            </div>
          </div>`).join('');
      }

      if (albums.length) {
        html += `<div class="search-section-title">Albums</div>`;
        html += albums.slice(0, 3).map(al => `
          <div class="search-item" onclick="App.navigate('album:${al.uuid}');document.getElementById('searchDropdown').classList.add('hidden');document.getElementById('searchInput').value=''">
            <img class="search-item-img" src="${al.artwork?`/uploads/artwork/${al.artwork}`:'/images/default-cover.svg'}" alt=""/>
            <div class="search-item-info">
              <div class="title">${al.title}</div>
              <div class="sub">${al.stage_name||al.artist_name||''} · ${al.song_count||0} songs</div>
            </div>
          </div>`).join('');
      }

      dropdown.innerHTML = html || '<div style="padding:24px;text-align:center;color:var(--text-muted)">No results found</div>';
    } catch (e) {
      dropdown.innerHTML = `<div style="padding:16px;color:var(--red)">Search failed: ${e.message}</div>`;
    }
  };

  const playFromSearch = (song) => {
    Player.play(song, [song]);
    document.getElementById('searchDropdown').classList.add('hidden');
    document.getElementById('searchInput').value = '';
  };

  // ── Sidebar ──────────────────────────────────────────────
  // Hamburger + overlay are handled in player.js to keep one listener
  const initSidebar = () => {
    // Close sidebar when a nav link is clicked on mobile
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          document.getElementById('sidebar').classList.remove('open');
          document.getElementById('sidebarOverlay')?.classList.remove('active');
        }
      });
    });
  };

  // ── Play song from row ───────────────────────────────────────
  // FIX: collect all song UUIDs visible on the page, fetch their data, set as queue
  const playSongFromRow = async (uuid) => {
    // Collect all song-row uuids currently on screen (for queue context)
    const rows  = Array.from(document.querySelectorAll('.song-row[data-uuid]'));
    const uuids = rows.map(r => r.dataset.uuid).filter(Boolean);

    // If we have a cached song list matching these rows, use it directly
    if (allSongs.length) {
      const allMatch = uuids.every(u => allSongs.find(s => s.uuid === u));
      if (allMatch) {
        const song = allSongs.find(s => s.uuid === uuid);
        if (song) {
          const contextSongs = allSongs.filter(s => uuids.includes(s.uuid));
          return Player.play(song, contextSongs);
        }
      }
    }

    // Otherwise fetch the clicked song and use visible rows as lightweight queue stubs
    try {
      const res = await API.getSong(uuid);
      const clickedSong = res.song;

      // Build a minimal queue from DOM data + fetched song details
      // Songs will fully load when played
      const queueSongs = uuids.map(u => {
        if (u === uuid) return clickedSong;
        const row = rows.find(r => r.dataset.uuid === u);
        // Build a minimal stub from the row's DOM content
        return {
          uuid: u,
          title:       row?.querySelector('.song-row-title')?.textContent || '',
          artist_name: row?.querySelector('.song-row-artist')?.textContent || '',
          stage_name:  null,
          artwork:     row?.querySelector('.song-row-img img')?.src?.split('/uploads/artwork/')[1] || null,
          file_path:   null, // will fail gracefully if played
        };
      }).filter(Boolean);

      // Store fetched song in allSongs cache
      if (!allSongs.find(s => s.uuid === uuid)) allSongs.push(clickedSong);

      Player.play(clickedSong, queueSongs.length > 1 ? queueSongs : [clickedSong]);
    } catch (e) {
      showNotification('Could not load song', 'error');
    }
  };

  // ── Like toggle ──────────────────────────────────────────
  const toggleLike = async (btn, uuid) => {
    if (!currentUser) return Auth.showSignIn();
    try {
      const res = await API.likeSong(uuid);
      const icon = btn.querySelector('i');
      icon.className = res.liked ? 'fas fa-heart' : 'far fa-heart';
      btn.classList.toggle('liked', res.liked);
      showNotification(res.liked ? 'Added to liked songs ❤️' : 'Removed from liked songs');

      // Update player like btn if same song
      const current = Player.getCurrent();
      if (current?.uuid === uuid) {
        document.getElementById('playerLikeBtn').querySelector('i').className = res.liked ? 'fas fa-heart' : 'far fa-heart';
        document.getElementById('playerLikeBtn').style.color = res.liked ? 'var(--accent)' : '';
        current.liked = res.liked;
      }
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  // ── Follow toggle ─────────────────────────────────────────
  const toggleFollow = async (btn, uuid) => {
    if (!currentUser) return Auth.showSignIn();
    try {
      const res = await API.followArtist(uuid);
      btn.textContent = res.following ? 'Following' : 'Follow';
      btn.classList.toggle('following', res.following);
      showNotification(res.following ? 'Now following artist 🎵' : 'Unfollowed artist');
    } catch (e) { showNotification(e.message, 'error'); }
  };

  // ── Playlist modal ────────────────────────────────────────
  const initPlaylistModal = () => {
    const overlay = document.getElementById('playlistOverlay');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
    document.querySelectorAll('[data-close-overlay]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.closeOverlay).classList.add('hidden');
      });
    });

    document.getElementById('createPlaylistFromModal').addEventListener('click', async () => {
      const name = prompt('Playlist name:');
      if (!name) return;
      try {
        const res = await API.createPlaylist({ title: name });
        showNotification(`Playlist "${name}" created!`);
        if (currentSongUuid) {
          await API.addToPlaylist(res.uuid, currentSongUuid);
          showNotification(`Song added to "${name}"`);
        }
        document.getElementById('playlistOverlay').classList.add('hidden');
      } catch (e) { showNotification(e.message, 'error'); }
    });
  };

  const openAddToPlaylist = async (songUuid) => {
    if (!currentUser) return Auth.showSignIn();
    currentSongUuid = songUuid;
    const overlay = document.getElementById('playlistOverlay');
    const list = document.getElementById('playlistModalList');
    list.innerHTML = '<p style="padding:10px;color:var(--text-muted)">Loading…</p>';
    overlay.classList.remove('hidden');

    try {
      const res = await API.getMyPlaylists();
      list.innerHTML = (res.playlists || []).map(pl => `
        <div class="playlist-modal-item" onclick="App.addSongToPlaylist('${pl.uuid}','${pl.title}')">
          <i class="fas fa-list-music"></i>
          <span>${pl.title}</span>
          <span style="color:var(--text-muted);font-size:12px;margin-left:auto">${pl.song_count||0}</span>
        </div>`).join('') || '<p style="padding:10px;color:var(--text-muted)">No playlists yet</p>';
    } catch (e) {
      list.innerHTML = `<p style="padding:10px;color:var(--red)">${e.message}</p>`;
    }
  };

  const addSongToPlaylist = async (playlistUuid, playlistTitle) => {
    if (!currentSongUuid) return;
    try {
      await API.addToPlaylist(playlistUuid, currentSongUuid);
      showNotification(`Added to "${playlistTitle}" ✅`);
      document.getElementById('playlistOverlay').classList.add('hidden');
    } catch (e) { showNotification(e.message, 'error'); }
  };

  const createPlaylistPrompt = async () => {
    const name = prompt('Playlist name:');
    if (!name) return;
    try {
      await API.createPlaylist({ title: name });
      showNotification(`Playlist "${name}" created!`);
      navigate('playlists');
    } catch (e) { showNotification(e.message, 'error'); }
  };

  // ── Playlist play all ────────────────────────────────────
  const playAllFromPlaylist = async (uuid) => {
    try {
      const res = await API.getPlaylist(uuid);
      if (res.songs?.length) {
        Player.play(res.songs[0], res.songs);
      }
    } catch (e) { showNotification('Could not load playlist', 'error'); }
  };

  // ── Download song ─────────────────────────────────────────
  const downloadSong = async (uuid) => {
    if (!currentUser) return Auth.showSignIn();
    try {
      const token = localStorage.getItem('kumam_token');
      const res = await fetch(`/api/songs/${uuid}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return showNotification(j.error || 'Cannot download', 'error');
      }
      // Extract filename from Content-Disposition header (set by server as Kumam_Music - ...)
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `Kumam_Music - song.mp3`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification(`Downloading: ${filename}`);
    } catch (e) {
      showNotification('Download failed', 'error');
    }
  };

  // ── Artist song delete ────────────────────────────────────
  const deleteSong = async (uuid) => {
    if (!confirm('Delete this song permanently?')) return;
    try {
      await API.deleteSong(uuid);
      showNotification('Song deleted');
      navigate('my-songs');
    } catch (e) { showNotification(e.message, 'error'); }
  };

  // ── Admin actions ─────────────────────────────────────────
  const adminToggleUser = async (id, name) => {
    try {
      const res = await API.toggleUserActive(id);
      showNotification(`${name} ${res.is_active ? 'activated' : 'banned'}`);
      const row = document.getElementById(`user-row-${id}`);
      if (row) {
        row.querySelectorAll('td')[3].innerHTML = `<span class="badge ${res.is_active?'badge-active':'badge-expired'}">${res.is_active?'Active':'Banned'}</span>`;
        row.querySelectorAll('td')[6].querySelector('button:first-child').textContent = res.is_active ? 'Ban' : 'Unban';
      }
    } catch (e) { showNotification(e.message, 'error'); }
  };

  const adminDeleteUser = async (id, name) => {
    if (!confirm(`Delete user "${name}" permanently? This cannot be undone.`)) return;
    try {
      await API.deleteAdminUser(id);
      showNotification(`User "${name}" deleted`);
      document.getElementById(`user-row-${id}`)?.remove();
    } catch (e) { showNotification(e.message, 'error'); }
  };

  const adminToggleSong = async (id) => {
    try {
      const res = await API.toggleSongPublished(id);
      showNotification(res.message);
      Pages.loadAdminSongs();
    } catch (e) { showNotification(e.message, 'error'); }
  };

  const adminDeleteSong = async (id) => {
    if (!confirm('Delete this song?')) return;
    try {
      await API.deleteAdminSong(id);
      showNotification('Song deleted');
      Pages.loadAdminSongs();
    } catch (e) { showNotification(e.message, 'error'); }
  };

  const adminApproveSub = async (id) => {
    try {
      const res = await API.approveSubscription(id);
      showNotification(res.message);
      Pages.loadAdminSubs();
    } catch (e) { showNotification(e.message, 'error'); }
  };

  // ── Notification ──────────────────────────────────────────
  const showNotification = (msg, type = 'success') => {
    const el = document.getElementById('notification');
    const msgEl = document.getElementById('notificationMsg');
    const icon = el.querySelector('i');
    msgEl.textContent = msg;
    icon.className = type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
    icon.style.color = type === 'error' ? 'var(--red)' : 'var(--accent)';
    el.style.borderColor = type === 'error' ? 'var(--red)' : 'var(--accent)';
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 3000);
  };

  // ── Delete account ────────────────────────────────────────
  const deleteAccount = () => {
    showNotification('Please contact support to delete your account.', 'error');
  };

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    init();
    initHelp();
  });

  // ── Help modal ───────────────────────────────────────────────
  const initHelp = () => {
    const fab     = document.getElementById('helpFab');
    const overlay = document.getElementById('helpOverlay');
    fab?.addEventListener('click', () => overlay?.classList.remove('hidden'));
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  };

  // ── Notifications banner ─────────────────────────────────────
  const loadNotifications = async () => {
    const banner = document.getElementById('notificationsBanner');
    if (!banner || !currentUser) return;
    try {
      const res = await API.get('/notifications');
      const notifs = res.notifications || [];
      banner.innerHTML = '';
      if (!notifs.length) { banner.classList.add('hidden'); return; }
      banner.classList.remove('hidden');
      notifs.forEach(n => {
        const icons = { green: 'check-circle', yellow: 'exclamation-triangle', red: 'exclamation-circle' };
        const bar = document.createElement('div');
        bar.className = `notif-bar ${n.color}`;
        bar.dataset.id = n.id;
        bar.innerHTML = `
          <i class="fas fa-${icons[n.color] || 'info-circle'} notif-bar-icon"></i>
          <div class="notif-bar-body">
            <div class="notif-bar-title">${n.title}</div>
            <div class="notif-bar-msg">${n.message}</div>
          </div>
          <button class="notif-bar-close" onclick="App.dismissNotification(${n.id}, this)" title="Dismiss">
            <i class="fas fa-times"></i>
          </button>`;
        banner.appendChild(bar);
      });
    } catch (e) { /* silent — user may not be logged in */ }
  };

  const dismissNotification = async (id, btn) => {
    try {
      await API.post(`/notifications/${id}/dismiss`);
      const bar = btn.closest('.notif-bar');
      bar.style.transition = 'opacity 0.25s, max-height 0.3s';
      bar.style.opacity = '0';
      bar.style.maxHeight = '0';
      bar.style.overflow = 'hidden';
      bar.style.padding = '0';
      setTimeout(() => {
        bar.remove();
        const banner = document.getElementById('notificationsBanner');
        if (banner && !banner.children.length) banner.classList.add('hidden');
      }, 300);
    } catch (e) { showNotification('Could not dismiss', 'error'); }
  };

  return {
    navigate, getUser, setUser, updateNavForUser,
    showNotification, toggleLike, toggleFollow,
    openAddToPlaylist, addSongToPlaylist, createPlaylistPrompt,
    playAllFromPlaylist, playSongFromRow, playFromSearch,
    downloadSong, deleteSong,
    adminToggleUser, adminDeleteUser, adminToggleSong, adminDeleteSong, adminApproveSub,
    deleteAccount, dismissNotification, loadNotifications,
  };
})();
