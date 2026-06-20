// api.js — Centralized API calls
const API = (() => {
  const BASE = '/api';

  const getToken = () => localStorage.getItem('kumam_token');

  const headers = (isForm = false) => {
    const h = {};
    const t = getToken();
    if (t) h['Authorization'] = `Bearer ${t}`;
    if (!isForm) h['Content-Type'] = 'application/json';
    return h;
  };

  const request = async (method, path, data = null, isForm = false) => {
    const opts = { method, headers: headers(isForm) };
    if (data) opts.body = isForm ? data : JSON.stringify(data);
    try {
      const res = await fetch(`${BASE}${path}`, opts);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.error || `HTTP ${res.status}`;
        console.error(`API ${method} ${path} failed:`, msg);
        throw new Error(msg);
      }
      return json;
    } catch (err) {
      if (err.name === 'TypeError') {
        console.error(`API ${method} ${path} network error:`, err.message);
        throw new Error('Network error — is the server running?');
      }
      throw err;
    }
  };

  return {
    get: (path) => request('GET', path),
    post: (path, data, form = false) => request('POST', path, data, form),
    put: (path, data, form = false) => request('PUT', path, data, form),
    delete: (path) => request('DELETE', path),

    // Notifications
    getNotifications:      ()     => request('GET',    '/notifications'),
    dismissNotification:   (id)   => request('POST',   `/notifications/${id}/dismiss`),
    getAdminNotifications: ()     => request('GET',    '/notifications/admin/all'),
    createNotification:    (data) => request('POST',   '/notifications', data),
    deleteNotification:    (id)   => request('DELETE', `/notifications/${id}`),

    // Auth
    login: (email, password) => request('POST', '/auth/login', { email, password }),
    register: (data) => request('POST', '/auth/register', data),
    registerArtist: (data) => request('POST', '/auth/register-artist', data),
    getMe: () => request('GET', '/auth/me'),

    // Songs
    getSongs: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', `/songs${q ? '?' + q : ''}`);
    },
    getSong: (id) => request('GET', `/songs/${id}`),
    streamSong: (id) => request('POST', `/songs/${id}/stream`),
    likeSong: (id) => request('POST', `/songs/${id}/like`),
    uploadSong: (formData) => request('POST', '/songs/upload', formData, true),
    getMySongs: () => request('GET', '/songs/artist/my-songs'),
    deleteSong: (id) => request('DELETE', `/songs/${id}`),

    // Albums
    getAlbums: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', `/albums${q ? '?' + q : ''}`);
    },
    getAlbum: (id) => request('GET', `/albums/${id}`),
    createAlbum: (formData) => request('POST', '/albums', formData, true),
    getMyAlbums: () => request('GET', '/albums/artist/mine'),

    // Playlists
    getPlaylists: () => request('GET', '/playlists'),
    getPlaylist: (id) => request('GET', `/playlists/${id}/songs`),
    createPlaylist: (data) => request('POST', '/playlists', data),
    addToPlaylist: (pid, song_uuid) => request('POST', `/playlists/${pid}/songs`, { song_uuid }),
    removeFromPlaylist: (pid, sid) => request('DELETE', `/playlists/${pid}/songs/${sid}`),
    getMyPlaylists: () => request('GET', '/playlists/user/mine'),

    // Artists
    getArtists: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', `/artists${q ? '?' + q : ''}`);
    },
    getArtist: (uuid) => request('GET', `/artists/${uuid}`),
    followArtist: (uuid) => request('POST', `/artists/${uuid}/follow`),
    getArtistStats: () => request('GET', '/artists/dashboard/stats'),
    updateArtistProfile: (formData) => request('PUT', '/artists/profile', formData, true),

    // Users
    getProfile: () => request('GET', '/users/profile'),
    updateProfile: (formData) => request('PUT', '/users/profile', formData, true),
    getLikedSongs: () => request('GET', '/users/liked-songs'),
    getFollowedArtists: () => request('GET', '/users/followed-artists'),
    getRecommendations: () => request('GET', '/users/recommendations'),
    getHistory: () => request('GET', '/users/history'),

    // Subscriptions (updated)
    getPlans:             ()     => request('GET',  '/subscriptions/plans'),
    getMySubscription:    ()     => request('GET',  '/subscriptions/my-subscription'),
    initiatePayment:      (data) => request('POST', '/subscriptions/initiate', data),
    verifyPayment:        (ref)  => request('POST', '/subscriptions/verify', { transaction_ref: ref }),
    initiateDonation:     (data) => request('POST', '/subscriptions/donate', data),
    verifyDonation:       (ref)  => request('POST', '/subscriptions/donate/verify', { transaction_ref: ref }),

    // Share
    createShareLink: (data) => request('POST', '/share', data),
    resolveShare:    (uuid) => request('GET',  `/share/${uuid}`),

    // Admin extras
    getAdminDonations: () => request('GET', '/admin/donations'),

    // Search
    search: (q, type = 'all') => request('GET', `/search?q=${encodeURIComponent(q)}&type=${type}`),

    // Admin
    getAdminDashboard: () => request('GET', '/admin/dashboard'),
    getAdminUsers: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', `/admin/users${q ? '?' + q : ''}`);
    },
    getAdminSongs: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('GET', `/admin/songs${q ? '?' + q : ''}`);
    },
    getAdminSubscriptions: () => request('GET', '/admin/subscriptions'),
    toggleUserActive: (id) => request('PUT', `/admin/users/${id}/toggle-active`),
    toggleSongPublished: (id) => request('PUT', `/admin/songs/${id}/toggle-published`),
    approveSubscription: (id) => request('PUT', `/admin/subscriptions/${id}/approve`),
    deleteAdminUser: (id) => request('DELETE', `/admin/users/${id}`),
    deleteAdminSong: (id) => request('DELETE', `/admin/songs/${id}`),
    refreshSystemPlaylists: () => request('POST', '/admin/system-playlists/refresh'),
    getAdminEarnings: () => request('GET', '/admin/earnings'),
  };
})();
