#!/usr/bin/env python3
"""Bundle index.html, css/style.css, and js/*.js into standalone gemmets-resa.html."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
JS_ORDER = [
    "js/audio.js",
    "js/sketch2d.js",
    "js/textures3d.js",
    "js/levels.js",
    "js/book.js",
    "js/player.js",
    "js/main.js",
]

LOCAL_IMPORT_RE = re.compile(r"^\s*import\s+(?:[\s\S]*?\s+from\s+)?['\"]\.\/[^'\"]+['\"];\s*$", re.MULTILINE)
THREE_IMPORT_RE = re.compile(r"^\s*import\s+\*\s+as\s+THREE\s+from\s+['\"]three['\"];\s*$", re.MULTILINE)
EXPORT_RE = re.compile(r"^\s*export\s+(?=(?:const|let|var|function|class)\b)", re.MULTILINE)


def strip_module_syntax(code: str) -> str:
    code = LOCAL_IMPORT_RE.sub("", code)
    code = THREE_IMPORT_RE.sub("", code)
    code = EXPORT_RE.sub("", code)
    return code.strip()


def build() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css/style.css").read_text(encoding="utf-8").strip()

    js_parts = []
    for rel_path in JS_ORDER:
        src = (ROOT / rel_path).read_text(encoding="utf-8")
        cleaned = strip_module_syntax(src)
        js_parts.append(f"// --- {rel_path} ---\n{cleaned}")
    bundled_js = "\n\n".join(js_parts)

    html = html.replace(
        '<link rel="stylesheet" href="css/style.css" />',
        f"<style>\n{css}\n  </style>",
    )
    html = html.replace(
        '<script type="module" src="js/main.js"></script>',
        f"<script type=\"module\">\nimport * as THREE from 'three';\n{bundled_js}\n  </script>",
    )

    out_path = ROOT / "gemmets-resa.html"
    out_path.write_text(html, encoding="utf-8")
    print(f"Built {out_path.name} ({len(html):,} bytes)")


if __name__ == "__main__":
    build()
