const A = window.AAN;
const nav = `<a class="skip" href="#content">Skip to content</a><nav aria-label="Primary"><a href="/">AAN × FASHION</a><a href="/exhibitions/">Stories</a><a href="/objects/">Objects</a><a href="/ask/">Ask</a><a href="/lab/">Tools</a><details><summary>More</summary><div class="nav-more"><a href="/evidence/">Sources</a><a href="/media/">Image archive</a><a href="/gallery/">Gallery</a><a href="/rights/">Rights</a><a href="/method/">Method</a></div></details></nav>`;
document.body.insertAdjacentHTML("afterbegin", nav);
const main = document.querySelector("main");
if (main && !main.id) main.id = "content";
document.body.insertAdjacentHTML(
  "beforeend",
  '<footer>Ask a Neuroscientist × Fashion · Clothing, sensation, memory and social perception · <a href="/gallery/">Gallery</a> · <a href="/rights/">Rights & corrections</a> · <a href="https://rn-selected-work.vercel.app/">RN Collins portfolio</a></footer>',
);
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="stylesheet" href="/enhancements.css"><link rel="stylesheet" href="/mobile-nav.css">',
);
window.objectCards = () =>
  A.objects
    .map(
      (o, i) =>
        `<article class="card"${i === 7 ? ' id="armor"' : ""}><figure><img loading="lazy" src="${o.image}" alt="${o.alt}"><figcaption>${o.title} · ${o.maker} · ${o.date}</figcaption></figure><h2>${o.title}</h2><p>${o.role}</p><p class="meta">Claims: ${o.claimIds.length ? o.claimIds.join(", ") : "context object"} · ${o.institution} · ${o.accession} · ${o.license}</p><a href="${o.image}" download>Open / download original ↧</a> · <a href="${o.record}">Canonical record ↗</a></article>`,
    )
    .join("");
window.claimRows = (items = A.claims) =>
  items
    .map(
      (c) =>
        `<article class="evidence-row"><div><span class="badge">${c.status}</span><p class="meta">${c.id}</p></div><div><h2>${c.claim}</h2><p>${c.study}<br>${c.measure}</p></div><div><p><b>Boundary</b><br>${c.boundary}</p><a href="${c.doi}">Source ↗</a></div></article>`,
    )
    .join("");
