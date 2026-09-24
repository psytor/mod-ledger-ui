# mod-ledger-ui — production image
# Multi-stage: build static assets with Node, serve with nginx.

# --- Stage 1: build ---
# Pinned to the exact patch release so a rebuild can't silently land on a
# different Node/npm than the last one - `node:24-alpine` floated with no
# record of what actually shipped. Confirmed via `docker inspect` that this
# tag currently resolves to the exact same digest as the floating one
# (sha256:ebfe2f9...) - no behavior change today, just a pin against future
# drift. Node 24 is the correct LTS line (became LTS Oct 2025, supported
# into 2028); Node 25 was Current-only and is already EOL.
FROM node:24.21.0-alpine AS builder

WORKDIR /app

# This image bundles npm 11.19.0; npm 12.1.0 is current. Bump explicitly
# before `npm ci` so the pinned Node version doesn't also pin us to a stale
# npm - same reasoning as the backend's POETRY_VERSION bump.
RUN npm install -g npm@12.1.0

# Install deps first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Build the production bundle. Vite inlines VITE_* env vars into the bundle at
# build time, so they must be present as ENV when `npm run build` runs.
ARG VITE_MOD_LEDGER_URL
ARG VITE_ASTROGATORS_TABLE_URL
ARG VITE_NAVICHARTS_URL
ENV VITE_MOD_LEDGER_URL=${VITE_MOD_LEDGER_URL}
ENV VITE_ASTROGATORS_TABLE_URL=${VITE_ASTROGATORS_TABLE_URL}
ENV VITE_NAVICHARTS_URL=${VITE_NAVICHARTS_URL}

COPY . .
RUN npm run build


# --- Stage 2: serve ---
# Pinned for the same reason as the builder stage above. `nginx:1.31.6-alpine`
# and the floating `nginx:alpine` report identical `nginx -v` (1.31.6) and
# identical Alpine base (3.24.2) - confirmed by running both - even though
# their manifest digests differ (expected: separately-tagged manifest lists
# for the same content, not a version difference).
FROM nginx:1.31.6-alpine

# Drop the default nginx site
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Minimal SPA config. App is mounted at /mod-ledger/ (matches Vite `base`), so
# static assets live under that prefix and SPA fallback goes to
# /mod-ledger/index.html. Listens on 4174.
#
# Cache split: Vite content-hashes every file under assets/ (a rebuild always
# changes the filename), so those are safe to cache forever. Everything else
# this location serves - index.html itself, and the SPA-fallback response for
# every client-side route - is NOT hashed, so it must never be cached: without
# an explicit header here neither nginx layer set one, and browsers fell back
# to heuristic caching, silently serving a stale index.html (pointing at
# assets/ files from a previous deploy that no longer exist) until a hard
# refresh. `always` so the header still shows up on 404s.
#
# try_files' SPA fallback target is /mod-ledger/index.html, not bare
# /index.html: the third try_files argument (when unmatched) triggers an
# nginx-internal redirect that re-runs location matching from scratch, and
# a bare /index.html doesn't start with /mod-ledger/ so it falls out of this
# location entirely (served from the bare root/index defaults instead) -
# silently losing the add_header above for every deep client-side route
# (verified: curl -I on a real deep route came back with no Cache-Control at
# all until this was prefixed). Keeping the prefix keeps the redirect inside
# this same location, so the header always applies.
#
# assets/sprites/ is carved out BEFORE the general assets/ rule: those PNGs
# come from public/assets/sprites/ (Vite copies public/ verbatim, no content
# hash), unlike everything else under assets/, which is Vite's own hashed
# build output. Caching them "forever, immutable" like the hashed files
# would mean a corrected sprite atlas stays stale in every visitor's browser
# for a year. nginx picks the longest matching prefix, so this location
# (longer) wins over the general assets/ one for anything under sprites/.
RUN printf '%s\n' \
    'server {' \
    '  listen 4174;' \
    '  server_name _;' \
    '  root /usr/share/nginx/html;' \
    '  index index.html;' \
    '  location /mod-ledger/assets/sprites/ {' \
    '    alias /usr/share/nginx/html/assets/sprites/;' \
    '    add_header Cache-Control "no-cache" always;' \
    '    try_files $uri =404;' \
    '  }' \
    '  location /mod-ledger/assets/ {' \
    '    alias /usr/share/nginx/html/assets/;' \
    '    add_header Cache-Control "public, max-age=31536000, immutable" always;' \
    '    try_files $uri =404;' \
    '  }' \
    '  location /mod-ledger/ {' \
    '    alias /usr/share/nginx/html/;' \
    '    add_header Cache-Control "no-cache" always;' \
    '    try_files $uri $uri/ /mod-ledger/index.html;' \
    '  }' \
    '  location = / { return 301 /mod-ledger/; }' \
    '}' > /etc/nginx/conf.d/mod-ledger-ui.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 4174

CMD ["nginx", "-g", "daemon off;"]
