// Builds the public site into dist/ from data/releases.json and nothing else.
//
// A piece is public only when its releasedAt date (Pacific/Honolulu) is today
// or earlier and hold is false. Every other piece is left out of dist/, so its
// pages, images, scripts, ZIPs and JSON return 404 even by direct URL. Source
// files stay in the repo; only the build output changes.
//
// RELEASE_TODAY=YYYY-MM-DD overrides today's date for checks and previews.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "dist");
const releases = JSON.parse(fs.readFileSync("data/releases.json", "utf8"));
const SITE = releases.site.replace(/\/$/, "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayIn(timeZone) {
  if (process.env.RELEASE_TODAY) {
    if (!DATE.test(process.env.RELEASE_TODAY)) throw Error("RELEASE_TODAY must be YYYY-MM-DD");
    return process.env.RELEASE_TODAY;
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const today = todayIn(releases.timezone);
const isReleased = (piece) => piece.hold === false && DATE.test(piece.releasedAt) && piece.releasedAt <= today;

// ---- validate the release record ----
const ids = new Set();
for (const piece of releases.pieces) {
  for (const key of ["id", "releasedAt", "hold", "postUrls", "longFormUrl", "sourcePageUrl", "package", "packageTitle", "type", "title", "paths"])
    if (!(key in piece)) throw Error(`${piece.id || "piece"} lacks ${key}`);
  if (ids.has(piece.id)) throw Error(`duplicate id ${piece.id}`);
  ids.add(piece.id);
  if (typeof piece.hold !== "boolean") throw Error(`${piece.id} hold must be true or false`);
  if (piece.releasedAt !== "" && !DATE.test(piece.releasedAt)) throw Error(`${piece.id} releasedAt must be YYYY-MM-DD or empty`);
  if (!Array.isArray(piece.postUrls) || !Array.isArray(piece.paths) || !piece.paths.length)
    throw Error(`${piece.id} postUrls and paths must be arrays`);
  for (const url of [...piece.postUrls, piece.longFormUrl, piece.sourcePageUrl].filter(Boolean))
    if (!/^https:\/\//.test(url)) throw Error(`${piece.id} has a non-https link ${url}`);
  if (!/^https:\/\/rn-selected-work\.vercel\.app\/sources\/aan-f\/aan-f-\d{3}$/.test(piece.sourcePageUrl) || !piece.sourcePageUrl.endsWith(piece.package.toLowerCase()))
    throw Error(`${piece.id} needs its rn-selected-work sources page (https://rn-selected-work.vercel.app/sources/aan-f/${piece.package.toLowerCase()})`);
  for (const file of piece.paths) if (!fs.existsSync(file)) throw Error(`${piece.id} lists a missing file ${file}`);
}

// ---- decide which files are public ----
const claims = new Map();
for (const piece of releases.pieces)
  for (const file of piece.paths) claims.set(file, [...(claims.get(file) || []), piece]);
for (const file of releases.sharedPublic) {
  if (claims.has(file)) throw Error(`${file} is listed as shared but belongs to ${claims.get(file).map((p) => p.id).join(", ")}`);
  if (!fs.existsSync(file)) throw Error(`shared file ${file} is missing`);
}
const released = releases.pieces.filter(isReleased);
const emit = new Set(releases.sharedPublic);
const withheldShared = [];
for (const piece of released)
  for (const file of piece.paths) {
    if (claims.get(file).every(isReleased)) emit.add(file);
    else withheldShared.push(`${file} (${piece.id})`);
  }

fs.rmSync(OUT, { recursive: true, force: true });
const write = (file, body) => {
  const target = path.join(OUT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
};
for (const file of emit) {
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.copyFileSync(file, path.join(OUT, file));
}

// The provenance inventory describes every media file in the repo. Publish
// only the records for files that are public or hosted elsewhere.
{
  const file = "production/media-provenance-inventory.json";
  const inventory = JSON.parse(fs.readFileSync(file, "utf8"));
  const isPublic = (url) => !url || /^https?:/.test(url) || emit.has(url.replace(/^\//, ""));
  inventory.records = inventory.records.filter((r) => isPublic(r.file) && isPublic(r.mediaUrl));
  inventory.counts = { files: inventory.records.length, note: "Public build: records for unreleased or uninstalled files are left out." };
  write(file, JSON.stringify(inventory, null, 2) + "\n");
}

// ---- gallery pages ----
const esc = (s = "") => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (d) => { const [y, m, day] = d.split("-").map(Number); return `${day} ${months[m - 1]} ${y}`; };
const local = (url) => (url.startsWith(SITE + "/") ? url.slice(SITE.length) : url);
const host = (url) => new URL(url).hostname.replace(/^www\./, "");
const slugOf = (pkg) => pkg.toLowerCase();
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const packages = [];
for (const piece of released) {
  let group = packages.find((g) => g.id === piece.package);
  if (!group) packages.push((group = { id: piece.package, title: piece.packageTitle, pieces: [] }));
  group.pieces.push(piece);
}
packages.sort((a, b) => a.id.localeCompare(b.id));

const head = ({ title, description, route, image, alt }) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${SITE}${route}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${SITE}${route}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:alt" content="${esc(alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="${esc(alt)}"><link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"><style>.gallery-links{border-top:1px solid var(--line);padding:3vw 0}.gallery-links h2{font:300 2.2rem/1 Newsreader}.gallery-links ul{padding-left:1.2rem;line-height:1.8}.gallery-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem}.gallery-strip figure{aspect-ratio:4/5}</style></head><body>`;
const foot = `<script src="/data.js"></script><script src="/app.js"></script></body></html>\n`;
const HOME_IMAGE = "https://images.metmuseum.org/CRDImages/ci/original/1979.152.54a%E2%80%93cf_F.jpg";

const pieceCard = (piece) => {
  const label = `${capital(piece.type)} · Released ${longDate(piece.releasedAt)}`;
  let body = "";
  if (piece.route) {
    const verb = piece.type === "essay" ? "Read the essay" : piece.type === "interactive tool" ? "Open the tool" : "Open";
    body = `<a href="${esc(piece.route)}">${verb} →</a>`;
  } else {
    const images = piece.paths.filter((f) => /\.(png|jpe?g|svg|webp)$/i.test(f) && emit.has(f));
    const others = piece.paths.filter((f) => !images.includes(f) && emit.has(f));
    if (images.length)
      body += `<div class="gallery-strip">${images.map((f, i) => `<figure><img loading="lazy" src="/${esc(f)}" alt="${esc(piece.title)}, image ${i + 1}"></figure>`).join("")}</div>`;
    body += others.map((f) => `<a href="/${esc(f)}">Open ${esc(path.basename(f))} →</a>`).join(" ");
  }
  return `<article class="card" id="${esc(piece.id.split("/").pop())}"><p class="badge">${esc(label)}</p><h2>${esc(piece.title)}</h2>${body}</article>`;
};

packages.forEach((group, index) => {
  const route = `/gallery/${slugOf(group.id)}/`;
  const prev = packages[index - 1];
  const next = packages[index + 1];
  const essay = group.pieces.find((p) => p.type === "essay");
  const lead = essay || group.pieces[0];
  const posts = group.pieces.flatMap((p) => p.postUrls.map((url) => ({ url, piece: p })));
  const sources = [...new Set(group.pieces.map((p) => p.sourcePageUrl).filter(Boolean))];
  const longForms = [...new Set(group.pieces.map((p) => p.longFormUrl).filter(Boolean))];
  const links = [];
  for (const url of longForms) links.push(`<li>Long-form: <a href="${esc(local(url))}">${esc(lead.packageTitle)}, the full essay</a></li>`);
  for (const url of sources) links.push(`<li>Source page: <a href="${esc(url)}">the research, lab tool and image credits for ${esc(group.id)} on the RN Collins portfolio</a></li>`);
  links.push(`<li>Evidence: <a href="/evidence/">the evidence reading room for this exhibition, every claim and what it does not prove</a></li>`);
  for (const { url, piece } of posts) links.push(`<li>Post: <a href="${esc(url)}">${esc(piece.title)} on ${esc(host(url))}</a></li>`);
  const pager = [
    prev ? `<a class="download" rel="prev" href="/gallery/${slugOf(prev.id)}/">← Previous: ${esc(prev.title)}</a>` : "",
    `<a class="download" href="/gallery/">Gallery index</a>`,
    next ? `<a class="download" rel="next" href="/gallery/${slugOf(next.id)}/">Next: ${esc(next.title)} →</a>` : "",
  ].join("");
  const title = `${group.title} · Gallery · AAN × Fashion`;
  const description = `Released pieces from ${group.id}, ${group.title}, with links to the essay, its sources and the rest of the gallery.`;
  write(`gallery/${slugOf(group.id)}/index.html`,
    head({ title, description, route, image: lead.image || HOME_IMAGE, alt: `Preview image for ${group.title}` }) +
    `<main class="wrap"><p class="kicker">GALLERY · ${esc(group.id)} · ${index + 1} OF ${packages.length}</p><h1>${esc(group.title)}</h1>` +
    `<p class="lede">The released pieces from ${esc(group.id)} of Ask a Neuroscientist × Fashion.</p>` +
    `<section class="grid">${group.pieces.map(pieceCard).join("")}</section>` +
    `<section class="gallery-links"><h2>Links for this piece</h2><ul>${links.join("")}</ul></section>` +
    `<nav class="next-actions" aria-label="Gallery pages">${pager}</nav></main>` + foot);
});

write("gallery/index.html",
  head({ title: "Gallery · AAN × Fashion", description: "Every released piece of Ask a Neuroscientist × Fashion, one page per package, in order.", route: "/gallery/", image: HOME_IMAGE, alt: "Preview image for the Ask a Neuroscientist × Fashion gallery" }) +
  `<main class="wrap"><p class="kicker">GALLERY · ${packages.length} PACKAGES · ${released.length} RELEASED PIECES</p><h1>Gallery</h1>` +
  `<p class="lede">Every released piece, one page per package, in order. New pieces appear here on their release day.</p>` +
  `<section class="grid">${packages.map((g) => `<article class="card"><p class="badge">${esc(g.id)} · ${g.pieces.length} ${g.pieces.length === 1 ? "piece" : "pieces"}</p><h2>${esc(g.title)}</h2><p>${g.pieces.map((p) => esc(p.title)).join(" · ")}</p><a href="/gallery/${slugOf(g.id)}/">Open the gallery page →</a></article>`).join("")}</section></main>` + foot);

// ---- links inside public pages: never point at something that is not public ----
const htmlFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else htmlFiles.push(path.relative(OUT, full).split(path.sep).join("/"));
  }
};
walk(OUT);
const exists = (p) => fs.existsSync(path.join(OUT, p)) && fs.statSync(path.join(OUT, p)).isFile();
const resolves = (urlPath) => {
  const clean = decodeURI(urlPath.split(/[?#]/)[0]).replace(/^\//, "");
  if (clean === "") return exists("index.html");
  if (clean.endsWith("/")) return exists(clean + "index.html");
  return exists(clean) || exists(clean + ".html") || exists(clean + "/index.html");
};
const unwrapped = [];
for (const file of htmlFiles.filter((f) => f.endsWith(".html"))) {
  const full = path.join(OUT, file);
  let html = fs.readFileSync(full, "utf8");
  html = html.replace(/<a\b([^>]*?)\bhref="([^"]*)"([^>]*)>([\s\S]*?)<\/a\s*>/g, (whole, a, href, b, inner) => {
    const target = href.startsWith(SITE + "/") ? href.slice(SITE.length) : href;
    if (!target.startsWith("/") || target.startsWith("//") || resolves(target)) return whole;
    unwrapped.push(`${file} -> ${href}`);
    return `<span>${inner}</span>`;
  });
  for (const m of html.matchAll(/\b(?:src|content|href)="([^"]+)"/g)) {
    const target = m[1].startsWith(SITE + "/") ? m[1].slice(SITE.length) : m[1];
    if (/^\/[^/]/.test(target) && /\.[a-z0-9]+$/i.test(target.split(/[?#]/)[0]) && !resolves(target))
      throw Error(`${file} references ${m[1]}, which is not in the public build`);
  }
  fs.writeFileSync(full, html);
}

// ---- sitemap from what was actually emitted ----
const routes = htmlFiles
  .filter((f) => f.endsWith("index.html"))
  .map((f) => "/" + f.replace(/index\.html$/, ""))
  .sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)));
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((r) => `<url><loc>${SITE}${r}</loc></url>`).join("\n")}\n</urlset>\n`);

let fileCount = 0;
const count = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) e.isDirectory() ? count(path.join(dir, e.name)) : fileCount++; };
count(OUT);

console.log(`Public build for ${today} (Pacific/Honolulu): ${released.length} of ${releases.pieces.length} pieces released, ${packages.length} gallery pages, ${routes.length} sitemap routes, ${fileCount} files in dist/.`);
if (withheldShared.length) console.log(`Held back because another unreleased piece shares the file: ${withheldShared.join("; ")}`);
if (unwrapped.length) console.log(`Links to non-public targets turned into plain text: ${unwrapped.length}\n  ${unwrapped.join("\n  ")}`);
