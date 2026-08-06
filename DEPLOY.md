# Deploying CogniTree AI

The app is a standard Node/Express server (serving the built Vite client) packaged by the
`Dockerfile` in this repo. It needs one secret at runtime: `GEMINI_API_KEY`. Never put the real
key in the repo or the Docker image — always inject it as a platform secret/env var.

## Test the container locally

```bash
docker build -t cognitree .
docker run --rm -p 8080:8080 -e GEMINI_API_KEY="your-real-key" cognitree
# open http://localhost:8080
```

## Deploy to Google Cloud Run (recommended)

Cloud Run is the natural fit here — it's what the `APP_URL` env var in `.env.example` refers to,
it's pay-per-use, and it builds directly from the `Dockerfile` in this repo.

1. **One-time setup:**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
   ```

2. **Store the Gemini API key in Secret Manager** (safer than a plain env var — it's encrypted at
   rest, access-controlled, and never shows up in `gcloud run services describe` output):
   ```bash
   printf "your-real-gemini-key" | gcloud secrets create gemini-api-key --data-file=-
   ```
   Get a key at https://aistudio.google.com/apikey if you don't have one yet.

3. **Deploy** (builds the `Dockerfile` via Cloud Build automatically):
   ```bash
   gcloud run deploy cognitree \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --set-secrets GEMINI_API_KEY=gemini-api-key:latest
   ```
   Drop `--allow-unauthenticated` if you'd rather keep it private / behind IAP or Cloud Run's
   built-in auth instead of the app-level rate limiting described below.

4. **(Optional) Set `APP_URL`** once you have the assigned `*.run.app` URL (or a custom domain
   mapped to the service), if you use it for self-referential links:
   ```bash
   gcloud run services update cognitree --set-env-vars APP_URL=https://your-service-url
   ```

## Cost / abuse note

There is no user login in this app, so any endpoint that calls Gemini is reachable by anyone who
has the URL. A basic per-IP rate limit is applied to `/api/generate-tree` and `/api/expand-node`
to bound worst-case usage, but rate limiting is not a substitute for real auth if you expect
meaningful public traffic — consider Cloud Run's `--no-allow-unauthenticated` + IAP, or adding a
simple shared-password gate, before sharing the URL widely.

## Other hosts

Any platform that can run a container and inject env vars works the same way (Render, Railway,
Fly.io, a VPS with `docker run`): build the image from this `Dockerfile`, set `GEMINI_API_KEY` as
a secret/env var on the platform, and point it at the container's exposed port (`$PORT`, which
`server.ts` already reads — defaults to 8080 in the container, 3000 for local `bun run dev`).
