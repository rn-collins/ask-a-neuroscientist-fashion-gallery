// Checks dist/ against data/releases.json after build-public.mjs.
// Fails if any unreleased piece's file is present, if a released piece is
// missing or lacks its links, or if a public file points at a file that is
// not public.
import fs from "node:fs";
import path from "node:path";

const OUT = "dist";
const releases = JSON.parse(fs.readFileSync("data/releases.json", "utf8"));
const SITE = releases.site.replace(/\/$/, "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const today = process.env.RELEASE_TODAY ||
  new Intl.DateTimeFormat("en-CA", { timeZone: releases.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const isReleased = (p) => p.hold === false && DATE.test(p.releasedAt) && p.releasedAt <= today;
const errors = [];
const has = (f) => fs.existsSync(path.join(OUT, f));
const read = (f) => fs.readFileSync(path.join(OUT, f), "utf8");

const files = [];
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); e.isDirectory() ? walk(f) : files.push(path.relative(OUT, f).split(path.sep).join("/")); } };
walk(OUT);
const fileSet = new Set(files);

// 1. Nothing from a held or future piece is public.
const held = releases.pieces.filter((p) => !isReleased(p));
const released = releases.pieces.filter(isReleased);
for (const piece of held) for (const f of piece.paths) if (has(f)) errors.push(`held piece ${piece.id} is public: ${f}`);

// 2. Only known files are public: shared files, released piece files and generated gallery files.
const allowed = new Set([...releases.sharedPublic, ...released.flatMap((p) => p.paths), "sitemap.xml"]);
for (const f of files) if (!allowed.has(f) && !f.startsWith("gallery/")) errors.push(`unexpected public file ${f}`);
for (const dir of ["deliverables/", "production-kits/", "research/", "scripts/", "data/", ".github/", "node_modules/"])
  for (const f of files) if (f.startsWith(dir) && !allowed.has(f)) errors.push(`private folder content is public: ${f}`);
for (const f of files) if (/\.(zip|md|csv)$/i.test(f) && !allowed.has(f)) errors.push(`download is public: ${f}`);

