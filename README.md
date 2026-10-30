# All Transport Service | JNAFAU DTDP

A mobile-first web application prototype that brings bus, Metro and MMTS information together for JNAFAU DTDP students.

> **Project status:** Front-end prototype. Transport routes, timings and other sample data must be independently verified before travel.

## Highlights

- Responsive, mobile-first interface
- Bus, Metro and MMTS sections
- Installable Progressive Web App (PWA) foundation
- Basic offline caching through a service worker
- No build step, package manager or backend required for the current static version
- GitHub Pages deployment support

## Quick start

### Option A — Open directly
Open `index.html` in a modern browser. Some PWA features require HTTPS or localhost.

### Option B — Run on localhost
With Python installed, run this command from the project folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy to GitHub Pages

See [Deployment Guide](docs/DEPLOYMENT.md). The repository includes a GitHub Actions workflow that can publish the site to GitHub Pages.

## Project structure

```text
all-transport-service/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml
├── docs/
│   ├── DEPLOYMENT.md
│   └── PROJECT-OVERVIEW.md
├── icons/
│   └── icon.svg
├── .gitignore
├── .nojekyll
├── CHANGELOG.md
├── CONTRIBUTING.md
├── index.html
├── manifest.webmanifest
├── README.md
├── SECURITY.md
└── service-worker.js
```

## Important limitations

- This version is a static front-end. It does not connect to live TSRTC, Hyderabad Metro or MMTS APIs.
- Displayed routes and timings are prototype/sample content. Confirm current information with official transport providers.
- Any login or student-facing screens in the prototype are not secure authentication and must not be used to collect real passwords or sensitive student data.
- Google Fonts may require an internet connection; system font fallbacks are provided.
- GitHub Pages hosts static files only. A real authentication system, database, admin panel or live transport feed would require a separately secured backend.

## Maintenance

When changing cached files, increment `CACHE_NAME` in `service-worker.js` so returning visitors can receive the new cache version.

See [Contributing](CONTRIBUTING.md) before submitting changes.
