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

   Rules live in `firestore.rules`: each user may only read/write `userSettings/{theirUid}` and `userSettings/{theirUid}/devices/*`.

## Part C — What the web app syncs

When Firebase env vars are set and the user **signs in** (Google or email/password):

- The **channel list** is fetched only after authentication so playback stays tied to an account.
- **Firestore document** `userSettings/{uid}` stores `favorites`, `recent`, **`watchHistory`** (deduped channels you opened, up to 120), `theme`, last channel, and library filters. The client keeps this document in **real time sync** (`onSnapshot`) so changes from another device merge into this browser (when the write is not a pending local echo).
- **Device presence** lives under `userSettings/{uid}/devices/{deviceId}` (one doc per browser / profile). Each device reports **last seen** and **now playing**; the in-app **Profile** drawer lists them. Removing a row deletes that device doc (it may reappear when that browser opens the app again).
- On sign-in, cloud data is merged into **localStorage** and the UI refreshes.
- While signed in, preference changes are **debounced** (~1.2s) and written to Firestore.

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
| `lib/firebase/applyRemoteSettings.ts` | Merge cloud prefs → localStorage |
| `lib/firebase/devicePresence.ts` | `devices` subcollection + live subscription |
| `app/components/ProfileAccountPanel.tsx` | Profile drawer (account + devices) |
| `app/contexts/FirebaseAuthContext.tsx` | Auth + cloud hydrate |
| `lib/browserPrefs.ts` | Shared localStorage read/write |