// 3. Every released piece is present, and its gallery page carries the link set.
const packages = [...new Set(released.map((p) => p.package))].sort();
for (const piece of released) {
  for (const f of piece.paths) if (!has(f)) errors.push(`released piece ${piece.id} is missing ${f}`);
  const index = packages.indexOf(piece.package);
  const page = `gallery/${piece.package.toLowerCase()}/index.html`;
  if (!has(page)) { errors.push(`${piece.id} has no gallery page`); continue; }
  const html = read(page);
  const need = [
    ["gallery index", 'href="/gallery/"'],
    ["long-form", `href="${piece.longFormUrl.startsWith(SITE) ? piece.longFormUrl.slice(SITE.length) : piece.longFormUrl}"`],
    ...piece.postUrls.map((u) => ["post", `href="${u}"`]),
    ["source page", `href="${piece.sourcePageUrl}"`],
    ["evidence", 'href="/evidence/"'],
    ...(index > 0 ? [["previous", `href="/gallery/${packages[index - 1].toLowerCase()}/"`]] : []),
    ...(index < packages.length - 1 ? [["next", `href="/gallery/${packages[index + 1].toLowerCase()}/"`]] : []),
    ...(piece.route ? [["the piece", `href="${piece.route}"`]] : []),
  ];
  for (const [label, token] of need) if (!html.includes(token)) errors.push(`${page} lacks the ${label} link for ${piece.id}`);
  // The piece's own page (essay or lab tool) links back to its gallery page and its sources page.
  if (piece.route) {
    const own = read(piece.route.replace(/^\//, "") + "index.html");
    if (!own.includes(`href="/gallery/${piece.package.toLowerCase()}/"`)) errors.push(`${piece.route} lacks its gallery page link`);
    if (!piece.sourcePageUrl || !own.includes(`href="${piece.sourcePageUrl}"`)) errors.push(`${piece.route} lacks its sources page link`);
  }
  if (!read("gallery/index.html").includes(`href="/gallery/${piece.package.toLowerCase()}/"`)) errors.push(`gallery index lacks ${piece.package}`);
  if (piece.route && !read("sitemap.xml").includes(`<loc>${SITE}${piece.route}</loc>`)) errors.push(`sitemap lacks ${piece.route}`);
}

// 4. Sitemap lists only public pages.
for (const m of read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const route = m[1].slice(SITE.length).replace(/^\//, "");
  if (!has(route + "index.html")) errors.push(`sitemap lists a non-public page ${m[1]}`);
}

// 5. No public file points at a repo file that is not public.
// app.js keeps a few strings that never become links on a public page: the
// companion-post fetch only runs on production-kit pages, the route title map
// still names the editions routes, and a selector matches "/production/" links.
// They are listed exactly so the check stays strict.
const knownDormant = new Set([
  "app.js -> /production/companion-posts.json",
  "app.js -> /production/",
  ...["", "armor/", "fabric-sensory-world/", "fashion-nostalgia/", "fashion-week-nervous-system/", "runway-soundtracks/", "uniforms-and-social-perception/"].map((s) => `app.js -> /deliverables/${s}`),
]);
for (const f of files.filter((f) => /\.(html|js|json|css|xml|txt)$/.test(f))) {
  const text = read(f);
  for (const m of text.matchAll(/(?:https:\/\/ask-a-neuroscientist-fashion\.vercel\.app|(?<=["'(=\s]))(\/(?:production|production-kits|deliverables|research|media|data)\/[^"'\s)<>\]]*)/g)) {
    const ref = m[1].split(/[?#]/)[0].replace(/[.,;]+$/, "");
    const clean = ref.replace(/^\//, "");
    const ok = fileSet.has(clean) || fileSet.has(clean + "index.html") || fileSet.has(clean.replace(/\/$/, "") + "/index.html");
    if (!ok && !knownDormant.has(`${f} -> ${ref}`) && !/^\/(media|data)\/$/.test(ref)) errors.push(`${f} refers to non-public ${ref}`);
  }
}

// 6. Generated gallery text: plain writing, no em or en dashes, no exclamation points in text.
for (const f of files.filter((f) => f.startsWith("gallery/"))) {
  const text = read(f).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!doctype[^>]*>/i, "").replace(/<[^>]+>/g, " ");
  if (/[–—]/.test(text)) errors.push(`${f} contains an em or en dash`);
  if (text.includes("!")) errors.push(`${f} contains an exclamation point`);
}

// 7. AaN house rules on every released essay and lab tool (RN, Oct 13, 2026):
// no em or en dashes and no exclamation points in the page text, and the
// exact line "Education, not medical advice." on the page.
const pageText = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!doctype[^>]*>/i, "").replace(/<[^>]+>/g, " ");
for (const piece of released.filter((p) => p.route)) {
  const f = piece.route.replace(/^\//, "") + "index.html";
  if (!has(f)) continue;
  const html = read(f);
  const text = pageText(html);
  if (/[–—]/.test(text)) errors.push(`${f} contains an em or en dash`);
  if (text.includes("!")) errors.push(`${f} contains an exclamation point`);
  if (!text.includes("Education, not medical advice.")) errors.push(`${f} lacks the line "Education, not medical advice."`);
}
// Claim text from data.js renders inside the released essays.
if (has("data.js") && /[–—]/.test(read("data.js").replace(/https?:\/\/[^\s"']+/g, ""))) errors.push("data.js contains an em or en dash outside a URL");

if (errors.length) {
  console.error(`Public build check FAILED (${errors.length}):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`Public build check passed for ${today}: ${released.length} released pieces present with links, ${held.length} held pieces absent, ${files.length} public files.`);
