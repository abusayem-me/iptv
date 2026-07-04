/**
 * Fetch an M3U playlist and append entries not already in data/channels.json.
 *
 *   node scripts/merge-m3u-channels.mjs [url-or-path]
 *
 * Default URL: KB TV GitHub auto-update playlist.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data", "channels.json");

const DEFAULT_M3U =
  "https://raw.githubusercontent.com/sanjoykb/-KB-TV-Playlist/refs/heads/main/Github%20Auto%20Update%20Channel.m3u";

function slugGroup(group) {
  return (
    String(group || "other")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "other"
  );
}

function titleCaseFromId(id) {
  return id
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isPlayableUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
  if (u.includes("youtube.com") || u.includes("youtu.be")) return false;
  return true;
}

function parseExtinf(line) {
  const groupM = line.match(/group-title="([^"]*)"/i);
  const logoM = line.match(/tvg-logo="([^"]*)"/i);
  const nameM = line.match(/,(.*)$/);
  return {
    group: groupM?.[1]?.trim() || "Other",
    logo: logoM?.[1]?.trim() || "",
    name: (nameM?.[1] || "Unknown").trim(),
  };
}

function parseM3u(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let pending = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "#EXTM3U") continue;

    if (line.startsWith("#EXTINF:")) {
      pending = parseExtinf(line);
      continue;
    }

    if (pending && isPlayableUrl(line)) {
      entries.push({ ...pending, url: line.trim() });
      pending = null;
      continue;
    }

    if (!line.startsWith("#")) pending = null;
  }

  return entries;
}

function rebuildCategories(channels) {
  const counts = new Map();
  for (const ch of channels) {
    counts.set(ch.category, (counts.get(ch.category) || 0) + 1);
  }
  const ids = [...counts.keys()].sort((a, b) => titleCaseFromId(a).localeCompare(titleCaseFromId(b)));
  return ids.map((id) => ({
    id,
    title: `${titleCaseFromId(id)} (${counts.get(id)} CHANNEL)`,
  }));
}

async function loadM3u(source) {
  if (/^https?:\/\//i.test(source)) {
    console.log("Fetching", source);
    const res = await fetch(source, { headers: { Accept: "application/vnd.apple.mpegurl, text/plain, */*" } });
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }
    return res.text();
  }
  const file = path.resolve(source);
  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

async function main() {
  const source = process.argv[2] || DEFAULT_M3U;

  if (!fs.existsSync(dataPath)) {
    console.error("Missing", dataPath, "— run npm run parse-channels first.");
    process.exit(1);
  }

  const local = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!Array.isArray(local.channels)) {
    console.error("Invalid channels.json: expected .channels array");
    process.exit(1);
  }

  const text = await loadM3u(source);
  const parsed = parseM3u(text);
  const existingUrls = new Set(local.channels.map((c) => c.streamUrl));

  const additions = [];
  let skippedDup = 0;
  let skippedBad = 0;

  for (const row of parsed) {
    if (!row.url || !row.name) {
      skippedBad++;
      continue;
    }
    if (existingUrls.has(row.url)) {
      skippedDup++;
      continue;
    }

    existingUrls.add(row.url);
    additions.push({
      category: slugGroup(row.group),
      name: row.name,
      streamUrl: row.url,
      logoUrl: row.logo,
      logoAlt: row.name,
    });
  }

  const mergedChannels = [...local.channels, ...additions];
  const out = {
    generatedAt: new Date().toISOString(),
    categories: rebuildCategories(mergedChannels),
    channels: mergedChannels,
  };

  fs.writeFileSync(dataPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Done.");
  console.log("  Source entries parsed:", parsed.length);
  console.log("  Local channels before:", local.channels.length);
  console.log("  Added (new URLs):", additions.length);
  console.log("  Total channels now:", mergedChannels.length);
  console.log("  Skipped (duplicate URL):", skippedDup);
  console.log("  Skipped (bad row):", skippedBad);
  console.log("  Wrote:", dataPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
