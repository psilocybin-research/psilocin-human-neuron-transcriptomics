import { loadLocalContext } from "./local-public-context.js";
import {
  createElement as el,
  loadingMessage,
  escapeHTML,
  createAccordion,
  useModalPush,
  destroySheet,
} from "./interface-utils.js";
import {
  createAnnotationClient,
  ensemblIdentity,
} from "./gene-annotation-data.js";
import { trackActivity } from "./app-activity.js";
import { uiIcon } from "./icons.js";
import { enhancePlots } from "./figure-controls.js";
const client = createAnnotationClient({ localLookup: loadLocalContext });
let sequence = 0,
  active;
function sourceLink(text, href) {
  const link = el("a", "external", text);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
async function annotation(gene, { live = false } = {}) {
  const record = await client.lookup(gene.id, { live }),
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
      "Gene version at retrieval",
      record.version === null
        ? "Not supplied"
        : `${record.id}.${record.version}`,
    ],
    ["Archived gene ID", gene.id],
    ["Retrieved (UTC)", record.retrievedAt],
  ])
    fields.append(el("dt", "", name), el("dd", "", String(value)));
  result.append(
    el(
      "p",
      "note",
      record.snapshot
        ? "Dated local Ensembl snapshot · available offline. Source descriptions and attribution are retained; this is external context, not an experimental result."
        : "Live Ensembl response · external context.",
    ),
  );
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
// Consent covers this exact provider set across genes and visits.
// Changing a provider hostname changes the key and requires fresh confirmation.
const connectionConsentKey =
  "atlas-public-context-consent-v2:" +
  [
    "rest.ensembl.org",
    "rest.uniprot.org",
    "files.rcsb.org",
    "alphafold.ebi.ac.uk",
  ]
    .sort()
    .join(",");
