# Deploying LeafCheckup to production

Target setup: one small VPS in India behind Cloudflare, Docker Compose, images built by GitHub Actions. Expected cost: about ₹1,000/month for the server plus the domain (≈₹850/year). There is no billing to set up; the product is free. Leaf diagnosis runs on users' phones, so traffic growth barely touches the server; Cloudflare serves the 16 MB model and the runtime from its cache.

Total time the first time: about 90 minutes, most of it waiting for DNS and provider sign-ups.

```
 phone/browser ──► Cloudflare (DNS, TLS, WAF, CDN, DDoS) ──► VPS :443 (only Cloudflare IPs allowed)
                                                              └─ Caddy ─► web (Next.js) ─► inference (FastAPI/ONNX)
                                                                                        └─► Postgres (internal network)
```

---

## 1. Domain

1. Buy **leafcheckup.com** at **Cloudflare Registrar** (at-cost, about US$10/year, DNS included): dash.cloudflare.com → Domain Registration → Register.
   On 16 Nov 2026 the .com registry (Verisign) reported leafcheckup.com as unregistered. Check other extensions you want (.in, .app) at the registrar before buying.
   If you use a different domain, set `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL`.
2. If you buy elsewhere (GoDaddy, Hostinger), add the domain to Cloudflare (free plan) and change the nameservers at your registrar to the two Cloudflare gives you.

## 2. Code on GitHub

```bash
cd leafcheckup
git remote add origin git@github.com:<you>/leafcheckup.git   # create a PRIVATE repo first
git push -u origin main
```
GitHub Actions starts running CI (type-check, lint, unit tests, build, Playwright, Python tests) and security scans (CodeQL, gitleaks, npm audit, pip-audit).

## 3. Server

1. Create a VPS: **DigitalOcean Bangalore** or **AWS Lightsail Mumbai**, Ubuntu 24.04, 2 vCPU / 2–4 GB RAM.
2. On your laptop: `ssh-keygen -t ed25519 -C deploy` (if you don't have a key).
3. SSH in as root once and harden it:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/<you>/leafcheckup/main/infra/server/bootstrap.sh -o bootstrap.sh
   bash bootstrap.sh "$(cat ~/.ssh/id_ed25519.pub)"     # run the cat on your laptop and paste the key
   ```
   After this, root login and passwords are disabled. Log in as `ssh deploy@<ip>`. Ports 80/443 accept Cloudflare only.

## 4. Cloudflare

DNS
- `A  @    <server ip>   Proxied (orange cloud)`
- `CNAME www  @          Proxied`

SSL/TLS
- Mode: **Full (strict)**. Edge certificates: Always Use HTTPS on, Min TLS 1.2, TLS 1.3 on, HSTS on (max-age 12 months, include subdomains, preload) once everything works.
- Origin Server → Create Certificate (15 years). Save as `/opt/leafcheckup/certs/origin.pem` and `/opt/leafcheckup/certs/origin.key` on the server (`chmod 600` the key).

Security (free plan)
- Security → WAF → Managed rules: enable the Cloudflare Free Managed Ruleset.
- Security → Bots: Bot Fight Mode on.
- Security → WAF → Rate limiting rule: `URI Path starts with /api/` → 100 requests / 10 s per IP → Block for 1 minute.
- Security → WAF → Custom rule: block `http.request.uri.path contains "/.env" or contains "/wp-"`.

Caching
- Rules → Cache Rules: `URI Path starts with /models/ or /ort/ or /_next/static/` → Eligible for cache, Edge TTL 1 year, respect origin headers.

## 5. Accounts and keys

| Service | Why | What to do |
|---|---|---|
| **Resend** (resend.com) | Sign-in links, contact notifications | Add your domain, add the DNS records it shows (in Cloudflare, DNS only), create an API key → `RESEND_API_KEY`, `EMAIL_FROM="LeafCheckup <hello@yourdomain>"` |
| **Google Cloud** (optional) | "Continue with Google" | APIs & Services → Credentials → OAuth client (Web). Authorised redirect URI: `https://<domain>/api/auth/callback/google` |
| **GitHub** | Pulling images on the server | Settings → Developer settings → Fine-grained token with `read:packages` |

### Email address

The site shows leafcheckup@gmail.com. If you prefer an address at your domain, enable Cloudflare → Email → Email Routing, forward `hello@leafcheckup.com` to that Gmail (free), and set `NEXT_PUBLIC_CONTACT_EMAIL` to it.

## 6. First deploy

On the server as `deploy`:
```bash
cd /opt/leafcheckup
# copy infra/prod/* here (the deploy workflow does this automatically later)
cp .env.example .env && nano .env      # fill everything; generate secrets with: openssl rand -hex 32
echo <github-token> | docker login ghcr.io -u <you> --password-stdin
docker compose pull && docker compose up -d
docker compose ps && curl -s https://<domain>/api/v1/health
```
`.env` needs every variable from `apps/web/.env.example` plus `DOMAIN`, `ACME_EMAIL`, `GH_OWNER`, `POSTGRES_PASSWORD`, `INFERENCE_TOKEN`. Database migrations run automatically on start (`AUTO_MIGRATE=1`).

## 7. Continuous deployment

In GitHub → Settings:
- Secrets → Actions: `DEPLOY_HOST` (server IP), `DEPLOY_SSH_KEY` (a separate private key whose public half you add to `/home/deploy/.ssh/authorized_keys`), `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan <ip>`).
- Variables: `SITE_URL=https://<domain>`.
- Environments → `production`: add yourself as a required reviewer if you want to approve each release.

Every push to `main` now: tests → builds signed images with SBOM → scans them with Trivy → deploys → smoke-tests `/api/v1/health`.

## 8. After launch

- Google Search Console and Bing Webmaster: verify the domain, submit `https://<domain>/sitemap.xml`.
- Uptime monitoring: BetterStack or UptimeRobot on `/api/v1/health` (free).
- Backups: `/opt/leafcheckup/backup.sh` runs nightly at 02:15. For off-site copies, `rclone config` a remote named `offsite` (Cloudflare R2 has a free tier).
- Restore drill: `docker compose exec -T db pg_restore -U leafcheckup -d leafcheckup --clean < backups/<file>.dump`.

## Cheapest option: free tiers

LeafCheckup can run at no cost on Vercel, Neon, Render and Resend free plans. Step-by-step instructions are in [`FREE_HOSTING.md`](FREE_HOSTING.md).
