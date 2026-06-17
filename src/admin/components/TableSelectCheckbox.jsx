import { useEffect, useRef } from "react";

export function TableSelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  ariaLabel = "Select row",
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      className="sa-table-select-checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
    />
  );
}
