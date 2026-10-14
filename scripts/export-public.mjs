#!/usr/bin/env node
// Writes the public edition of this repository to a folder.
//
// The private repository is canonical. It holds every piece of Ask a
// Neuroscientist x Fashion, including the derived production material that is
// not yet released (episode scripts, vertical shorts, carousels, newsletters,
// pins, platform kits, rendered images and ZIP bundles). The public edition
// holds the site, the code, the tests, the documentation and only the files of
// pieces released as of a date. Held pieces are carried as counts in
// data/withheld.json and nothing else: no id, no title, no text, no filename.
//
//   node scripts/export-public.mjs --out ../ask-a-neuroscientist-fashion-open
//   node scripts/export-public.mjs --out /tmp/open --date 2026-11-01
//
// Re-run it on any day a piece is released, then commit the result in the
// public repository. After writing, the script scans the whole output for
// held ids, held titles, held media files and held body text. If it finds any,
// it clears the output (never the target's .git folder) and exits with an error.
//
// Uses Node built-ins only.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_EXT = new Set([".md", ".csv", ".json", ".html", ".js", ".mjs", ".css", ".xml", ".txt", ".svg", ".yml", ".yaml", ".cff"]);
const MEDIA_EXT = /\.(?:png|jpe?g|webp|gif|svg|avif|mp4|webm|mp3|wav|pdf|zip)$/i;
const SHINGLE = 10; // consecutive words that must match for held body text to count as copied

// Folders and files of the private repository that are never exported. Their text and media
// feed the leak check as the "held" corpus.
const INTERNAL_DIRS = ["production-kits", "deliverables", "research"];
const SCRIPTS_EXPORTED = ["build-public.mjs", "verify-public.mjs", "export-public.mjs", "public-tests.mjs", "check-urls.mjs"];

const die = (message) => { console.error(`export-public: ${message}`); process.exit(1); };
const rel = (p) => p.split(path.sep).join("/");
const readText = (p) => fs.readFileSync(p, "utf8");

// ---- arguments ----
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node scripts/export-public.mjs --out <folder> [--date YYYY-MM-DD]\n" +
    "  --out   folder to write; its .git folder is kept, everything else in it is replaced\n" +
    "  --date  export the pieces released on or before this date, Pacific/Honolulu (default: today there)");
  process.exit(0);
}
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const outArg = flag("--out");
if (!outArg) die("--out <folder> is required (see --help)");
if (!INTERNAL_DIRS.every((d) => fs.existsSync(path.join(ROOT, d))))
  die("this looks like the public edition. Run the exporter from the private source repository.");

