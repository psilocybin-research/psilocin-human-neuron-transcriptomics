// Helpers emit one versioned scene per execution; the last helper call replaces the prior scene.
// They describe exact numerical points, archived membership overlays, or structure references.
// No helper invents molecular coordinates, causal edges, subcellular localization or anatomy.
// atlas_mitochondria is explicitly an archived respiratory-complex membership overlay.
// Native R/Python scripts may override atlas.scene.file / ATLAS_SCENE_FILE for portable exports.
// The application validates every output and supplies the execution hash and timestamp.
export const SCIENTIFIC_R_HELPERS = String.raw`
.atlas_json_string <- function(x) {
  points <- utf8ToInt(enc2utf8(as.character(x)))
  escaped <- vapply(points, function(n) {
    if (n == 34L) return('\\"')
    if (n == 92L) return('\\\\')
    if (n < 32L) return(sprintf('\\u%04x', n))
    intToUtf8(n)
  }, character(1))
  paste0('"', paste0(escaped, collapse = ''), '"')
}
.atlas_json <- function(x) {
  if (is.null(x)) return('null')
  if (is.list(x)) {
    values <- vapply(x, .atlas_json, character(1))
    if (!is.null(names(x))) return(paste0('{', paste0(vapply(names(x), .atlas_json_string, character(1)), ':', values, collapse = ','), '}'))
    return(paste0('[', paste0(values, collapse = ','), ']'))
  }
  if (length(x) != 1L || is.na(x)) stop('Scene values must be scalar and nonmissing.')
  if (is.character(x)) return(.atlas_json_string(x))
  if (is.logical(x)) return(if (x) 'true' else 'false')
  if (is.numeric(x) && is.finite(x)) return(sprintf('%.17g', x))
  stop('Unsupported scene value.')
}
.atlas_write_scene <- function(spec) {
  path <- getOption('atlas.scene.file', '/home/web_user/atlas_scene.json')
  writeLines(.atlas_json(spec), path, useBytes = TRUE)
  invisible(spec)
}
.atlas_scene_base <- function(kind, title) list(schema = 'psilocin-atlas/scientific-scene/1', kind = kind, classification = 'user-exploratory', title = title, source = list(label = 'R notebook output'))
.atlas_scene_rows <- function(data, fields, id) {
  if (!is.data.frame(data) || nrow(data) < 1L || nrow(data) > 50000L) stop('Use a data.frame with 1–50000 rows.')
  if (!all(c(id, unname(fields)) %in% names(data))) stop('Required scene columns are missing.')
  ids <- as.character(data[[id]])
  if (anyNA(ids) || any(!nzchar(trimws(ids))) || anyDuplicated(ids)) stop('Scene identifiers must be unique and nonempty.')
  for (field in fields) if (!is.numeric(data[[field]]) || any(!is.finite(data[[field]]))) stop('Scene numerical columns must contain finite numbers; filter missing values explicitly.')
  lapply(seq_len(nrow(data)), function(i) {
    row <- list(id = ids[[i]])
    for (key in names(fields)) row[[key]] <- data[[fields[[key]]]][[i]]
    row
  })
}
atlas_scatter3d <- function(data, x, y, z, color = NULL, id = 'id', title = 'Exploratory 3D scatter plot') {
  fields <- c(x = x, y = y, z = z)
  if (!is.null(color)) fields <- c(fields, color = color)
  spec <- .atlas_scene_base('scatter3d', title)
  spec$axes <- list(x = x, y = y, z = z)
  if (!is.null(color)) spec$color_label <- color
  spec$data <- .atlas_scene_rows(data, fields, id)
  .atlas_write_scene(spec)
}
atlas_network <- function(data, value, id = 'id', title = 'Exploratory membership overlay') {
  spec <- .atlas_scene_base('membership-overlay', title)
  spec$value_label <- value
  spec$data <- .atlas_scene_rows(data, c(value = value), id)
  .atlas_write_scene(spec)
}
atlas_structure <- function(gene, title = 'Protein structure context') {
  if (!is.character(gene) || length(gene) != 1L || is.na(gene) || !nzchar(trimws(gene))) stop('Supply one exact gene identifier or symbol.')
  spec <- .atlas_scene_base('structure-reference', title)
  spec$gene <- gene
  .atlas_write_scene(spec)
}
atlas_scene <- function(data, scene = c('scatter3d', 'network', 'structure'), ...) {
  # A complete specification is accepted as a list and validated by the client.
  if (is.list(data) && !is.data.frame(data) && identical(data$schema, 'psilocin-atlas/scientific-scene/1')) {
    data$classification <- 'user-exploratory'
    return(.atlas_write_scene(data))
  }
  scene <- match.arg(scene)
  switch(scene, scatter3d = atlas_scatter3d(data, ...), network = atlas_network(data, ...), structure = atlas_structure(data, ...))
}
atlas_overlay <- function(data, value, ...) atlas_network(data, value, ...)
atlas_mitochondria <- function(data, value, id = 'id', title = 'Respiratory-complex membership overlay') {
  # Membership schematic only: positions are not measured mitochondrial anatomy.
  atlas_network(data, value, id = id, title = title)
}
`;
export const SCIENTIFIC_PYTHON_HELPERS = String.raw`
import json as _atlas_json
import math as _atlas_math
from pathlib import Path as _AtlasPath

def _atlas_records(data):
    if hasattr(data, "to_dict"):
        return data.to_dict(orient="records")
    return list(data)

def _atlas_scene_base(kind, title):
    return {"schema": "psilocin-atlas/scientific-scene/1", "kind": kind,
            "classification": "user-exploratory", "title": title,
            "source": {"label": "Python notebook output"}}

def _atlas_write_scene(spec):
    _AtlasPath(globals().get("ATLAS_SCENE_FILE", "/home/pyodide/atlas_scene.json")).write_text(
        _atlas_json.dumps(spec, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    return spec

def _atlas_scene_rows(data, fields, id):
    records = _atlas_records(data)
    if not 1 <= len(records) <= 50000:
        raise ValueError("Use 1–50000 rows.")
    rows, ids = [], set()
    for record in records:
        identifier = record[id]
        if identifier is None or not str(identifier).strip() or str(identifier) in ids:
            raise ValueError("Scene identifiers must be unique and nonempty.")
        identifier = str(identifier)
        ids.add(identifier)
        row = {"id": identifier}
        for key, field in fields.items():
            value = record[field]
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not _atlas_math.isfinite(value):
                raise ValueError("Scene numerical columns must be finite; filter missing values explicitly.")
            row[key] = value
        rows.append(row)
    return rows

def atlas_scatter3d(data, x, y, z, color=None, id="id", title="Exploratory 3D scatter plot"):
    spec = _atlas_scene_base("scatter3d", title)
    fields = {"x": x, "y": y, "z": z}
    if color is not None:
        fields["color"] = color
        spec["color_label"] = color
    spec["axes"] = {"x": x, "y": y, "z": z}
    spec["data"] = _atlas_scene_rows(data, fields, id)
    return _atlas_write_scene(spec)

def atlas_network(data, value, id="id", title="Exploratory membership overlay"):
    spec = _atlas_scene_base("membership-overlay", title)
    spec["value_label"] = value
    spec["data"] = _atlas_scene_rows(data, {"value": value}, id)
    return _atlas_write_scene(spec)

def atlas_structure(gene, title="Protein structure context"):
    if not isinstance(gene, str) or not gene.strip():
        raise ValueError("Supply one exact gene identifier or symbol.")
    spec = _atlas_scene_base("structure-reference", title)
    spec["gene"] = gene
    return _atlas_write_scene(spec)

def atlas_scene(data, scene="scatter3d", **kwargs):
    if isinstance(data, dict) and data.get("schema") == "psilocin-atlas/scientific-scene/1":
        return _atlas_write_scene({**data, "classification": "user-exploratory"})
    dispatch = {"scatter3d": atlas_scatter3d, "network": atlas_network, "structure": atlas_structure}
    if scene not in dispatch:
        raise ValueError("Supported scenes: scatter3d, network, structure.")
    return dispatch[scene](data, **kwargs)

def atlas_overlay(data, value, **kwargs):
    return atlas_network(data, value, **kwargs)

def atlas_mitochondria(data, value, id="id", title="Respiratory-complex membership overlay"):
    # Membership schematic only; no measured mitochondrial anatomy is claimed.
    return atlas_network(data, value, id=id, title=title)
`;

export const SCIENTIFIC_R_SCATTER_EXAMPLE = `# Descriptive archived estimates, not a new statistical test.
# The original gene-level BH-adjusted p values remain unchanged.
scene_data <- subset(genes, selected & contrast == "day3_vs_control" &
                     is.finite(log2FoldChange) & is.finite(lfcSE) & is.finite(padj))
atlas_scatter3d(scene_data, x = "log2FoldChange", y = "lfcSE", z = "padj",
                color = "log2FoldChange", id = "id",
                title = "Day 3 estimates, uncertainty and adjusted p values")`;
