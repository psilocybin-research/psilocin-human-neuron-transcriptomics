import { createElement as node } from "./interface-utils.js";
let sequence = 0;
// Options are visible in the controls panel; no selector opens a second modal.
export function analysisOptions(select) {
  const field = node("section", "analysis-option-field");
  const title = select.getAttribute("aria-label") || "Options";
  const heading = node("h3", "", title);
  heading.id = `analysis-option-title-${++sequence}`;
  field.append(heading);
  field.setAttribute("role", "group");
  field.setAttribute("aria-labelledby", heading.id);
  if (select.disabled) {
    field.hidden = true;
    return field;
  }
  const list = node(
      "div",
      "list list-strong list-dividers analysis-option-list",
    ),
    ul = node("ul");
  const name = `analysis-option-${sequence}`;
  for (const option of select.options) {
    const li = node("li"),
      label = node("label", "item-radio item-content"),
      input = node("input");
    input.type = "radio";
    input.name = name;
    input.value = option.value;
    input.checked = option.selected;
    input.disabled = option.disabled;
    input.setAttribute("aria-label", option.textContent);
    const inner = node("div", "item-inner");
    inner.append(node("div", "item-title", option.textContent));
    label.append(input, node("i", "icon icon-radio"), inner);
    li.append(label);
    ul.append(li);
    input.onchange = () => {
      if (!input.checked) return;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
  }
  list.append(ul);
  field.append(list);
  return field;
}
