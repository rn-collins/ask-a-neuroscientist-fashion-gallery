// Tests for the public edition of this repository.
//
// The private repository's tests.mjs and media validators assert on unreleased
// material (production kits, production copy, deliverables). They cannot run
// here and are not exported. This file keeps the checks that apply to what is
// released: the routes, the object and claim data, the rights ledger, the page
// structure and metadata, and the release gate itself.
//
//   node scripts/public-tests.mjs
//
// It reads files relative to the current directory and writes nothing in it.
// The release-gate tests build in a temporary copy.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { checkUrls, selfCheck, vercelLikeServer } from "./check-urls.mjs";

let checks = 0;
const ok = (condition, message) => {
  checks++;
  if (!condition) throw Error(message);
};
const read = (file) => fs.readFileSync(file, "utf8");

// ---- release record and the counts of what is not here ----
const releases = JSON.parse(read("data/releases.json"));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
ok(releases.pieces.length > 0, "data/releases.json lists no released pieces");
for (const piece of releases.pieces) {
  ok(piece.hold === false && DATE.test(piece.releasedAt), `${piece.id} is in the public edition but is not released`);
  for (const file of piece.paths) ok(fs.existsSync(file) && fs.statSync(file).size > 0, `${piece.id} lists a missing file ${file}`);
}
for (const file of releases.sharedPublic) ok(fs.existsSync(file) && fs.statSync(file).size > 0, `shared file ${file} is missing`);
const withheld = JSON.parse(read("data/withheld.json"));
ok(withheld.released === releases.pieces.length, "data/withheld.json released count disagrees with data/releases.json");
ok(withheld.total === withheld.released + withheld.withheld, "data/withheld.json totals do not add up");
ok(Object.values(withheld.withheldByType).reduce((a, b) => a + b, 0) === withheld.withheld, "withheld counts by type do not add up");
ok(Object.values(withheld.withheldByPackage).reduce((a, b) => a + b, 0) === withheld.withheld, "withheld counts by package do not add up");
ok(!Object.keys(withheld).some((k) => /^(ids?|titles?|pieces|paths|files)$/i.test(k)), "data/withheld.json must carry counts only");

// ---- routes ----
const routeFiles = [
  "index.html", "exhibitions/index.html",
  "exhibitions/clothes-and-cognition/index.html", "exhibitions/outfit-as-armor/index.html",
  "exhibitions/fabric-sensory-world/index.html", "exhibitions/fashion-nostalgia/index.html",
  "exhibitions/fashion-week-nervous-system/index.html", "exhibitions/runway-soundtracks/index.html",
  "exhibitions/uniforms-and-social-perception/index.html",
  "objects/index.html", "evidence/index.html", "ask/index.html", "lab/index.html",
  "lab/armor/index.html", "lab/textile-sensory-map/index.html", "lab/memory-garment-map/index.html",
  "lab/field-load-recovery/index.html", "lab/runway-sound-map/index.html", "lab/uniform-encounter-map/index.html",
  "rights/index.html", "method/index.html", "media/index.html",
];
for (const f of [...routeFiles, "404.html", "robots.txt"]) ok(fs.existsSync(f) && fs.statSync(f).size > 0, `missing ${f}`);

// ---- objects and claims ----
const ctx = { window: {} };
vm.createContext(ctx);
const dataSource = read("data.js");
vm.runInContext(dataSource, ctx);
const { objects, claims } = ctx.window.AAN;
for (const retired of ["50.105.17_CP2.jpg", "69.2.51_front_CP4.jpg", "DP151922.jpg", "DP-14863-055.jpg", "DP-46028-001.jpg"])
  ok(!dataSource.includes(retired), `retired broken Met image URL remains: ${retired}`);
const vercelConfig = read("vercel.json");
ok(vercelConfig.includes("https://collectionapi.metmuseum.org"), "CSP must permit the Met IIIF host used by object images");
ok(objects.length === 22 && objects.every((o) => o.license === "CC0" && o.alt && o.record && o.image && o.accession),
  "object rights/provenance incomplete");
