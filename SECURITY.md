# Security policy

Report vulnerabilities privately to leafcheckup@gmail.com. Please do not open public issues for security problems. We acknowledge reports within 72 hours.

## Design summary
- **Photos never leave the device** in the web app: inference runs in the browser (ONNX Runtime Web).
- **Strict CSP** with per-request nonces and `strict-dynamic`; `frame-ancestors 'none'`, HSTS preload, COOP, CORP, no-sniff, locked-down Permissions-Policy.
- **Auth**: better-auth sessions (httpOnly, SameSite=Lax, Secure in production), magic links expire in 10 minutes and are rate limited; Google OAuth optional.
- **API keys**: 192-bit random, shown once, stored only as a peppered SHA-256 hash, compared in constant time; per-key RPM limits and monthly quotas; per-IP shield.
- **Uploads**: 8 MB cap enforced at the proxy, the gateway and the inference service; file type verified by magic bytes; Pillow decompression-bomb guard.
- **CSRF**: cookie-authenticated mutations require same-origin `Origin`.
- **Infrastructure**: containers run as non-root with read-only root filesystems, dropped capabilities and no-new-privileges; inference and database sit on an internal network; the origin accepts HTTP(S) only from Cloudflare; SSH key-only with fail2ban; automatic security updates; nightly encrypted-at-rest backups.
- **Supply chain**: CodeQL, gitleaks, npm audit, pip-audit, Trivy image scans, Dependabot, SBOM + provenance on images.
