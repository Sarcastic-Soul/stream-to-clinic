#!/usr/bin/env bash
# Runs on the EC2 box (as root, via SSM) after the repo has been updated to origin/main.
set -euo pipefail

REPO_DIR=/srv/stream-to-clinic
ENV_FILE=/srv/env/stream-to-clinic.env

# First deploy: generate secrets once and keep them outside the repo.
if [ ! -f "$ENV_FILE" ]; then
  mkdir -p "$(dirname "$ENV_FILE")"
  umask 077
  cat > "$ENV_FILE" <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
CORS_ORIGINS=https://stream-to-clinic.vercel.app,http://localhost:3000
ENV
fi

cd "$REPO_DIR"
docker compose -f deploy/compose.yml --env-file "$ENV_FILE" build

# Web push keys, generated once with the API image's own web-push and kept with the other secrets.
if ! grep -q '^VAPID_PUBLIC_KEY=' "$ENV_FILE"; then
  keys=$(docker compose -f deploy/compose.yml --env-file "$ENV_FILE" run --rm --no-deps -T api \
    node -e 'const k=require("web-push").generateVAPIDKeys();console.log("VAPID_PUBLIC_KEY="+k.publicKey+"\nVAPID_PRIVATE_KEY="+k.privateKey)')
  printf '%s\n' "$keys" >> "$ENV_FILE"
fi

docker compose -f deploy/compose.yml --env-file "$ENV_FILE" up -d --remove-orphans

# Route this project's domain through the shared Caddy instance.
install -D -m 644 deploy/caddy/stream-to-clinic.caddy /srv/caddy/sites/stream-to-clinic.caddy
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

docker image prune -f >/dev/null
docker compose -f deploy/compose.yml --env-file "$ENV_FILE" ps