const accessions = [
  "C.I.45.27a, b", "2009.300.6638a, b", "2009.300.3330", "1988.65.1-.2; 1995.93a, b", "53.134", "2022.428.5",
  "1992.374", "29.154.3", "24.179; 26.188.1, .2; 29.158.363a, b", "04.3.289", "39.121a-n", "04.4.2",
  "2003.426a, b", "1993.35.1a-c", "1976.147.1", "1980.409.1a-c", "1979.1.2", "1978.412.111", "1976.285.5",
  "C.I.47.76.1a, b", "1979.152.54a-h", "2009.20a-j",
];
ok(objects.every((o, i) => o.accession === accessions[i]), "canonical Met accession mismatch");
ok(ctx.window.filterEvidence(claims, "replication", "stroop").map((x) => x.id).join() === "C02", "filter behavior failed");
ok(ctx.window.filterEvidence(claims, "all", "all").length === 50, "filter reset behavior failed");
for (const [prefix, count] of [["F", 9], ["S", 9], ["U", 8]]) {
  const set = claims.filter((c) => c.id.startsWith(prefix));
  ok(set.length === count && set.every((c) => c.boundary && c.doi), `claims ${prefix} or their boundaries incomplete`);
}

// ---- interactive tools and exhibitions ----
const lab = read("lab/index.html");
for (const id of ["statusSelect", "measureSelect", "fitRegion", "countRegion", "resetButton"]) ok(lab.includes(id), `explicit binding missing ${id}`);
ok(!/\bstatus\.value/.test(lab), "implicit status global remains");
const hasAll = (file, tokens, label, fold = false) => {
  const text = fold ? read(file).toLowerCase() : read(file);
  for (const token of tokens) ok(text.includes(fold ? token.toLowerCase() : token), `${label} missing ${token}`);
};
hasAll("exhibitions/outfit-as-armor/index.html", ["AAN-F-002", "download>Download", "3D + AUDIO", "Link-only", "Armor Pathway Mapper"], "armor exhibition");
hasAll("lab/armor/index.html", ["nothing is stored", "non-diagnostic", "aria-live", "clearArmor"], "armor mapper", true);
hasAll("exhibitions/fashion-week-nervous-system/index.html",
  ["Fashion Week stacks many stimuli at once", "youtube-nocookie.com/embed/S5dwtat6Wp8", "youtube-nocookie.com/embed/vRJbrfgrAUs",
   "Not established", "Map one event day", "/production-kits/aan-f-005/media/f-runway-pexels.jpg", "/media/p005-field-load-score.svg",
   "Ahmad Ardity", "does not measure exposure or physiology"], "Fashion Week exhibition");
hasAll("lab/field-load-recovery/index.html", ["NOTHING IS STORED", "non-diagnostic", "aria-live", "buildLoad", "clearLoad", "does not calculate nervous-system load"], "Fashion Week mapper", true);
hasAll("exhibitions/runway-soundtracks/index.html",
  ["Powerful is not the same as universal", "youtube-nocookie.com/embed/WifoAv6AR_I", "Entrainment means temporal alignment", "Download image", "Not established"], "Listening Room exhibition");
hasAll("lab/runway-sound-map/index.html", ["NOTHING IS STORED", "aria-live", "buildSound", "clearSound", "does not reveal sound dose"], "Listening Room mapper", true);
hasAll("exhibitions/uniforms-and-social-perception/index.html",
  ["A uniform is read before its wearer speaks", "Inference is not verification", "Download image", "Not established", "Uniform Encounter Map"], "Role Room exhibition");
hasAll("lab/uniform-encounter-map/index.html", ["NOTHING IS STORED", "aria-live", "buildUniform", "clearUniform", "verifies no authority"], "Role Room mapper", true);
for (const [slug, target, filter] of [
  ["fashion-nostalgia", "nostalgiaClaims", "startsWith('N')"],
  ["fashion-week-nervous-system", "fashionWeekClaims", "startsWith('F')"],
  ["runway-soundtracks", "soundClaims", "startsWith('S')"],
  ["uniforms-and-social-perception", "uniformClaims", "startsWith('U')"],
]) {
  const html = read(`exhibitions/${slug}/index.html`);
  ok(html.includes(`id="${target}"`) && html.includes(filter), `${slug} missing scoped evidence ledger`);
}

