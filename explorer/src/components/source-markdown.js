import { MarkdownIt, DOMPurify } from "../assets/vendor/source-markdown.js";
const markdown = new MarkdownIt({ html: true, linkify: true });
const tags = ["h1","h2","h3","h4","h5","h6","p","a","img","strong","em","del","s","br","hr","ul","ol","li","blockquote","pre","code","table","thead","tbody","tr","th","td","details","summary","div","span","sup","sub"];
export function renderSourceMarkdown(text, { repository, commit, path = "README.md" }) {
  const host = document.createElement("article"); host.className = "source-readme";
  const fragment = DOMPurify.sanitize(markdown.render(text), {
    ALLOWED_TAGS: tags, ALLOWED_ATTR: ["href","src","alt","title","width","height","align"],
    RETURN_DOM_FRAGMENT: true,
  });
  const directory = path.slice(0, path.lastIndexOf("/") + 1);
  const slugCounts = new Map();
  for (const heading of fragment.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    const slug = heading.textContent.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    const count = slugCounts.get(slug) || 0; slugCounts.set(slug, count + 1);
    heading.id = `source-readme-${slug}${count ? `-${count}` : ""}`;
  }
  for (const anchor of fragment.querySelectorAll("a")) {
    const href = anchor.getAttribute("href"); if (!href) continue;
    if (href.startsWith("#")) {
      anchor.href = `#source-readme-${href.slice(1)}`;
      anchor.onclick = event => { event.preventDefault(); host.querySelector(`#${CSS.escape(`source-readme-${href.slice(1)}`)}`)?.scrollIntoView({ block: "start" }); };
    } else {
      const url = new URL(href, `${repository}/blob/${commit}/${directory}`);
      if (!["https:", "http:", "mailto:"].includes(url.protocol)) { anchor.removeAttribute("href"); continue; }
      anchor.href = url.href; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
    }
  }
  for (const image of fragment.querySelectorAll("img")) {
    const src = image.getAttribute("src");
    if (!src) continue;
    const url = new URL(src, `${repository.replace("github.com", "raw.githubusercontent.com")}/${commit}/${directory}`);
    if (url.protocol !== "https:") { image.remove(); continue; }
    image.src = url.href; image.loading = "lazy"; image.referrerPolicy = "no-referrer";
  }
  host.append(fragment); return host;
}
