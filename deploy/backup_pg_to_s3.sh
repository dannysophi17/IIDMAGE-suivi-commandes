#!/usr/bin/env sh
set -eu

# Usage: run on the server (cron) where AWS credentials are configured.
# Requires: gzip, awscli
#
# Two modes:
# - compose (default when docker compose is available): dumps from the Postgres container.
# - local: uses pg_dump from host (requires pg_dump installed + connectivity).

: "${S3_BUCKET:?Missing S3_BUCKET (ex: s3://iidmage-db-backups-prod)}"

MODE="${MODE:-auto}"

has_docker_compose() {
	command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1
}

TS="$(date -u +%Y%m%dT%H%M%SZ)"

run_compose_dump() {
	: "${COMPOSE_FILE:=./docker-compose.prod.yml}"
	: "${ENV_FILE:=./.env.prod}"
	: "${DB_SERVICE:=db}"
	: "${DB_NAME_ENV:=POSTGRES_DB}"

	DB_NAME="$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$DB_SERVICE" sh -lc "printf '%s' \"\${$DB_NAME_ENV}\"")"
	if [ -z "$DB_NAME" ]; then
		echo "Could not read database name from container env ($DB_NAME_ENV)." >&2
		exit 1
	fi

	OUT="/tmp/${DB_NAME}_${TS}.sql.gz"
	docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T "$DB_SERVICE" sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -9 > "$OUT"

	aws s3 cp "$OUT" "$S3_BUCKET/" --only-show-errors
	rm -f "$OUT"
}

run_local_dump() {
	# Requires: pg_dump installed on host.
	: "${PGHOST:=localhost}"
	: "${PGPORT:=5432}"
	: "${PGDATABASE:?Missing PGDATABASE}"
	: "${PGUSER:?Missing PGUSER}"

	OUT="/tmp/${PGDATABASE}_${TS}.sql.gz"
	pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" | gzip -9 > "$OUT"

	aws s3 cp "$OUT" "$S3_BUCKET/" --only-show-errors
	rm -f "$OUT"
}

case "$MODE" in
	compose)
		run_compose_dump
		;;
	local)
		run_local_dump
		;;
	auto)
		if has_docker_compose && [ -f "${COMPOSE_FILE:-./docker-compose.prod.yml}" ]; then
			run_compose_dump
		else
			run_local_dump
		fi
		;;
	*)
		echo "Unknown MODE: $MODE (use: auto|compose|local)" >&2
		exit 1
		;;
esac
