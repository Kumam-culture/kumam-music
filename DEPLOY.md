# 🚀 Deploying Etokwa Music to Railway + Cloudinary

## Overview
- **Hosting:** Railway.app (Node.js server + MySQL database)
- **File Storage:** Cloudinary (songs, artwork, profile photos)
- **Time needed:** ~15 minutes

---

## Step 1 — Set up Cloudinary

1. Log in to [cloudinary.com](https://cloudinary.com)
2. Go to **Settings → API Keys**
3. Note your:
   - `Cloud Name`
   - `API Key`
   - `API Secret`

### Create upload folders (auto-created on first upload, but good to verify)
The app creates these folders automatically:
- `kumam-music/songs` — audio files
- `kumam-music/artwork` — album/song cover art
- `kumam-music/profiles` — artist/user avatars

### Optional: Set Cloudinary unsigned upload preset (not required — we use signed uploads server-side)

---

## Step 2 — Set up Railway

### 2a. Create Railway account
- Go to [railway.app](https://railway.app) and sign up with GitHub

### 2b. Push code to GitHub
```bash
cd kumam-music
git init
git add .
git commit -m "Initial Etokwa Music deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kumam-music.git
git push -u origin main
```

### 2c. Create Railway project
1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Deploy from GitHub repo"**
3. Select your `kumam-music` repository
4. Railway auto-detects Node.js and starts building

### 2d. Add MySQL database
1. In your Railway project, click **"+ New"**
2. Select **"Database" → "MySQL"**
3. Railway provisions a MySQL instance automatically

---

## Step 3 — Configure Environment Variables

In Railway → Your Service → **Variables tab**, add ALL of these:

```
NODE_ENV=production

# Copy these from Railway → MySQL service → Variables tab
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}

# Generate random secrets (use: openssl rand -base64 48)
JWT_SECRET=your-very-long-random-secret-here
SESSION_SECRET=another-very-long-random-secret-here

# Admin login
ADMIN_EMAIL=admin@etokwamusic.ug
ADMIN_PASSWORD=Admin@Kumam2024

# Cloudinary (from Step 1)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Your Railway public URL (set after first deploy)
BASE_URL=https://your-app-name.up.railway.app
```

> 💡 **Tip:** Railway supports variable references like `${{MySQL.MYSQLHOST}}` 
> which auto-fill from the MySQL plugin. Use those instead of copy-pasting.

---

## Step 4 — Run Database Schema

After deployment, run the schema on your Railway MySQL database.

### Option A: Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Connect to your project
railway link

# Run the schema
railway run mysql -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < config/schema.sql
```

### Option B: MySQL Workbench / DBeaver
1. In Railway → MySQL service → **Connect tab**
2. Copy the connection string
3. Open MySQL Workbench, paste connection details
4. Open and run `config/schema.sql`

### Option C: Railway's built-in query tool
1. Railway → MySQL service → **Data tab**
2. Paste the contents of `config/schema.sql` and run

---

## Step 5 — Get your live URL

1. Railway → Your service → **Settings → Domains**
2. Click **"Generate Domain"** — you get `https://your-app.up.railway.app`
3. Update `BASE_URL` env var with this URL
4. Redeploy (Railway auto-redeploys on env var changes)

---

## Step 6 — Verify everything works

Open your URL and check:
- [ ] Home page loads with Etokwa Music branding
- [ ] Sign in with `admin@etokwamusic.ug` / `Admin@Kumam2024`
- [ ] Admin panel opens (Admin → Dashboard)
- [ ] Upload a test song (verify it goes to Cloudinary, not local disk)
- [ ] Song plays back from Cloudinary URL
- [ ] Share links work with your production URL

---

## Troubleshooting

### "Can't connect to database"
- Check `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` match Railway MySQL variables exactly
- Make sure you ran `config/schema.sql`

### "Audio won't play" / "404 on audio"
- Check Cloudinary credentials are correct
- Verify `CLOUDINARY_CLOUD_NAME` has no spaces
- Check Railway logs: `railway logs`

### "Cloudinary upload fails"
- Confirm `CLOUDINARY_API_SECRET` is correct (not the API key)
- Check Cloudinary dashboard for failed uploads under "Activity"

### App crashes on start
```bash
railway logs
```
Look for the error — usually a missing env var or DB connection issue.

---

## Local Development (after setting up Railway)

```bash
# Create local .env from example
cp .env.example .env
# Fill in your Cloudinary keys and local MySQL settings

npm install
npm run dev
# Visit http://localhost:3000
```

---

## Cost Estimate (for your beta)

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Railway Hobby | Starter | ~$5 USD |
| Railway MySQL | Shared | ~$1 USD |
| Cloudinary | Free tier | $0 (25 credits/month) |
| **Total** | | **~$6 USD/month** |

Cloudinary free tier gives you 25GB storage + 25GB bandwidth/month — plenty for beta testing.

---

## Support
- williamekidu@gmail.com
- WhatsApp: +256 794 257 174
