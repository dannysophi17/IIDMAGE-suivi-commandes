# Production deployment (Lightsail)

This folder contains production-ready configuration to deploy the monorepo behind a single domain.

No need to buy a new domain: you only configure a subdomain under a domain you already own, e.g.:

- `https://portal.<your-domain>` (recommended)
- `https://suivi.<your-domain>`

Routing:

- `https://portal.<your-domain>` → Next.js (frontend)
- `https://portal.<your-domain>/api/*` → Express API (backend)
- `https://portal.<your-domain>/uploads/*` → uploads served by backend

Note: if you received something like `https://www.<your-domain>/#something`, the `#something` is just an anchor on the public website and does not affect DNS.

## Files

- `docker-compose.prod.yml`: containers for `caddy`, `frontend`, `backend`, `db`
- `Caddyfile`: reverse proxy + automatic Let's Encrypt
- `.env.prod.example`: example environment variables
- `backup_pg_to_s3.sh`: sample script to dump DB and upload to S3 (requires `pg_dump` on host)
- `backup_pg_to_s3_compose.sh`: backup script using the Postgres container (no `pg_dump` on host)

## On the server

DNS:

- Create an `A` record for your chosen subdomain (`portal` or `suivi`) pointing to the Lightsail static IP.
- Do it in Route 53 if that's where your DNS is managed; otherwise in Cloudflare/OVH/etc.

1) Copy `.env.prod.example` to `.env.prod` and fill in values.
2) Run from this folder:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Notes:
- Make sure ports 80/443 are open on the instance firewall.
- Do not expose Postgres publicly.

## Backups to S3

Preferred (no `pg_dump` install on host):

```bash
S3_BUCKET=s3://iidmage-db-backups-prod ./backup_pg_to_s3_compose.sh
```
