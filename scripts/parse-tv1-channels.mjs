/**
 * Extract channels from TV PRO BD / Blogger HTML export (tv1 (1).txt).
 * Run: node scripts/parse-tv1-channels.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "tv1 (1).txt");
const out = path.join(root, "data", "channels.json");

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const html = fs.readFileSync(src, "utf8");
const parts = html.split("<div class=\"category-section\"");
const channels = [];
const categories = [];

for (let i = 1; i < parts.length; i++) {
  const part = parts[i];
  const catM = part.match(/^\s*data-cat="([^"]+)">/);
  if (!catM) continue;
  const categoryId = catM[1];
  const titleM = part.match(/<div class="section-title">[\s\S]*?<\/div>/);
  const titleRaw = titleM ? titleM[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : categoryId;
  if (!categories.find((c) => c.id === categoryId)) {
    categories.push({ id: categoryId, title: titleRaw });
  }

  const chRe =
    /<div class="channel-item" onclick="playChannel\('([^']+)',\s*this,\s*'([^']+)'\)">[\s\S]*?<img alt="([^"]*)" src="([^"]*)"/g;
  let m;
  while ((m = chRe.exec(part)) !== null) {
    channels.push({
      category: categoryId,
      name: decodeHtmlEntities(m[2]),
      streamUrl: decodeHtmlEntities(m[1]),
      logoUrl: decodeHtmlEntities(m[4]),
      logoAlt: decodeHtmlEntities(m[3]),
    });
  }
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify({ generatedAt: new Date().toISOString(), categories, channels }, null, 2),
  "utf8"
);
console.log(`Wrote ${channels.length} channels, ${categories.length} categories -> ${out}`);