const routeMetadata = {
  "/": {
    title: "The Dressed Nervous System",
    description:
      "Seven fashion stories about clothing, sensation, memory, social perception and the nervous system.",
  },
  "/exhibitions/": {
    title: "Exhibitions · AAN × Fashion",
    description:
      "Installed and developing rooms in The Dressed Nervous System.",
  },
  "/exhibitions/clothes-and-cognition/": {
    title: "Clothes and Cognition: Exhibition 001",
    description:
      "The original enclothed cognition claim, its replication and the evidence boundary.",
  },
  "/exhibitions/outfit-as-armor/": {
    title: "Why Does the Right Outfit Feel Like Armor? Exhibition 002",
    description:
      "Clothing as sensation, boundary, social signal and ritual, without turning a metaphor into a brain claim.",
  },
  "/exhibitions/fabric-sensory-world/": {
    title: "Why Can One Fabric Feel Calming and Another Unbearable? Exhibition 003",
    description: "Touch, textile and context without diagnostic stereotypes.",
  },
  "/exhibitions/fashion-nostalgia/": {
    title: "Why Can Fashion Nostalgia Feel So Powerful? Exhibition 004",
    description: "Autobiographical memory, cue-dependent recall and cultural nostalgia, without a mythical nostalgia center.",
  },
  "/exhibitions/fashion-week-nervous-system/": {
    title: "What Does Fashion Week Do to the Nervous System? Exhibition 005",
    description: "Sleep, sensory load, attention, arousal, movement and recovery, without inventing a Fashion Week brain.",
  },
  "/exhibitions/runway-soundtracks/": {
    title: "Why Are Runway Soundtracks So Powerful? Exhibition 006",
    description: "Rhythm, expectation, audiovisual integration, movement and memory, without mind-control mythology.",
  },
  "/exhibitions/uniforms-and-social-perception/": {
    title: "What Do Uniforms Do to Wearer and Observer? Exhibition 007",
    description: "Role, inference and institutional power, without treating a uniform as proof of character, competence or behavior.",
  },
  "/media/": {
    title: "Media & Resources · AAN × Fashion",
    description:
      "Package media libraries, resource rooms, rights decisions and dated excavation reports.",
  },
  "/objects/": {
    title: "Object Room · AAN × Fashion",
    description:
      "Twenty-two traceable Met Open Access fashion objects with provenance and direct files.",
  },
  "/evidence/": {
    title: "Evidence Reading Room",
    description:
      "Findings, measurements, replications and the limits attached to each claim.",
  },
  "/ask/": {
    title: "Ask: Expert Room",
    description:
      "Questions for evidence specialists, fashion historians and lived-experience experts.",
  },
  "/lab/": {
    title: "Evidence Fitting Room",
    description:
      "Fit the strength of a fashion-and-cognition sentence to the evidence.",
  },
  "/lab/armor/": {
    title: "Armor Pathway Mapper · AAN × Fashion",
    description:
      "Separate sensory, interpretive, social and ritual pathways in a protective outfit.",
  },
  "/lab/textile-sensory-map/": {
    title: "Sensory Textile Field Map · AAN × Fashion",
    description: "A private, non-diagnostic garment comparison tool.",
  },
  "/lab/memory-garment-map/": {
    title: "Memory Garment Field Map · AAN × Fashion",
    description: "A private, non-diagnostic tool separating cue, remembered experience and corroborated record.",
  },
  "/lab/field-load-recovery/": {
    title: "Field Load / Recovery Mapper · AAN × Fashion",
    description: "A private, no-storage, non-diagnostic field tool for noticing event conditions and recovery choices.",
  },
  "/lab/runway-sound-map/": {
    title: "Runway Sound Map · AAN × Fashion",
    description: "A private, no-storage map for one situated runway listening.",
  },
  "/lab/uniform-encounter-map/": {
    title: "Uniform Encounter Map · AAN × Fashion",
    description: "A private, no-storage tool separating visible uniform cues from inference, knowledge, history and uncertainty.",
  },
  "/rights/": {
    title: "Rights & Provenance",
    description:
      "Rights, provenance, corrections and asset dispositions for the exhibition.",
  },
  "/method/": {
    title: "Editorial Method",
    description:
      "The experience, mechanism and evidence-limit standard behind the series.",
  },
  "/deliverables/": {
    title: "Clothes and Cognition — Production Gallery",
    description:
      "Complete editable publication systems for seven fashion-and-neuroscience exhibitions.",
  },
  "/deliverables/armor/": {
    title: "Outfit as Armor — Production Gallery",
    description: "Complete editable production assets for Outfit as Armor.",
  },
  "/deliverables/fabric-sensory-world/": {
    title: "The Sensory Textile Room — Production Gallery",
    description: "Finished cross-platform assets for the sensory textile exhibition.",
  },
  "/deliverables/fashion-nostalgia/": {
    title: "The Memory Wardrobe — Production Gallery",
    description: "Finished cross-platform assets for the fashion nostalgia exhibition.",
  },
  "/deliverables/fashion-week-nervous-system/": {
    title: "The Fashion Week Nervous System — Production Gallery",
    description: "Finished cross-platform assets for the Fashion Week nervous-system exhibition.",
  },
  "/deliverables/runway-soundtracks/": {
    title: "The Listening Room — Production Gallery",
    description: "Finished cross-platform assets for the runway soundtracks exhibition.",
  },
  "/deliverables/uniforms-and-social-perception/": {
    title: "The Role Room — Production Gallery",
    description: "Complete editable production assets for The Role Room.",
  },
};
const routeImages = {
  "/": "https://images.metmuseum.org/CRDImages/ci/original/1979.152.54a%E2%80%93cf_F.jpg",
  "/exhibitions/clothes-and-cognition/": "https://images.metmuseum.org/CRDImages/ci/original/DT200606.jpg",
  "/exhibitions/outfit-as-armor/": "https://images.metmuseum.org/CRDImages/aa/original/DP256970.jpg",
  "/exhibitions/fabric-sensory-world/": "https://images.metmuseum.org/CRDImages/ci/original/DT5639.jpg",
  "/exhibitions/fashion-nostalgia/": "https://images.metmuseum.org/CRDImages/ci/original/1980.409.1a-c.jpg",
  "/exhibitions/fashion-week-nervous-system/": "/production-kits/aan-f-005/media/f-runway-pexels.jpg",
  "/exhibitions/runway-soundtracks/": "https://images.metmuseum.org/CRDImages/mi/original/215848.jpg",
  "/exhibitions/uniforms-and-social-perception/": "https://images.metmuseum.org/CRDImages/ci/original/1979.152.54a%E2%80%93cf_F.jpg",
};
const routePath = location.pathname.endsWith("/")
  ? location.pathname
  : location.pathname + "/";
