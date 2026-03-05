#!/usr/bin/env sh
set -eu

# Backup Postgres running in docker-compose to S3.
# Requirements: docker + awscli configured on the host (or AWS_* env vars).
# Does NOT require pg_dump installed on the host.

: "${COMPOSE_FILE:=docker-compose.prod.yml}"
: "${ENV_FILE:=.env.prod}"
: "${S3_BUCKET:?Missing S3_BUCKET (ex: s3://iidmage-db-backups-prod)}"

# Optional: override DB credentials (defaults read from env file via docker compose)
TS="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="/tmp/iidmage_db_${TS}.sql.gz"

# Dump from DB container
# Uses POSTGRES_USER and POSTGRES_DB from compose env.
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "$TMP"

aws s3 cp "$TMP" "$S3_BUCKET/" --only-show-errors
rm -f "$TMP"
