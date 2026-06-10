# Firebase + MCP for SAYEM TV

This repo includes:

1. **Cursor MCP** — `.cursor/mcp.json` wires the official **Firebase MCP** (via `firebase-tools`) so Cursor can use Firebase-oriented tools when you are logged into the Firebase CLI.
2. **App runtime** — the Next.js client uses the **Firebase JS SDK** (Auth + Firestore) with `NEXT_PUBLIC_*` env vars. MCP does **not** replace this: MCP helps *you and the agent* manage projects; the app talks to Firebase in the browser.

## Part A — Enable the Firebase MCP in Cursor

1. Install Node.js if needed, then log in once on your machine:

   ```bash
   npx -y firebase-tools@latest login
   ```

2. Confirm **`.cursor/mcp.json`** in this repo contains the `firebase` server (already added).

3. **Restart Cursor** so it picks up the new MCP.

4. In **Cursor → Settings → MCP** (or the MCP panel), confirm **firebase** is connected (green). If tools show as `0`:

   - Install Firebase CLI globally: `npm i -g firebase-tools`, then set `"command": "firebase", "args": ["mcp"]` in `.cursor/mcp.json`, optionally with `"--dir"` pointing at this project’s absolute path.
   - On macOS, some users need to **launch Cursor from Terminal** (`cursor .`) so `PATH` includes global `firebase`.

5. Use the MCP in chat for things like: Firestore rules review, project linkage, deployment guidance — whatever tools your Firebase MCP build exposes.

## Part B — Link this repo to a Firebase project

1. In the [Firebase Console](https://console.firebase.google.com/), create a project (or pick an existing one).

2. **Register a Web app** (or use an existing one). To generate **`.env.local`** from the CLI after `firebase login`:

   ```bash
   npm run env:firebase
   ```

   On **Windows PowerShell** from the repo root:

   ```powershell
   .\scripts\setup-firebase-env.ps1
   ```

   Both run `scripts/generate-env-local.mjs`, which reads `.firebaserc`’s default project (or `FIREBASE_PROJECT`) and the first WEB app’s SDK config. You can still copy values manually from **`.env.example`** / the Console if you prefer.

3. Enable **Authentication → Sign-in method:** turn on **Google** and **Email/Password** (for account creation in the app).

4. Enable **Firestore** in native mode.

5. This repo includes **`.firebaserc`** with default project `iptv-a1668` (adjust if you use another project). You can also start from **`.firebaserc.example`** and rename it.

6. Deploy security rules (from repo root, after CLI login):

   ```bash
   firebase deploy --only firestore:rules
   ```

   Rules live in `firestore.rules`: each user may only read/write `userSettings/{theirUid}`.

## Part C — What the web app syncs

When Firebase env vars are set and the user clicks **Sign in with Google**:

- **Firestore document** `userSettings/{uid}` stores `favorites`, `recent`, and `theme` (same shape as localStorage).
- On sign-in, cloud data is merged into **localStorage** and the UI refreshes.
- While signed in, changes are **debounced** (~1.2s) and written to Firestore.

Without `.env.local` config, the header shows **Cloud off** and everything stays local-only (unchanged behavior).

Public deployment checklist: **[docs/DEPLOY.md](./DEPLOY.md)** (Vercel + Firebase, authorized domains, rules).

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| `PERMISSION_DENIED` in the browser | Deploy `firestore.rules`; ensure the user is signed in; check `userSettings` path. |
| Popup blocked | Allow popups for your origin. |
| MCP shows 0 tools | Global `firebase` CLI + `--dir` to this repo; restart Cursor; see [Firebase MCP docs](https://firebase.google.com/docs/ai-assistance/mcp-server). |

## Files reference

| File | Role |
|------|------|
| `.cursor/mcp.json` | Cursor MCP: `npx firebase-tools mcp` |
| `firebase.json` | Firestore rules + indexes entry |
| `firestore.rules` | Security rules |
| `lib/firebase/client.ts` | Web SDK init from env |
| `lib/firebase/userSettingsFirestore.ts` | Read/write `userSettings` |
| `app/contexts/FirebaseAuthContext.tsx` | Auth + cloud hydrate |
| `lib/browserPrefs.ts` | Shared localStorage read/write |
