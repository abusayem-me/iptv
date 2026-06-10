# Deploy SAYEM TV publicly

The app is a **Next.js** project with **API routes** (`/api/channels`, `/api/hls-proxy`). You need a host that runs **Node** for production (not static hosting alone).

## Recommended: Vercel + Firebase

1. **Firebase Console**
   - **Authentication → Sign-in method:** enable **Google** and **Email/Password**.
   - **Authentication → Settings → Authorized domains:** add your production domain (e.g. `your-app.vercel.app` and custom domain).
   - **Firestore:** from the repo root, deploy rules (first deploy usually **enables the Firestore API** and **creates the `(default)` native database** if none exists yet):

     ```bash
     firebase deploy --only firestore:rules
     ```

     You can still create or inspect the database in **Firebase Console → Firestore**; the CLI path above is enough for this project’s rules and default DB.

2. **Environment variables on Vercel**  
   Project → Settings → Environment Variables → add every `NEXT_PUBLIC_FIREBASE_*` from your local `.env.local` (same values as the Firebase Web app config).

3. **Deploy**

   ```bash
   npm install
   npm run build
   ```

   Connect the GitHub repo to Vercel (or `vercel` CLI), set root to this project, deploy.

4. **HLS proxy / streams**  
   Playback still depends on upstream stream URLs and your proxy. For production, use **HTTPS**, monitor quotas, and avoid exposing the proxy without extra protections if the app is public (see README SSRF note).

## Alternative: Firebase App Hosting

Google’s **Firebase App Hosting** can run full-stack Next.js apps with tighter Firebase integration. See the [Firebase App Hosting docs](https://firebase.google.com/docs/app-hosting) and use the Firebase MCP or CLI to initialize in this repo if you prefer that path instead of Vercel.

## After deploy

- Open the live URL: **sign in** first — the channel list loads only after authentication. Then use **Sign in** → Google or email.
- Confirm **Firestore** shows `userSettings/{uid}` documents when you favorite channels or watch something (sync is debounced ~1.2s).
