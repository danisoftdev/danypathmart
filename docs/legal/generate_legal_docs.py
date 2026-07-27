#!/usr/bin/env python3
"""Generate DanyPathMart legal policy Word documents from docs/legal/policies/*.md."""

from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT_DIR = Path(__file__).resolve().parent
WORD_DIR = OUT_DIR / "word"
POLICIES_DIR = OUT_DIR / "policies"
SITE_URL = "https://danypathmart.store"
BRAND_GREEN = RGBColor(0x1B, 0x5E, 0x20)
MUTED = RGBColor(0x55, 0x55, 0x55)
NOTE_FILL = "FFF3E0"

POLICY_FILES: list[tuple[str, str, str, str]] = [
    ("terms.md", "01_Terms_and_Conditions.docx", "Terms of Service", "terms"),
    ("privacy.md", "02_Privacy_Policy.docx", "Privacy Policy", "privacy"),
    ("cookies.md", "03_Cookies_Policy.docx", "Cookies Policy", "cookies"),
    ("shop-seller-policy.md", "04_Shop_Seller_Policy.docx", "Shop Seller Policy", "shop-seller-policy"),
    ("payments.md", "05_Payment_Policy.docx", "Payment Policy", "payments"),
    ("returns.md", "06_Returns_and_Refunds_Policy.docx", "Returns & Refunds Policy", "returns"),
    ("acceptable-use.md", "07_Acceptable_Use_Policy.docx", "Acceptable Use Policy", "acceptable-use"),
    ("complaints-disputes.md", "08_Complaints_and_Disputes.docx", "Complaints & Disputes Policy", "complaints-disputes"),
    ("seller-handbook.md", "09_Seller_Handbook.docx", "Seller Handbook", "seller-handbook"),
]

SECTION_RE = re.compile(r"^(\d+)\.\s+(.+)$")
CHECKLIST_RE = re.compile(r"^[☐☑]\s")
BULLET_RE = re.compile(r"^[•\-]\s+")


def set_cell_shading(cell, fill: str) -> None:
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(shading)


def heading(doc: Document, text: str, level: int = 1) -> None:
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        if level == 1:
            run.font.color.rgb = BRAND_GREEN


def body(doc: Document, text: str, *, italic: bool = False, size: int = 11) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.italic = italic


def add_note_box(doc: Document, text: str) -> None:
    table = doc.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    cell = table.rows[0].cells[0]
    set_cell_shading(cell, NOTE_FILL)
    p = cell.paragraphs[0]
    run = p.add_run(text)
    run.italic = True
    run.font.size = Pt(10)
    run.font.color.rgb = MUTED
    doc.add_paragraph()


def add_policy_header(doc: Document, title: str, slug: str, last_updated: str) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("DanyPathMart")
    r.bold = True
    r.font.size = Pt(18)
    r.font.color.rgb = BRAND_GREEN

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sr = sub.add_run(SITE_URL)
    sr.font.size = Pt(10)
    sr.font.color.rgb = MUTED

    doc.add_paragraph()
    heading(doc, title)

    meta = doc.add_paragraph()
    meta.add_run("Last updated: ").bold = True
    meta.add_run(last_updated)
    meta.add_run("  ·  CMS slug: ")
    slug_run = meta.add_run(slug)
    slug_run.italic = True
    meta.add_run("  ·  Public URL: ")
    meta.add_run(f"{SITE_URL}/policies/{slug}")

    add_note_box(
        doc,
        "Operating status: DanyPathMart is currently run as an online business at "
        f"{SITE_URL} and is not yet formally registered in Ghana. Policies will be "
        "updated when registration is completed. Not legal advice — have a qualified "
        "Ghana lawyer review before heavy marketing.",
    )


def is_note_line(line: str) -> bool:
    lowered = line.lower()
    return (
        lowered.startswith("operating note:")
        or lowered.startswith("operating status:")
        or lowered.startswith("platform status:")
    )


def is_list_intro(line: str) -> bool:
    return line.endswith(":") and len(line) < 120


def parse_last_updated(lines: list[str]) -> str:
    for line in lines[:3]:
        if line.lower().startswith("last updated:"):
            return line.split(":", 1)[1].strip()
    return "July 2026"


