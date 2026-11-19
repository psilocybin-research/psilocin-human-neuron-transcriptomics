import { createElement as el } from "./interface-utils.js";
import { rExamples } from "./r-examples.js";

const contrasts = ["day1_vs_control", "day3_vs_control", "day3_vs_day1"];
export function buildResearchRecipe({
  recipe,
  gene = "GPX4",
  contrast = contrasts[0],
  effect = 0.5,
  alpha = 0.05,
}) {
  if (!contrasts.includes(contrast))
    throw Error("Select an archived contrast.");
  if (recipe === "volcano") {
    alpha = Number(alpha);
    if (!(alpha > 0 && alpha < 1))
      throw Error("Specify 0 < FDR threshold < 1.");
    return `# Archived gene estimates; exploratory display, not a refitted differential-expression test.\ncontrast_id <- "${contrast}"\nfdr_threshold <- ${alpha}\nresults <- subset(genes, contrast == contrast_id & selected)\nresults <- results[is.finite(results$log2FoldChange) & is.finite(results$padj), ]\nresults$display_neglog10_fdr <- -log10(pmax(results$padj, .Machine$double.xmin))\nplot(results$log2FoldChange, results$display_neglog10_fdr, pch=19, cex=.6,\n col=ifelse(results$padj < fdr_threshold, '#235780', '#9cabb5'),\n xlab='Archived log2 fold change', ylab='-log10 gene FDR', main=contrast_id)\nabline(h=-log10(fdr_threshold), lty=2, col='grey50')\n# Original adjusted values are retained; NA values are unavailable, not null results.\nprint(head(results))`;
  }
  if (recipe === "power") {
    effect = Number(effect);
    alpha = Number(alpha);
    if (!(effect > 0 && effect <= 5 && alpha > 0 && alpha < 1))
      throw Error("Specify effect > 0 (up to 5) and 0 < alpha < 1.");
    return `# Hypothetical design calculation; not estimated power of the source study.\n# Two independent groups, equal n, known common variance, two-sided normal test.\n# This approximation ignores donor/block dependence, multiple testing and count dispersion.\nstandardized_effect <- ${effect}\nalpha <- ${alpha}\nn_per_group <- 3:100\ncritical <- qnorm(1 - alpha/2)\nnoncentrality <- standardized_effect * sqrt(n_per_group/2)\nresults <- data.frame(n_per_group, power = pnorm(-critical-noncentrality) + 1-pnorm(critical-noncentrality))\nprint(results)\nplot(results$n_per_group, results$power, type='l', ylim=c(0,1),\n xlab='Independent biological units per group', ylab='Approximate power',\n main='Hypothetical independent-group design')\nabline(h=.8, lty=2, col='grey50')\n# Native RNA-seq power analysis requires an appropriate dispersion model and design.`;
  }
  const example = rExamples.find((item) => item.id === recipe);
  if (!example) throw Error("Choose a supported R recipe.");
  const literal = JSON.stringify(
    String(gene)
      .replace(/[\u0000-\u001f]/g, "")
      .slice(0, 120),
  );
  return example.code
    .replace(/gene_symbol <- "GPX4"/, `gene_symbol <- ${literal}`)
    .replace(
      /contrast_id <- "day1_vs_control"/,
      `contrast_id <- "${contrast}"`,
    );
}
export function createRRecipeBuilder({ action, onGenerate, onStatus }) {
  const host = el("details", "research-studio-builder");
  host.append(el("summary", "", "Generate an editable analysis recipe"));
  const fields = el("div", "custom-r-toolbar");
  const recipe = el("select"),
    gene = el("input"),
    contrast = el("select"),
    effect = el("input"),
    alpha = el("input");
  recipe.setAttribute("aria-label", "Recipe template");
  for (const item of [
    ...rExamples,
    { id: "power", title: "Hypothetical independent-group power" },
    { id: "volcano", title: "Archived gene volcano" },
  ]) {
    const option = el("option", "", item.title);
    option.value = item.id;
    recipe.append(option);
  }
  gene.type = "text";
  gene.value = "GPX4";
  gene.maxLength = 120;
  for (const value of contrasts) {
    const option = el("option", "", value);
    option.value = value;
    contrast.append(option);
  }
  effect.type = alpha.type = "number";
  effect.value = "0.5";
  effect.min = "0.01";
  effect.max = "5";
  effect.step = ".1";
  alpha.value = ".05";
  alpha.min = ".001";
  alpha.max = ".99";
  alpha.step = ".01";
  function field(label, input) {
    const wrap = el("label", "research-studio-field", label);
    wrap.append(input);
    fields.append(wrap);
    return wrap;
  }
  fields.append(recipe);
  const geneField = field("Source gene symbol", gene),
    contrastField = field("Contrast", contrast),
    effectField = field("Hypothetical standardized effect", effect),
    alphaField = field("Type I error rate", alpha);
  const update = () => {
    const power = recipe.value === "power";
    geneField.hidden = !["gene", "profiles"].includes(recipe.value);
    contrastField.hidden = !["pathways", "threshold", "volcano"].includes(
      recipe.value,
    );
    effectField.hidden = !power;
    alphaField.hidden = !power && recipe.value !== "volcano";
  };
  recipe.onchange = update;
  update();
  host.append(
    fields,
    action("Add generated R cell", "plus", () => {
      try {
        onGenerate(
          buildResearchRecipe({
            recipe: recipe.value,
            gene: gene.value,
            contrast: contrast.value,
            effect: effect.value,
            alpha: alpha.value,
          }),
        );
      } catch (error) {
        onStatus(error.message);
      }
    }),
    el(
      "p",
      "note",
      "Generating a recipe does not run it. Inspect and edit the complete R code before execution; outputs remain exploratory.",
    ),
  );
  return host;
}