const releases = JSON.parse(readText(path.join(ROOT, "data/releases.json")));
const today = flag("--date") ||
  process.env.RELEASE_TODAY ||
  new Intl.DateTimeFormat("en-CA", { timeZone: releases.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
if (!DATE.test(today)) die("--date must be YYYY-MM-DD");

const OUT = path.resolve(outArg);
const fromRoot = path.relative(OUT, ROOT);
if (OUT === path.parse(OUT).root || OUT === process.env.HOME || fromRoot === "" || (!fromRoot.startsWith("..") && !path.isAbsolute(fromRoot)))
  die(`refusing to write to ${OUT}: it is, or contains, the source repository or a system folder`);
if (path.relative(ROOT, OUT) !== "" && !path.relative(ROOT, OUT).startsWith(".."))
  die("--out must be outside the source repository");

// ---- which pieces are public ----
const isReleased = (p) => p.hold === false && DATE.test(p.releasedAt) && p.releasedAt <= today;
const released = releases.pieces.filter(isReleased);
const held = releases.pieces.filter((p) => !isReleased(p));
if (!released.length) die(`no piece is released as of ${today}`);

const claims = new Map();
for (const piece of releases.pieces) for (const f of piece.paths) claims.set(f, [...(claims.get(f) || []), piece]);
const emit = new Set(releases.sharedPublic);
for (const f of releases.sharedPublic) if (claims.has(f)) die(`${f} is listed as shared but belongs to a piece`);
for (const piece of released) for (const f of piece.paths) {
  if (!claims.get(f).every(isReleased)) die(`${f} belongs to released piece ${piece.id} and to a held piece. Fix data/releases.json first (the live build would withhold it too).`);
  emit.add(f);
}
for (const f of emit) if (!fs.existsSync(path.join(ROOT, f))) die(`${f} is listed as public but is missing`);

// ---- clear the target, keep its git folder ----
fs.mkdirSync(OUT, { recursive: true });
const clear = () => {
  for (const name of fs.readdirSync(OUT)) {
    if (name === ".git") continue;
    fs.rmSync(path.join(OUT, name), { recursive: true, force: true });
  }
};
clear();

const write = (file, body) => {
  const target = path.join(OUT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
};
const copy = (file, as = file) => {
  const target = path.join(OUT, as);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, file), target);
};

function run() {
 try {
  // ---- the site: shared files and the files of released pieces, byte for byte ----
  for (const f of emit) if (f !== "production/media-provenance-inventory.json") copy(f);

  // The provenance inventory describes every media file in the private repository, held ones
  // included. Keep the records for files that are public or hosted elsewhere, as the build does.
  {
    const inventory = JSON.parse(readText(path.join(ROOT, "production/media-provenance-inventory.json")));
    const isPublic = (url) => !url || /^https?:/.test(url) || emit.has(url.replace(/^\//, ""));
    inventory.records = inventory.records.filter((r) => isPublic(r.file) && isPublic(r.mediaUrl));
    inventory.counts = { files: inventory.records.length, note: "Public build: records for unreleased or uninstalled files are left out." };
    write("production/media-provenance-inventory.json", JSON.stringify(inventory, null, 2) + "\n");
  }

  // vercel.json: the same headers, and a build command that needs no private files.
  {
    const vercel = JSON.parse(readText(path.join(ROOT, "vercel.json")));
    vercel.buildCommand = "npm run build:public";
    write("vercel.json", JSON.stringify(vercel, null, 2) + "\n");
  }
  copy("configure-hostname.mjs");
  for (const f of fs.readdirSync(path.join(ROOT, ".github/ISSUE_TEMPLATE"))) copy(`.github/ISSUE_TEMPLATE/${f}`);
  for (const f of SCRIPTS_EXPORTED) copy(`scripts/${f}`);

  // ---- release record: released pieces only; the rest as counts ----
  write("data/releases.json", JSON.stringify({ ...releases, pieces: released }, null, 2) + "\n");
  const countBy = (list, key) => Object.fromEntries(Object.entries(
    list.reduce((acc, p) => ({ ...acc, [p[key]]: (acc[p[key]] || 0) + 1 }), {})).sort(([a], [b]) => a.localeCompare(b)));
  write("data/withheld.json", JSON.stringify({
    note: "Pieces not yet released are counted and not listed. Their ids, titles, text and media stay in the private source repository and are published on their release day.",
    asOf: today,
    timezone: releases.timezone,
    total: releases.pieces.length,
    released: released.length,
    withheld: held.length,
    withheldByType: countBy(held, "type"),
    withheldByPackage: countBy(held, "package"),
  }, null, 2) + "\n");

  // ---- package.json, ignore file, CI, licenses, notice, readme ----
  write("package.json", JSON.stringify({
    name: "ask-a-neuroscientist-fashion",
    version: "1.0.0",
    private: true,
    description: "Ask a Neuroscientist x Fashion: a rights-first, evidence-bound exhibition on the neuroscience of dress. Public edition.",
    license: "MIT AND CC-BY-4.0",
    engines: { node: ">=24" },
    scripts: {
      test: "node --check app.js && node --check data.js && node scripts/public-tests.mjs",
      "build:public": "node scripts/build-public.mjs && node scripts/verify-public.mjs",
      build: "npm run build:public",
    },
  }, null, 2) + "\n");
  write(".gitignore", "dist/\nnode_modules/\n.vercel/\n.DS_Store\n");
  write(".github/workflows/ci.yml", `name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Tests (routes, data, rights ledger, metadata, release gate)
        run: npm test
      - name: Build the public site and verify it against the release record
        run: npm run build:public
`);
  write("LICENSE", `MIT License

Copyright (c) 2026 RN Collins

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

This license covers the code: app.js, the *.css files, configure-hostname.mjs,
the files in scripts/, the workflow in .github/workflows/, vercel.json and
package.json, and the small inline scripts inside the HTML pages. The original
text and data are licensed separately: see LICENSE-CONTENT. Third-party items
are listed in NOTICE and are not covered by either license.
`);
  write("LICENSE-CONTENT", `Copyright (c) 2026 RN Collins. All rights reserved.

The original text, data and graphics in this repository (the page text of the
exhibitions, tools and reference pages, the claim and object records, the files
in data/ and production/, and the evidence graphic in media/) are the work of
RN Collins and are not licensed for reuse or redistribution.

You may quote short passages with credit and a link to the live site:
https://ask-a-neuroscientist-fashion.vercel.app

Third-party material (Metropolitan Museum of Art Open Access objects, Wikimedia
Commons photographs, embedded videos, fonts and cited research) keeps its own
terms. See NOTICE.

The code (app.js, *.css, *.mjs, scripts/, workflows and vercel.json) is
licensed separately under the MIT License. See LICENSE.
`);

  // NOTICE is built from the repository's own provenance data.
  {
    const vmCtx = { window: {} };
    vm.createContext(vmCtx);
    vm.runInContext(readText(path.join(ROOT, "data.js")), vmCtx);
    const objects = vmCtx.window.AAN.objects;
    const inventory = JSON.parse(readText(path.join(OUT, "production/media-provenance-inventory.json")));
    const hosted = inventory.records.filter((r) => r.assetClass === "documentary-source-image");
    const videos = [...new Set([...emit].filter((f) => f.endsWith(".html")).flatMap((f) =>
      [...readText(path.join(ROOT, f)).matchAll(/youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})/g)].map((m) => m[1])))].sort();
    const lines = [];
    lines.push("NOTICE", "", "Third-party items used by this project and the terms the project's own records give for them.",
      "Nothing here is relicensed. The code is under MIT (LICENSE) and the original text and data are copyright RN Collins, all rights reserved (LICENSE-CONTENT).", "");
    lines.push(`1. The Metropolitan Museum of Art Open Access objects (${objects.length})`, "",
      "Object photographs are displayed from the Met's servers and are not stored in this repository. Each record",
      "below is marked Public Domain / CC0 under the Met's Open Access policy",
      "(https://www.metmuseum.org/about-the-met/policies-and-documents/open-access). Titles, makers, dates and",
      "accession numbers follow the Met's catalogue records, with dashes written as hyphens or the word to.", "");
    for (const o of objects) {
      const line = `  - ${o.title}, ${o.maker}, ${o.date}. ${o.institution}. ${o.accession}. ${o.license}. ${o.record}`;
      lines.push(line);
      derivedPublic += line + "\n";
    }
    lines.push("", `2. Wikimedia Commons photographs stored in this repository (${hosted.length})`, "");
    for (const r of hosted) {
      const line = `  - ${r.file.slice(1)}: "${r.title}", ${r.creator}. ${r.institution}. ${r.rightsStatus}${r.licenseUrl ? ` (${r.licenseUrl})` : ""}. Record: ${r.canonicalUrl}. SHA-256 ${r.sha256}.`;
      lines.push(line);
      derivedPublic += line + "\n";
    }
    lines.push("",
      "3. Embedded video", "",
      "The pages embed videos through YouTube's privacy-enhanced player (youtube-nocookie.com). The videos are not",
      "copied or licensed by this repository; rights stay with their owners.",
      `Embedded video ids: ${videos.join(", ") || "none"}.`, "",
      "4. Fonts", "",
      "style.css loads DM Mono, Inter and Newsreader from Google Fonts at runtime. The font files are not stored here. Each family",
      "keeps the license its designers chose, which this project has not restated.", "",
      "5. Cited research", "",
      "Papers, courses and other records are cited by DOI or link. No figure, table or excerpt is reproduced beyond",
      "short attribution.", "",
      "6. The evidence graphic", "",
      "media/p005-field-load-score.svg is an original vector graphic by RN Collins. All rights reserved.", "");
    write("NOTICE", lines.join("\n"));
  }

  // README from the template in public-edition/
  {
    const tpl = readText(path.join(ROOT, "public-edition/README.template.md"));
    const vmCtx = { window: {} };
    vm.createContext(vmCtx);
    vm.runInContext(readText(path.join(ROOT, "data.js")), vmCtx);
    const longDate = (d) => { const [y, m, day] = d.split("-").map(Number);
      return `${day} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`; };
    const fills = {
      DATE: today, DATE_LONG: longDate(today), SITE: releases.site, TIMEZONE: releases.timezone,
      RELEASED: String(released.length), WITHHELD: String(held.length), TOTAL: String(releases.pieces.length),
      OBJECTS: String(vmCtx.window.AAN.objects.length), CLAIMS: String(vmCtx.window.AAN.claims.length),
      HELD_TYPES: Object.entries(countBy(held, "type")).map(([k, v]) => `${k} (${v})`).join(", ") || "none",
    };
    const body = tpl.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => { if (!(k in fills)) die(`README template uses unknown field ${m}`); return fills[k]; });
    write("README.md", body);
  }

  // ---- leak check ----
  const leaks = leakCheck();
  if (leaks.length) {
    clear();
    die("refusing to export. Held material found in the output, which has been cleared:\n  " +
      leaks.slice(0, 25).map((l) => `${l.file}: ${l.kind}: ${l.what}`).join("\n  ") + (leaks.length > 25 ? `\n  ... and ${leaks.length - 25} more` : ""));
  }
} catch (error) {
  clear();
  throw error;
}
}

