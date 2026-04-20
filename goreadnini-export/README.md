# 📚 GoreadNini

> *Her books, her pace, her realm.*

A beautiful personal reading sanctuary — dark romance castle aesthetic, built for one special reader.

---

## Features

**Core (Library + Reader)**
- Personal bookshelf with shelves: Reading, Finished, Wishlist, Paused
- Google Books search & import
- Manual book entry
- Upload & read ePub files (built-in reader with progress tracking)
- PDF file storage
- Reading progress tracking per book

**Reading Experience**
- Built-in ePub reader (epub.js) with font size controls
- Highlights — select text while reading to save passages
- Bookmarks — save your place
- In-reader note taking
- Star ratings + private reviews

**Progress & Stats**
- Reading activity heatmap (past 52 weeks)
- Stats dashboard: books, pages, hours, streak
- Genre breakdown chart
- Reading session logger
- Monthly & yearly reading goals with progress rings

**Delights**
- Quotes Journal — save beautiful passages
- Badges & Milestones — earn rewards for reading achievements
- Reading Wrapped — annual summary card (like Spotify Wrapped for books)

**Access Gate**
- Secret access code protects the library (default: `NINI2025`)
- Change in `src/components/AccessGate.jsx` line 4

---

## Setup & Deploy

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in your keys (see below).

### 3. Run locally
```bash
npm run dev
```

### 4. Deploy to Vercel
```bash
npx vercel
```
Or connect your GitHub repo at vercel.com. Add env vars in the Vercel dashboard.

### 5. Deploy to Netlify
```bash
npx netlify deploy --prod --dir=dist
```
Or drag the `dist/` folder to netlify.com/drop.

---

## Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full schema from `src/lib/supabase.js` (it's in the comments at the top of the file)
3. Copy your **Project URL** and **Anon Key** from Settings → API
4. Add them to `.env`

**Without Supabase:** The app works fully offline using `localStorage`. Files up to ~20MB can be stored. Perfect for getting started.

---

## Google Books API (Optional)

Without a key, search still works but hits Google's public rate limit.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Books API**
3. Create an API key
4. Add to `.env` as `VITE_GOOGLE_BOOKS_API_KEY`

---

## Changing the Access Code

Open `src/components/AccessGate.jsx` and change line 4:
```js
const ACCESS_CODE = 'NINI2025' // ← change this
```

---

## Tech Stack

- **React 18** + **Vite** — fast, modern frontend
- **Tailwind** — *not used, custom CSS with castle theme instead*
- **epub.js** — built-in ePub reader
- **Supabase** — database, auth, and file storage (optional)
- **Google Books API** — book search and metadata
- **Lucide React** — icons
- **Deployed on** Vercel or Netlify (free tier)

---

*Built with love. For Nini. 🏰*
