// F7 owns sortable headers; comparisons use raw values rather than rounded labels.
export function createResearchTables({ root, app }) {
  const controllers = new Map();
  let frame;
  function enhance() {
    frame = undefined;
    for (const [table, controller] of controllers)
      if (!table.isConnected) {
        controller.destroy();
        controllers.delete(table);
      }
    for (const table of root.querySelectorAll("table[data-sortable=true]")) {
      if (controllers.has(table)) continue;
      const headers = [...table.querySelectorAll("thead th")],
        body = table.tBodies[0];
      if (!body || headers.some((th) => th.colSpan !== 1)) continue;
      const wrapper =
        table.closest(".table-scroll,.network-table-scroll") || table;
      wrapper.classList.add("data-table", "research-data-table");
      const rows = [...body.rows];
      rows.forEach((row, index) => (row.dataset.originalOrder = String(index)));
      headers.forEach((header, index) => {
        header.scope = "col";
        const numeric =
          header.dataset.sortType === "number" ||
          rows.some((row) => row.cells[index]?.classList.contains("numeric"));
        header.dataset.sortType = numeric ? "number" : "text";
        header.classList.add(numeric ? "numeric-cell" : "label-cell");
        for (const row of rows)
          row.cells[index]?.classList.add(
            numeric ? "numeric-cell" : "label-cell",
          );
        if (!numeric) return;
        header.classList.add("sortable-cell");
        header.setAttribute("aria-sort", "none");
        const label = header.textContent,
          button = document.createElement("button");
        button.type = "button";
        button.className = "table-sort-button";
        button.textContent = label;
        button.setAttribute("aria-label", `Sort by ${label}`);
        header.replaceChildren(button);
      });
      function sort(event) {
        const header = event.target.closest("th");
        if (!header || header.dataset.sortType !== "number") return;
        const index = headers.indexOf(header),
          descending = header.classList.contains("sortable-desc");
        const numeric = header.dataset.sortType === "number";
        const current = [...body.rows];
        const value = (row) => {
          const cell = row.cells[index];
          const raw = cell?.dataset.sortValue ?? cell?.textContent ?? "";
          return raw === "" ? null : numeric ? Number(raw) : raw;
        };
        current.sort((a, b) => {
          const av = value(a),
            bv = value(b),
            missing = (value) =>
              value === null || (numeric && !Number.isFinite(value));
          if (missing(av) || missing(bv))
            return (
              Number(missing(av)) - Number(missing(bv)) ||
              Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder)
            );
          const order = av - bv;
          return (
            (descending ? -order : order) ||
            Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder)
          );
        });
        for (const th of headers.filter(
          (th) => th.dataset.sortType === "number",
        ))
          th.setAttribute(
            "aria-sort",
            th === header ? (descending ? "descending" : "ascending") : "none",
          );
        const fragment = document.createDocumentFragment();
        fragment.append(...current);
        body.append(fragment);
      }
      wrapper.addEventListener("datatable:sort", sort);
      const instance = app.dataTable.create({ el: wrapper });
      controllers.set(table, {
        destroy() {
          wrapper.removeEventListener("datatable:sort", sort);
          instance.destroy();
        },
      });
    }
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(enhance);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });
  schedule();
  return {
    destroy() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      for (const controller of controllers.values()) controller.destroy();
      controllers.clear();
    },
  };
}
