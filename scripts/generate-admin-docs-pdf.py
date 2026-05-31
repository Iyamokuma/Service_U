#!/usr/bin/env python3
"""Build ADMIN_DASHBOARD_GUIDE.pdf from markdown via HTML + Chrome headless."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MD = ROOT / "docs" / "ADMIN_DASHBOARD_GUIDE.md"
HTML = ROOT / "docs" / "ADMIN_DASHBOARD_GUIDE.html"
PDF = ROOT / "docs" / "ADMIN_DASHBOARD_GUIDE.pdf"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
]

CSS = """
@page { margin: 18mm 16mm; size: A4; }
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.55;
  color: #1a1a1a;
  max-width: 210mm;
  margin: 0 auto;
  padding: 12px 8px 48px;
}
h1 { font-size: 22pt; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-top: 0; color: #1e3a5f; }
h2 { font-size: 15pt; margin-top: 28px; color: #1e3a5f; page-break-after: avoid; }
h3 { font-size: 12.5pt; margin-top: 20px; color: #2d4a6f; page-break-after: avoid; }
h4 { font-size: 11pt; margin-top: 14px; color: #333; }
p, li { orphans: 3; widows: 3; }
ul, ol { padding-left: 1.4em; }
li { margin-bottom: 0.35em; }
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
  margin: 12px 0 16px;
  page-break-inside: avoid;
}
th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #eef2f7; font-weight: 600; }
tr:nth-child(even) td { background: #f9fafb; }
code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 0.92em; }
hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
blockquote {
  margin: 12px 0;
  padding: 10px 14px;
  border-left: 4px solid #1e3a5f;
  background: #f5f8fc;
  color: #333;
}
.cover-meta { color: #555; font-size: 10pt; margin-bottom: 24px; }
.toc { background: #f8f9fb; padding: 16px 20px; border-radius: 6px; margin: 20px 0; }
.toc ul { list-style: none; padding-left: 0; }
.toc li { margin: 4px 0; }
.toc a { color: #1e3a5f; text-decoration: none; }
.role-section { page-break-before: always; }
@media print {
  a { color: inherit; text-decoration: none; }
  .no-print { display: none; }
}
"""


def find_chrome() -> str | None:
    for path in CHROME_CANDIDATES:
        if Path(path).is_file():
            return path
    return None


def main() -> int:
    try:
        import markdown  # type: ignore
    except ImportError:
        print("Installing markdown package…", file=sys.stderr)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "markdown", "-q"])
        import markdown  # type: ignore

    if not MD.is_file():
        print(f"Missing source: {MD}", file=sys.stderr)
        return 1

    text = MD.read_text(encoding="utf-8")
    body = markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "toc"],
        extension_configs={"toc": {"permalink": False, "toc_depth": 3}},
    )

    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Salvation Ministries — Admin Dashboard Guide</title>
  <style>{CSS}</style>
</head>
<body>
{body}
<p class="no-print" style="margin-top:48px;font-size:9pt;color:#888;">
  Generated from ADMIN_DASHBOARD_GUIDE.md — open this HTML in a browser and use Print → Save as PDF if needed.
</p>
</body>
</html>
"""

    HTML.write_text(html_doc, encoding="utf-8")
    print(f"Wrote {HTML}")

    chrome = find_chrome()
    if not chrome:
        print("Chrome/Chromium not found — HTML only. Open the HTML file and Print → Save as PDF.", file=sys.stderr)
        return 0

    html_uri = HTML.resolve().as_uri()
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        f"--print-to-pdf={PDF.resolve()}",
        html_uri,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"Wrote {PDF}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
