/**
 * Writes `.env.local` from the first Firebase WEB app in the default (or FIREBASE_PROJECT) project.
 * Requires: `npx firebase-tools login` (or global `firebase login`).
 *
 *   node scripts/generate-env-local.mjs
 *   FIREBASE_PROJECT=my-id node scripts/generate-env-local.mjs
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, ".env.local");

function readDefaultProject() {
  const rc = path.join(root, ".firebaserc");
  if (!fs.existsSync(rc)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(rc, "utf8"));
    return j?.projects?.default ?? null;
  } catch {
    return null;
  }
}

const project = process.env.FIREBASE_PROJECT || readDefaultProject();
if (!project) {
  console.error("Set FIREBASE_PROJECT or add .firebaserc with projects.default");
  process.exit(1);
}

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", cwd: root, stdio: ["ignore", "pipe", "pipe"] });
}

const listRaw = run(`npx -y firebase-tools@latest apps:list WEB --project ${project} --json`);
const list = JSON.parse(listRaw);
const apps = list?.result;
if (!Array.isArray(apps) || apps.length === 0) {
  console.error(`No WEB apps in project ${project}. Create one:`);
  console.error(`  npx firebase-tools apps:create WEB "My App" --project ${project}`);
  process.exit(1);
}

const appId = apps[0].appId;
const sdkRaw = run(
  `npx -y firebase-tools@latest apps:sdkconfig WEB ${appId} --project ${project} --json`
);
const sdkWrap = JSON.parse(sdkRaw);
const c = sdkWrap?.result?.sdkConfig;
if (!c?.apiKey || !c?.appId) {
  console.error("Unexpected sdkconfig response:", sdkRaw.slice(0, 500));
  process.exit(1);
}

const lines = [
  `# Generated for Firebase project ${project}`,
  `# Regenerate: npm run env:firebase`,
  "",
  `NEXT_PUBLIC_FIREBASE_API_KEY=${c.apiKey}`,
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${c.authDomain}`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${c.projectId}`,
  `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${c.storageBucket}`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${c.messagingSenderId}`,
  `NEXT_PUBLIC_FIREBASE_APP_ID=${c.appId}`,
];

if (c.measurementId) {
  lines.push(`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${c.measurementId}`);
}

lines.push("");
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log("Wrote", path.relative(root, outPath), "for project", project);
