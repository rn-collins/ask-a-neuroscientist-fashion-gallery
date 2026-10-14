# Ask a Neuroscientist × Fashion (public edition)

A rights-first, evidence-bound exhibition on the neuroscience of dress, part of the Ask a Neuroscientist series by RN Collins. It is seven exhibitions, six small interactive tools, an evidence ledger of 50 claims, and 22 Metropolitan Museum of Art Open Access objects, each with its record and rights status. It is static HTML, CSS and JavaScript.

**Live site:** https://ask-a-neuroscientist-fashion.vercel.app
**Built by:** [RN Collins](https://rn-selected-work.vercel.app)

Every released essay and tool carries the line "Education, not medical advice." The site uses no AI-generated imagery. Remote object photography comes from the Met's Open Access program (CC0), and the one photograph stored in this repository is a Wikimedia Commons CC0 file credited in [NOTICE](NOTICE).

## What this repository is

This is the public edition. The private source repository stays canonical and keeps deploying the live site. A script in it, [`scripts/export-public.mjs`](scripts/export-public.mjs), writes this tree on each release day. The site built from this tree is byte-identical to the site built from the private repository for the same date, which is what the live site serves.

State as of 13 October 2026 (Pacific/Honolulu): 13 of 132 pieces are released and 119 are held. The seven essays and six tools are all released. What is held is the derived production material for each package: episode scripts, vertical short-video scripts, Instagram carousels, newsletter editions, Pinterest pins and publication kits. Held by type: Beehiiv newsletter edition (7), Instagram carousel (14), long-form film and audio episode (script) (7), Pinterest pin (35), production kit and download bundle (7), vertical short video (script) (49).

Held pieces appear here only as counts in [`data/withheld.json`](data/withheld.json). No id, title, text or media file of a held piece is in this repository, and the exporter refuses to finish if it finds one.

## How a piece becomes public

[`data/releases.json`](data/releases.json) is the only gate. A piece is public when `hold` is `false` and `releasedAt` is today or earlier in Pacific/Honolulu. Any other piece is left out of everything the build writes: its pages, files, gallery entry and sitemap line, so its URL returns 404.

| Field | Meaning |
|---|---|
| `id` | Shared id, `aan-f/aan-f-00N/<piece>`, used by RN Collins Selected Work for the same piece. |
| `releasedAt` | Release date in Pacific/Honolulu, `YYYY-MM-DD`, or empty. |
| `hold` | `true` keeps the piece hidden whatever its date. |
| `postUrls`, `longFormUrl`, `sourcePageUrl` | Links to posts about the piece, the essay it belongs with, and its sources page. |
| `package`, `packageTitle`, `type`, `title`, `route`, `image`, `paths` | What the build emits and how the gallery describes it. |

`RELEASE_TODAY=YYYY-MM-DD` overrides the date for previews and checks.

## Build and test

Node 24. There are no dependencies and nothing to install.

```sh
npm test                    # routes, object and claim data, rights ledger, metadata, release gate
npm run build:public        # writes dist/ for today in Honolulu, then verifies it
RELEASE_TODAY=2026-10-13 npm run build:public    # as of a given day
node configure-hostname.mjs example.org          # rewrite the canonical host in this tree
python3 -m http.server 8000 --directory dist
```

`npm run build:public` runs [`scripts/build-public.mjs`](scripts/build-public.mjs), which writes `dist/`, and [`scripts/verify-public.mjs`](scripts/verify-public.mjs), which fails if a held file is present, a released piece is missing or lacks its links, a public file points at a file that is not public, the sitemap, a canonical link, an `og:url` or an internal link does not match how `vercel.json` serves pages (`trailingSlash: true`, so every page URL ends in a slash and none redirects; see [`scripts/check-urls.mjs`](scripts/check-urls.mjs)), or a released page contains a dash or an exclamation mark. `vercel.json` sets the same command for deployment.

`npm test` runs [`scripts/public-tests.mjs`](scripts/public-tests.mjs). It checks the routes, the 22 object records and their accession numbers, the claim filter, each exhibition and tool, the correction channel, page structure and alt text, static and runtime metadata, the Content Security Policy, the provenance record and its hashes, and the release gate itself (a build before a piece's date, on its date, and with `hold` set to `true`).

## Repository map

| Path | What it is |
|---|---|
| `index.html`, `exhibitions/`, `lab/`, `objects/`, `evidence/`, `ask/`, `rights/`, `method/`, `media/` | The site pages. |
| `app.js`, `data.js`, `style.css`, `enhancements.css`, `mobile-nav.css` | Behavior, the claim and object records, and styles. |
| `data/releases.json` | The release record for every public piece. |
| `data/withheld.json` | Counts of held pieces by type and package. Nothing else about them. |
| `production/publication-register.json` | Version, publication date and approval state for each package. |
| `production/media-provenance-inventory.json` | Provenance, rights and SHA-256 for each media file stored here. |
| `production/media-excavation.json`, `production/media-excavation-summary.csv` | The record of the media search and what was installed, linked only or rejected. |
| `production/human-completion-packet.md` | The steps that remain for people: recording, permissions, review, approval. |
| `production/package-002-field-notes.md`, `production/package-003-rights.csv` | Released field-notes protocol and rights ledger. |
| `scripts/` | Build, verify, test and export scripts. |
| `.github/` | CI and the correction and rights-review issue forms. |

## What is left out, and why

| Left out | Why |
|---|---|
| Files of held pieces: scripts, newsletters, carousels, pins, publication kits, rendered images, ZIP bundles | Publishing them would publish what the release gate withholds. |
| `production-kits/`, `deliverables/` | These are the held production galleries and kits. |
| The rest of `production/` (per-package copy, source manifests, rights CSVs, social cuts, asset-kit data) | Unreleased copy and working data. Only the shared production files the site serves, and the production files attached to released pieces, are kept. |
| `research/` | Quarantined and retired media with unverified rights. |
| Media held for rights review | Rights and consent on a file do not follow from its license. These files stay out until cleared. |
| Provenance records of held media | Their credits, alt text and hashes describe held files. The inventory here lists only files stored in this repository. |
| `AGENTS.md`, `CLAUDE.md`, audit and repair notes | Internal operating notes and working logs. |
| Private test files, asset renderers, the ZIP builder, the metadata installers | They read held files and cannot run without them. Their output (the page metadata) is already in the HTML here. |
| `.github/workflows` for the daily release rebuild and the Made-with check | Deployment and commit rules belong to the private source repository. |
| `package-lock.json`, `sharp` | Only the rendering and validation of held images used them. |

## Corrections

Report a factual, attribution, provenance, accessibility or link error, or a rights concern, with the forms in `.github/ISSUE_TEMPLATE`. Reports are public, so do not include personal or sensitive information. The Rights page on the live site describes the same channel.

## Licenses

| What | License |
|---|---|
| Code: `app.js`, `*.css`, `*.mjs`, `scripts/`, workflow, `vercel.json`, inline page scripts | MIT, see [LICENSE](LICENSE) |
| Original text and data: page text, claim records in `data.js`, `data/`, `production/`, the SVG in `media/` | Copyright RN Collins, all rights reserved, see [LICENSE-CONTENT](LICENSE-CONTENT). Short quotations with credit and a link to the site are welcome. |
| Met Open Access objects, Wikimedia Commons photograph, embedded videos, fonts, cited research | Their own terms. Listed in [NOTICE](NOTICE) and not relicensed here. |

Site composition is not a blanket license for the sources it cites.