def md_to_docx(md_path: Path, out_path: Path, title: str, slug: str) -> None:
    raw = md_path.read_text(encoding="utf-8").strip()
    lines = raw.splitlines()
    last_updated = parse_last_updated(lines)

    doc = Document()
    add_policy_header(doc, title, slug, last_updated)

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1

        if not line:
            continue
        if line.lower().startswith("last updated:"):
            continue

        if is_note_line(line):
            add_note_box(doc, line)
            continue

        section = SECTION_RE.match(line)
        if section:
            heading(doc, line, level=2)
            continue

        if CHECKLIST_RE.match(line):
            doc.add_paragraph(line, style="List Bullet")
            continue

        if BULLET_RE.match(line):
            doc.add_paragraph(BULLET_RE.sub("", line), style="List Bullet")
            continue

        if is_list_intro(line):
            body(doc, line)
            items: list[str] = []
            while i < len(lines):
                nxt = lines[i].strip()
                if not nxt:
                    i += 1
                    break
                if SECTION_RE.match(nxt) or is_note_line(nxt) or CHECKLIST_RE.match(nxt) or BULLET_RE.match(nxt):
                    break
                items.append(nxt)
                i += 1
            for item in items:
                doc.add_paragraph(item, style="List Bullet")
            continue

        body(doc, line)

    return save_docx(doc, out_path)


def build_guide_doc() -> Path:
    doc = Document()
    heading(doc, "DanyPathMart Legal Policies — Guide")
    body(
        doc,
        f"Source markdown: docs/legal/policies/*.md  ·  Website: {SITE_URL}  ·  "
        "Regenerate Word files: python docs/legal/generate_legal_docs.py",
    )
    doc.add_paragraph()

    heading(doc, "Operating status", level=2)
    body(
        doc,
        "DanyPathMart is currently operated as an online marketplace and is not yet "
        "formally registered with Ghanaian authorities. When you complete registration, "
        "update the markdown policies and regenerate these Word files.",
    )
    doc.add_paragraph()

    heading(doc, "Word files in this folder", level=2)
    table = doc.add_table(rows=1 + len(POLICY_FILES), cols=4)
    table.style = "Table Grid"
    for col, label in enumerate(["Word file", "Markdown source", "CMS slug", "Footer"]):
        table.rows[0].cells[col].text = label
        set_cell_shading(table.rows[0].cells[col], "E8F5E9")

    footer_slugs = {"seller-handbook"}
    for row_idx, (md_name, docx_name, _title, slug) in enumerate(POLICY_FILES, start=1):
        table.rows[row_idx].cells[0].text = docx_name
        table.rows[row_idx].cells[1].text = f"policies/{md_name}"
        table.rows[row_idx].cells[2].text = slug
        table.rows[row_idx].cells[3].text = "No" if slug in footer_slugs else "Yes"

    doc.add_paragraph()
    heading(doc, "Publish to the live site", level=2)
    for step in [
        "Edit the .md file in docs/legal/policies/ (or use these Word files for sharing).",
        "Run: cd backend && php scripts/seed-legal-policies.php",
        "Verify at https://danypathmart.store/policies/{slug}",
    ]:
        doc.add_paragraph(step, style="List Number")

    WORD_DIR.mkdir(parents=True, exist_ok=True)
    return save_docx(doc, WORD_DIR / "00_DPM_Legal_Where_To_Fill_Your_Details.docx")


def save_docx(doc: Document, out_path: Path) -> Path:
    """Save docx; if the file is locked (open in Word), write a sibling *_UPDATED.docx."""
    try:
        doc.save(out_path)
        return out_path
    except PermissionError:
        alt = out_path.with_name(out_path.stem + "_UPDATED" + out_path.suffix)
        doc.save(alt)
        print(
            f"  WARNING: {out_path.name} is locked — wrote {alt.name} instead. "
            "Close Word and re-run to replace."
        )
        return alt


def main() -> None:
    WORD_DIR.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = [build_guide_doc()]
    for md_name, docx_name, title, slug in POLICY_FILES:
        md_path = POLICIES_DIR / md_name
        if not md_path.is_file():
            raise FileNotFoundError(f"Missing policy source: {md_path}")
        paths.append(md_to_docx(md_path, WORD_DIR / docx_name, title, slug))

    # Also refresh docs/legal/*.docx when not locked (best effort)
    for path in paths[1:]:
        canonical = OUT_DIR / path.name.replace("_UPDATED", "")
        try:
            canonical.write_bytes(path.read_bytes())
        except OSError as exc:
            print(f"  (skipped copy to {canonical.name}: {exc})")

    print("Generated legal policy Word documents:")
    for path in paths:
        print(f"  {path}")


if __name__ == "__main__":
    main()