// Lines the exporter builds only from public records (data.js objects and the filtered inventory).
let derivedPublic = "";

// Walks a folder; returns relative file paths.
function walk(dir, base = dir, skip = () => false) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (skip(entry.name, full)) continue;
    if (entry.isDirectory()) files.push(...walk(full, base, skip));
    else files.push(rel(path.relative(base, full)));
  }
  return files;
}
const isText = (file) => TEXT_EXT.has(path.extname(file).toLowerCase()) || !path.extname(file);
const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}]+(?:['\u2019][\p{L}]+)?/gu) || [];
// cyrb53: a small string hash with a 53-bit result, enough to compare shingles.
function hash53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function shingles(text) {
  const w = words(text);
  const out = [];
  for (let i = 0; i + SHINGLE <= w.length; i++) out.push(hash53(w.slice(i, i + SHINGLE).join(" ")));
  return out;
}

// Looks for held ids, titles, media files and body text in everything written to OUT.
function leakCheck() {
  const found = [];
  const outFiles = walk(OUT, OUT, (name) => name === ".git");
  const outText = new Map(outFiles.filter(isText).map((f) => [f, readText(path.join(OUT, f))]));

  // Text that is on the live site is public by definition, so it cannot count as held.
  const siteText = [...emit].filter((f) => isText(f)).map((f) => outText.get(f) ?? readText(path.join(ROOT, f))).join("\n") + "\n" + derivedPublic;
  const siteLower = siteText.toLowerCase();

  // 1. Ids: the full id and its package/slug tail (the last two parts of the id).
  const idNeedles = new Set();
  for (const p of held) { idNeedles.add(p.id); idNeedles.add(p.id.split("/").slice(-2).join("/")); }
  // 2. Titles of held pieces, unless the same words are already on a released page.
  const titleNeedles = new Set(held.map((p) => p.title).filter((t) => t && !siteLower.includes(t.toLowerCase())));
  // 3. Media files of the private repository that are not public.
  const internalFiles = [];
  for (const d of INTERNAL_DIRS) internalFiles.push(...walk(path.join(ROOT, d), ROOT));
  for (const f of walk(path.join(ROOT, "production"), ROOT)) if (!emit.has(f)) internalFiles.push(f);
  // A piece held only by its date has its own pages and files too (an essay or a tool released later).
  for (const piece of held) for (const f of piece.paths)
    if (!emit.has(f) && !internalFiles.includes(f) && fs.existsSync(path.join(ROOT, f))) internalFiles.push(f);
  const heldMedia = internalFiles.filter((f) => MEDIA_EXT.test(f) && !emit.has(f));
  const heldMediaPaths = new Set(heldMedia);
  const outBase = new Set(outFiles.map((f) => path.basename(f)));
  const heldBase = new Set(heldMedia.map((f) => path.basename(f)).filter((b) => !outBase.has(b) && b.length >= 8));
  // 4. Body text: word shingles of held text that do not occur in the released site text.
  //    A: the held pieces' own material (production copy, kits, deliverables, research).
  //    B: internal notes at the top level. These quote public rules and code, so shingles that
  //       also occur in the build and verify scripts or the release rule are not counted for B.
  const heldA = internalFiles.filter((f) => isText(f) && !emit.has(f) && !/\.(?:css|js|mjs|svg)$/i.test(f));
  const heldB = fs.readdirSync(ROOT).filter((f) => /\.md$/i.test(f) && f !== "README.md");
  const siteShingles = new Set(shingles(siteText));
  const codeShingles = new Set(shingles(["scripts/build-public.mjs", "scripts/verify-public.mjs"].map((f) => readText(path.join(ROOT, f))).join("\n") +
    "\n" + [releases.rule, releases.fields, releases.sourcePages].join("\n")));
  const heldShingles = new Map();
  for (const [files, exempt] of [[heldA, null], [heldB, codeShingles]]) {
    for (const f of files) {
      for (const h of shingles(readText(path.join(ROOT, f))))
        if (!siteShingles.has(h) && !(exempt && exempt.has(h)) && !heldShingles.has(h)) heldShingles.set(h, f);
    }
  }
  const boundary = (name) => new RegExp(`(?<![\\w./-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
  const baseRegexes = [...heldBase].map((b) => [b, boundary(b)]);

  for (const f of outFiles) {
    if (heldMediaPaths.has(f)) found.push({ file: f, kind: "held media file", what: "exported at its private path" });
  }
  for (const [f, text] of outText) {
    for (const n of idNeedles) if (text.includes(n)) found.push({ file: f, kind: "held piece id", what: n });
    for (const n of titleNeedles) if (text.includes(n)) found.push({ file: f, kind: "held piece title", what: n });
    for (const p of heldMediaPaths) if (text.includes(p)) found.push({ file: f, kind: "held media path", what: p });
    for (const [b, re] of baseRegexes) if (re.test(text)) found.push({ file: f, kind: "held media filename", what: b });
    if (heldShingles.size) {
      const w = words(text);
      for (let i = 0; i + SHINGLE <= w.length; i++) {
        const passage = w.slice(i, i + SHINGLE).join(" ");
        const src = heldShingles.get(hash53(passage));
        if (src) { found.push({ file: f, kind: "held body text", what: `"${passage}" also in ${src}` }); break; }
      }
    }
  }
  // Held binary media copied under another name: compare content hashes.
  const outBinary = outFiles.filter((f) => !isText(f));
  if (outBinary.length) {
    const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    const heldHashes = new Map(heldMedia.map((f) => [sha(path.join(ROOT, f)), f]));
    for (const f of outBinary) {
      const h = sha(path.join(OUT, f));
      if (heldHashes.has(h)) found.push({ file: f, kind: "held media content", what: `identical to ${heldHashes.get(h)}` });
    }
  }
  const shared = heldBase.size;
  console.log(`leak check: ${outFiles.length} files scanned against ${idNeedles.size} held ids, ${titleNeedles.size} held titles, ` +
    `${heldMediaPaths.size} held media files (${shared} distinctive names), ${heldShingles.size} held text passages: ${found.length} found`);
  return found;
}

run();
const outFiles = walk(OUT, OUT, (name) => name === ".git");
const bytes = outFiles.reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`exported ${released.length} released pieces as of ${today}; ${held.length} held pieces carried as counts only -> ${OUT}`);
console.log(`${outFiles.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
