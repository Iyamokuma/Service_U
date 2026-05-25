/**
 * Client-side CSV export. Escapes values per RFC 4180 and triggers a
 * browser download with the given filename.
 */

function escapeCell(value) {
  const s = String(value ?? "").replace(/\r?\n/g, " ");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ columns: Array<{ key: string, label: string, format?: (v: unknown, row: Record<string, unknown>) => string }>, filename?: string }} opts
 */
export function exportCsv(rows, { columns, filename = "export.csv" }) {
  if (!rows.length) return;
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = row[c.key];
          const val = c.format ? c.format(raw, row) : raw;
          return escapeCell(val);
        })
        .join(","),
    )
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
