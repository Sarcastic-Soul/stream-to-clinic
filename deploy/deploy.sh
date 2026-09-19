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
docker compose -f deploy/compose.yml --env-file "$ENV_FILE" up -d --build --remove-orphans

# Route this project's domain through the shared Caddy instance.
install -D -m 644 deploy/caddy/stream-to-clinic.caddy /srv/caddy/sites/stream-to-clinic.caddy
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

docker image prune -f >/dev/null
docker compose -f deploy/compose.yml --env-file "$ENV_FILE" ps
