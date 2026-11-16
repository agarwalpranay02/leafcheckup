# Cloudflare configuration

All settings are listed step by step in ../../DEPLOY.md §4. Summary of the protective layer:

- Proxy (orange cloud) on `@` and `www` → origin IP is hidden; the VPS firewall only accepts 80/443 from Cloudflare ranges.
- SSL **Full (strict)** with a Cloudflare Origin Certificate on Caddy; HSTS with preload.
- WAF Free Managed Ruleset, Bot Fight Mode.
- Rate limiting: `/api/*` 100 req / 10 s / IP (the app adds per-key and per-IP limits behind it).
- Custom block rule for common scanner paths (`/.env`, `/wp-*`, `/.git`).
- Cache rule: `/models/*`, `/ort/*`, `/_next/static/*` cached at the edge for a year (immutable, versioned paths).
