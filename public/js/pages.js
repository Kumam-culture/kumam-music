// pages.js — All page renderers
const Pages = (() => {

  const DEFAULT_COVER = '/images/default-cover.svg';
  const DEFAULT_AVATAR = '/images/default-avatar.svg';

  const artwork = (song) => {
    if (song.artwork) return `/uploads/artwork/${song.artwork}`;
    if (song.album_artwork) return `/uploads/artwork/${song.album_artwork}`;
    return DEFAULT_COVER;
  };
  const avatarUrl = (u) => u?.avatar ? `/uploads/profiles/${u.avatar}` : DEFAULT_AVATAR;
  const fmtNum = (n) => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : (n||0).toString();
  const fmtTime = (s) => { if(!s) return ''; const m=Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}`; };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-UG',{year:'numeric',month:'short',day:'numeric'}) : '';

  // ── Song Card (grid view) ──────────────────────────────
  const songCard = (song, queueSongs) => {
    const art = artwork(song);
    return `
      <div class="song-card" onclick="Player.play(${JSON.stringify(song).replace(/"/g,'&quot;')}, null)" data-uuid="${song.uuid}">
        <div class="song-card-artwork">
          <img src="${art}" onerror="this.src='${DEFAULT_COVER}'" alt="${song.title}" loading="lazy"/>
          <div class="play-overlay"><i class="fas fa-play"></i></div>
        </div>
        <div class="song-card-title" title="${song.title}">${song.title}</div>
        <div class="song-card-artist">${song.stage_name || song.artist_name || 'Unknown'}</div>
        <div class="song-card-meta">
          <span class="song-card-streams"><i class="fas fa-play text-muted" style="font-size:10px;margin-right:3px"></i>${fmtNum(song.stream_count)}</span>
          <div class="song-card-actions">
            <button class="like-btn-song ${song.liked?'liked':''}" data-uuid="${song.uuid}" onclick="event.stopPropagation();App.toggleLike(this,'${song.uuid}')" title="Like">
              <i class="${song.liked?'fas':'far'} fa-heart"></i>
            </button>
            <button onclick="event.stopPropagation();App.openAddToPlaylist('${song.uuid}')" title="Add to playlist">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
      </div>`;
  };

  // ── Song Row (list view) ───────────────────────────────
  const songRow = (song, index, showArtist = true) => {
    const art = artwork(song);
    return `
      <div class="song-row" data-uuid="${song.uuid}" onclick="App.playSongFromRow('${song.uuid}')">
        <div class="song-num">${index + 1}</div>
        <div class="song-row-info">
          <div class="song-row-img"><img src="${art}" onerror="this.src='${DEFAULT_COVER}'" alt="" loading="lazy"/></div>
          <div>
            <div class="song-row-title">${song.title}</div>
            ${showArtist ? `<div class="song-row-artist">${song.stage_name || song.artist_name || ''}</div>` : ''}
          </div>
        </div>
        <div class="song-row-streams">${fmtNum(song.stream_count)}</div>
        <div class="song-row-duration">${fmtTime(song.duration)}</div>
        <div class="song-row-actions">
          <button class="like-btn-song ${song.liked?'liked':''}" data-uuid="${song.uuid}" onclick="event.stopPropagation();App.toggleLike(this,'${song.uuid}')" title="Like">
            <i class="${song.liked?'fas':'far'} fa-heart"></i>
          </button>
          <button onclick="event.stopPropagation();App.openAddToPlaylist('${song.uuid}')" title="Add to playlist">
            <i class="fas fa-plus"></i>
          </button>
          ${song.is_downloadable ? `<button onclick="event.stopPropagation();App.downloadSong('${song.uuid}')" title="Download"><i class="fas fa-download"></i></button>` : ''}
        </div>
      </div>`;
  };

  // ── Artist Card ────────────────────────────────────────
  const artistCard = (a) => {
    const av = a.avatar ? `/uploads/profiles/${a.avatar}` : null;
    return `
      <div class="artist-card" onclick="App.navigate('artist:${a.uuid}')">
        <div class="artist-card-avatar">
          ${av ? `<img src="${av}" onerror="this.style.display='none'" alt="${a.name}"/>` : `<i class="fas fa-user"></i>`}
        </div>
        <div class="artist-card-name">${a.name}</div>
        ${a.stage_name && a.stage_name !== a.name ? `<div class="artist-card-stage">${a.stage_name}</div>` : ''}
        <div class="artist-card-followers">${fmtNum(a.follower_count || 0)} followers</div>
        <button class="follow-btn ${a.is_following?'following':''}" onclick="event.stopPropagation();App.toggleFollow(this,'${a.uuid}')">
          ${a.is_following ? 'Following' : 'Follow'}
        </button>
      </div>`;
  };

  // ── Album Card ─────────────────────────────────────────
  const albumCard = (al) => {
    const img = al.artwork ? `/uploads/artwork/${al.artwork}` : null;
    return `
      <div class="album-card" onclick="App.navigate('album:${al.uuid}')">
        <div class="album-card-img">
          ${img ? `<img src="${img}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-record-vinyl\\'></i>'" alt="${al.title}"/>` : '<i class="fas fa-record-vinyl"></i>'}
        </div>
        <div class="album-card-info">
          <div class="album-card-title">${al.title}</div>
          <div class="album-card-artist">${al.stage_name || al.artist_name || ''}</div>
          <div class="album-card-meta">${al.song_count || 0} songs · ${fmtDate(al.release_date)}</div>
        </div>
      </div>`;
  };

  // ── Playlist Card ──────────────────────────────────────
  const PLAYLIST_COLORS = ['#8B5CF6','#F59E0B','#EF4444','#10B981','#EC4899','#3B82F6'];
  const playlistCard = (pl, i) => {
    const color = PLAYLIST_COLORS[i % PLAYLIST_COLORS.length];
    return `
      <div class="playlist-card" onclick="App.navigate('playlist:${pl.uuid}')">
        <div class="playlist-icon" style="background:${color}20;color:${color}">
          <i class="fas fa-${pl.is_system ? 'list-music' : 'music'}"></i>
        </div>
        <div class="playlist-card-info">
          <div class="title">${pl.title}</div>
          <div class="meta">${pl.song_count || pl.total_songs || 0} songs${pl.creator_name ? ' · ' + pl.creator_name : ''}</div>
        </div>
      </div>`;
  };

  const loading = () => `<div class="loading-spinner"><div class="spinner"></div></div>`;

  const empty = (icon, title, msg) => `
    <div class="empty-state">
      <i class="fas fa-${icon}"></i>
      <h3>${title}</h3>
      <p>${msg}</p>
    </div>`;

  // ════════════════════════════════════════════════════════
  // HOME PAGE
  // ════════════════════════════════════════════════════════
  const renderHome = async (container, user) => {
    container.innerHTML = loading();
    try {
      const [songsResult, artistsResult, albumsResult, playlistsResult] = await Promise.allSettled([
        API.getSongs({ limit: 12, sort: 'trending' }),
        API.getArtists({ limit: 8 }),
        API.getAlbums({ limit: 8 }),
        API.getPlaylists(),
      ]);

      // Safely extract values — use empty fallback if any call failed
      const songsRes    = songsResult.status    === 'fulfilled' ? songsResult.value    : { songs: [] };
      const artistsRes  = artistsResult.status  === 'fulfilled' ? artistsResult.value  : { artists: [] };
      const albumsRes   = albumsResult.status   === 'fulfilled' ? albumsResult.value   : { albums: [] };
      const playlistsRes= playlistsResult.status=== 'fulfilled' ? playlistsResult.value: { playlists: [] };

      // Log individual failures for debugging without crashing
      [songsResult, artistsResult, albumsResult, playlistsResult].forEach((r, i) => {
        if (r.status === 'rejected') {
          console.warn(['songs','artists','albums','playlists'][i], 'failed:', r.reason?.message);
        }
      });

      const greetMsg = user ? `Welcome back, ${user.name.split(' ')[0]}!` : 'Music from the Heart of Kumam';

      container.innerHTML = `
        <div class="tribal-border"></div>
        <div class="hero">
          <div class="hero-content">
            <div class="hero-badge"><i class="fas fa-drum"></i> KUMAM MUSIC</div>
            <h1>${user ? `Hey, ${user.name.split(' ')[0]}! 👋<br/>` : ''}<span class="highlight">Feel the Rhythm,</span><br/>Live the Culture</h1>
            <p>Stream authentic Kumam music — Gospel, Afrobeats, Hip-Hop, Dancehall, RnB and more. Support your favourite local artists.</p>
            <div class="hero-cta">
              ${!user ? `<button class="btn btn-primary" onclick="Auth.showSignUp()"><i class="fas fa-music"></i> Get Started Free</button>` : ''}
              <button class="btn btn-outline" onclick="App.navigate('discover')"><i class="fas fa-compass"></i> Discover Music</button>
            </div>
          </div>
          <div class="hero-stats">
            <div class="hero-stat"><div class="num">${fmtNum(songsRes.songs?.length * 10 || 0)}+</div><div class="label">Songs</div></div>
            <div class="hero-stat"><div class="num">${fmtNum(artistsRes.artists?.length * 5 || 0)}+</div><div class="label">Artists</div></div>
            <div class="hero-stat"><div class="num">5</div><div class="label">Genres</div></div>
          </div>
        </div>

        ${user ? `
        <div class="section" id="recommendSection">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-star"></i> Recommended For You</h2>
          </div>
          <div class="songs-grid" id="recommendGrid">${loading()}</div>
        </div>` : ''}

        <div class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-fire"></i> Trending Now</h2>
            <a href="#" class="see-all" onclick="App.navigate('discover');return false">See all</a>
          </div>
          <div class="songs-grid">
            ${(songsRes.songs || []).map(s => songCard(s, songsRes.songs)).join('') || empty('music', 'No songs yet', 'Songs will appear here')}
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-list"></i> Playlists</h2>
          </div>
          <div class="playlists-grid">
            ${(playlistsRes.playlists || []).map((pl, i) => playlistCard(pl, i)).join('') || empty('list', 'No playlists', '')}
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-users"></i> Featured Artists</h2>
            <a href="#" class="see-all" onclick="App.navigate('artists');return false">See all</a>
          </div>
          <div class="artists-grid">
            ${(artistsRes.artists || []).map(a => artistCard(a)).join('') || empty('user', 'No artists yet', '')}
          </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-compact-disc"></i> New Albums</h2>
            <a href="#" class="see-all" onclick="App.navigate('albums');return false">See all</a>
          </div>
          <div class="albums-grid">
            ${(albumsRes.albums || []).map(al => albumCard(al)).join('') || empty('record-vinyl', 'No albums yet', '')}
          </div>
        </div>
      `;

      // Load recommendations lazily
      if (user) {
        API.getRecommendations().then(r => {
          const grid = document.getElementById('recommendGrid');
          if (grid) grid.innerHTML = (r.songs || []).slice(0,8).map(s => songCard(s, r.songs)).join('') || empty('star', 'No recommendations yet', 'Listen to more songs to get recommendations');
        }).catch(() => {
          const grid = document.getElementById('recommendGrid');
          if (grid) grid.innerHTML = empty('star', 'No recommendations yet', 'Listen to more songs to get recommendations');
        });
      }

    } catch (e) {
      container.innerHTML = `<div class="section"><p style="color:var(--red)">Failed to load home: ${e.message}</p></div>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // DISCOVER PAGE
  // ════════════════════════════════════════════════════════
  const renderDiscover = async (container) => {
    const genres = [
      { name: 'All', slug: '' }, { name: 'Gospel', slug: 'gospel' }, { name: 'Afrobeats', slug: 'afrobeats' },
      { name: 'Hip-Hop', slug: 'hiphop' }, { name: 'Dancehall', slug: 'dancehall' }, { name: 'RnB', slug: 'rnb' }
    ];

    container.innerHTML = `
      <div class="section">
        <div class="section-header"><h2 class="section-title"><i class="fas fa-compass"></i> Discover Music</h2></div>
        <div class="genre-pills">
          ${genres.map((g, i) => `<div class="genre-pill ${i===0?'active':''}" data-genre="${g.slug}" onclick="Pages.filterDiscover(this,'${g.slug}')">${g.name}</div>`).join('')}
        </div>
        <div id="discoverSongsGrid">${loading()}</div>
      </div>`;

    await loadDiscoverSongs('');
  };

  const loadDiscoverSongs = async (genre) => {
    const grid = document.getElementById('discoverSongsGrid');
    if (!grid) return;
    grid.innerHTML = loading();
    try {
      const res = await API.getSongs({ genre, limit: 40, sort: 'trending' });
      grid.innerHTML = `<div class="songs-grid">${(res.songs||[]).map(s => songCard(s, res.songs)).join('') || empty('music','No songs found','Try a different genre')}</div>`;
    } catch (e) {
      grid.innerHTML = `<p style="color:var(--red);padding:20px">${e.message}</p>`;
    }
  };

  const filterDiscover = (el, genre) => {
    document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    loadDiscoverSongs(genre);
  };

  // ════════════════════════════════════════════════════════
  // GENRES PAGE
  // ════════════════════════════════════════════════════════
  const renderGenres = async (container) => {
    const genres = [
      { name: 'Gospel', slug: 'gospel', icon: 'cross', color: '#8B5CF6', desc: 'Praise, worship & inspirational' },
      { name: 'Afrobeats', slug: 'afrobeats', icon: 'drum', color: '#F59E0B', desc: 'Afro rhythms & vibes' },
      { name: 'Hip-Hop', slug: 'hiphop', icon: 'microphone', color: '#EF4444', desc: 'Flow, bars & beats' },
      { name: 'Dancehall', slug: 'dancehall', icon: 'record-vinyl', color: '#10B981', desc: 'Island & dance energy' },
      { name: 'RnB', slug: 'rnb', icon: 'heart', color: '#EC4899', desc: 'Rhythm & soul' },
    ];
    container.innerHTML = `
      <div class="section">
        <div class="section-header"><h2 class="section-title"><i class="fas fa-music"></i> Genres</h2></div>
        <div class="albums-grid">
          ${genres.map(g => `
            <div class="album-card" onclick="App.navigate('genre:${g.slug}')" style="cursor:pointer">
              <div class="album-card-img" style="background:${g.color}20;display:flex;align-items:center;justify-content:center;font-size:56px;color:${g.color}">
                <i class="fas fa-${g.icon}"></i>
              </div>
              <div class="album-card-info">
                <div class="album-card-title">${g.name}</div>
                <div class="album-card-artist" style="color:var(--text-muted)">${g.desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  };

  // ════════════════════════════════════════════════════════
  // GENRE DETAIL
  // ════════════════════════════════════════════════════════
  const renderGenreDetail = async (container, slug) => {
    container.innerHTML = loading();
    try {
      const res = await API.getSongs({ genre: slug, limit: 50, sort: 'trending' });
      const genreName = slug.charAt(0).toUpperCase() + slug.slice(1);
      container.innerHTML = `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-music"></i> ${genreName}</h2>
            <span class="text-muted text-sm">${res.songs?.length || 0} songs</span>
          </div>
          <div class="songs-list">
            ${(res.songs||[]).map((s,i) => songRow(s, i)).join('') || empty('music','No songs in this genre yet','')}
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // CHARTS PAGE
  // ════════════════════════════════════════════════════════
  const renderCharts = async (container) => {
    container.innerHTML = loading();
    try {
      const res = await API.getSongs({ limit: 100, sort: 'popular' });
      container.innerHTML = `
        <div class="section">
          <div class="section-header"><h2 class="section-title"><i class="fas fa-chart-bar"></i> Top 100 Charts</h2></div>
          <div class="songs-list">
            ${(res.songs||[]).map((s,i) => songRow(s, i)).join('') || empty('chart-bar','No songs yet','')}
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // LIBRARY
  // ════════════════════════════════════════════════════════
  const renderLibrary = async (container) => {
    container.innerHTML = loading();
    try {
      const [likedResult, playlistsResult, followedResult] = await Promise.allSettled([
        API.getLikedSongs(),
        API.getMyPlaylists(),
        API.getFollowedArtists(),
      ]);
      const likedRes    = likedResult.status    === 'fulfilled' ? likedResult.value    : { songs: [] };
      const playlistsRes= playlistsResult.status=== 'fulfilled' ? playlistsResult.value: { playlists: [] };
      const followedRes = followedResult.status === 'fulfilled' ? followedResult.value : { artists: [] };
      container.innerHTML = `
        <div class="section">
          <div class="section-header"><h2 class="section-title"><i class="fas fa-book-open"></i> My Library</h2></div>
          <div class="playlists-grid" style="margin-bottom:24px">
            <div class="playlist-card" onclick="App.navigate('liked')">
              <div class="playlist-icon" style="background:#ef444420;color:#ef4444"><i class="fas fa-heart"></i></div>
              <div class="playlist-card-info">
                <div class="title">Liked Songs</div>
                <div class="meta">${likedRes.songs?.length||0} songs</div>
              </div>
            </div>
            <div class="playlist-card" onclick="App.navigate('history')">
              <div class="playlist-icon" style="background:#3b82f620;color:#3b82f6"><i class="fas fa-history"></i></div>
              <div class="playlist-card-info">
                <div class="title">Recently Played</div>
                <div class="meta">Your history</div>
              </div>
            </div>
          </div>
        </div>
        <div class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-list"></i> My Playlists</h2>
            <button class="btn btn-outline btn-sm" onclick="App.createPlaylistPrompt()"><i class="fas fa-plus"></i> New</button>
          </div>
          <div class="playlists-grid">
            ${(playlistsRes.playlists||[]).map((pl,i) => playlistCard(pl, i)).join('') || empty('list','No playlists yet','Create your first playlist!')}
          </div>
        </div>
        <div class="section">
          <div class="section-header"><h2 class="section-title"><i class="fas fa-users"></i> Following</h2></div>
          <div class="artists-grid">
            ${(followedRes.artists||[]).map(a => artistCard(a)).join('') || empty('user','Not following anyone','Follow artists to see them here')}
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // LIKED SONGS
  // ════════════════════════════════════════════════════════
  const renderLiked = async (container) => {
    container.innerHTML = loading();
    try {
      const res = await API.getLikedSongs();
      container.innerHTML = `
        <div class="profile-header">
          <div class="profile-avatar" style="background:#ef444430"><i class="fas fa-heart" style="color:#ef4444;font-size:40px"></i></div>
          <div class="profile-info">
            <div class="name">Liked Songs</div>
            <div class="meta">${res.songs?.length||0} songs</div>
          </div>
        </div>
        <div class="section">
          <div class="songs-list">
            ${(res.songs||[]).map((s,i) => songRow(s, i)).join('') || empty('heart','No liked songs yet','Like songs to see them here')}
          </div>
        </div>`;

      if (res.songs?.length) {
        document.querySelector('.profile-header .btn')?.addEventListener('click', () => {
          Player.setQueue(res.songs);
          Player.play(res.songs[0], res.songs);
        });
      }
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // HISTORY
  // ════════════════════════════════════════════════════════
  const renderHistory = async (container) => {
    container.innerHTML = loading();
    try {
      const res = await API.getHistory();
      container.innerHTML = `
        <div class="section">
          <div class="section-header"><h2 class="section-title"><i class="fas fa-history"></i> Listening History</h2></div>
          <div class="songs-list">
            ${(res.songs||[]).map((s,i) => songRow(s, i)).join('') || empty('history','No history yet','Start listening to build your history')}
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // PLAYLISTS PAGE
  // ════════════════════════════════════════════════════════
  const renderPlaylists = async (container) => {
    container.innerHTML = loading();
    try {
      const [myResult, sysResult] = await Promise.allSettled([API.getMyPlaylists(), API.getPlaylists()]);
      const myRes  = myResult.status  === 'fulfilled' ? myResult.value  : { playlists: [] };
      const sysRes = sysResult.status === 'fulfilled' ? sysResult.value : { playlists: [] };
      container.innerHTML = `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-list-music"></i> My Playlists</h2>
            <button class="btn btn-outline btn-sm" onclick="App.createPlaylistPrompt()"><i class="fas fa-plus"></i> New Playlist</button>
          </div>
          <div class="playlists-grid">
            ${(myRes.playlists||[]).map((pl,i)=>playlistCard(pl,i)).join('') || empty('list','No playlists yet','Create your first playlist!')}
          </div>
        </div>
        <div class="section">
          <div class="section-header"><h2 class="section-title"><i class="fas fa-globe"></i> Featured Playlists</h2></div>
          <div class="playlists-grid">
            ${(sysRes.playlists||[]).filter(p=>p.is_system).map((pl,i)=>playlistCard(pl,i)).join('')}
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // PLAYLIST DETAIL
  // ════════════════════════════════════════════════════════
  const renderPlaylist = async (container, uuid) => {
    container.innerHTML = loading();
    try {
      const res = await API.getPlaylist(uuid);
      const pl = res.playlist;
      const songs = res.songs || [];
      container.innerHTML = `
        <div class="profile-header">
          <div class="profile-avatar" style="background:#8B5CF620"><i class="fas fa-list-music" style="color:#8B5CF6;font-size:40px"></i></div>
          <div class="profile-info">
            <div class="name">${pl.title}</div>
            <div class="meta">${songs.length} songs ${pl.description ? '· ' + pl.description : ''}</div>
            <div style="margin-top:14px;display:flex;gap:10px">
              ${songs.length ? `<button class="btn btn-primary" onclick="App.playAllFromPlaylist('${uuid}')"><i class="fas fa-play"></i> Play All</button>` : ''}
              ${songs.length ? `<button class="btn btn-outline"><i class="fas fa-random"></i> Shuffle</button>` : ''}
            </div>
          </div>
        </div>
        <div class="section">
          <div class="songs-list">
            ${songs.map((s,i) => songRow(s, i)).join('') || empty('music','No songs in this playlist','Add songs to get started')}
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // ALBUM DETAIL
  // ════════════════════════════════════════════════════════
  const renderAlbum = async (container, uuid) => {
    container.innerHTML = loading();
    try {
      const res = await API.getAlbum(uuid);
      const al = res.album;
      const songs = res.songs || [];
      const img = al.artwork ? `/uploads/artwork/${al.artwork}` : null;
      container.innerHTML = `
        <div class="profile-header">
          <div class="profile-avatar" style="border-radius:12px;overflow:hidden;background:var(--bg-card)">
            ${img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover" alt="${al.title}"/>` : `<i class="fas fa-record-vinyl" style="font-size:40px;color:var(--accent)"></i>`}
          </div>
          <div class="profile-info">
            <div class="name">${al.title}</div>
            <div class="role-badge">Album</div>
            <div class="meta" style="margin-top:8px">
              <a href="#" onclick="App.navigate('artist:${al.artist_uuid||''}');return false" style="color:var(--accent)">${al.stage_name||al.artist_name}</a>
              · ${songs.length} songs · ${fmtDate(al.release_date)}
            </div>
            <div style="margin-top:14px;display:flex;gap:10px">
              ${songs.length ? `<button class="btn btn-primary" onclick="Player.play(${JSON.stringify(songs[0]).replace(/"/g,'&quot;')}, ${JSON.stringify(songs).replace(/"/g,'&quot;')})"><i class="fas fa-play"></i> Play All</button>` : ''}
            </div>
          </div>
        </div>
        <div class="section">
          <div class="songs-list">
            ${songs.map((s,i) => songRow(s, i, false)).join('') || empty('music','No songs in this album yet','')}
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // ARTIST PROFILE
  // ════════════════════════════════════════════════════════
  const renderArtist = async (container, uuid) => {
    container.innerHTML = loading();
    try {
      const res = await API.getArtist(uuid);
      const a = res.artist;
      const songs = res.songs || [];
      const albums = res.albums || [];
      const av = a.avatar ? `/uploads/profiles/${a.avatar}` : null;
      container.innerHTML = `
        <div class="profile-header" style="background:linear-gradient(135deg,#1a0533,#0d1a33)">
          <div class="profile-avatar">
            ${av ? `<img src="${av}" alt="${a.name}"/>` : `<i class="fas fa-user" style="font-size:40px"></i>`}
          </div>
          <div class="profile-info">
            <div class="name">${a.stage_name || a.name}</div>
            <div class="role-badge">Artist</div>
            <div class="meta">${fmtNum(a.follower_count||0)} followers · ${fmtNum(a.total_streams||0)} streams ${a.genre ? '· ' + a.genre : ''} ${a.location ? '· 📍 ' + a.location : ''}</div>
            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn ${a.is_following?'btn-primary':'btn-outline'}" id="artistFollowBtn" onclick="App.toggleFollow(this,'${a.uuid}')">
                ${a.is_following ? '<i class="fas fa-check"></i> Following' : '<i class="fas fa-plus"></i> Follow'}
              </button>
              ${songs.length ? `<button class="btn btn-outline" onclick="Player.play(${JSON.stringify(songs[0]).replace(/"/g,'&quot;')},${JSON.stringify(songs).replace(/"/g,'&quot;')})"><i class="fas fa-play"></i> Play</button>` : ''}
            </div>
          </div>
        </div>

        ${a.bio ? `
        <div class="artist-bio-section">
          <h4><i class="fas fa-user-circle"></i> About ${a.stage_name || a.name}</h4>
          <div class="bio-text">${a.bio.replace(/\n/g, '<br/>')}</div>
          <div class="bio-stats-row">
            <div class="bio-stat"><div class="val">${fmtNum(songs.length)}</div><div class="lbl">Songs</div></div>
            <div class="bio-stat"><div class="val">${fmtNum(albums.length)}</div><div class="lbl">Albums</div></div>
            <div class="bio-stat"><div class="val">${fmtNum(a.follower_count||0)}</div><div class="lbl">Followers</div></div>
            <div class="bio-stat"><div class="val">${fmtNum(a.total_streams||0)}</div><div class="lbl">Streams</div></div>
          </div>
          ${a.social_instagram || a.social_twitter || a.website ? `
          <div style="margin-top:14px;display:flex;gap:12px;flex-wrap:wrap">
            ${a.website         ? `<a href="${a.website}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-globe"></i> Website</a>` : ''}
            ${a.social_instagram? `<a href="${a.social_instagram}" target="_blank" class="btn btn-outline btn-sm"><i class="fab fa-instagram"></i> Instagram</a>` : ''}
            ${a.social_twitter  ? `<a href="${a.social_twitter}"   target="_blank" class="btn btn-outline btn-sm"><i class="fab fa-twitter"></i> Twitter</a>` : ''}
          </div>` : ''}
        </div>` : ''}

        <div class="profile-tabs">
          <div class="profile-tab active" onclick="Pages.switchTab(this,'songs-tab')">Songs</div>
          <div class="profile-tab" onclick="Pages.switchTab(this,'albums-tab')">Albums</div>
        </div>
        <div class="profile-tab-content active" id="songs-tab">
          <div class="songs-list" style="padding:16px">
            ${songs.map((s,i) => songRow(s, i, false)).join('') || empty('music','No songs yet','')}
          </div>
        </div>
        <div class="profile-tab-content" id="albums-tab">
          <div class="albums-grid" style="padding:24px">
            ${albums.map(al => albumCard(al)).join('') || empty('record-vinyl','No albums yet','')}
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  const switchTab = (el, tabId) => {
    el.closest('.profile-tabs').querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const parent = el.closest('.page') || document.getElementById('pageContent');
    parent.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');
  };

  // ════════════════════════════════════════════════════════
  // PROFILE PAGE
  // ════════════════════════════════════════════════════════
  const renderProfile = async (container) => {
    container.innerHTML = loading();
    try {
      const [profileResult, subResult] = await Promise.allSettled([API.getProfile(), API.getMySubscription()]);
      if (profileResult.status === 'rejected') throw profileResult.reason;
      const profileRes = profileResult.value;
      const subRes = subResult.status === 'fulfilled' ? subResult.value : { active: null };
      const u = profileRes.user;
      const sub = subRes.active;
      const av = u.avatar ? `/uploads/profiles/${u.avatar}` : null;
      container.innerHTML = `
        <div class="profile-header">
          <div class="profile-avatar">
            ${av ? `<img src="${av}" alt="${u.name}"/>` : `<i class="fas fa-user" style="font-size:40px"></i>`}
          </div>
          <div class="profile-info">
            <div class="name">${u.name}</div>
            <div class="role-badge">${u.role.charAt(0).toUpperCase()+u.role.slice(1)}</div>
            <div class="meta">${u.email} · Member since ${fmtDate(u.created_at)}</div>
          </div>
        </div>
        <div class="profile-tabs">
          <div class="profile-tab active" onclick="Pages.switchTab(this,'edit-profile-tab')">Edit Profile</div>
          <div class="profile-tab" onclick="Pages.switchTab(this,'sub-tab')">Subscription</div>
          ${u.role === 'artist' ? `<div class="profile-tab" onclick="Pages.switchTab(this,'payment-tab')">Payment Info</div>` : ''}
        </div>
        <div class="profile-tab-content active" id="edit-profile-tab">
          <div class="upload-form">
            <form id="editProfileForm" enctype="multipart/form-data">
              <div class="form-group">
                <label>Full Name</label>
                <input type="text" name="name" value="${u.name}" required/>
              </div>
              <div class="form-group">
                <label>Email <small style="color:var(--text-muted)">(requires current password)</small></label>
                <input type="email" name="email" value="${u.email}"/>
              </div>
              <div class="form-group">
                <label>Phone</label>
                <input type="tel" name="phone" value="${u.phone||''}"/>
              </div>
              <div class="form-group">
                <label>Bio / About You</label>
                <div class="bio-edit-wrap">
                  <textarea name="bio" id="bioTextarea" rows="5" maxlength="1000" style="resize:vertical;padding-bottom:28px" placeholder="Tell your fans about yourself — your journey, style, influences...">${u.bio||''}</textarea>
                  <span class="bio-char-count" id="bioCharCount">${(u.bio||'').length}/1000</span>
                </div>
              </div>
              <div class="form-group">
                <label>Profile Photo</label>
                <input type="file" name="avatar" accept="image/*"/>
              </div>
              <div class="form-group">
                <label>Current Password <small style="color:var(--text-muted)">(required for email/password change)</small></label>
                <input type="password" name="currentPassword" placeholder="Enter current password to verify"/>
              </div>
              <div class="form-group">
                <label>New Password <small style="color:var(--text-muted)">(leave blank to keep current)</small></label>
                <input type="password" name="newPassword" placeholder="Min 8 characters"/>
              </div>
              <div id="profileUpdateMsg" class="hidden"></div>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
          </div>
        </div>
        <div class="profile-tab-content" id="sub-tab">
          <div class="upload-form">
            ${sub ? `
              <div class="alert alert-success">
                <i class="fas fa-check-circle"></i>
                Active: <strong>${sub.plan.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</strong>
                · Expires ${fmtDate(sub.end_date)}
              </div>` : `
              <div class="alert" style="background:var(--accent-glow);border-color:var(--accent);color:var(--accent-light)">
                <i class="fas fa-crown"></i>
                No active subscription. Upgrade to unlock premium features!
              </div>
              <button class="btn btn-primary" onclick="Auth.showSubscription()"><i class="fas fa-crown"></i> Subscribe Now</button>`}
          </div>
        </div>
        ${u.role === 'artist' ? `
        <div class="profile-tab-content" id="payment-tab">
          <div class="upload-form">
            <form id="paymentInfoForm">
              <div class="form-group"><label>MTN Mobile Money Number</label><input type="tel" name="mtn_number" placeholder="0761234567"/></div>
              <div class="form-group"><label>Airtel Money Number</label><input type="tel" name="airtel_number" placeholder="0701234567"/></div>
              <div class="form-group"><label>Bank Name (optional)</label><input type="text" name="bank_name" placeholder="Bank name"/></div>
              <div class="form-group"><label>Bank Account Number</label><input type="text" name="bank_account" placeholder="Account number"/></div>
              <button type="submit" class="btn btn-primary">Save Payment Info</button>
            </form>
          </div>
        </div>` : ''}
      `;

      // Bio char counter
      const bioTA = document.getElementById('bioTextarea');
      const bioCount = document.getElementById('bioCharCount');
      if (bioTA && bioCount) {
        bioTA.addEventListener('input', () => {
          bioCount.textContent = `${bioTA.value.length}/1000`;
          bioCount.style.color = bioTA.value.length > 900 ? 'var(--red)' : 'var(--text-muted)';
        });
      }

      // Edit profile submit
      document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const msgEl = document.getElementById('profileUpdateMsg');
        try {
          await API.updateProfile(fd);
          msgEl.className = 'alert alert-success';
          msgEl.textContent = 'Profile updated successfully!';
          msgEl.classList.remove('hidden');
          const meRes = await API.getMe();
          App.setUser(meRes.user);
          App.updateNavForUser(meRes.user);
        } catch (err) {
          msgEl.className = 'alert alert-error';
          msgEl.textContent = err.message;
          msgEl.classList.remove('hidden');
        }
      });

      if (u.role === 'artist') {
        document.getElementById('paymentInfoForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await API.updateArtistProfile(fd);
            App.showNotification('Payment info saved');
          } catch (err) {
            App.showNotification(err.message, 'error');
          }
        });
      }
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // SETTINGS PAGE
  // ════════════════════════════════════════════════════════
  const renderSettings = (container) => {
    container.innerHTML = `
      <div class="section">
        <div class="section-header"><h2 class="section-title"><i class="fas fa-cog"></i> Settings</h2></div>
        <div style="max-width:500px">
          <div class="stat-card" style="margin-bottom:16px">
            <h3 style="margin-bottom:16px;font-size:16px">Account Settings</h3>
            <button class="btn btn-outline w-full" style="margin-bottom:10px" onclick="App.navigate('profile')"><i class="fas fa-user"></i> Edit Profile</button>
            <button class="btn btn-outline w-full" style="margin-bottom:10px" onclick="Auth.showSubscription()"><i class="fas fa-crown"></i> Manage Subscription</button>
          </div>
          <div class="stat-card">
            <h3 style="margin-bottom:16px;font-size:16px">Privacy & Security</h3>
            <button class="btn btn-danger w-full" onclick="App.deleteAccount()"><i class="fas fa-trash"></i> Delete Account</button>
          </div>
        </div>
      </div>`;
  };

  // ════════════════════════════════════════════════════════
  // ARTIST DASHBOARD
  // ════════════════════════════════════════════════════════
  const renderArtistDashboard = async (container) => {
    container.innerHTML = loading();
    try {
      const res = await API.getArtistStats();
      const { stats, topSongs, monthlyStreams } = res;
      container.innerHTML = `
        <div class="section">
          <div class="section-header"><h2 class="section-title"><i class="fas fa-tachometer-alt"></i> Artist Dashboard</h2></div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-card-icon" style="background:#8B5CF620;color:#8B5CF6"><i class="fas fa-music"></i></div>
              <div class="stat-card-value">${fmtNum(stats.total_songs||0)}</div>
              <div class="stat-card-label">Published Songs</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-icon" style="background:#F59E0B20;color:#F59E0B"><i class="fas fa-play"></i></div>
              <div class="stat-card-value">${fmtNum(stats.total_streams||0)}</div>
              <div class="stat-card-label">Total Streams</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-icon" style="background:#10B98120;color:#10B981"><i class="fas fa-users"></i></div>
              <div class="stat-card-value">${fmtNum(stats.total_followers||0)}</div>
              <div class="stat-card-label">Followers</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-icon" style="background:#EC489920;color:#EC4899"><i class="fas fa-coins"></i></div>
              <div class="stat-card-value">UGX ${fmtNum(Math.round(stats.total_earnings||0))}</div>
              <div class="stat-card-label">Total Earnings</div>
            </div>
          </div>

          <h3 style="margin-bottom:16px;font-weight:700">Top Songs</h3>
          <div class="songs-list" style="margin-bottom:32px">
            ${(topSongs||[]).map((s,i) => `
              <div class="song-row" style="cursor:default">
                <div class="song-num">${i+1}</div>
                <div class="song-row-info">
                  <div class="song-row-img"><img src="${s.artwork?`/uploads/artwork/${s.artwork}`:DEFAULT_COVER}" onerror="this.src='${DEFAULT_COVER}'" alt=""/></div>
                  <div><div class="song-row-title">${s.title}</div><div class="song-row-artist">${fmtNum(s.likes||0)} likes</div></div>
                </div>
                <div class="song-row-streams">${fmtNum(s.stream_count)} streams</div>
                <div class="song-row-duration">${fmtNum(s.download_count)} downloads</div>
              </div>`).join('') || empty('music','No songs yet','Upload your first song!')}
          </div>

          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:32px">
            <button class="btn btn-primary" onclick="App.navigate('upload')"><i class="fas fa-upload"></i> Upload Song</button>
            <button class="btn btn-outline" onclick="App.navigate('my-songs')"><i class="fas fa-list"></i> Manage Songs</button>
            <button class="btn btn-outline" onclick="App.navigate('my-albums')"><i class="fas fa-compact-disc"></i> Albums</button>
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // UPLOAD PAGE
  // ════════════════════════════════════════════════════════
  const renderUpload = async (container) => {
    let albums = [];
    try { const r = await API.getMyAlbums(); albums = r.albums || []; } catch (e) {}

    container.innerHTML = `
      <div class="section">
        <div class="section-header"><h2 class="section-title"><i class="fas fa-upload"></i> Upload Music</h2></div>
        <div class="upload-form">
          <form id="uploadSongForm" enctype="multipart/form-data">
            <div class="upload-area" id="audioDropZone">
              <i class="fas fa-music"></i>
              <div class="upload-text">Drop your audio file here</div>
              <div class="upload-hint">MP3, M4A, WAV, OGG · Max 50MB</div>
              <input type="file" name="audio" id="audioFileInput" accept="audio/*" style="display:none" required/>
            </div>
            <div id="audioFileName" class="text-muted text-sm mt-2" style="display:none"></div>

            <div class="form-group">
              <label>Song Title *</label>
              <input type="text" name="title" placeholder="Enter song title" required/>
            </div>
            <div class="form-group">
              <label>Genre</label>
              <select name="genre_id">
                <option value="">Select genre</option>
                <option value="1">Gospel</option>
                <option value="2">Afrobeats</option>
                <option value="3">Hip-Hop</option>
                <option value="4">Dancehall</option>
                <option value="5">RnB</option>
              </select>
            </div>
            <div class="form-group">
              <label>Album (optional)</label>
              <select name="album_id">
                <option value="">No album (single)</option>
                ${albums.map(al => `<option value="${al.id}">${al.title}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Track Number (if in album)</label>
              <input type="number" name="track_number" min="1" placeholder="e.g. 1"/>
            </div>
            <div class="form-group">
              <label>Artwork (optional)</label>
              <div class="upload-area" id="artworkDropZone" style="padding:20px">
                <i class="fas fa-image"></i>
                <div class="upload-text">Upload cover art</div>
                <div class="upload-hint">JPG, PNG, WebP · Max 5MB</div>
                <input type="file" name="artwork" id="artworkFileInput" accept="image/*" style="display:none"/>
              </div>
            </div>
            <div class="form-group">
              <label>Lyrics (optional)</label>
              <textarea name="lyrics" rows="5" placeholder="Paste song lyrics here..."></textarea>
            </div>
            <div style="display:flex;gap:20px;margin-bottom:20px">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--text-secondary)">
                <input type="checkbox" name="is_downloadable" value="true"/> Allow downloads
              </label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--text-secondary)">
                <input type="checkbox" name="is_premium" value="true"/> Premium only
              </label>
            </div>
            <div id="uploadMsg" class="hidden"></div>
            <button type="submit" class="btn btn-primary"><span><i class="fas fa-upload"></i> Upload Song</span><i class="fas fa-spinner fa-spin hidden"></i></button>
          </form>

          <div style="margin-top:40px;padding-top:32px;border-top:1px solid var(--border)">
            <h3 style="margin-bottom:16px;font-weight:700"><i class="fas fa-compact-disc"></i> Create New Album</h3>
            <form id="createAlbumForm" enctype="multipart/form-data">
              <div class="form-group"><label>Album Title *</label><input type="text" name="title" placeholder="Album title" required/></div>
              <div class="form-group"><label>Description</label><textarea name="description" rows="2" placeholder="Album description..."></textarea></div>
              <div class="form-group"><label>Genre</label>
                <select name="genre_id">
                  <option value="">Select genre</option>
                  <option value="1">Gospel</option><option value="2">Afrobeats</option>
                  <option value="3">Hip-Hop</option><option value="4">Dancehall</option><option value="5">RnB</option>
                </select>
              </div>
              <div class="form-group"><label>Release Date</label><input type="date" name="release_date"/></div>
              <div class="form-group"><label>Album Artwork</label><input type="file" name="artwork" accept="image/*"/></div>
              <div id="albumMsg" class="hidden"></div>
              <button type="submit" class="btn btn-outline"><i class="fas fa-plus"></i> Create Album</button>
            </form>
          </div>
        </div>
      </div>`;

    // Audio drop zone
    const audioZone = document.getElementById('audioDropZone');
    const audioInput = document.getElementById('audioFileInput');
    audioZone.addEventListener('click', () => audioInput.click());
    audioInput.addEventListener('change', () => {
      if (audioInput.files[0]) {
        const nameEl = document.getElementById('audioFileName');
        nameEl.textContent = `✓ ${audioInput.files[0].name}`;
        nameEl.style.display = 'block';
        audioZone.style.borderColor = 'var(--green)';
        audioZone.querySelector('i').style.color = 'var(--green)';
      }
    });

    // Artwork drop zone
    const artZone = document.getElementById('artworkDropZone');
    const artInput = document.getElementById('artworkFileInput');
    artZone.addEventListener('click', () => artInput.click());
    artInput.addEventListener('change', () => {
      if (artInput.files[0]) {
        artZone.querySelector('.upload-text').textContent = `✓ ${artInput.files[0].name}`;
        artZone.style.borderColor = 'var(--green)';
      }
    });

    // Upload song
    document.getElementById('uploadSongForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const msgEl = document.getElementById('uploadMsg');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.querySelector('i.fa-spinner').classList.remove('hidden');
      try {
        await API.uploadSong(fd);
        msgEl.className = 'alert alert-success';
        msgEl.textContent = '🎵 Song uploaded successfully!';
        msgEl.classList.remove('hidden');
        e.target.reset();
        document.getElementById('audioFileName').style.display = 'none';
        audioZone.style.borderColor = '';
        artZone.querySelector('.upload-text').textContent = 'Upload cover art';
        artZone.style.borderColor = '';
      } catch (err) {
        msgEl.className = 'alert alert-error';
        msgEl.textContent = err.message;
        msgEl.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.querySelector('i.fa-spinner').classList.add('hidden');
      }
    });

    // Create album
    document.getElementById('createAlbumForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const msgEl = document.getElementById('albumMsg');
      try {
        await API.createAlbum(fd);
        msgEl.className = 'alert alert-success';
        msgEl.textContent = 'Album created successfully!';
        msgEl.classList.remove('hidden');
        e.target.reset();
      } catch (err) {
        msgEl.className = 'alert alert-error';
        msgEl.textContent = err.message;
        msgEl.classList.remove('hidden');
      }
    });
  };

  // ════════════════════════════════════════════════════════
  // MY SONGS (artist management)
  // ════════════════════════════════════════════════════════
  const renderMySongs = async (container) => {
    container.innerHTML = loading();
    try {
      const res = await API.getMySongs();
      container.innerHTML = `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title"><i class="fas fa-list"></i> My Songs</h2>
            <button class="btn btn-primary btn-sm" onclick="App.navigate('upload')"><i class="fas fa-plus"></i> Upload</button>
          </div>
          <div class="data-table-wrap" style="overflow-x:auto">
            <table class="data-table">
              <thead><tr><th>Song</th><th>Genre</th><th>Streams</th><th>Downloads</th><th>Likes</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                ${(res.songs||[]).map(s => `
                  <tr>
                    <td><div style="display:flex;align-items:center;gap:10px">
                      <img src="${s.artwork?`/uploads/artwork/${s.artwork}`:DEFAULT_COVER}" style="width:36px;height:36px;border-radius:4px;object-fit:cover" onerror="this.src='${DEFAULT_COVER}'"/>
                      <span>${s.title}</span>
                    </div></td>
                    <td>${s.genre_name||'—'}</td>
                    <td>${fmtNum(s.stream_count)}</td>
                    <td>${fmtNum(s.download_count)}</td>
                    <td>${fmtNum(s.like_count||0)}</td>
                    <td><span class="badge ${s.is_published?'badge-active':'badge-pending'}">${s.is_published?'Published':'Draft'}</span></td>
                    <td>
                      <button class="btn btn-sm btn-danger" onclick="App.deleteSong('${s.uuid}')">Delete</button>
                    </td>
                  </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">No songs yet. Upload your first song!</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  // ════════════════════════════════════════════════════════
  // ADMIN DASHBOARD
  // ════════════════════════════════════════════════════════
  const renderAdmin = async (container) => {
    container.innerHTML = loading();
    try {
      const res = await API.getAdminDashboard();
      const { stats } = res;
      container.innerHTML = `
        <div class="tribal-border"></div>
        <div class="section" style="padding-bottom:0">
          <div class="section-header"><h2 class="section-title"><i class="fas fa-shield-alt"></i> Admin Panel</h2>
            <button class="btn btn-outline btn-sm" onclick="API.refreshSystemPlaylists().then(()=>App.showNotification('Playlists refreshed'))"><i class="fas fa-sync"></i> Refresh Playlists</button>
          </div>
          <div class="stats-grid">
            ${[
              {icon:'users',color:'#8B5CF6',val:stats.totalListeners,label:'Listeners'},
              {icon:'microphone',color:'#F59E0B',val:stats.totalArtists,label:'Artists'},
              {icon:'music',color:'#EF4444',val:stats.totalSongs,label:'Songs'},
              {icon:'play',color:'#10B981',val:fmtNum(stats.totalStreams),label:'Total Streams'},
              {icon:'coins',color:'#EC4899',val:'UGX '+fmtNum(Math.round(stats.totalRevenue||0)),label:'Revenue'},
              {icon:'clock',color:'#3B82F6',val:stats.pendingSubscriptions,label:'Pending Subs'},
            ].map(s=>`<div class="stat-card">
              <div class="stat-card-icon" style="background:${s.color}20;color:${s.color}"><i class="fas fa-${s.icon}"></i></div>
              <div class="stat-card-value">${s.val}</div>
              <div class="stat-card-label">${s.label}</div>
            </div>`).join('')}
          </div>
        </div>
        <div class="admin-tabs">
          <div class="admin-tab active" onclick="Pages.adminTab(this,'admin-users')">Users</div>
          <div class="admin-tab" onclick="Pages.adminTab(this,'admin-songs')">Songs</div>
          <div class="admin-tab" onclick="Pages.adminTab(this,'admin-subs')">Subscriptions</div>
          <div class="admin-tab" onclick="Pages.adminTab(this,'admin-earnings')">Earnings</div>
          <div class="admin-tab" onclick="Pages.adminTab(this,'admin-notifs')">Notifications</div>
        </div>
        <div class="admin-content active" id="admin-users">${loading()}</div>
        <div class="admin-content" id="admin-songs"></div>
        <div class="admin-content" id="admin-subs"></div>
        <div class="admin-content" id="admin-earnings"></div>
        <div class="admin-content" id="admin-notifs"></div>
      `;

      // Load users tab
      loadAdminUsers();
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red);padding:32px">${e.message}</p>`;
    }
  };

  const adminTab = (el, tabId) => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
    const tab = document.getElementById(tabId);
    if (tab) { tab.classList.add('active'); }

    if (tabId === 'admin-users' && !tab.dataset.loaded) loadAdminUsers();
    else if (tabId === 'admin-songs' && !tab.dataset.loaded) loadAdminSongs();
    else if (tabId === 'admin-subs' && !tab.dataset.loaded) loadAdminSubs();
    else if (tabId === 'admin-earnings' && !tab.dataset.loaded) loadAdminEarnings();
    else if (tabId === 'admin-notifs') loadAdminNotifs();
  };

  const loadAdminUsers = async () => {
    const el = document.getElementById('admin-users');
    if (!el) return;
    try {
      const res = await API.getAdminUsers({ limit: 100 });
      el.dataset.loaded = '1';
      el.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:16px">
          <input type="text" placeholder="Search users..." id="adminUserSearch" style="flex:1;padding:8px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);outline:none"/>
          <select id="adminRoleFilter" style="padding:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary)">
            <option value="">All roles</option><option value="listener">Listeners</option><option value="artist">Artists</option>
          </select>
        </div>
        <div style="overflow-x:auto">
          <table class="data-table" id="usersTable">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Sub</th><th>Actions</th></tr></thead>
            <tbody>
              ${(res.users||[]).map(u=>`
                <tr id="user-row-${u.id}">
                  <td>${u.name}${u.stage_name&&u.stage_name!==u.name?`<br/><small style="color:var(--accent)">${u.stage_name}</small>`:''}</td>
                  <td>${u.email}</td>
                  <td><span class="badge ${u.role==='artist'?'badge-artist':'badge-pending'}">${u.role}</span></td>
                  <td><span class="badge ${u.is_active?'badge-active':'badge-expired'}">${u.is_active?'Active':'Banned'}</span></td>
                  <td>${fmtDate(u.created_at)}</td>
                  <td><span class="badge ${u.has_active_sub?'badge-active':'badge-pending'}">${u.has_active_sub?'Active':'None'}</span></td>
                  <td style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-outline" onclick="App.adminToggleUser(${u.id},'${u.name}')">${u.is_active?'Ban':'Unban'}</button>
                    <button class="btn btn-sm btn-danger" onclick="App.adminDeleteUser(${u.id},'${u.name}')">Delete</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { el.innerHTML = `<p style="color:var(--red);padding:20px">${e.message}</p>`; }
  };

  const loadAdminSongs = async () => {
    const el = document.getElementById('admin-songs');
    if (!el) return;
    try {
      const res = await API.getAdminSongs({ limit: 100 });
      el.dataset.loaded = '1';
      el.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Title</th><th>Artist</th><th>Genre</th><th>Streams</th><th>Published</th><th>Actions</th></tr></thead>
        <tbody>
          ${(res.songs||[]).map(s=>`<tr>
            <td>${s.title}</td><td>${s.artist_name}</td><td>${s.genre_name||'—'}</td>
            <td>${fmtNum(s.stream_count)}</td>
            <td><span class="badge ${s.is_published?'badge-active':'badge-pending'}">${s.is_published?'Yes':'No'}</span></td>
            <td style="display:flex;gap:6px">
              <button class="btn btn-sm btn-outline" onclick="App.adminToggleSong(${s.id})">${s.is_published?'Unpublish':'Publish'}</button>
              <button class="btn btn-sm btn-danger" onclick="App.adminDeleteSong(${s.id})">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    } catch (e) { el.innerHTML = `<p style="color:var(--red);padding:20px">${e.message}</p>`; }
  };

  const loadAdminSubs = async () => {
    const el = document.getElementById('admin-subs');
    if (!el) return;
    try {
      const res = await API.getAdminSubscriptions();
      el.dataset.loaded = '1';
      el.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>User</th><th>Plan</th><th>Amount</th><th>Method</th><th>Phone</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead>
        <tbody>
          ${(res.subscriptions||[]).map(s=>`<tr>
            <td>${s.user_name}<br/><small style="color:var(--text-muted)">${s.email}</small></td>
            <td>${s.plan.replace(/_/g,' ')}</td>
            <td>UGX ${Number(s.amount).toLocaleString()}</td>
            <td><span class="badge" style="background:${s.payment_method==='mtn'?'rgba(255,204,0,0.2)':'rgba(239,68,68,0.2)'};color:${s.payment_method==='mtn'?'#fde047':'#fca5a5'}">${s.payment_method?.toUpperCase()}</span></td>
            <td>${s.payment_phone}</td>
            <td><span class="badge badge-${s.status==='active'?'active':s.status==='pending'?'pending':'expired'}">${s.status}</span></td>
            <td>${s.end_date?fmtDate(s.end_date):'—'}</td>
            <td>${s.status==='pending'?`<button class="btn btn-sm btn-green" onclick="App.adminApproveSub(${s.id})">Approve</button>`:'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    } catch (e) { el.innerHTML = `<p style="color:var(--red);padding:20px">${e.message}</p>`; }
  };

  const loadAdminEarnings = async () => {
    const el = document.getElementById('admin-earnings');
    if (!el) return;
    try {
      const res = await API.getAdminEarnings();
      el.dataset.loaded = '1';
      el.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Artist</th><th>Song</th><th>Period</th><th>Streams</th><th>Amount (UGX)</th><th>Paid</th></tr></thead>
        <tbody>
          ${(res.earnings||[]).map(e=>`<tr>
            <td>${e.artist_name}</td><td>${e.song_title}</td><td>${e.period}</td>
            <td>${fmtNum(e.streams_count)}</td>
            <td>${Number(e.amount).toFixed(4)}</td>
            <td><span class="badge ${e.paid?'badge-active':'badge-pending'}">${e.paid?'Paid':'Pending'}</span></td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    } catch (e) { el.innerHTML = `<p style="color:var(--red);padding:20px">${e.message}</p>`; }
  };

  // ════════════════════════════════════════════════════════
  // SUBSCRIPTION PAGE
  // ════════════════════════════════════════════════════════
  const renderSubscription = (container) => {
    container.innerHTML = `
      <div class="section">
        <div class="section-header"><h2 class="section-title"><i class="fas fa-crown"></i> Subscription Plans</h2></div>
        <div style="max-width:700px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px">
            <div class="stat-card" style="border:2px solid var(--accent)">
              <div style="font-size:28px;margin-bottom:12px">🎵</div>
              <h3 style="font-size:18px;margin-bottom:8px">Listener Free</h3>
              <div style="font-size:28px;font-weight:800;color:var(--accent);margin-bottom:12px">UGX 0</div>
              <ul style="color:var(--text-secondary);font-size:13px;list-style:none;margin-bottom:20px;line-height:2">
                <li>✅ Stream all songs</li><li>✅ Search music</li><li>✅ Follow artists</li>
                <li>✅ Create playlists</li><li>❌ Downloads</li><li>❌ Offline mode</li>
              </ul>
              <button class="btn btn-outline w-full">Current Plan</button>
            </div>
            <div class="stat-card" style="border:2px solid var(--purple)">
              <div style="font-size:28px;margin-bottom:12px">👑</div>
              <h3 style="font-size:18px;margin-bottom:8px">Listener Premium</h3>
              <div style="font-size:28px;font-weight:800;color:var(--purple);margin-bottom:12px">UGX 5,000<span style="font-size:14px;color:var(--text-muted)">/month</span></div>
              <ul style="color:var(--text-secondary);font-size:13px;list-style:none;margin-bottom:20px;line-height:2">
                <li>✅ Everything in Free</li><li>✅ Download songs</li><li>✅ Offline listening</li>
                <li>✅ Premium songs access</li><li>✅ Ad-free experience</li><li>✅ High quality audio</li>
              </ul>
              <button class="btn btn-primary w-full" onclick="Auth.showSubscription('listener_premium')">Subscribe via MTN/Airtel</button>
            </div>
          </div>
          <div class="stat-card" style="border:2px solid var(--green)">
            <div style="font-size:28px;margin-bottom:12px">🎤</div>
            <h3 style="font-size:18px;margin-bottom:8px">Artist Annual Plan</h3>
            <div style="font-size:28px;font-weight:800;color:var(--green);margin-bottom:12px">UGX 15,000<span style="font-size:14px;color:var(--text-muted)">/year</span></div>
            <ul style="color:var(--text-secondary);font-size:13px;list-style:none;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;line-height:2">
              <li>✅ Upload unlimited songs</li><li>✅ Create albums</li>
              <li>✅ Earn from streams</li><li>✅ View analytics</li>
              <li>✅ Artist profile page</li><li>✅ Verified badge</li>
            </ul>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Payment: UGX 0.001 per stream (UGX 1 per 1,000 streams) paid monthly</div>
            <button class="btn btn-green w-full" onclick="Auth.showSubscription('artist_annual')">Subscribe as Artist via MTN/Airtel</button>
          </div>
        </div>
      </div>`;
  };

  const loadAdminNotifs = async () => {
    const el = document.getElementById('admin-notifs');
    if (!el) return;
    el.innerHTML = `
      <div style="max-width:640px">
        <h3 style="font-weight:700;font-size:16px;margin-bottom:16px"><i class="fas fa-bell" style="color:var(--accent)"></i> Send Notification</h3>
        <form id="adminNotifForm">
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="notifTitle" placeholder="Notification title" maxlength="200" required style="background:var(--bg-primary);border:1.5px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-primary);width:100%;outline:none"/>
          </div>
          <div class="form-group">
            <label>Message</label>
            <textarea id="notifMessage" rows="3" placeholder="Your message to users..." maxlength="1000" required style="background:var(--bg-primary);border:1.5px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-primary);width:100%;outline:none;resize:vertical"></textarea>
          </div>
          <div class="form-group">
            <label>Color / Urgency</label>
            <div class="color-selector">
              <div class="color-opt green selected" data-color="green" title="Green — Normal info" onclick="Pages.selectNotifColor(this)"></div>
              <div class="color-opt yellow" data-color="yellow" title="Yellow — Warning" onclick="Pages.selectNotifColor(this)"></div>
              <div class="color-opt red" data-color="red" title="Red — Urgent / Error" onclick="Pages.selectNotifColor(this)"></div>
            </div>
            <small style="color:var(--text-muted);margin-top:6px;display:block">
              🟢 Green = general info &nbsp;|&nbsp; 🟡 Yellow = warning &nbsp;|&nbsp; 🔴 Red = urgent
            </small>
          </div>
          <div class="form-group">
            <label>Send To</label>
            <select id="notifTarget" style="background:var(--bg-primary);border:1.5px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text-primary);width:100%;outline:none">
              <option value="all">Everyone (all users)</option>
              <option value="listeners">Listeners only</option>
              <option value="artists">Artists only</option>
            </select>
          </div>
          <div id="notifFormMsg" class="hidden" style="margin-bottom:12px"></div>
          <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Send Notification</button>
        </form>

        <div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h3 style="font-weight:700;font-size:16px"><i class="fas fa-list" style="color:var(--accent)"></i> Sent Notifications</h3>
            <button class="btn btn-outline btn-sm" onclick="Pages.loadAdminNotifs()"><i class="fas fa-sync"></i> Refresh</button>
          </div>
          <div id="adminNotifList">${loading()}</div>
        </div>
      </div>`;

    // Color selector state
    let selectedColor = 'green';
    document.getElementById('adminNotifForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title   = document.getElementById('notifTitle').value.trim();
      const message = document.getElementById('notifMessage').value.trim();
      const target  = document.getElementById('notifTarget').value;
      const msgEl   = document.getElementById('notifFormMsg');
      try {
        await API.post('/notifications', { title, message, color: selectedColor, target });
        msgEl.className = 'alert alert-success';
        msgEl.textContent = '✓ Notification sent successfully!';
        msgEl.classList.remove('hidden');
        e.target.reset();
        document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
        document.querySelector('.color-opt.green').classList.add('selected');
        selectedColor = 'green';
        setTimeout(() => loadAdminNotifList(), 500);
      } catch (err) {
        msgEl.className = 'alert alert-error';
        msgEl.textContent = err.message;
        msgEl.classList.remove('hidden');
      }
    });

    // Store color selection in closure
    Pages._setNotifColor = (color) => { selectedColor = color; };

    loadAdminNotifList();
  };

  const selectNotifColor = (el) => {
    document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    if (Pages._setNotifColor) Pages._setNotifColor(el.dataset.color);
  };

  const loadAdminNotifList = async () => {
    const list = document.getElementById('adminNotifList');
    if (!list) return;
    try {
      const res = await API.get('/notifications/admin/all');
      const notifs = res.notifications || [];
      if (!notifs.length) {
        list.innerHTML = `<p style="color:var(--text-muted);padding:16px 0">No notifications sent yet.</p>`;
        return;
      }
      const icons = { green: 'check-circle', yellow: 'exclamation-triangle', red: 'exclamation-circle' };
      const targetLabels = { all: 'Everyone', listeners: 'Listeners', artists: 'Artists' };
      list.innerHTML = notifs.map(n => `
        <div class="notif-admin-card" id="notif-card-${n.id}">
          <div class="color-dot ${n.color}"></div>
          <div class="notif-admin-card-body">
            <div class="notif-admin-card-title">
              <i class="fas fa-${icons[n.color]}" style="color:${n.color==='green'?'#10b981':n.color==='yellow'?'#eab308':'#ef4444'};margin-right:6px"></i>
              ${n.title}
            </div>
            <div class="notif-admin-card-meta">
              To: <strong>${targetLabels[n.target]}</strong> &nbsp;·&nbsp;
              ${new Date(n.created_at).toLocaleString()} &nbsp;·&nbsp;
              ${n.dismiss_count} dismissed
            </div>
            <div class="notif-admin-card-msg">${n.message}</div>
          </div>
          <button class="btn btn-sm btn-danger" onclick="Pages.deleteAdminNotif(${n.id})" title="Delete notification">
            <i class="fas fa-trash"></i>
          </button>
        </div>`).join('');
    } catch (err) {
      list.innerHTML = `<p style="color:var(--red)">${err.message}</p>`;
    }
  };

  const deleteAdminNotif = async (id) => {
    if (!confirm('Delete this notification? Users who haven\'t dismissed it will no longer see it.')) return;
    try {
      await API.delete(`/notifications/${id}`);
      const card = document.getElementById(`notif-card-${id}`);
      if (card) { card.style.opacity = '0'; card.style.transition = 'opacity 0.2s'; setTimeout(() => card.remove(), 200); }
      App.showNotification('Notification deleted');
    } catch (err) {
      App.showNotification(err.message, 'error');
    }
  };

  return {
    renderHome, renderDiscover, renderGenres, renderGenreDetail, renderCharts,
    renderLibrary, renderLiked, renderHistory, renderPlaylists, renderPlaylist,
    renderAlbum, renderArtist, renderProfile, renderSettings, renderSubscription,
    renderArtistDashboard, renderUpload, renderMySongs, renderAdmin,
    filterDiscover, switchTab, adminTab, selectNotifColor, deleteAdminNotif,
    loadAdminUsers, loadAdminSongs, loadAdminSubs, loadAdminEarnings,
    loadAdminNotifs, loadAdminNotifList,
    songCard, songRow, artistCard, albumCard, playlistCard,
  };
})();
