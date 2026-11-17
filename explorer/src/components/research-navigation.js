// Native F7 accordion groups; independent expansion choices stay on this device.
import {
  createElement as node,
  readPreference as stored,
  writePreference as remember,
} from "./interface-utils.js";
export function createResearchNavigation({ nav, tabs, initial }) {
  const navList = node("ul"),
    navGroups = new Map();
  let groupChoices;
  try {
    groupChoices = JSON.parse(stored("atlas-navigation-groups-v2", "{}"));
  } catch {
    groupChoices = {};
  }
  if (
    !groupChoices ||
    typeof groupChoices !== "object" ||
    Array.isArray(groupChoices)
  )
    groupChoices = {};
  const originalButtons = [...nav.children];
  function sectionItem(id) {
    const b = originalButtons[tabs.findIndex((t) => t[0] === id)];
    b.dataset.section = id;
    b.className = "item-link item-content";
    const media = node("span", "item-media"),
      inner = node("span", "item-inner"),
      title = node("span", "item-title");
    media.append(b.firstChild);
    title.append(b.lastChild);
    inner.append(title);
    b.append(media, inner);
    const li = node("li");
    li.dataset.sectionItem = id;
    li.append(b);
    return li;
  }
  navList.append(sectionItem("overview"));
  for (const [key, title, sections] of [
    ["molecular", "Molecular evidence", ["landscape", "genes"]],
    ["pathways", "Pathways & comparisons", ["pathways", "comparison"]],
    ["confidence", "Confidence & interpretation", ["robustness", "dna"]],
  ]) {
    const opened = groupChoices[key] ?? key === "molecular",
      li = node(
        "li",
        `accordion-item${opened ? " accordion-item-opened" : ""}`,
      ),
      toggle = node(
        "button",
        "item-content accordion-item-toggle nav-group-toggle",
      ),
      inner = node("span", "item-inner"),
      label = node("span", "item-title", "");
    label.textContent = title;
    inner.append(label);
    toggle.append(inner);
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(opened));
    const content = node("div", "accordion-item-content");
    content.id = `nav-group-${key}`;
    toggle.setAttribute("aria-controls", content.id);
    if (!opened) content.setAttribute("aria-hidden", "true");
    const list = node("ul");
    for (const id of sections) {
      list.append(sectionItem(id));
      navGroups.set(id, li);
    }
    content.append(list);
    li.append(toggle, content);
    navList.append(li);
    const syncExpanded = (expanded) => {
      toggle.setAttribute("aria-expanded", String(expanded));
      content.inert = !expanded;
      groupChoices[key] = expanded;
      remember("atlas-navigation-groups-v2", JSON.stringify(groupChoices));
    };
    content.inert = !opened;
    li.addEventListener("accordion:open", () => syncExpanded(true));
    li.addEventListener("accordion:close", () => syncExpanded(false));
  }
  navList.append(sectionItem("methods"));
  nav.append(navList);

  return {
    activate(section) {
      const group = navGroups.get(section);
      for (const item of new Set(navGroups.values()))
        item.classList.toggle("nav-group-current", item === group);
    },
  };
}
