import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Integrated searchable dropdown (trigger + search + list in one panel).
 */
export function SearchableDropdown({
  value = "",
  onChange,
  options = [],
  disabled = false,
  placeholder = "Select",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches",
  invalid = false,
  valid = false,
  id: idProp,
  ariaLabel,
}) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized = useMemo(
    () =>
      options.map((o) => {
        if (typeof o === "string") return { value: o, label: o, meta: "" };
        return {
          value: String(o.value ?? ""),
          label: String(o.label ?? o.value ?? ""),
          meta: String(o.meta ?? ""),
        };
      }),
    [options],
  );

  const selected = useMemo(
    () => normalized.find((o) => String(o.value) === String(value)),
    [normalized, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        o.meta.toLowerCase().includes(q),
    );
  }, [normalized, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  function pick(option) {
    onChange?.(option.value);
    setOpen(false);
  }

  const triggerState = invalid ? "error" : valid ? "valid" : undefined;

  return (
    <div className="search-dropdown" ref={rootRef}>
      <button
        type="button"
        id={idProp || autoId}
        className="search-dropdown-trigger input"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        data-state={triggerState}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className={`search-dropdown-value${selected ? "" : " is-placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`search-dropdown-chevron${open ? " is-open" : ""}`} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && !disabled ? (
        <div className="search-dropdown-panel" role="presentation">
          <div className="search-dropdown-search">
            <input
              ref={searchRef}
              type="search"
              className="search-dropdown-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoComplete="off"
            />
            <span className="search-dropdown-search-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <ul id={listId} className="search-dropdown-list" role="listbox" aria-label={ariaLabel}>
            {filtered.length === 0 ? (
              <li className="search-dropdown-empty">{emptyMessage}</li>
            ) : (
              filtered.map((o) => {
                const active = String(o.value) === String(value);
                return (
                  <li key={o.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`search-dropdown-option${active ? " is-selected" : ""}`}
                      onClick={() => pick(o)}
                    >
                      <span className="search-dropdown-option-label">{o.label}</span>
                      {o.meta ? <span className="search-dropdown-option-meta">{o.meta}</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