const exhibitionSlugs = [
  "clothes-and-cognition",
  "outfit-as-armor",
  "fabric-sensory-world",
  "fashion-nostalgia",
  "fashion-week-nervous-system",
  "runway-soundtracks",
  "uniforms-and-social-perception",
];
const exhibitionIndex = exhibitionSlugs.findIndex((slug) =>
  routePath.includes(`/exhibitions/${slug}/`),
);
if (exhibitionIndex >= 0) {
  document.body.classList.add("gallery-story", `story-00${exhibitionIndex + 1}`);
  const threshold = main?.querySelector(
    ":scope > .armor-hero, :scope > .uniform-opening, :scope > .editorial-object",
  );
  const storyHead = main?.querySelector(":scope > .story-head");
  if (threshold && storyHead) {
    threshold.classList.add("exhibition-threshold");
    storyHead.insertAdjacentElement("afterend", threshold);
  }
}
if (routePath.startsWith("/deliverables/")) document.body.classList.add("production-page");

const packageMatch = routePath.match(/^\/production-kits\/(aan-f-\d{3})\/$/);
if (packageMatch) {
  document.body.classList.add("publication-workspace");
  const packageId = packageMatch[1].toUpperCase();
  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const postText = (post) =>
    [post.hook, post.context, post.story, post.seriesRelevance, post.ending, post.cta]
      .filter(Boolean)
      .join("\n\n");

  fetch("/production/companion-posts.json")
    .then((response) => {
      if (!response.ok) throw new Error("Companion posts could not be loaded.");
      return response.json();
    })
    .then((data) => {
      const packagePosts = data.packages.find((item) => item.id === packageId);
      if (!packagePosts || !main) return;

      const intro = main.querySelector(":scope > .lede");
      if (intro) {
        intro.textContent =
          "Two complete carousel stories with their own ready-to-post captions. Read the sequence, edit the post in place, then copy or download the version you want to publish.";
      }
      const masterSection = main.querySelector(":scope > .plate");
      const workspace = document.createElement("section");
      workspace.className = "companion-workspace";
      workspace.setAttribute("aria-labelledby", "companion-title");
      workspace.innerHTML = `
        <div class="companion-heading">
          <p class="kicker">THE WORDS THAT TRAVEL WITH THE CAROUSEL</p>
          <h2 id="companion-title">Two carousels. Two complete posts.</h2>
          <p>These are not slide captions pasted together. Each post carries the reader from the opening question through the evidence, the place this story holds in Ask a Neuroscientist, and an ending with somewhere to go.</p>
        </div>
        <div class="companion-grid">
          ${packagePosts.carousels
            .map((post, index) => {
              const storageKey = `aan-companion-${packageId}-${post.id}`;
              const value = postText(post);
              return `<article class="companion-editor">
                <p class="kicker">CAROUSEL ${String.fromCharCode(65 + index)}</p>
                <h3>${escapeHtml(post.label)}</h3>
                <label for="${post.id}-post">Editable companion post</label>
                <textarea id="${post.id}-post" data-storage-key="${storageKey}" rows="22">${escapeHtml(value)}</textarea>
                <div class="editor-actions">
                  <button type="button" data-copy="${post.id}-post">Copy post</button>
                  <button type="button" data-download="${post.id}-post" data-filename="${packageMatch[1]}-${post.id}-companion-post.txt">Download .txt</button>
                  <button type="button" data-reset="${post.id}-post">Restore draft</button>
                </div>
                <p class="editor-status" id="${post.id}-status" aria-live="polite"></p>
                <details class="post-anatomy">
                  <summary>Why this post works</summary>
                  <dl>
                    <div><dt>Hook</dt><dd>${escapeHtml(post.hook)}</dd></div>
                    <div><dt>Context</dt><dd>${escapeHtml(post.context)}</dd></div>
                    <div><dt>Story</dt><dd>${escapeHtml(post.story)}</dd></div>
                    <div><dt>Why it belongs here</dt><dd>${escapeHtml(post.seriesRelevance)}</dd></div>
                    <div><dt>Ending</dt><dd>${escapeHtml(post.ending)}</dd></div>
                    <div><dt>Reader invitation</dt><dd>${escapeHtml(post.cta)}</dd></div>
                  </dl>
                </details>
              </article>`;
            })
            .join("")}
        </div>`;
      (masterSection || intro)?.insertAdjacentElement("afterend", workspace);

      for (const post of packagePosts.carousels) {
        const textarea = document.getElementById(`${post.id}-post`);
        if (!textarea) continue;
        textarea.dataset.original = postText(post);
        const saved = localStorage.getItem(textarea.dataset.storageKey);
        if (saved) textarea.value = saved;
        textarea.addEventListener("input", () =>
          localStorage.setItem(textarea.dataset.storageKey, textarea.value),
        );
      }

      for (const section of main.querySelectorAll(":scope > section")) {
        const kicker = section.querySelector(":scope > .section-head .kicker")?.textContent || "";
        if (!/^(INSTAGRAM|SHORT VIDEO)/.test(kicker)) continue;
        const heading = section.querySelector(":scope > .section-head h2")?.textContent || "Details";
        const details = document.createElement("details");
        details.className = "frame-notes";
        details.innerHTML = `<summary>Open the slide-by-slide context for ${escapeHtml(heading)}</summary>`;
        while (section.firstChild) details.append(section.firstChild);
        section.append(details);
      }
    })
    .catch(() => {
      document.body.classList.add("companion-load-error");
    });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-copy], button[data-download], button[data-reset]");
    if (!button) return;
    const targetId = button.dataset.copy || button.dataset.download || button.dataset.reset;
    const textarea = document.getElementById(targetId);
    if (!textarea) return;
    const status = document.getElementById(`${targetId.replace("-post", "")}-status`);
    if (button.dataset.copy) {
      await navigator.clipboard.writeText(textarea.value);
      if (status) status.textContent = "Copied to clipboard.";
    } else if (button.dataset.download) {
      const url = URL.createObjectURL(new Blob([textarea.value + "\n"], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = button.dataset.filename;
      link.click();
      URL.revokeObjectURL(url);
      if (status) status.textContent = "Downloaded as editable text.";
    } else {
      textarea.value = textarea.dataset.original || "";
      localStorage.removeItem(textarea.dataset.storageKey);
      if (status) status.textContent = "Original draft restored.";
    }
  });
}
document
  .querySelectorAll('a[href^="/production/"], a[href*="images.metmuseum.org"]')
  .forEach((link) => link.setAttribute("download", ""));
