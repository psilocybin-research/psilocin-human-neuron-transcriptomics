import { createElement as node } from "./interface-utils.js";
let sequence = 0;
const expansion = new WeakMap();
// Options are visible in the controls panel; no selector opens a second modal.
export function analysisOptions(select, { expanded = false } = {}) {
  const field = node("details", "analysis-option-field");
  field.open = expansion.get(select) ?? expanded;
  field.ontoggle = () => expansion.set(select, field.open);
  const title = select.getAttribute("aria-label") || "Options";
  const heading = node("summary", "analysis-option-heading");
  heading.append(node("strong", "", title));
  const selected = node("span", "analysis-option-current", select.selectedOptions[0]?.textContent || "Choose an option");
  heading.append(selected);
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
  let previousGroup;
  for (const option of select.options) {
    const group =
      option.parentElement.tagName === "OPTGROUP" ? option.parentElement : null;
    if (group && group !== previousGroup)
      ul.append(node("li", "list-group-title", group.label));
    previousGroup = group;
    const li = node("li"),
      label = node("label", "item-radio item-content"),
      input = node("input");
    input.type = "radio";
    input.name = name;
    input.value = option.value;
    input.checked = option.selected;
    input.disabled = option.disabled || Boolean(group?.disabled);
    input.setAttribute("aria-label", option.textContent);
    const inner = node("div", "item-inner");
    inner.append(node("div", "item-title", option.textContent));
    label.append(input, node("i", "icon icon-radio"), inner);
    li.append(label);
    ul.append(li);
    input.onchange = () => {
      if (!input.checked) return;
      selected.textContent = option.textContent;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
  }
  list.append(ul);
  field.append(list);
  return field;
}
