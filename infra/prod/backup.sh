#!/usr/bin/env bash
# Nightly Postgres backup with 14-day local retention. Optional off-site copy to
# Cloudflare R2 / S3 if rclone is configured with a remote named "offsite".
set -euo pipefail
cd "$(dirname "$0")"
ts=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T db pg_dump -U leafcheckup -Fc leafcheckup > "backups/leafcheckup-$ts.dump"
find backups -name 'leafcheckup-*.dump' -mtime +14 -delete
if command -v rclone >/dev/null && rclone listremotes | grep -q '^offsite:'; then
  rclone copy "backups/leafcheckup-$ts.dump" offsite:leafcheckup-backups/ --quiet
fi
echo "backup ok: leafcheckup-$ts.dump"
