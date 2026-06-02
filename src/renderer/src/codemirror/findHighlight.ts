import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { findMatches } from "../utils/findMatches";

export type FindHighlightSpec = {
  query: string;
  caseSensitive: boolean;
  activeIndex: number;
  navigated: boolean;
  enabled: boolean;
};

export const setFindHighlight = StateEffect.define<FindHighlightSpec>();

function buildDecorations(
  content: string,
  spec: FindHighlightSpec,
): DecorationSet {
  if (!spec.enabled || !spec.query) return Decoration.none;

  const matches = findMatches(content, spec.query, spec.caseSensitive);
  if (matches.length === 0) return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 0; i < matches.length; i++) {
    const { from, to } = matches[i];
    const active = spec.navigated && i === spec.activeIndex;
    builder.add(
      from,
      to,
      Decoration.mark({
        class: active ? "cm-findMatch cm-findMatch-active" : "cm-findMatch",
      }),
    );
  }
  return builder.finish();
}

const findHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    let next = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setFindHighlight)) {
        return buildDecorations(tr.state.doc.toString(), effect.value);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const findHighlightExtension = findHighlightField;

export function updateFindHighlight(
  view: EditorView,
  spec: FindHighlightSpec,
): void {
  view.dispatch({ effects: setFindHighlight.of(spec) });
}

export function clearFindHighlight(view: EditorView): void {
  updateFindHighlight(view, {
    query: "",
    caseSensitive: false,
    activeIndex: 0,
    navigated: false,
    enabled: false,
  });
}
