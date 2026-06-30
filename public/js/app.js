// app.js — Main application controller
const App = (() => {
  let currentUser   = null;
  let currentPage   = null;
  let allSongs      = [];
  let currentSongUuid = null;
  let _shareData    = null;
  let _donationRef  = null;
  let _termsCallback= null;

  // ── Getters ──────────────────────────────────────────────
  const getUser = () => currentUser;

  const setUser = (u) => {
    currentUser = u;
    updateNavForUser(u);
    if (u) loadNotifications();
    else {
      const banner = document.getElementById('notificationsBanner');
      if (banner) { banner.innerHTML = ''; banner.classList.add('hidden'); }
      updateNotifBadge(0);
    }
  };

  // ── Boot ─────────────────────────────────────────────────
  const init = async () => {
    const token = localStorage.getItem('kumam_token');
    if (token) {
      try {
        const res = await API.getMe();
        currentUser = res.user;
      } catch (e) {
        localStorage.removeItem('kumam_token');
      }
    }
    updateNavForUser(currentUser);
    if (currentUser) loadNotifications();

    // Restore page from URL — handles refresh, shared links, back on load
    const params = new URLSearchParams(window.location.search);
    const shareId  = params.get('share');
    const pageParam = params.get('p');

    if (shareId) {
      window.history.replaceState({ page: 'home' }, '', '/');
      try {
        const res = await API.resolveShare(shareId);
        if      (res.type === 'artist')   navigate(`artist:${res.ref_uuid}`);
        else if (res.type === 'album')    navigate(`album:${res.ref_uuid}`);
        else if (res.type === 'playlist') navigate(`playlist:${res.ref_uuid}`);
        else                              navigate('home');
      } catch (e) { navigate('home'); }
    } else if (pageParam) {
      const page = decodeURIComponent(pageParam);
      // Replace current history entry with the restored page (no duplicate push)
      window.history.replaceState({ page }, '', `/?p=${pageParam}`);
      _isPopState = true;
      await navigate(page, false);
      _isPopState = false;
    } else {
      // First load — set a base history entry so back works from first click
      window.history.replaceState({ page: 'home' }, '', '/');
      _isPopState = true;
      await navigate('home', false);
      _isPopState = false;
    }

    initSearch();
    initSidebar();
    initPlaylistModal();
    initModals();
  };

  // ── Navigation ───────────────────────────────────────────
  let _isPopState = false;

  const navigate = async (page, pushState = true) => {
    currentPage = page;
    const content = document.getElementById('pageContent');
    if (!content) return;

    // ── Browser history ──────────────────────────────────
    if (!_isPopState && pushState) {
      const url = page === 'home' ? '/' : `/?p=${encodeURIComponent(page)}`;
      window.history.pushState({ page }, '', url);
    }

    // ── Active nav link ──────────────────────────────────
    document.querySelectorAll('.nav-link[data-page]').forEach(l => {
      l.classList.toggle('active', l.dataset.page === page);
    });

    content.scrollTop = 0;

    if (page === 'home')        await Pages.renderHome(content, currentUser);
    else if (page === 'discover')    await Pages.renderDiscover(content);
    else if (page === 'genres')      await Pages.renderGenres(content);
    else if (page === 'charts')      await Pages.renderCharts(content);
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
    else if (page === 'notifications-page') {
      if (!requireAuth()) return;
      await Pages.renderNotificationsPage(content);
      updateNotifBadge(0);
    }
    else if (page === 'artist-dashboard') {
      if (!requireAuth(['artist'])) return;
      await Pages.renderArtistDashboard(content);
    }
    else if (page === 'upload') {
      if (!requireAuth(['artist'])) return;
      try {
        const subRes = await API.getMySubscription();
        if (!subRes.payment_registered) {
          Auth.showSubscription('artist_payment_registration',
            'Register for Payments First',
            'You need to register for payments (UGX 15,000 one-time) before uploading music.');
          return;
        }
      } catch (e) {}
      await Pages.renderUpload(content);
    }
    else if (page === 'my-songs') {
      if (!requireAuth(['artist'])) return;
      await Pages.renderMySongs(content);
    }
    else if (page === 'my-albums') {
      if (!requireAuth(['artist'])) return;
      content.innerHTML = '<div class="section"><div class="loading-spinner"><div class="spinner"></div></div></div>';
      try {
        const res = await API.getMyAlbums();
        content.innerHTML = `
          <div class="section">
            <div class="section-header">
              <h2 class="section-title"><i class="fas fa-compact-disc"></i> My Albums</h2>
              <button class="btn btn-primary btn-sm" onclick="App.navigate('upload')"><i class="fas fa-plus"></i> New Album</button>
            </div>
            <div class="albums-grid">
              ${(res.albums||[]).map(al => Pages.albumCard(al)).join('') || '<p class="text-muted">No albums yet.</p>'}
            </div>
          </div>`;
      } catch (e) { content.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`; }
    }
    else if (page === 'admin') {
      if (!requireAuth(['admin'])) return;
      await Pages.renderAdmin(content);
    }
    else if (page.startsWith('artist:'))   await Pages.renderArtist(content, page.split(':')[1]);
    else if (page.startsWith('album:'))    await Pages.renderAlbum(content, page.split(':')[1]);
    else if (page.startsWith('playlist:')) await Pages.renderPlaylist(content, page.split(':')[1]);
    else if (page.startsWith('genre:'))    await Pages.renderGenreDetail(content, page.split(':')[1]);
    else if (page.startsWith('region:'))   await Pages.renderRegionDetail(content, page.split(':')[1]);
    else if (page.startsWith('tribe:'))    await Pages.renderTribeDetail(content, page.split(':')[1]);
    else content.innerHTML = `<div class="section"><p class="text-muted">Page not found</p></div>`;

    content.scrollTop = 0;
  };

  // ── Browser back / forward buttons ──────────────────────
  window.addEventListener('popstate', async (e) => {
    const page = e.state?.page || 'home';
    _isPopState = true;
    await navigate(page, false);
    _isPopState = false;
  });

  const requireAuth = (roles = []) => {
    if (!currentUser) { Auth.showSignIn(); return false; }
    if (roles.length && !roles.includes(currentUser.role)) {
      showNotification('Access denied', 'error'); return false;
    }
    return true;
  };

  // ── Nav updates ──────────────────────────────────────────
  const updateNavForUser = (user) => {
    const guestEl = document.getElementById('guestActions');
    const userEl  = document.getElementById('userMenu');
    const nameEl  = document.getElementById('userNameDisplay');
    const imgEl   = document.getElementById('userAvatarImg');

    if (user) {
      // Hide Sign In / Sign Up, show avatar
      if (guestEl) { guestEl.style.display = 'none'; guestEl.classList.add('hidden'); }
      if (userEl)  { userEl.style.display  = '';     userEl.classList.remove('hidden'); }
      if (nameEl)  nameEl.textContent = user.name.split(' ')[0];
      if (imgEl)   imgEl.src = user.avatar ? API.profileUrl(user.avatar) : '/images/default-avatar.svg';
    } else {
      // Show Sign In / Sign Up, hide avatar
      if (guestEl) { guestEl.style.display = '';     guestEl.classList.remove('hidden'); }
      if (userEl)  { userEl.style.display  = 'none'; userEl.classList.add('hidden'); }
    }

    // Sidebar nav visibility
    document.querySelectorAll('.auth-required').forEach(el => el.classList.toggle('hidden', !user));
    document.querySelectorAll('.artist-only').forEach(el => el.classList.toggle('hidden', user?.role !== 'artist'));
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', user?.role !== 'admin'));
  };

  // ── Nav link click handlers ──────────────────────────────
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.page);
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
      }
    });
  });

  // ── Search ───────────────────────────────────────────────
  const initSearch = () => {
    const input    = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchDropdown');
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { dropdown.classList.add('hidden'); return; }
      timer = setTimeout(() => performSearch(q), 350);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { dropdown.classList.add('hidden'); input.value = ''; }
    });
    document.addEventListener('click', (e) => {
      if (!document.querySelector('.search-bar')?.contains(e.target))
        dropdown.classList.add('hidden');
    });
  };

  const performSearch = async (q) => {
    const dropdown = document.getElementById('searchDropdown');
    dropdown.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i></div>';
    dropdown.classList.remove('hidden');
    try {
      const res = await API.search(q);
      const { songs=[], artists=[], albums=[] } = res.results;
      let html = '';
      if (songs.length) {
        html += `<div class="search-section-title">Songs</div>`;
        html += songs.slice(0,4).map(s => `
          <div class="search-item" onclick="App.playFromSearch(${JSON.stringify(s).replace(/"/g,'&quot;')})">
            <img class="search-item-img" src="${s.artwork?`/uploads/artwork/${s.artwork}`:'/images/default-cover.svg'}" onerror="this.src='/images/default-cover.svg'" alt=""/>
            <div class="search-item-info"><div class="title">${s.title}</div><div class="sub">${s.stage_name||s.artist_name||''}</div></div>
          </div>`).join('');
      }
      if (artists.length) {
        html += `<div class="search-section-title">Artists</div>`;
        html += artists.slice(0,3).map(a => `
          <div class="search-item" onclick="App.navigate('artist:${a.uuid}');document.getElementById('searchDropdown').classList.add('hidden');document.getElementById('searchInput').value=''">
            <img class="search-item-img round" src="${a.avatar?`/uploads/profiles/${a.avatar}`:'/images/default-avatar.svg'}" alt=""/>
            <div class="search-item-info"><div class="title">${a.name}</div><div class="sub">${a.stage_name||''}</div></div>
          </div>`).join('');
      }
      if (albums.length) {
        html += `<div class="search-section-title">Albums</div>`;
        html += albums.slice(0,3).map(al => `
          <div class="search-item" onclick="App.navigate('album:${al.uuid}');document.getElementById('searchDropdown').classList.add('hidden');document.getElementById('searchInput').value=''">
            <img class="search-item-img" src="${al.artwork?`/uploads/artwork/${al.artwork}`:'/images/default-cover.svg'}" alt=""/>
            <div class="search-item-info"><div class="title">${al.title}</div><div class="sub">${al.stage_name||al.artist_name||''}</div></div>
          </div>`).join('');
      }
      dropdown.innerHTML = html || '<div style="padding:24px;text-align:center;color:var(--text-muted)">No results found</div>';
    } catch (e) {
      dropdown.innerHTML = `<div style="padding:16px;color:var(--red)">Search failed</div>`;
    }
  };

  const playFromSearch = async (song) => {
    document.getElementById('searchDropdown').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    // Search results are lightweight (no file_path). Fetch the full song first.
    try {
      const res = await API.getSong(song.uuid);
      Player.play(res.song, [res.song]);
    } catch (e) {
      showNotification('Could not load song', 'error');
    }
  };

  // ── Sidebar (hamburger handled in player.js) ─────────────
  const initSidebar = () => {};

  // ── Play song from any row ───────────────────────────────
  const playSongFromRow = async (uuid) => {
    const rows  = Array.from(document.querySelectorAll('.song-row[data-uuid]'));
    const uuids = rows.map(r => r.dataset.uuid).filter(Boolean);

    // Try cache first
    if (allSongs.length) {
      const song = allSongs.find(s => s.uuid === uuid);
      const allMatch = uuids.every(u => allSongs.find(s => s.uuid === u));
      if (song && allMatch) {
        return Player.play(song, allSongs.filter(s => uuids.includes(s.uuid)));
      }
    }

    try {
      const res  = await API.getSong(uuid);
      const song = res.song;
      if (!allSongs.find(s => s.uuid === uuid)) allSongs.push(song);
      // Build minimal queue from visible rows
      const queueSongs = uuids.map(u => {
        if (u === uuid) return song;
        const row = rows.find(r => r.dataset.uuid === u);
        return {
          uuid: u,
          title:       row?.querySelector('.song-row-title')?.textContent || '',
          artist_name: row?.querySelector('.song-row-artist')?.textContent || '',
          stage_name:  null,
          artwork:     null,
          file_path:   null,
        };
      });
      Player.play(song, queueSongs.length > 1 ? queueSongs : [song]);
    } catch (e) { showNotification('Could not load song', 'error'); }
  };

  // ── Like toggle ──────────────────────────────────────────
  const toggleLike = async (btn, uuid) => {
    if (!currentUser) return Auth.showSignIn();
    try {
      const res = await API.likeSong(uuid);
      btn.querySelector('i').className = res.liked ? 'fas fa-heart' : 'far fa-heart';
      btn.classList.toggle('liked', res.liked);
      showNotification(res.liked ? 'Added to liked songs ❤️' : 'Removed from liked songs');
      const current = Player.getCurrent();
      if (current?.uuid === uuid) {
        document.getElementById('playerLikeBtn').querySelector('i').className = res.liked ? 'fas fa-heart' : 'far fa-heart';
        document.getElementById('playerLikeBtn').style.color = res.liked ? 'var(--accent)' : '';
        current.liked = res.liked;
      }
    } catch (e) { showNotification(e.message, 'error'); }
  };

  // ── Follow toggle ────────────────────────────────────────
  const toggleFollow = async (btn, uuid) => {
    if (!currentUser) return Auth.showSignIn();
    try {
      const res = await API.followArtist(uuid);
      btn.textContent = res.following ? 'Following' : 'Follow';
      btn.classList.toggle('following', res.following);
      showNotification(res.following ? 'Now following artist 🎵' : 'Unfollowed artist');
    } catch (e) { showNotification(e.message, 'error'); }
  };

  // ── Playlist modal ───────────────────────────────────────
  const initPlaylistModal = () => {
    const overlay = document.getElementById('playlistOverlay');
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
    document.querySelectorAll('[data-close-overlay]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.closeOverlay)?.classList.add('hidden');
      });
    });
    document.getElementById('createPlaylistFromModal')?.addEventListener('click', async () => {
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
    const list    = document.getElementById('playlistModalList');
    list.innerHTML = '<p style="padding:10px;color:var(--text-muted)">Loading…</p>';
    overlay.classList.remove('hidden');
    try {
      const res = await API.getMyPlaylists();
      list.innerHTML = (res.playlists||[]).map(pl => `
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

  const playAllFromPlaylist = async (uuid) => {
    try {
      const res = await API.getPlaylist(uuid);
      if (res.songs?.length) Player.play(res.songs[0], res.songs);
    } catch (e) { showNotification('Could not load playlist', 'error'); }
  };

  // ── Download ─────────────────────────────────────────────
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
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `Etokwa_Music - song.mp3`;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification(`Downloading: ${filename}`);
    } catch (e) { showNotification('Download failed', 'error'); }
  };

  // ── Artist song delete ───────────────────────────────────
  const deleteSong = async (uuid) => {
    if (!confirm('Delete this song permanently?')) return;
    try {
      await API.deleteSong(uuid);
      showNotification('Song deleted');
      navigate('my-songs');
    } catch (e) { showNotification(e.message, 'error'); }
  };

  // ── Admin actions ────────────────────────────────────────
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
    if (!confirm(`Delete user "${name}" permanently?`)) return;
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

  const deleteAccount = () => showNotification('Please contact support to delete your account.', 'error');

  // ── Toast notification ───────────────────────────────────
  const showNotification = (msg, type = 'success') => {
    const el   = document.getElementById('notification');
    if (!el) return;
    el.innerHTML = `<i class="fas fa-${type==='error'?'exclamation-circle':'check-circle'}" style="color:${type==='error'?'var(--red)':'var(--accent)'}"></i><span>${msg}</span>`;
    el.style.borderColor = type === 'error' ? 'var(--red)' : 'var(--accent)';
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 3000);
  };

  // ── Notifications banner + badge ─────────────────────────
  const updateNotifBadge = (count) => {
    const badge   = document.getElementById('navNotifBadge');
    const navLink = document.getElementById('navNotifLink');
    if (!badge || !navLink) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
      navLink.classList.add('has-notifs');
    } else {
      badge.classList.add('hidden');
      navLink.classList.remove('has-notifs');
    }
  };

  const loadNotifications = async () => {
    const banner = document.getElementById('notificationsBanner');
    if (!currentUser) return;
    try {
      const res   = await API.get('/notifications');
      const notifs = res.notifications || [];
      updateNotifBadge(notifs.length);
      if (!banner) return;
      banner.innerHTML = '';
      if (!notifs.length) { banner.classList.add('hidden'); return; }
      banner.classList.remove('hidden');
      const icons = { green:'check-circle', yellow:'exclamation-triangle', red:'exclamation-circle' };
      notifs.forEach(n => {
        const bar = document.createElement('div');
        bar.className   = `notif-bar ${n.color}`;
        bar.dataset.id  = n.id;
        bar.innerHTML   = `
          <i class="fas fa-${icons[n.color]||'info-circle'} notif-bar-icon"></i>
          <div class="notif-bar-body">
            <div class="notif-bar-title">${n.title}</div>
            <div class="notif-bar-msg">${n.message}</div>
          </div>
          <button class="notif-bar-close" onclick="App.dismissNotification(${n.id},this)" title="Dismiss">
            <i class="fas fa-times"></i>
          </button>`;
        banner.appendChild(bar);
      });
    } catch (e) { /* silent */ }
  };

  const dismissNotification = async (id, btn) => {
    try {
      await API.post(`/notifications/${id}/dismiss`);
      const bar = btn?.closest?.('.notif-bar') || document.querySelector(`[data-id="${id}"]`);
      if (bar) {
        bar.style.transition = 'opacity 0.25s';
        bar.style.opacity = '0';
        setTimeout(() => {
          bar.remove();
          const banner = document.getElementById('notificationsBanner');
          if (banner && !banner.children.length) banner.classList.add('hidden');
          updateNotifBadge(Math.max(0, (parseInt(document.getElementById('navNotifBadge')?.textContent)||1) - 1));
        }, 250);
      }
    } catch (e) { showNotification('Could not dismiss', 'error'); }
  };

  const dismissAllNotifications = async () => {
    document.querySelectorAll('.notif-page-item[id^="notif-page-"]').forEach(async item => {
      const id = item.id.replace('notif-page-','');
      try { await API.post(`/notifications/${id}/dismiss`); } catch (e) {}
      item.remove();
    });
    updateNotifBadge(0);
    document.getElementById('notificationsBanner')?.classList.add('hidden');
    showNotification('All notifications dismissed');
    navigate('notifications-page');
  };

  // ── Share ────────────────────────────────────────────────
  const openShare = async (type, refUuid, refTitle) => {
    const overlay = document.getElementById('shareOverlay');
    if (!overlay) return;
    document.getElementById('shareModalTitle').textContent = `Share "${refTitle||'Etokwa Music'}"`;
    document.getElementById('shareModalSubtitle').textContent = `Share this ${type}`;
    document.getElementById('shareLinkInput').value = 'Generating link…';
    document.getElementById('shareCopiedMsg').classList.add('hidden');
    overlay.classList.remove('hidden');
    try {
      const res = await API.createShareLink({ type, ref_uuid: refUuid, ref_title: refTitle });
      const url = res.url;
      _shareData = { url, title: refTitle||'Etokwa Music' };
      document.getElementById('shareLinkInput').value = url;
      const text = encodeURIComponent(`🎵 Listen on Etokwa Music: ${refTitle||''} ${url}`);
      document.getElementById('shareWhatsApp').href = `https://wa.me/?text=${text}`;
      document.getElementById('shareFacebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      document.getElementById('shareTwitter').href  = `https://twitter.com/intent/tweet?text=${text}`;
      document.getElementById('shareNativeBtn').style.display = navigator.share ? '' : 'none';
    } catch (e) { document.getElementById('shareLinkInput').value = window.location.origin; }
  };

  const copyShareLink = () => {
    const input = document.getElementById('shareLinkInput');
    navigator.clipboard?.writeText(input.value).then(() => {
      document.getElementById('shareCopiedMsg').classList.remove('hidden');
      document.getElementById('copyLinkBtn').innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => {
        document.getElementById('shareCopiedMsg').classList.add('hidden');
        document.getElementById('copyLinkBtn').innerHTML = '<i class="fas fa-copy"></i> Copy';
      }, 2500);
    }).catch(() => { input.select(); document.execCommand('copy'); showNotification('Link copied!'); });
  };

  const nativeShare = async () => {
    if (!_shareData || !navigator.share) return;
    try { await navigator.share({ title: _shareData.title, text:'🎵 Listen on Etokwa Music', url: _shareData.url }); }
    catch (e) {}
  };

  const handleShareLink = async () => {
    const shareId = new URLSearchParams(window.location.search).get('share');
    if (!shareId) return;
    try {
      const res = await API.resolveShare(shareId);
      if (res.type === 'artist')   navigate(`artist:${res.ref_uuid}`);
      else if (res.type === 'album')    navigate(`album:${res.ref_uuid}`);
      else if (res.type === 'playlist') navigate(`playlist:${res.ref_uuid}`);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (e) {}
  };

  // ── Donations ────────────────────────────────────────────
  const openDonation = (artistUuid, artistName) => {
    if (!currentUser) return Auth.showSignIn();
    const overlay = document.getElementById('donationOverlay');
    if (!overlay) return;
    document.getElementById('donationArtistName').textContent = artistName;
    document.getElementById('donationArtistUuid').value = artistUuid;
    document.getElementById('donationError').classList.add('hidden');
    document.getElementById('donationSuccess').classList.add('hidden');
    document.getElementById('donationForm').classList.remove('hidden');
    document.getElementById('donationPending').classList.add('hidden');
    document.getElementById('donationBreakdown').classList.add('hidden');
    document.getElementById('donationAmount').value = '';
    document.querySelectorAll('.donation-preset').forEach(b => b.classList.remove('active'));
    overlay.classList.remove('hidden');
  };

  const showDonationBreakdown = (amount) => {
    document.getElementById('breakdownArtist').textContent = `UGX ${Math.round(amount*0.85).toLocaleString()}`;
    document.getElementById('breakdownFee').textContent    = `UGX ${Math.round(amount*0.15).toLocaleString()}`;
    document.getElementById('donationBreakdown').classList.remove('hidden');
  };

  const checkDonationStatus = async () => {
    if (!_donationRef) return;
    try {
      const res = await API.verifyDonation(_donationRef);
      if (res.status === 'completed') {
        document.getElementById('donationPending').classList.add('hidden');
        const s = document.getElementById('donationSuccess');
        s.textContent = res.message; s.classList.remove('hidden');
        showNotification('💝 Donation sent! Thank you for supporting the artist.');
        setTimeout(() => document.getElementById('donationOverlay').classList.add('hidden'), 3000);
      }
    } catch (e) {}
  };

  // ── Terms & Conditions ───────────────────────────────────
  const showTerms = (onAccept) => {
    _termsCallback = onAccept;
    const cb = document.getElementById('termsCheckbox');
    if (cb) cb.checked = false;
    const btn = document.getElementById('termsAcceptBtn');
    if (btn) btn.disabled = true;
    document.getElementById('termsOverlay')?.classList.remove('hidden');
  };

  const acceptTermsAndProceed = () => {
    document.getElementById('termsOverlay')?.classList.add('hidden');
    if (_termsCallback) { _termsCallback(); _termsCallback = null; }
  };

  // ── Init all modal close/event bindings ──────────────────
  const initModals = () => {

    // ── 3-dot song context menu ─────────────────────────────
    // Create one shared dropdown, appended to body
    const ctxMenu = document.createElement('div');
    ctxMenu.id        = 'songCtxMenu';
    ctxMenu.className = 'song-actions-dropdown';
    ctxMenu.setAttribute('role', 'menu');
    ctxMenu.style.cssText = 'display:none;position:fixed;z-index:9999;';
    document.body.appendChild(ctxMenu);

    let menuOpen = false;

    const closeMenu = () => {
      ctxMenu.style.display = 'none';
      menuOpen = false;
    };

    const openMenu = (trigger, songData) => {
      const liked = songData.liked;
      const likeIcon  = liked ? 'fas fa-heart' : 'far fa-heart';
      const likeLabel = liked ? 'Unlike Song'  : 'Like Song';
      const likeColor = liked ? 'color:var(--accent)' : '';

      ctxMenu.innerHTML = `
        <button class="song-action-item" id="ctxLike" style="${likeColor}">
          <i class="${likeIcon}" style="color:inherit"></i> ${likeLabel}
        </button>
        <button class="song-action-item" id="ctxPlaylist">
          <i class="fas fa-plus"></i> Add to Playlist
        </button>
        <button class="song-action-item share-btn-item" id="ctxShare">
          <i class="fas fa-share-alt"></i> Share
        </button>
        ${songData.is_downloadable ? `
        <button class="song-action-item download" id="ctxDownload">
          <i class="fas fa-download"></i> Download
        </button>` : ''}
      `;

      // Wire up actions (using addEventListener, not inline onclick)
      ctxMenu.querySelector('#ctxLike')?.addEventListener('click', () => {
        closeMenu();
        // Find the like button for this song and click it
        const likeBtn = document.querySelector(`.like-btn-song[data-uuid="${songData.uuid}"]`);
        if (likeBtn) likeBtn.click();
        else if (currentUser) API.likeSong(songData.uuid).then(r => showNotification(r.liked ? 'Added to liked songs ❤️' : 'Removed from liked songs')).catch(() => {});
        else Auth.showSignIn();
      });

      ctxMenu.querySelector('#ctxPlaylist')?.addEventListener('click', () => {
        closeMenu();
        openAddToPlaylist(songData.uuid);
      });

      ctxMenu.querySelector('#ctxShare')?.addEventListener('click', () => {
        closeMenu();
        openShare('song', songData.uuid, songData.title);
      });

      ctxMenu.querySelector('#ctxDownload')?.addEventListener('click', () => {
        closeMenu();
        downloadSong(songData.uuid);
      });

      // Position: show first (off-screen) to measure, then place correctly
      ctxMenu.style.display = 'block';
      ctxMenu.style.top  = '-9999px';
      ctxMenu.style.left = '-9999px';

      const rect   = trigger.getBoundingClientRect();
      const menuW  = ctxMenu.offsetWidth  || 200;
      const menuH  = ctxMenu.offsetHeight || 160;
      const vw     = window.innerWidth;
      const vh     = window.innerHeight;

      let top  = rect.bottom + 6;
      let left = rect.right - menuW;

      // Flip up if no room below
      if (top + menuH > vh - 16) top = rect.top - menuH - 6;
      // Keep within left edge
      if (left < 8) left = 8;
      // Keep within right edge
      if (left + menuW > vw - 8) left = vw - menuW - 8;

      ctxMenu.style.top  = `${top}px`;
      ctxMenu.style.left = `${left}px`;
      menuOpen = true;
    };

    // Event delegation — listen on document for trigger clicks
    document.addEventListener('click', (e) => {
      // If clicked inside the open menu → let the button handlers above run
      if (ctxMenu.contains(e.target)) return;

      // If clicked a trigger button
      const trigger = e.target.closest('.song-actions-trigger');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();

        // If same menu is open, toggle it closed
        if (menuOpen) { closeMenu(); return; }

        // Read song data from the closest [data-song] parent
        const wrap = trigger.closest('.song-actions-menu');
        if (!wrap) return;

        let songData;
        try {
          // dataset.song is URL-encoded JSON
          songData = JSON.parse(decodeURIComponent(wrap.getAttribute('data-song')));
        } catch (err) {
          console.warn('Could not parse song data:', err);
          return;
        }
        openMenu(trigger, songData);
        return;
      }

      // Clicked outside → close
      if (menuOpen) closeMenu();
    }, true); // use capture so it fires before stopPropagation elsewhere

    // Close on scroll or ESC
    window.addEventListener('scroll', closeMenu, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

    // ── Player share button ─────────────────────────────────
    document.getElementById('sharePlayerBtn')?.addEventListener('click', () => {
      const song = Player.getCurrent();
      if (!song) return;
      openShare('song', song.uuid, song.title);
    });
    document.getElementById('helpFab')?.addEventListener('click', () =>
      document.getElementById('helpOverlay')?.classList.remove('hidden'));
    document.getElementById('helpOverlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('helpOverlay'))
        document.getElementById('helpOverlay').classList.add('hidden');
    });

    // Share
    document.getElementById('shareOverlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('shareOverlay'))
        document.getElementById('shareOverlay').classList.add('hidden');
    });

    // Donation presets
    document.querySelectorAll('.donation-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.donation-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const amt = parseInt(btn.dataset.amount);
        document.getElementById('donationAmount').value = amt;
        showDonationBreakdown(amt);
      });
    });

    document.getElementById('donationAmount')?.addEventListener('input', (e) => {
      const amt = parseInt(e.target.value);
      if (amt >= 500) showDonationBreakdown(amt);
      else document.getElementById('donationBreakdown').classList.add('hidden');
    });

    document.getElementById('donationForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const artistUuid = document.getElementById('donationArtistUuid').value;
      const amount     = parseInt(document.getElementById('donationAmount').value);
      const method     = document.querySelector('input[name="don_method"]:checked')?.value;
      const phone      = document.getElementById('donationPhone').value.trim();
      const message    = document.getElementById('donationMessage').value.trim();
      const errEl      = document.getElementById('donationError');
      const btn        = document.getElementById('donationSubmitBtn');
      if (!method) { errEl.textContent = 'Choose a payment method'; errEl.classList.remove('hidden'); return; }
      errEl.classList.add('hidden');
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Processing…';
      btn.querySelector('i').classList.remove('hidden');
      try {
        const res = await API.initiateDonation({ artist_uuid: artistUuid, amount, payment_method: method, payment_phone: phone, message });
        _donationRef = res.transaction_ref;
        document.getElementById('donationForm').classList.add('hidden');
        document.getElementById('donationPending').classList.remove('hidden');
        document.getElementById('donationPendingMsg').textContent = res.instructions;
        setTimeout(checkDonationStatus, 12000);
      } catch (err) {
        errEl.textContent = err.message; errEl.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Send Donation';
        btn.querySelector('i').classList.add('hidden');
      }
    });

    document.getElementById('checkDonationBtn')?.addEventListener('click', checkDonationStatus);
    document.getElementById('donationOverlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('donationOverlay'))
        document.getElementById('donationOverlay').classList.add('hidden');
    });

    // Terms
    document.getElementById('termsCheckbox')?.addEventListener('change', (e) => {
      document.getElementById('termsAcceptBtn').disabled = !e.target.checked;
    });
    document.getElementById('termsOverlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('termsOverlay'))
        document.getElementById('termsOverlay').classList.add('hidden');
    });

    // User dropdown
    document.getElementById('userAvatarBtn')?.addEventListener('click', () =>
      document.getElementById('userDropdown').classList.toggle('hidden'));
    document.addEventListener('click', (e) => {
      if (!document.getElementById('userMenu')?.contains(e.target))
        document.getElementById('userDropdown')?.classList.add('hidden');
    });

    // User dropdown links
    document.querySelectorAll('.user-dropdown a[data-page]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('userDropdown')?.classList.add('hidden');
        navigate(a.dataset.page);
      });
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('kumam_token');
      setUser(null);
      navigate('home');
      showNotification('Signed out successfully');
      document.getElementById('userDropdown')?.classList.add('hidden');
    });
  };

  const closeCtxMenu = () => {
    const m = document.getElementById('songCtxMenu');
    if (m) m.style.display = 'none';
  };

  // ── Theme ────────────────────────────────────────────────
  const setTheme = (mode) => {
    if (mode === 'dark') {
      document.body.classList.add('dark-mode');
      localStorage.setItem('kumam_theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('kumam_theme', 'light');
    }
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = (mode === 'dark');
  };

  const loadTheme = () => {
    if (localStorage.getItem('kumam_theme') === 'dark') {
      document.body.classList.add('dark-mode');
    }
    // Default is light — nothing to do
  };

  // ── Boot ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    init();
  });

  return {
    navigate, getUser, setUser, updateNavForUser,
    showNotification, toggleLike, toggleFollow,
    openAddToPlaylist, addSongToPlaylist, createPlaylistPrompt,
    playAllFromPlaylist, playSongFromRow, playFromSearch,
    downloadSong, deleteSong, closeCtxMenu,
    adminToggleUser, adminDeleteUser, adminToggleSong, adminDeleteSong, adminApproveSub,
    deleteAccount, setTheme,
    loadNotifications, dismissNotification, dismissAllNotifications, updateNotifBadge,
    openShare, copyShareLink, nativeShare,
    openDonation, checkDonationStatus, showDonationBreakdown,
    showTerms, acceptTermsAndProceed,
  };
})();