let connectionAccepted = false;
function hasConnectionConsent() {
  if (connectionAccepted) return true;
  try {
    return localStorage.getItem(connectionConsentKey) === "accepted";
  } catch {
    return false;
  }
}
function confirmConnection(app, gene) {
  if (hasConnectionConsent()) return Promise.resolve(true);
  if (app.el.querySelector(".gene-connection-confirmation"))
    return Promise.resolve(false);
  return new Promise((resolve) => {
    let accepted = false;
    let rememberToggle;
    const label = (icon, text) =>
      `${uiIcon(icon).outerHTML}<span>${text}</span>`;
    const container =
      document.fullscreenElement || document.webkitFullscreenElement || app.el;
    const dialog = app.dialog.create({
      containerEl: container,
      title: label("information", "Connect to public databases?"),
      content: `<p>Retrieve public information for <strong>${escapeHTML(gene.symbol)}</strong> (${escapeHTML(gene.id)})?</p><p>External databases receive the identifier and your network address. Archived expression data are not uploaded. </p><label class="gene-connection-remember"><span>Remember my choice for these databases</span><span class="toggle"><input type="checkbox" role="switch" name="remember-public-databases"><span class="toggle-icon" aria-hidden="true"></span></span></label>`,
      cssClass: "research-message-dialog gene-connection-confirmation",
      closeByBackdropClick: true,
      destroyOnClose: true,
      buttons: [
        { text: label("close", "Cancel") },
        {
          text: label("done", "Connect"),
          strong: true,
          onClick: () => {
            accepted = true;
            if (
              dialog.el.querySelector('[name="remember-public-databases"]')
                .checked
            ) {
              connectionAccepted = true;
              try {
                localStorage.setItem(connectionConsentKey, "accepted");
              } catch {
                // Retain remembered consent for this visit when storage is unavailable.
              }
            }
          },
        },
      ],
      on: {
        closed() {
          rememberToggle?.destroy();
          if (container !== app.el && dialog.backdropEl)
            app.el.append(dialog.backdropEl);
          resolve(accepted);
        },
      },
    });
    const details = createAccordion(
      "Connection details",
      "gene-connection-details",
    );
    const stableId = ensemblIdentity(gene.id).stableId;
    for (const [title, text] of [
      [
        "Ensembl · rest.ensembl.org",
        `Gene tab: sends ${stableId}; requests description, biotype, assembly, coordinates, strand and annotation version.`,
      ],
      [
        "UniProt · rest.uniprot.org",
        `Protein or 3D tab: searches human Ensembl cross-references for ${stableId}; requests protein accessions, names, sequences, features and structure references (up to 25 records).`,
      ],
      [
        "RCSB PDB · files.rcsb.org",
        "3D tab: the first linked PDB model opens automatically. Sends its PDB ID to download atomic coordinates; other models load when selected.",
      ],
      [
        "AlphaFold · alphafold.ebi.ac.uk",
        "Only when you choose prediction lookup: sends the selected UniProt accession; requests model metadata and downloads coordinates when opened. Sequence matching happens locally.",
      ],
    ])
      details.body.append(el("strong", "", title), el("p", "", text));
    details.body.append(
      el(
        "p",
        "",
        "Requests omit credentials and the page referrer. Information is reused in memory during this visit. Cancel makes no connection. When remembered, approval applies to these four databases; a changed provider set requires confirmation again. Clearing browser storage removes this approval. Provider links open external sites only when clicked.",
      ),
    );
    rememberToggle = app.toggle.create({
      el: dialog.el.querySelector(".gene-connection-remember .toggle"),
    });
    dialog.el.querySelector(".dialog-inner").append(details.element);
    if (container !== app.el && dialog.backdropEl)
      container.append(dialog.backdropEl);
    dialog.open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  });
}
// Public information has its own native F7 sheet; archived evidence stays in place.
export function geneAnnotation(gene) {
  return {
    async open(initial = "gene", preferredModel) {
      const root = document.querySelector("#psilocin-app"),
        app = root?.f7;
      if (!app) return;
      if (active?.gene === gene.id && !preferredModel) {
        active.select(initial);
        return;
      }
      const local = await loadLocalContext(gene.id);
      if (!local && !(await confirmConnection(app, gene))) return;
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
      const sendToR = el("button", "button button-tonal labelled-icon-action");
      sendToR.type = "button";
      sendToR.setAttribute("aria-label", `Send ${gene.symbol} to R Studio`);
      sendToR.title = "Send this exact archived gene to R Studio";
      sendToR.append(uiIcon("custom-r"), el("span", "", "To R"));
      const done = el("button", "button button-tonal labelled-icon-action");
      done.type = "button";
      done.append(uiIcon("done"), el("span", "", "Done"));
      header.append(identity, sendToR, done);
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
          "Dated public annotations and structural models are external context, not measurements of a psilocin response. Archived expression estimates and pathway memberships remain unchanged.",
        ),
      );
      let live = false,
        authorized = !local;
      async function authorizeSession() {
        if (authorized) return true;
        authorized = await confirmConnection(app, gene);
        return authorized;
      }
      const refresh = el("button", "button button-tonal labelled-icon-action");
      refresh.type = "button";
      refresh.disabled = !navigator.onLine;
      refresh.append(
        uiIcon("share"),
        el("span", "", "Load live database updates"),
      );
      content.append(refresh);
      const tabs = el("div", "tabs"),
        panes = new Map(),
        buttons = new Map(),
        loaded = new Set();
      refresh.onclick = async () => {
        if (!(await authorizeSession())) return;
        live = true;
        loaded.clear();
        const key =
          [...buttons].find(
            ([, button]) => button.getAttribute("aria-selected") === "true",
          )?.[0] || "gene";
        select(key);
      };
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
      content.prepend(tabs);
      sheet.append(handle, header, navigation, content);
      const container =
        document.fullscreenElement || document.webkitFullscreenElement || root;
      container.append(sheet);
      let closed = false;
      function openInitialStructure(key, pane) {
        if (key !== "structures" || pane.hidden || pane.dataset.modelOpened)
          return;
        const button = pane.querySelector(
          local && !live
            ? ".protein-structure-access [data-open-structure][data-offline-available=true]"
            : ".protein-structure-access [data-open-structure]",
        );
        if (!button) return;
        pane.dataset.modelOpened = "true";
        button.click();
      }
      async function load(key) {
        if (loaded.has(key)) {
          openInitialStructure(key, panes.get(key));
          return;
        }
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
              ? annotation(gene, { live })
              : import("./protein-context.js").then(({ proteinContext }) =>
                  proteinContext(gene, {
                    view: key,
                    live,
                    authorize: authorizeSession,
                    preferredModel,
                  }),
                ),
            "Loading public gene information",
          );
          if (closed) return;
          pane.replaceChildren(result);
          enhancePlots(pane, { nested: true });
          openInitialStructure(key, pane);
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
        push: useModalPush(),
        swipeToClose: true,
        swipeHandler: handle,
        closeByBackdropClick: true,
        on: {
          closed() {
            closed = true;
            if (active?.element === sheet) active = undefined;
            // Let the shell restore its modal stack and focus before removing the sheet.
            setTimeout(() => {
              destroySheet(instance);
              sheet.remove();
            }, 0);
          },
        },
      });
      done.onclick = () =>
        instance.close(!matchMedia("(prefers-reduced-motion: reduce)").matches);
      sendToR.onclick = () => {
        const dispatch = () =>
          root.dispatchEvent(
            new CustomEvent("atlas:send-gene-to-r", { detail: { gene: gene.id } }),
          );
        if (instance.opened) {
          instance.once("closed", dispatch);
          instance.close(!matchMedia("(prefers-reduced-motion: reduce)").matches);
        } else dispatch();
      };
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
