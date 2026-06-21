const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// ── Song audio storage ───────────────────────────────────────────
const songStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:         'kumam-music/songs',
    resource_type:  'video',   // Cloudinary uses 'video' for audio files
    format:         'mp3',
    public_id:      `song_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    overwrite:      false,
  }),
});

// ── Artwork image storage ────────────────────────────────────────
const artworkStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:        'kumam-music/artwork',
    resource_type: 'image',
    format:        'webp',
    transformation: [{ width: 600, height: 600, crop: 'fill', quality: 'auto' }],
    public_id:     `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    overwrite:     false,
  }),
});

// ── Profile avatar storage ───────────────────────────────────────
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:        'kumam-music/profiles',
    resource_type: 'image',
    format:        'webp',
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }],
    public_id:     `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    overwrite:     false,
  }),
});

// ── Multer upload instances ──────────────────────────────────────
const uploadSong = multer({
  storage: songStorage,
  limits:  { fileSize: 60 * 1024 * 1024 }, // 60MB
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/x-wav'];
    if (file.fieldname === 'audio' && !allowed.includes(file.mimetype))
      return cb(new Error('Invalid audio format. Use MP3, WAV, M4A or OGG.'));
    cb(null, true);
  },
});

const uploadArtwork = multer({
  storage: artworkStorage,
  limits:  { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg','image/png','image/webp'].includes(file.mimetype))
      return cb(new Error('Invalid image format. Use JPEG, PNG or WebP.'));
    cb(null, true);
  },
});

const uploadProfile = multer({
  storage: profileStorage,
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg','image/png','image/webp'].includes(file.mimetype))
      return cb(new Error('Invalid image format.'));
    cb(null, true);
  },
});

// ── Song upload (audio + artwork together) ───────────────────────
const uploadSongFields = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      if (file.fieldname === 'audio') {
        return {
          folder:        'kumam-music/songs',
          resource_type: 'video',
          format:        'mp3',
          public_id:     `song_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        };
      }
      return {
        folder:         'kumam-music/artwork',
        resource_type:  'image',
        format:         'webp',
        transformation: [{ width: 600, height: 600, crop: 'fill', quality: 'auto' }],
        public_id:      `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
    },
  }),
  limits: { fileSize: 60 * 1024 * 1024 },
}).fields([{ name: 'audio', maxCount: 1 }, { name: 'artwork', maxCount: 1 }]);

// ── Helper: delete a Cloudinary asset by URL ─────────────────────
const deleteAsset = async (url, resourceType = 'image') => {
  if (!url || !url.includes('cloudinary.com')) return;
  try {
    // Extract public_id from URL
    const parts   = url.split('/');
    const upload  = parts.indexOf('upload');
    if (upload < 0) return;
    const withExt = parts.slice(upload + 2).join('/');      // skip version
    const publicId = withExt.replace(/\.[^/.]+$/, '');       // strip extension
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.warn('Cloudinary delete warning:', e.message);
  }
};

module.exports = {
  cloudinary,
  uploadSong,
  uploadArtwork,
  uploadProfile,
  uploadSongFields,
  deleteAsset,
};