// ---- correction channel, honest labels, structure ----
const app = read("app.js");
const site = routeFiles.filter((f) => f.endsWith(".html")).map(read).join("\n") + app;
ok(!site.includes("corrections@example.com") && !site.includes("Contact pending"), "fake or unresolved correction contact remains");
ok(site.includes("https://github.com/rn-collins/ask-a-neuroscientist-fashion/issues/new/choose"), "authorized correction channel missing");
ok(read("production/human-completion-packet.md").includes("none of the steps below is represented as completed"), "human completion packet no longer says that no human step is represented as completed");
for (const form of [".github/ISSUE_TEMPLATE/correction.yml", ".github/ISSUE_TEMPLATE/takedown.yml", ".github/ISSUE_TEMPLATE/config.yml"])
  ok(fs.existsSync(form), `missing ${form}`);
ok(read("index.html").includes('rel="canonical"') && read("index.html").includes("og:title"), "homepage metadata incomplete");
ok(read("evidence/index.html").includes('rel="canonical"'), "evidence canonical metadata incomplete");
ok(app.includes("<details>") && app.includes("Skip to content"), "low-load accessible navigation absent");
for (const file of routeFiles.filter((f) => f.endsWith("index.html"))) {
  const html = read(file);
  for (const token of ['<html lang="en">', '<meta name="viewport"', "<main", "<h1", "/app.js"]) ok(html.includes(token), `${file} missing structural ${token}`);
  ok(!/<img\b(?![^>]*\balt=)[^>]*>/i.test(html), `${file} contains image without alt text`);
  ok(!/<img[^>]+src=["']data:image/i.test(html), `${file} contains unprovenanced inline imagery`);
}
for (const route of [
  "/exhibitions/", "/exhibitions/outfit-as-armor/", "/exhibitions/fabric-sensory-world/", "/exhibitions/fashion-nostalgia/",
  "/exhibitions/fashion-week-nervous-system/", "/exhibitions/runway-soundtracks/", "/exhibitions/uniforms-and-social-perception/",
  "/objects/", "/evidence/", "/ask/", "/lab/", "/lab/armor/", "/lab/textile-sensory-map/", "/lab/memory-garment-map/",
  "/lab/field-load-recovery/", "/lab/runway-sound-map/", "/lab/uniform-encounter-map/", "/rights/", "/method/",
]) ok(app.includes(`"${route}"`) || app.includes(`'${route}'`), `route metadata missing ${route}`);
for (const token of ["og:title", "og:description", "og:url", "twitter:card", "canonicalLink", "og:image", "twitter:image",
  "routeMetadata[routePath]", "staticDescription", "resolvedTitle", "staticPreview", 'routeImages["/"]'])
  ok(app.includes(token), `dynamic metadata missing ${token}`);
const mobile = read("mobile-nav.css");
ok(mobile.includes("nth-of-type(3)") && mobile.includes("nth-of-type(4)") && mobile.includes("display:inline"), "Objects and Evidence not directly visible on mobile");
const csp = JSON.parse(vercelConfig).headers[0].headers.find((x) => x.key === "Content-Security-Policy")?.value || "";
for (const directive of ["frame-ancestors 'self' https://rn-selected-work.vercel.app", "images.metmuseum.org", "fonts.googleapis.com", "fonts.gstatic.com", "youtube-nocookie.com"])
  ok(csp.includes(directive), `CSP missing ${directive}`);

// ---- previews: each exhibition has its own ----
const routeImageBlock = app.match(/const routeImages = \{([\s\S]*?)\n\};/);
ok(routeImageBlock, "route-specific preview image map missing");
const previews = [...routeImageBlock[1].matchAll(/"\/exhibitions\/[^"]+\/": "([^"]+)"/g)].map((m) => m[1]);
ok(previews.length === 7 && new Set(previews).size === 7, "every exhibition needs a unique route-specific preview image");
for (const slug of ["clothes-and-cognition", "outfit-as-armor", "fabric-sensory-world", "fashion-nostalgia", "fashion-week-nervous-system", "runway-soundtracks", "uniforms-and-social-perception"]) {
  const html = read(`exhibitions/${slug}/index.html`);
  ok(html.includes('property="og:image"') && html.includes('name="twitter:image"'), `${slug} lacks static social preview metadata`);
}
for (const file of routeFiles) {
  const html = read(file);
  ok(/<title>[^<]+<\/title>/i.test(html), `${file} lacks a static title`);
  for (const [label, re] of [
    ["description", /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["']/i],
    ["canonical", /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/ask-a-neuroscientist-fashion\.vercel\.app\//i],
    ["og:title", /<meta[^>]+property=["']og:title["'][^>]+content=["'][^"']+["']/i],
    ["og:description", /<meta[^>]+property=["']og:description["'][^>]+content=["'][^"']+["']/i],
    ["og:url", /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/ask-a-neuroscientist-fashion\.vercel\.app\//i],
    ["og:image", /<meta[^>]+property=["']og:image["'][^>]+content=["'][^"']+["']/i],
    ["og:image:alt", /<meta[^>]+property=["']og:image:alt["'][^>]+content=["'][^"']+["']/i],
    ["twitter:card", /<meta[^>]+name=["']twitter:card["'][^>]+content=["']summary_large_image["']/i],
    ["twitter:title", /<meta[^>]+name=["']twitter:title["'][^>]+content=["'][^"']+["']/i],
    ["twitter:description", /<meta[^>]+name=["']twitter:description["'][^>]+content=["'][^"']+["']/i],
    ["twitter:image", /<meta[^>]+name=["']twitter:image["'][^>]+content=["'][^"']+["']/i],
    ["twitter:image:alt", /<meta[^>]+name=["']twitter:image:alt["'][^>]+content=["'][^"']+["']/i],
    ["favicon.svg", /<link[^>]+rel=["']icon["'][^>]+href=["']\/favicon\.svg["']/i],
    ["favicon.ico", /<link[^>]+rel=["']icon["'][^>]+href=["']\/favicon\.ico["']/i],
  ]) ok(re.test(html), `${file} lacks static ${label}`);
  for (const m of html.matchAll(/(?:src|href|content)=["'](\/[^"'#?]+\.(?:png|jpe?g|webp|gif|svg))["']/gi))
    ok(fs.existsSync(m[1].slice(1)) && fs.statSync(m[1].slice(1)).size > 0, `${file} references missing local asset ${m[1]}`);
}

// ---- media: the evidence graphic and the provenance record ----
for (const file of fs.readdirSync("media").filter((n) => n.endsWith(".svg"))) {
  const svg = read(path.join("media", file));
  ok(svg.includes("<title") && svg.includes("<desc"), `${file} lacks accessible title/description`);
  ok(!/<image\b|data:image/i.test(svg), `${file} embeds unprovenanced raster imagery`);
}
const inventory = JSON.parse(read("production/media-provenance-inventory.json"));
ok(inventory.records.length === inventory.counts.files, "provenance count mismatch");
ok(!inventory.counts.videoFiles && !inventory.counts.audioFiles, "unexpected locally copied audio/video");
const seen = new Set();
for (const x of inventory.records) {
  for (const key of ["file", "sha256", "assetClass", "sourceAssetId", "title", "creator", "institution", "canonicalUrl", "rightsStatus", "credit", "alt", "relevance", "nonAiBasis", "transformation"])
    ok(x[key], `${x.file}: missing ${key}`);
  ok(!seen.has(x.file), `${x.file}: duplicate manifest record`);
  seen.add(x.file);
  const local = x.file.slice(1);
  ok(fs.existsSync(local), `${x.file}: absent`);
  ok(crypto.createHash("sha256").update(fs.readFileSync(local)).digest("hex") === x.sha256, `${x.file}: hash drift`);
  ok(!/rejected|duplicate|permission required|fair-use candidate/i.test(x.rightsStatus), `${x.file}: disallowed rights state`);
  if (x.assetClass === "documentary-source-image") ok(/^https:\/\//.test(x.canonicalUrl), `${x.file}: documentary image lacks public canonical record`);
  if (x.assetClass === "original-evidence-graphic") ok(/not documentary photography/i.test(x.transformation), `${x.file}: original graphic is not honestly distinguished`);
}
for (const f of ["media/p005-field-load-score.svg", "production-kits/aan-f-005/media/f-runway-pexels.jpg"])
  ok(seen.has("/" + f), `${f} has no provenance record`);

// ---- excavation record and publication register ----
const d = JSON.parse(read("production/media-excavation.json"));
ok(d.packages.length === 7 && d.surfaces.length >= 22, "excavation coverage");
const ids = new Set(d.candidates.map((c) => c.id));
ok(ids.size === d.candidates.length, "duplicate candidate id");
for (const c of d.candidates) {
  for (const k of ["id", "packages", "title", "creator", "date", "institution", "canonicalUrl", "type", "rightsStatus", "credit", "caption", "relevance", "disposition", "reason", "accessed"])
    ok(c[k] !== undefined && c[k] !== null, `${c.id} ${k}`);
  ok(Array.isArray(c.destinations) && c.destinations.length, `${c.id} has no destination or exclusion`);
  ok(!(["duplicate", "rejected"].includes(c.disposition) && !c.exclusionReason), `${c.id} missing exclusion reason`);
}
const waveFour = d.candidates.filter((x) => x.wave === 4);
ok(waveFour.length === 9 && !waveFour.some((x) => x.disposition.startsWith("installed-")), "wave 4 record is wrong");
const waveFive = d.candidates.filter((x) => x.wave === 5);
ok(waveFive.length === 4 && waveFive.every((x) => x.disposition === "resource-room" && x.mediaUrl === null), "wave 5 record is wrong");
const register = JSON.parse(read("production/publication-register.json"));
ok(register.packages.length === 7 && register.packages.every((p) => p.author !== "" && p.owner_final === "pending" && p.web_publication_date && p.version),
  "publication register incomplete or overclaims approval");

// ---- hostname rewrite ----
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aan-host-"));
  fs.writeFileSync(path.join(tmp, "robots.txt"), "https://ask-a-neuroscientist-fashion.vercel.app/x");
  fs.writeFileSync(path.join(tmp, "index.html"), '<link rel="canonical" href="https://ask-a-neuroscientist-fashion.vercel.app/">');
  const run = spawnSync(process.execPath, [path.resolve("configure-hostname.mjs"), "aan.example.org"], { cwd: tmp });
  ok(!run.status && !read(path.join(tmp, "robots.txt")).includes("vercel.app") && read(path.join(tmp, "index.html")).includes("aan.example.org"), "hostname configuration failed");
  fs.rmSync(tmp, { recursive: true });
}

// ---- HTTP smoke over the source routes ----
{
  const routeMap = new Map([["/", "index.html"]]);
  for (const f of routeFiles.filter((x) => x !== "index.html" && x.endsWith("index.html"))) routeMap.set("/" + f.replace(/\/index\.html$/, ""), f);
  // Served the way Vercel does it: cleanUrls, with trailingSlash read from vercel.json.
  const server = vercelLikeServer(".", { trailingSlash: JSON.parse(read("vercel.json")).trailingSlash === true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const route of routeMap.keys()) {
      const response = await fetch(origin + (route === "/" ? route : `${route}/`), { redirect: "manual" });
      ok(response.status === 200, `HTTP ${response.status} ${route}`);
      const html = await response.text();
      ok(html.includes("<main") && html.includes("<h1"), `DOM smoke failed ${route}`);
    }
    ok((await fetch(origin + "/not-a-room/")).status === 404, "HTTP 404 route failed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// ---- the release gate, in a temporary copy ----
{
  const copy = (from, to) => {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if ([".git", "dist", "node_modules"].includes(entry.name)) continue;
      const a = path.join(from, entry.name);
      const b = path.join(to, entry.name);
      if (entry.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copy(a, b); } else fs.copyFileSync(a, b);
    }
  };
  const build = (cwd, date) => spawnSync(process.execPath, ["scripts/build-public.mjs"], { cwd, env: { ...process.env, RELEASE_TODAY: date }, encoding: "utf8" });
  const first = releases.pieces.map((p) => p.releasedAt).sort()[0];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aan-gate-"));
  try {
    copy(".", tmp);

    // 1. Before a piece's date it is not public, even by direct path.
    const beforeAll = new Date(Date.parse(first + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
    const early = build(tmp, beforeAll);
    ok(early.status === 0, `build for ${beforeAll} failed: ${early.stderr}`);
    for (const piece of releases.pieces) for (const f of piece.paths)
      ok(!fs.existsSync(path.join(tmp, "dist", f)), `${f} is public on ${beforeAll}, before its release date`);

    // 2. On the first release date only the pieces dated that day appear.
    const day = build(tmp, first);
    ok(day.status === 0, `build for ${first} failed: ${day.stderr}`);
    for (const piece of releases.pieces) for (const f of piece.paths)
      ok(fs.existsSync(path.join(tmp, "dist", f)) === (piece.releasedAt <= first), `${f} has the wrong state on ${first}`);
    // The sitemap, canonical links and internal links of a partial build must name built pages in the
    // spelling vercel.json serves (no redirect), on the first day and, below, after the last release.
    const dayProblems = await checkUrls(path.join(tmp, "dist"));
    ok(!dayProblems.length, `URL check failed for the build on ${first}: ${dayProblems.slice(0, 5).join("; ")}`);

    // 3. hold: true withholds a piece whatever its date.
    const heldCopy = JSON.parse(read("data/releases.json"));
    const target = heldCopy.pieces.find((p) => p.route);
    target.hold = true;
    fs.writeFileSync(path.join(tmp, "data/releases.json"), JSON.stringify(heldCopy, null, 2));
    const held = build(tmp, "2099-01-01");
    ok(held.status === 0, `build with a held piece failed: ${held.stderr}`);
    ok(!fs.existsSync(path.join(tmp, "dist", target.paths[0])), `${target.paths[0]} is public although hold is true`);
    ok(!read(path.join(tmp, "dist/sitemap.xml")).includes(target.route), "sitemap lists a held piece");
    const heldProblems = await checkUrls(path.join(tmp, "dist"));
    ok(!heldProblems.length, `URL check failed with a held piece: ${heldProblems.slice(0, 5).join("; ")}`);

    // 4. After every release date the full public build must also be redirect-free, and the check must be able to fail.
    fs.writeFileSync(path.join(tmp, "data/releases.json"), JSON.stringify(JSON.parse(read("data/releases.json")), null, 2));
    const all = build(tmp, "2099-01-01");
    ok(all.status === 0, `build for 2099-01-01 failed: ${all.stderr}`);
    const allProblems = await checkUrls(path.join(tmp, "dist"));
    ok(!allProblems.length, `URL check failed for the full build: ${allProblems.slice(0, 5).join("; ")}`);
    const broken = await selfCheck();
    ok(!broken.length, `the URL check does not catch what it should: ${broken.join("; ")}`);
    ok(JSON.parse(read("vercel.json")).trailingSlash === true, "vercel.json trailingSlash changed; re-read scripts/check-urls.mjs before relying on the URL check");
    // Every public page, the 404 page included, carries the favicon tags, and the files exist.
    for (const f of ["favicon.svg", "favicon.ico"]) ok(fs.existsSync(path.join(tmp, "dist", f)) && fs.statSync(path.join(tmp, "dist", f)).size > 0, `dist/${f} is missing`);
    ok(fs.readFileSync(path.join(tmp, "dist/favicon.ico")).readUInt16LE(2) === 1, "dist/favicon.ico is not an icon file");
    ok(/^<svg[\s>]/.test(read(path.join(tmp, "dist/favicon.svg")).trim()) && !/<(?:image|script)\b|href=/.test(read(path.join(tmp, "dist/favicon.svg"))), "dist/favicon.svg must be a self-contained SVG");
    const pages = [];
    const walkHtml = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, e.name); if (e.isDirectory()) walkHtml(full); else if (e.name.endsWith(".html")) pages.push(full); } };
    walkHtml(path.join(tmp, "dist"));
    ok(pages.length > 30, "expected the built pages and 404.html");
    for (const page of pages) ok(read(page).includes('<link rel="icon" href="/favicon.svg" type="image/svg+xml">') && read(page).includes('<link rel="icon" href="/favicon.ico" sizes="32x32">'), `${path.relative(tmp, page)} lacks the favicon link tags`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`PASS: ${checks} checks on routes, object and claim data, rights ledger, page structure and metadata, provenance record, hostname rewrite, HTTP smoke and the release gate`);
