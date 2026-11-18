import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import {
  StreamLanguage,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { r } from "@codemirror/legacy-modes/mode/r";
import { tags } from "@lezer/highlight";
export function createREditor(value) {
  const host = document.createElement("div");
  host.className = "custom-r-editor";
  const view = new EditorView({
    doc: value,
    parent: host,
    extensions: [
      basicSetup,
      StreamLanguage.define(r),
      keymap.of([indentWithTab]),
      EditorView.contentAttributes.of({
        "aria-label": "R code",
        spellcheck: "false",
        autocapitalize: "off",
        autocorrect: "off",
      }),
      syntaxHighlighting(
        HighlightStyle.define([
          { tag: tags.keyword, color: "var(--r-keyword)" },
          {
            tag: [tags.string, tags.special(tags.string)],
            color: "var(--r-string)",
          },
          { tag: [tags.number, tags.bool], color: "var(--r-number)" },
          { tag: tags.comment, color: "var(--r-comment)", fontStyle: "italic" },
          { tag: tags.operator, color: "var(--r-keyword)" },
        ]),
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) host.dispatchEvent(new Event("input"));
      }),
    ],
  });
  Object.defineProperty(host, "value", {
    get: () => view.state.doc.toString(),
    set: (value) =>
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      }),
  });
  host.destroy = () => view.destroy();
  return host;
}
export { zip } from "fflate";
