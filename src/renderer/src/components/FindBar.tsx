import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFindHighlights } from "../hooks/useFindHighlights";
import { useStore } from "../store";
import { findMatches } from "../utils/findMatches";

export function FindBar() {
  const findOpen = useStore((s) => s.findOpen);
  const activePath = useStore((s) => s.activePath);
  const content = useStore((s) => s.content);
  const findQuery = useStore((s) => s.findQuery);
  const findCaseSensitive = useStore((s) => s.findCaseSensitive);
  const findMatchIndex = useStore((s) => s.findMatchIndex);
  const findNavigated = useStore((s) => s.findNavigated);
  const setFindQuery = useStore((s) => s.setFindQuery);
  const toggleFindCase = useStore((s) => s.toggleFindCase);
  const findNext = useStore((s) => s.findNext);
  const findPrevious = useStore((s) => s.findPrevious);
  const closeFind = useStore((s) => s.closeFind);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = findMatches(content, findQuery, findCaseSensitive);
  const matchLabel = !findQuery
    ? ""
    : matches.length === 0
      ? "No matches"
      : findNavigated
        ? `${findMatchIndex + 1} of ${matches.length}`
        : `${matches.length} match${matches.length === 1 ? "" : "es"}`;

  useEffect(() => {
    if (!findOpen) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [findOpen]);

  useFindHighlights();

  if (!findOpen || !activePath) return null;

  return (
    <div className="find-bar" role="search">
      <input
        ref={inputRef}
        className="find-bar-input"
        type="text"
        value={findQuery}
        placeholder="Find in file"
        aria-label="Find in file"
        onChange={(event) => setFindQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) findPrevious();
            else findNext();
          } else if (event.key === "Escape") {
            event.preventDefault();
            closeFind();
          }
        }}
      />
      <span className="find-bar-status" aria-live="polite">
        {matchLabel}
      </span>
      <label className="find-bar-case">
        <input
          type="checkbox"
          checked={findCaseSensitive}
          onChange={() => toggleFindCase()}
        />
        Match case
      </label>
      <button
        type="button"
        className="find-bar-btn"
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
        onClick={() => findPrevious()}
        disabled={matches.length === 0}
      >
        <ChevronUp size={16} />
      </button>
      <button
        type="button"
        className="find-bar-btn"
        title="Next match (Enter)"
        aria-label="Next match"
        onClick={() => findNext()}
        disabled={matches.length === 0}
      >
        <ChevronDown size={16} />
      </button>
      <button
        type="button"
        className="find-bar-btn"
        title="Close (Escape)"
        aria-label="Close find"
        onClick={() => closeFind()}
      >
        <X size={16} />
      </button>
    </div>
  );
}
