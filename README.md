# 🥁 Kumam Music — Streaming Platform

A full-stack music streaming platform inspired by Kumam culture, built with Node.js, Express, MySQL, and vanilla JavaScript.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MySQL 8.0+
- npm

---

### 1. Clone & Install

```bash
cd kumam-music
npm install
```

---

### 2. Set Up Database

Start MySQL and run the schema:

```bash
mysql -u root -p < config/schema.sql
```

Or manually:

```sql
CREATE DATABASE kumam_music;
USE kumam_music;
-- then paste contents of config/schema.sql
```

---

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=kumam_music

JWT_SECRET=change-this-to-something-long-and-random
SESSION_SECRET=another-random-secret

ADMIN_EMAIL=admin@kumammusic.ug
ADMIN_PASSWORD=Admin@Kumam2024
```

---

### 4. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

Visit: **http://localhost:3000**

---

## 👤 Default Accounts

| Role  | Email                   | Password        |
|-------|-------------------------|-----------------|
| Admin | admin@kumammusic.ug     | Admin@Kumam2024 |

> The admin account is automatically detected — just sign in with the admin credentials on the regular sign-in form.

---

## 🎵 Features

### For Everyone (No Account Needed)
- Browse & stream all published songs
- Search songs, artists, albums
- View artist profiles
- Browse by genre (Gospel, Afrobeats, Hip-Hop, Dancehall, RnB)
- View Top 100 charts, playlists

### Listeners (Free)
- Like songs
- Follow artists
- Create playlists
- View listening history
- Personalized recommendations

### Listeners (Premium — UGX 5,000/month)
- Download songs
- Access premium-only songs
- All free features

### Artists (UGX 15,000/year subscription)
- Upload songs (MP3, WAV, OGG — up to 50MB)
- Upload album artwork
- Create albums & playlists
- View song statistics (streams, downloads, likes)
- Monthly earnings based on streams (UGX 0.001/stream)
- Artist profile page with followers

### Admin
- Full user management (ban, delete, search)
- Song moderation (publish/unpublish, delete)
- Subscription approval (manual for MTN/Airtel)
- Earnings reports
- System playlist refresh (Trending, Top 100)
- Genre management

---

## 💳 Subscription & Payments

### Plans

| Plan              | Amount            | Duration | Who        |
|-------------------|-------------------|----------|------------|
| Listener Free     | UGX 0             | Forever  | Listeners  |
| Listener Premium  | UGX 5,000/month   | 1 month  | Listeners  |
| Artist Annual     | UGX 15,000/year   | 1 year   | Artists    |

### Payment Flow (MTN & Airtel Mobile Money)

1. User selects plan & payment method
2. Enters mobile number
3. System sends payment prompt to their phone
4. User approves on phone
5. System verifies & activates subscription automatically

> **Demo mode:** Payments auto-approve after 12 seconds for testing. In production, connect to the MTN MoMo API or Airtel Money API using the keys in `.env`.

### MTN Number Formats
- 076xxxxxxx, 078xxxxxxx, 077xxxxxxx

### Airtel Number Formats  
- 070xxxxxxx, 071xxxxxxx, 072xxxxxxx

---

## 🎧 Music Player Features

- ▶️ Play / Pause
- ⏭️ Next / ⏮️ Previous
- 🔀 Shuffle mode
- 🔁 Repeat (Off / All / One)
- 🔊 Volume control + Mute
- ❤️ Like button
- 📥 Download button (if song allows)
- Progress bar (click to seek)
- Song title & artist display
- Album artwork (default if none uploaded)
- Queue panel (view & jump to songs)

---

## 🗂️ Project Structure

```
kumam-music/
├── server.js              # Entry point
├── config/
│   ├── database.js        # MySQL pool
│   └── schema.sql         # Full DB schema
├── middleware/
│   └── auth.js            # JWT middleware
├── routes/
│   ├── auth.js            # Login, register
│   ├── songs.js           # Upload, stream, like, download
│   ├── albums.js          # Album CRUD
│   ├── playlists.js       # Playlist management
│   ├── artists.js         # Artist profiles, follow, stats
│   ├── users.js           # Profile, liked, history, recommendations
│   ├── admin.js           # Admin panel APIs
│   ├── subscriptions.js   # MTN/Airtel payment flow
│   └── search.js          # Full-text search
├── public/
│   ├── index.html         # Single-page app shell
│   ├── css/style.css      # Full UI styles
│   ├── js/
│   │   ├── api.js         # API client
│   │   ├── player.js      # Music player logic
│   │   ├── auth.js        # Auth modals & flows
│   │   ├── pages.js       # Page renderers
│   │   └── app.js         # App controller & routing
│   └── images/            # SVG assets
└── uploads/
    ├── songs/             # Audio files
    ├── artwork/           # Cover art
    └── profiles/          # Avatar images
```

---

## 🌐 API Reference

### Auth
| Method | Endpoint                    | Auth | Description           |
|--------|-----------------------------|------|-----------------------|
| POST   | /api/auth/login             | No   | Login (auto-detects admin) |
| POST   | /api/auth/register          | No   | Register listener     |
| POST   | /api/auth/register-artist   | No   | Register artist       |
| GET    | /api/auth/me                | Yes  | Get current user      |
| POST   | /api/auth/change-password   | Yes  | Change password       |

### Songs
| Method | Endpoint                    | Auth     | Description           |
|--------|-----------------------------|----------|-----------------------|
| GET    | /api/songs                  | Optional | List songs            |
| GET    | /api/songs/:uuid            | Optional | Get song              |
| POST   | /api/songs/upload           | Artist   | Upload song           |
| POST   | /api/songs/:uuid/stream     | Optional | Record stream         |
| POST   | /api/songs/:uuid/like       | User     | Like/unlike song      |
| GET    | /api/songs/:uuid/download   | User     | Download song         |
| GET    | /api/songs/artist/my-songs  | Artist   | Artist's own songs    |
| DELETE | /api/songs/:uuid            | Artist   | Delete song           |

### Subscriptions
| Method | Endpoint                       | Auth | Description           |
|--------|--------------------------------|------|-----------------------|
| GET    | /api/subscriptions/plans       | No   | Get plans             |
| GET    | /api/subscriptions/my-subscription | Yes | My subscription   |
| POST   | /api/subscriptions/initiate    | Yes  | Start payment         |
| POST   | /api/subscriptions/verify      | Yes  | Check payment status  |
| POST   | /api/subscriptions/webhook     | No   | MTN/Airtel callback   |

---

## 🔧 Production Deployment

### 1. Install PM2
```bash
npm install -g pm2
pm2 start server.js --name kumam-music
pm2 save
pm2 startup
```

### 2. Nginx Config (optional)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        client_max_body_size 60M;
    }
}
```

### 3. MTN MoMo API Integration (Production)
Replace the demo payment flow in `routes/subscriptions.js` with actual MTN API calls:
- Documentation: https://momodeveloper.mtn.com/
- Use the `MTN_SUBSCRIPTION_KEY`, `MTN_API_USER`, `MTN_API_KEY` from `.env`

### 4. Airtel Money API Integration (Production)
- Documentation: https://developers.airtel.africa/
- Use the `AIRTEL_CLIENT_ID` and `AIRTEL_CLIENT_SECRET` from `.env`

---

## 🎨 Design

- **Colors:** Deep night blues + Kumam earth tones (amber/orange)
- **Font:** Poppins
- **Logo:** Kumam drum icon
- **Tribal patterns:** Decorative border with Kumam-inspired geometric repeat
- **Dark theme** with warm amber accents

---

## 📝 License

Built for Kumam cultural community. All rights reserved.