if (routePath === "/exhibitions/") {
  const roomMedia = [82433, 24671, 81754, 107620, 436533, 503169, 84449]
    .map((id) => A.objects.find((object) => object.id === id))
    .filter(Boolean);
  const lede = main?.querySelector(".lede");
  if (lede && roomMedia.length) {
    const strip = document.createElement("section");
    strip.className = "room-object-strip";
    strip.setAttribute("aria-label", "Objects from the seven exhibitions");
    strip.innerHTML = roomMedia.map((object, index) =>
      `<a href="/exhibitions/${exhibitionSlugs[index]}/"><figure><img src="${object.image}" alt="${object.alt}"><figcaption>${String(index + 1).padStart(2, "0")} · ${object.title}</figcaption></figure></a>`
    ).join("");
    lede.insertAdjacentElement("afterend", strip);
  }
}
// Registered editorial routes receive canonical copy from the central map.
// Generated production-kit routes intentionally keep the static title and
// description authored in their HTML instead of being relabelled as home.
const routeMeta = routeMetadata[routePath];
const canonical = location.origin + routePath;
if (routeMeta) document.title = routeMeta.title;
const staticDescription = document.head
  .querySelector('meta[name="description"]')
  ?.getAttribute("content");
const resolvedTitle = routeMeta?.title || document.title;
const resolvedDescription = routeMeta?.description || staticDescription || routeMetadata["/"].description;
for (const [kind, key, value] of [
  ["name", "description", resolvedDescription],
  ["property", "og:title", resolvedTitle],
  ["property", "og:description", resolvedDescription],
  ["property", "og:type", "website"],
  ["property", "og:url", canonical],
  ["name", "twitter:card", "summary_large_image"],
]) {
  let el = document.head.querySelector(`meta[${kind}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(kind, key);
    document.head.append(el);
  }
  el.content = value;
}
let canonicalLink = document.head.querySelector('link[rel="canonical"]');
if (!canonicalLink) {
  canonicalLink = document.createElement("link");
  canonicalLink.rel = "canonical";
  document.head.append(canonicalLink);
}
canonicalLink.href = canonical;
const staticPreview = document.head
  .querySelector('meta[property="og:image"], meta[name="twitter:image"]')
  ?.getAttribute("content");
const routeImage = routeImages[routePath] || staticPreview || routeImages["/"];
if (routeImage) {
  const imageUrl = new URL(routeImage, location.origin).href;
  for (const [property, content] of [
    ["og:image", imageUrl],
    ["twitter:image", imageUrl],
  ]) {
    let imageMeta = document.head.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
    if (!imageMeta) {
      imageMeta = document.createElement("meta");
      imageMeta.setAttribute(property.startsWith("og:") ? "property" : "name", property);
      document.head.append(imageMeta);
    }
    imageMeta.content = content;
  }
}
