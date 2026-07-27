# videos.freeapi

A YouTube-style video listing UI built for the **FreeAPI Videos Listing** project (Web Dev Cohort 2026).

Fetches real video data from the 
[FreeAPI YouTube Videos endpoint]- (https://api.freeapi.app/api/v1/public/youtube/videos) 
and renders it in a responsive card grid, with client-side search and sorting. No framework, no build step — just HTML, CSS, and vanilla JS.

## Design

The visual language borrows from a developer's terminal, since the video catalogue itself is a programming-tutorial channel: a blinking-cursor header, a live command line that mirrors the current sort/filter ('ls --sort=views | grep -i "nextjs"'), and sort controls styled as CLI flags ('--latest', '--popular', `--liked'). Dark surface, amber accent, monospace for structure (JetBrains Mono) paired with Inter for readable body text.

## Features

- Fetches **all** pages from the API on load (it paginates upstream) and caches them client-side
- Search/filter by title or channel name
- Sort by latest, most viewed, or most liked
- Client-side pagination (12 videos per page)
- Compact view/like counts (`17208` → `17.2K`) and relative publish dates (`3 years ago`)
- Loading skeletons, empty state, and error state
- Fully responsive, keyboard-accessible cards (`Enter`/`Space` opens the video)

## Project structure

```
.
├── index.html
├── style.css
├── script.js
└── README.md
```

## Running locally

No build tools required. Any static file server works, for example:

```bash
npx serve .
# or
python3 -m http.server 5500
```

Then open the printed local URL in your browser.

## Deploying (GitHub Pages) and Vercel

1. Push this repo to GitHub.

Github Url : 

Vercel :

## API

`GET https://api.freeapi.app/api/v1/public/youtube/videos?page={n}&limit={n}`

Returns a paginated envelope: `{ data: { data: [...], totalPages, ... } }`, where each item's video fields live under `items` (`id`, `snippet`, `contentDetails`, `statistics`).
