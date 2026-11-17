import { createElement as el, loadingMessage } from "./interface-utils.js";
import {
  createAnnotationClient,
  ensemblIdentity,
} from "./gene-annotation-data.js";
import { trackActivity } from "./app-activity.js";
import { uiIcon } from "./icons.js";
import { enhancePlots } from "./figure-controls.js";
const client = createAnnotationClient();
let sequence = 0,
  active;
function sourceLink(text, href) {
  const link = el("a", "external", text);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
async function annotation(gene) {
  const record = await client.lookup(gene.id),
    identity = ensemblIdentity(gene.id);
  const result = el("section", "gene-annotation-result"),
    fields = el("dl", "gene-annotation-fields");
  result.append(
    el("h3", "", record.symbol),
    sourceLink(
      "Ensembl gene record ↗",
      `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${record.id}`,
    ),
  );
  for (const [name, value] of [
    ["Description", record.description],
    ["Biotype", record.biotype],
    ["Assembly", record.assembly],
    ["Coordinates", record.location],
    ["Strand", record.strand],
    [
      "Current gene version",
      record.version === null
        ? "Not supplied"
        : `${record.id}.${record.version}`,
    ],
    ["Archived gene ID", gene.id],
    ["Retrieved (UTC)", record.retrievedAt],
  ])
    fields.append(el("dt", "", name), el("dd", "", String(value)));
  result.append(fields, sourceLink("Ensembl API source ↗", record.source));
  if (
    identity.archivedVersion !== null &&
    record.version !== null &&
    identity.archivedVersion !== record.version
  )
    result.append(
      el(
        "p",
        "note",
        "The current gene version differs from the archived ID. Coordinates and descriptions belong to the current annotation; archived estimates have not been remapped or reinterpreted.",
      ),
    );
  return result;
}
// Public information has its own native F7 sheet; archived evidence stays in place.
export function geneAnnotation(gene) {
  return {
    open(initial = "gene") {
      const root = document.querySelector("#psilocin-app"),
        app = root?.f7;
      if (!app) return;
      if (active?.gene === gene.id) {
        active.select(initial);
        return;
      }
      active?.close();
      const id = `gene-information-${++sequence}`;
      const sheet = el(
        "section",
        "sheet-modal research-evidence-sheet gene-information-sheet gene-annotation",
      );
      sheet.setAttribute(
        "aria-label",
        `${gene.symbol} public gene and protein information`,
      );
      const handle = el("div", "sheet-handle"),
        header = el("header", "evidence-sheet-header");
      const identity = el("div", "gene-information-identity");
      identity.append(
        el("h2", "", `${gene.symbol} · Public context`),
        el("p", "identifier", gene.id),
      );
      const done = el("button", "button button-tonal labelled-icon-action");
      done.type = "button";
      done.append(uiIcon("done"), el("span", "", "Done"));
      header.append(identity, done);
      const navigation = el(
        "div",
        "segmented segmented-strong gene-information-tabs",
      );
      navigation.setAttribute("role", "tablist");
      navigation.setAttribute("aria-label", "Public gene information");
      const content = el(
        "div",
        "sheet-modal-inner evidence-sheet-content gene-information-content",
      );
      content.append(
        el(
          "p",
          "note gene-information-scope",
          "Current public annotations and structural models are external context, not measurements of a psilocin response. Archived expression estimates and pathway memberships remain unchanged.",
        ),
      );
      const tabs = el("div", "tabs"),
        panes = new Map(),
        buttons = new Map(),
        loaded = new Set();
      const entries = [
        ["gene", "Gene annotation", "information"],
        ["protein", "Protein features", "landscape"],
        ["structures", "3D structures", "fullscreen"],
      ];
      for (const [key, title, icon] of entries) {
        const button = el("button", "button");
        button.type = "button";
        button.id = `${id}-${key}-label`;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", `${id}-${key}`);
        button.append(uiIcon(icon), el("span", "", title));
        const pane = el("section", "tab gene-information-pane");
        pane.id = `${id}-${key}`;
        pane.setAttribute("role", "tabpanel");
        pane.setAttribute("aria-labelledby", button.id);
        panes.set(key, pane);
        buttons.set(key, button);
        tabs.append(pane);
        navigation.append(button);
        button.onclick = () => select(key);
        button.onkeydown = (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const keys = entries.map((e) => e[0]);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? keys.length - 1
                : (keys.indexOf(key) +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    keys.length) %
                  keys.length;
          select(keys[next]);
          buttons.get(keys[next]).focus();
        };
      }
      navigation.append(el("span", "segmented-highlight"));
      content.append(tabs);
      sheet.append(handle, header, navigation, content);
      const container =
        document.fullscreenElement || document.webkitFullscreenElement || root;
      container.append(sheet);
      let closed = false;
      async function load(key) {
        if (loaded.has(key)) return;
        loaded.add(key);
        const pane = panes.get(key);
        pane.setAttribute("aria-busy", "true");
        pane.replaceChildren(
          loadingMessage(
            key === "gene"
              ? "Loading Ensembl annotation…"
              : "Loading verified human protein matches…",
          ),
        );
        const geneSource = () =>
          sourceLink(
            "Open Ensembl gene record ↗",
            `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${ensemblIdentity(gene.id).stableId}`,
          );
        if (key === "gene") pane.append(geneSource());
        try {
          const result = await trackActivity(
            key === "gene"
              ? annotation(gene)
              : import("./protein-context.js").then(({ proteinContext }) =>
                  proteinContext(gene, { view: key }),
                ),
            "Loading public gene information",
          );
          if (closed) return;
          pane.replaceChildren(result);
          enhancePlots(pane, { nested: true });
        } catch (error) {
          if (closed) return;
          loaded.delete(key);
          const retry = el("button", "button button-tonal", "Retry");
          retry.type = "button";
          retry.onclick = () => load(key);
          pane.replaceChildren(
            el(
              "p",
              "note",
              error.message ||
                "The public service is unavailable. Please retry.",
            ),
            retry,
          );
          if (key === "gene") pane.append(geneSource());
        } finally {
          pane.setAttribute("aria-busy", "false");
        }
      }
      function select(key) {
        if (!panes.has(key)) key = "gene";
        app.tab.show(panes.get(key), false);
        for (const [name, pane] of panes) {
          pane.hidden = name !== key;
          const button = buttons.get(name);
          button.classList.toggle("button-active", name === key);
          button.setAttribute("aria-selected", String(name === key));
          button.tabIndex = name === key ? 0 : -1;
        }
        content.scrollTop = 0;
        load(key);
      }
      const instance = app.sheet.create({
        el: sheet,
        containerEl: container,
        backdrop: true,
        push: true,
        swipeToClose: true,
        swipeHandler: handle,
        closeByBackdropClick: true,
        on: {
          closed() {
            closed = true;
            if (active?.element === sheet) active = undefined;
            // Let the shell restore its modal stack and focus before removing the sheet.
            setTimeout(() => {
              instance.destroy();
              sheet.remove();
            }, 0);
          },
        },
      });
      done.onclick = () =>
        instance.close(!matchMedia("(prefers-reduced-motion: reduce)").matches);
      active = {
        gene: gene.id,
        element: sheet,
        select,
        close: () => instance.close(false),
      };
      select(initial);
      instance.open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
    },
  };
}
