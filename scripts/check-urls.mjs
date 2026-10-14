// Checks that the URLs the site advertises agree with how the server answers them.
//
// vercel.json decides whether a page lives at /x/ (trailingSlash true) or at /x (false). The other
// URL is answered with a 308 redirect. Search engines treat a sitemap or canonical URL that
// redirects as a mistake, so this check fails when any of these URLs does not match vercel.json:
//   - every <loc> in sitemap.xml
//   - every <link rel="canonical"> and og:url
//   - every url in a JSON-LD block
//   - every internal link to a page
// It also fails when the sitemap lists a URL that is not a built page, and it serves the folder
// with a small server that behaves like Vercel (cleanUrls true, trailingSlash from vercel.json)
// and requests every sitemap URL, canonical and internal link: each must answer 200, not a redirect.
//
//   node scripts/check-urls.mjs [folder]      folder defaults to dist/
//
// Run from the repository root (it reads vercel.json and data/releases.json there). Node built-ins only.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import os from "node:os";
import { pathToFileURL } from "node:url";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".xml": "application/xml", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const hasExtension = (p) => /\.[A-Za-z0-9]+$/.test(p.split("/").pop());

// A stand-in for Vercel's static hosting with cleanUrls true. Redirects are 308, like Vercel's.
export function vercelLikeServer(root, { trailingSlash }) {
  const file = (p) => { try { return fs.statSync(p).isFile() ? p : null; } catch { return null; } };
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const route = decodeURIComponent(url.pathname);
    const redirect = (to) => { res.writeHead(308, { location: to + url.search }); res.end(); };
    const withSlash = (p) => (trailingSlash && p !== "/" && !p.endsWith("/") ? p + "/" : p);
    // cleanUrls: /x.html and /x/index.html are never served as such.
    if (/(^|\/)index\.html$/.test(route)) return redirect(withSlash(route.replace(/index\.html$/, "").replace(/(.)\/$/, "$1")));
    if (route.endsWith(".html")) return redirect(withSlash(route.slice(0, -5)));
    if (trailingSlash && route !== "/" && !route.endsWith("/") && !hasExtension(route)) return redirect(route + "/");
    if (!trailingSlash && route !== "/" && route.endsWith("/")) return redirect(route.replace(/\/+$/, ""));
    const base = path.join(root, route);
    const target = file(base) || file(path.join(base, "index.html")) || file(base + ".html");
    if (target && path.resolve(target).startsWith(path.resolve(root))) {
      res.writeHead(200, { "content-type": TYPES[path.extname(target)] || "application/octet-stream" });
      return res.end(fs.readFileSync(target));
    }
    const notFound = file(path.join(root, "404.html"));
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(notFound ? fs.readFileSync(notFound) : "Not found");
  });
}

function htmlFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if ([".git", "node_modules", "dist"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") out.push(path.relative(root, full).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out;
}

// Returns a list of problems; empty means the URLs and the server agree.
//   generatedPrefixes: routes that scripts/build-public.mjs writes into dist/ and that do not exist in the
//   source tree (the /gallery/ pages). Links to them are not requested when the source tree is checked.
export async function checkUrls(root = "dist", { vercelFile = "vercel.json", releasesFile = "data/releases.json", generatedPrefixes = [] } = {}) {
  const errors = [];
  const trailingSlash = JSON.parse(fs.readFileSync(vercelFile, "utf8")).trailingSlash === true;
  const site = JSON.parse(fs.readFileSync(releasesFile, "utf8")).site.replace(/\/$/, "");
  const policy = trailingSlash ? "end in a slash" : "not end in a slash";
  const wrongShape = (p) => p !== "/" && !hasExtension(p) && p.endsWith("/") !== trailingSlash;
  const toPath = (url) => (url.startsWith(site + "/") || url === site ? url.slice(site.length) || "/" : null);

  // [where, path] pairs to check statically and to request.
  const advertised = [];
  const builtPage = (p) => fs.existsSync(path.join(root, p.replace(/^\//, ""), "index.html"));

  const sitemapFile = path.join(root, "sitemap.xml");
  if (!fs.existsSync(sitemapFile)) return [`${sitemapFile} is missing`];
  const locs = [...fs.readFileSync(sitemapFile, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) errors.push("sitemap.xml lists no URLs");
  for (const loc of locs) {
    const p = toPath(loc);
    if (p === null) { errors.push(`sitemap lists ${loc}, which is not on ${site}`); continue; }
    if (loc !== site + p || /[?#]/.test(p)) errors.push(`sitemap URL ${loc} is not a plain page URL`);
    if (wrongShape(p)) errors.push(`sitemap URL ${loc} must ${policy} (vercel.json trailingSlash is ${trailingSlash})`);
    if (!builtPage(p)) errors.push(`sitemap lists ${loc}, which is not a built page`);
    advertised.push(["sitemap", p]);
  }
  if (new Set(locs).size !== locs.length) errors.push("sitemap lists a URL more than once");

  for (const file of htmlFiles(root)) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const own = file === "index.html" ? "/" : "/" + file.replace(/index\.html$/, "");
    const canonicals = [...html.matchAll(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]);
    const ogUrls = [...html.matchAll(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/gi)].map((m) => m[1]);
    const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) =>
      [...m[1].matchAll(/"(?:url|@id|item|mainEntityOfPage)"\s*:\s*"([^"]+)"/g)].map((u) => u[1]));
    for (const [kind, urls] of [["canonical", canonicals], ["og:url", ogUrls], ["JSON-LD url", ld]]) {
      for (const url of urls) {
        const p = toPath(url.split(/[?#]/)[0]);
        if (p === null) continue; // an external URL is not ours to check
        if (wrongShape(p)) errors.push(`${file}: ${kind} ${url} must ${policy}`);
        if (!hasExtension(p) && !builtPage(p)) errors.push(`${file}: ${kind} ${url} is not a built page`);
        advertised.push([`${file} ${kind}`, p]);
      }
    }
    if (canonicals.length > 1) errors.push(`${file}: more than one canonical link`);
    if (canonicals.length && canonicals[0] !== site + own) errors.push(`${file}: canonical ${canonicals[0]} is not its own URL ${site}${own}`);
    for (const m of html.matchAll(/\bhref=["']([^"'#?][^"']*)["']/g)) {
      const target = m[1].split(/[?#]/)[0];
      const p = target.startsWith("/") && !target.startsWith("//") ? target : toPath(target);
      if (p && !hasExtension(p)) {
        if (wrongShape(p)) errors.push(`${file}: internal link ${m[1]} must ${policy}`);
        if (!generatedPrefixes.some((prefix) => p.startsWith(prefix))) advertised.push([`${file} link`, p]);
      }
    }
  }

  // Ask the Vercel-like server for each URL. Every answer must be a plain 200.
  const server = vercelLikeServer(root, { trailingSlash });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const seen = new Map();
    for (const [where, p] of advertised) if (!seen.has(p)) seen.set(p, where);
    for (const [p, where] of seen) {
      const response = await fetch(origin + p, { redirect: "manual" });
      if (response.status !== 200) errors.push(`${p} (from ${where}) answers ${response.status}${response.headers.get("location") ? ` to ${response.headers.get("location")}` : ""}, not 200`);
    }
    // The mirror image: the other spelling of a page must redirect to the advertised one, so the server config is what we think it is.
    const probe = locs.map(toPath).find((p) => p && p !== "/");
    if (probe) {
      const other = trailingSlash ? probe.replace(/\/$/, "") : probe + "/";
      const response = await fetch(origin + other, { redirect: "manual" });
      if (response.status !== 308 || response.headers.get("location") !== probe) errors.push(`expected ${other} to redirect (308) to ${probe}`);
    }
    return errors.concat(seen.size ? [] : ["no URL was requested"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// Proves the check can fail. Builds tiny sites in a temporary folder and returns a list of the cases
// where checkUrls answered wrongly: a good site must pass, and each kind of mistake must be reported.
export async function selfCheck() {
  const SITE = "https://example.test";
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aan-urls-"));
  const wrong = [];
  try {
    fs.writeFileSync(path.join(tmp, "releases.json"), JSON.stringify({ site: SITE }));
    for (const [flag, name] of [[true, "slash.json"], [false, "noslash.json"]]) fs.writeFileSync(path.join(tmp, name), JSON.stringify({ trailingSlash: flag }));
    const site = (dir, { sitemap, canonical, link = "/about/" }) => {
      const root = path.join(tmp, dir);
      fs.mkdirSync(path.join(root, "about"), { recursive: true });
      const page = (own, canon, body) => `<!doctype html><title>x</title><link rel="canonical" href="${SITE}${canon}"><meta property="og:url" content="${SITE}${canon}"><main><h1>${own}</h1>${body}</main>`;
      fs.writeFileSync(path.join(root, "index.html"), page("home", "/", `<a href="${link}">about</a>`));
      fs.writeFileSync(path.join(root, "about/index.html"), page("about", canonical, ""));
      fs.writeFileSync(path.join(root, "sitemap.xml"), `<urlset>${sitemap.map((u) => `<url><loc>${SITE}${u}</loc></url>`).join("")}</urlset>`);
      return root;
    };
    const run = (root, config) => checkUrls(root, { vercelFile: path.join(tmp, config), releasesFile: path.join(tmp, "releases.json") });
    const expect = async (label, root, config, shouldPass, mention) => {
      const errors = await run(root, config);
      if (shouldPass && errors.length) wrong.push(`${label}: expected to pass, got ${errors[0]}`);
      if (!shouldPass && !errors.some((e) => e.includes(mention))) wrong.push(`${label}: expected a problem mentioning "${mention}", got ${errors.length ? errors[0] : "none"}`);
    };
    await expect("slash site, trailingSlash true", site("good", { sitemap: ["/", "/about/"], canonical: "/about/" }), "slash.json", true);
    await expect("slash URLs, trailingSlash false", site("a", { sitemap: ["/", "/about/"], canonical: "/about/" }), "noslash.json", false, "must not end in a slash");
    await expect("sitemap URL without a slash", site("b", { sitemap: ["/", "/about"], canonical: "/about/" }), "slash.json", false, "sitemap URL");
    await expect("canonical without a slash", site("c", { sitemap: ["/", "/about/"], canonical: "/about" }), "slash.json", false, "canonical");
    await expect("sitemap lists an unbuilt page", site("d", { sitemap: ["/", "/about/", "/missing/"], canonical: "/about/" }), "slash.json", false, "not a built page");
    await expect("internal link without a slash", site("e", { sitemap: ["/", "/about/"], canonical: "/about/", link: "/about" }), "slash.json", false, "internal link");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return wrong;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const root = process.argv[2] || "dist";
  const errors = await checkUrls(root);
  if (errors.length) {
    console.error(`URL check failed for ${root}:\n  ${errors.slice(0, 40).join("\n  ")}${errors.length > 40 ? `\n  ... and ${errors.length - 40} more` : ""}`);
    process.exit(1);
  }
  console.log(`URL check passed for ${root}: sitemap, canonical, og:url, JSON-LD and internal page links agree with vercel.json and answer 200 without a redirect.`);
}
