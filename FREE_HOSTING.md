# Hosting LeafCheckup for free

This puts the whole site online at no cost. You need a laptop, a GitHub account and about an hour. Nothing here asks for a credit card except the optional domain in step 7.

| Part | Free service | What it does |
|---|---|---|
| Website | **Vercel** (Hobby plan) | Serves every page, the AI model and the API routes |
| Database | **Neon** (Free plan) | Stores sign-ins, API keys and contact messages |
| Inference API | **Render** (Free web service) | Runs the model on a server for developers using the API. Optional |
| Email | **Resend** (Free plan) | Sends contact-form messages to your inbox |

Free-tier limits worth knowing (checked November 2026):

- **Vercel Hobby** is for personal, non-commercial projects, which LeafCheckup is. It includes 100 GB of transfer a month. A first-time visitor downloads about 31 MB (the model plus the AI runtime) and repeat visits come from the phone's cache, so the free plan covers roughly 3,000 new visitors a month.
- **Neon Free**: 1 GB of storage and 100 compute hours a month per project. The database sleeps when idle and wakes in under a second.
- **Render Free** sleeps after 15 minutes without traffic, and the first API request after that waits about a minute. The website itself never uses Render, because diagnosis runs in the visitor's browser.

---

## 1. Put the code on GitHub

1. Unzip `leafcheckup.zip`.
2. On github.com, create a new **private** repository called `leafcheckup`. Don't add a README.
3. In a terminal, inside the unzipped folder:
   ```bash
   git init -b main
   git add .
   git commit -m "LeafCheckup"
   git remote add origin https://github.com/<your-username>/leafcheckup.git
   git push -u origin main
   ```
   You can make the repository public later if you want recruiters to read the code.

## 2. Create the database (Neon)

1. Sign up at **neon.com** with GitHub.
2. Create a project named `leafcheckup` in region **AWS Asia Pacific (Singapore)**, the closest to India.
3. Click **Connect**, switch **Connection pooling** on, and copy the connection string (it starts with `postgresql://` and ends with `sslmode=require`). This is your `DATABASE_URL`. The pooled string matters on Vercel, where many short-lived functions connect at once.

The site creates its own tables on first start (`AUTO_MIGRATE=1`), so there is nothing else to run.

## 3. Set up email (Resend)

1. Sign up at **resend.com** with leafcheckup@gmail.com, the address that should receive messages.
2. API Keys → Create API key → set Permission to **Sending access** → copy it. This is your `RESEND_API_KEY`. Resend shows it only once.

Without your own domain, Resend can only deliver to the address you signed up with. That is exactly what the contact form needs. Email sign-in links for other people need a domain (step 7); until then visitors sign in with Google, which only the developer API needs anyway. The app switches email sign-in on by itself once `EMAIL_FROM` uses a verified domain instead of `@resend.dev`. Replying to a contact email goes straight to the person who wrote it.

## 4. Deploy the website (Vercel)

1. Sign up at **vercel.com** with GitHub and choose the **Hobby** plan.
2. Add New → Project → import the `leafcheckup` repository.
3. Set **Root Directory** to `apps/web`. Vercel detects Next.js; leave the build settings as they are.
4. Open **Environment Variables** and add the following. Generate each secret with `openssl rand -hex 32` in a terminal, or any random 64-character string.

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://leafcheckup.vercel.app` (or the address Vercel gives you) |
   | `BETTER_AUTH_URL` | same as above |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | `leafcheckup@gmail.com` |
   | `CONTACT_INBOX` | `leafcheckup@gmail.com` |
   | `DATABASE_URL` | the Neon connection string |
   | `AUTO_MIGRATE` | `1` |
   | `BETTER_AUTH_SECRET` | a random secret |
   | `API_KEY_PEPPER` | a random secret. Never change it after launch, or every API key stops working |
   | `RESEND_API_KEY` | from step 3 |
   | `EMAIL_FROM` | `LeafCheckup <onboarding@resend.dev>` |
   | `TRUST_PROXY` | `1` |

5. Click **Deploy**. The first build takes about three minutes. Your site is now live at the `.vercel.app` address.

If the project name `leafcheckup` is taken on Vercel, you get an address like `leafcheckup-pranay.vercel.app`; use that in the two URL variables and redeploy.

## 5. Google sign-in (optional, 10 minutes)

1. console.cloud.google.com → create a project → APIs & Services → OAuth consent screen → External, app name LeafCheckup, your Gmail as support email.
2. Credentials → Create credentials → OAuth client ID → Web application.
3. Authorised redirect URI: `https://<your-site>/api/auth/callback/google`.
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel → Settings → Environment Variables, then Deployments → Redeploy.

## 6. Inference API on Render (optional)

Only developers calling `/api/v1/diagnose` use this. Skip it and that endpoint replies "inference service is not configured"; everything else on the site works.

1. Sign up at **render.com** with GitHub → New → Web Service → pick the `leafcheckup` repository.
2. Language **Docker**, instance type **Free**, region **Singapore**. Leave Root Directory empty and set **Dockerfile Path** to `services/inference/Dockerfile.compose`, because the image copies the model from the web app.
3. Environment: `INFERENCE_TOKEN` = a random secret, `PUBLIC_SITE_URL` = your site address, `PORT` = `8000`.
4. Deploy, then copy the service address (`https://leafcheckup-inference.onrender.com`).
5. In Vercel add `INFERENCE_URL` (that address) and `INFERENCE_TOKEN` (the same secret), then redeploy.

## 7. Your own domain (optional, about ₹850 a year)

A `.vercel.app` address is fine for a resume. If you want `leafcheckup.com`:

1. Buy it at **Cloudflare Registrar** (dash.cloudflare.com → Domain Registration). Cloudflare sells at cost, about US$10 a year.
2. Vercel → your project → Settings → Domains → add `leafcheckup.com` and `www.leafcheckup.com`. Vercel shows the DNS records to create.
3. In Cloudflare → DNS, add those records with the proxy switched **off** (grey cloud), as Vercel recommends.
4. Change `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` to `https://leafcheckup.com`, update the Google redirect URI, and redeploy.
5. Optional email at your domain: Cloudflare → Email → Email Routing → forward `hello@leafcheckup.com` to leafcheckup@gmail.com and set `NEXT_PUBLIC_CONTACT_EMAIL` to it. Verify the domain in Resend too and set `EMAIL_FROM` to `LeafCheckup <hello@leafcheckup.com>`, so sign-in emails reach everyone.

## 8. Check it works

- Open the site on your phone, allow the camera, and diagnose a leaf.
- Send yourself a message from the contact form on the About page.
- Visit `/api/v1/health`.
- Put the address on your resume and LinkedIn.

Every `git push` to `main` redeploys automatically.

When you outgrow the free plans, `DEPLOY.md` describes the hardened setup on your own server behind Cloudflare.
