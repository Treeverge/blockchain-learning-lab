"""Generate HTML and macro-free DOCX from the sharing Markdown (standard library).

Supported authoring subset: headings, paragraphs, unordered lists, **bold**,
`code`, and [links](url). Run --check to check both committed outputs without writes.
"""
from pathlib import Path
from html import escape
import io
import posixpath
import re
import sys
import zipfile
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "02-演讲稿/演讲稿（对外版）.md"
TOKEN = re.compile(r"\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|`([^`]+)`")


def blocks(text):
    result, paragraph = [], []

    def flush():
        if paragraph:
            result.append(("p", " ".join(paragraph)))
            paragraph.clear()

    for line in text.splitlines():
        if not line.strip():
            flush()
        elif line.startswith("#"):
            flush()
            match = re.fullmatch(r"(#{1,3}) (.+)", line)
            if not match:
                raise ValueError("Unsupported heading: " + line)
            result.append((f"h{len(match[1])}", match[2]))
        elif line.startswith("- "):
            flush()
            result.append(("li", line[2:]))
        else:
            paragraph.append(line)
    flush()
    return result


def fragments(text):
    start = 0
    for match in TOKEN.finditer(text):
        if match.start() > start:
            yield "text", text[start:match.start()], None
        if match[1] is not None:
            url = match[2]
            if urlsplit(url).scheme not in ("", "https") or url.startswith("//"):
                raise ValueError("Unsupported link: " + url)
            yield "link", match[1], url
        elif match[3] is not None:
            yield "bold", match[3], None
        else:
            yield "code", match[4], None
        start = match.end()
    if start < len(text):
        yield "text", text[start:], None


def inline_html(text):
    parts = []
    for kind, value, url in fragments(text):
        safe = escape(value)
        parts.append(f'<a href="{escape(url, quote=True)}">{safe}</a>' if kind == "link"
                     else f"<strong>{safe}</strong>" if kind == "bold"
                     else f"<code>{safe}</code>" if kind == "code" else safe)
    return "".join(parts)


def html_document(items):
    content, in_list = [], False
    for tag, text in items:
        if tag == "li" and not in_list:
            content.append("<ul>")
            in_list = True
        elif tag != "li" and in_list:
            content.append("</ul>")
            in_list = False
        content.append(f"<{tag}>{inline_html(text)}</{tag}>")
    if in_list:
        content.append("</ul>")
    return ('''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>40 分钟分享讲稿 · 区块链学习实验室</title>
<link rel="stylesheet" href="../assets/css/lab.css"><link rel="stylesheet" href="../assets/css/presentation.css">
</head><body class="manuscript">
<header class="site-header"><a class="brand" href="../index.html"><span class="brand-mark">▦</span>区块链学习实验室</a><a href="../03-演示文稿/blockchain-presentation.html">返回演示文稿 →</a></header>
<main class="shell"><article>
''' + "\n".join(content) + '''
</article><div class="deck-actions"><a class="deck-link" href="演讲稿（对外版）.docx" download>下载 Word 讲稿</a><a href="演讲稿（对外版）.md" download>Markdown 原稿</a></div></main>
</body></html>
''').encode("utf-8")


def public_link(url):
    parts = urlsplit(url)
    if parts.scheme:
        return url
    relative = posixpath.normpath(posixpath.join("02-演讲稿", parts.path))
    if relative.startswith("../") or relative.startswith("/"):
        raise ValueError("Local link leaves project: " + url)
    suffix = ("?" + parts.query if parts.query else "") + ("#" + parts.fragment if parts.fragment else "")
    return "https://treeverge.github.io/blockchain-learning-lab/" + quote(relative, safe="/") + suffix


def docx_document(items):
    relationships, paragraphs = [], []
    for tag, text in items:
        style = {"h1": "Title", "h2": "Heading1", "h3": "Heading2"}.get(tag, "Normal")
        runs = []
        if tag == "li":
            text = "• " + text
        for kind, value, url in fragments(text):
            prop = '<w:b/>' if kind == "bold" else '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' if kind == "code" else ''
            if kind == "link":
                prop = '<w:rStyle w:val="Hyperlink"/>'
            run = f'<w:r><w:rPr>{prop}</w:rPr><w:t xml:space="preserve">{escape(value)}</w:t></w:r>'
            if kind == "link":
                relation_id = f"rId{len(relationships) + 2}"
                relationships.append(f'<Relationship Id="{relation_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="{escape(public_link(url), quote=True)}" TargetMode="External"/>')
                run = f'<w:hyperlink r:id="{relation_id}">{run}</w:hyperlink>'
            runs.append(run)
        paragraphs.append(f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr>{"".join(runs)}</w:p>')
    ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    document = f'<w:document {ns}><w:body>{"".join(paragraphs)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:bottom="1134" w:left="1134" w:right="1134"/></w:sectPr></w:body></w:document>'
    styles = f'''<w:styles {ns}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/><w:color w:val="192627"/><w:lang w:val="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="320"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="2458DF"/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="2458DF"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>'''
    rel_ns = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"'
    files = {
        "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
        "_rels/.rels": f'<Relationships {rel_ns}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        "word/document.xml": document,
        "word/styles.xml": styles,
        "word/_rels/document.xml.rels": f'<Relationships {rel_ns}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>{"".join(relationships)}</Relationships>',
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 14, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + content).encode("utf-8"))
    return output.getvalue()


def main():
    items = blocks(SOURCE.read_text(encoding="utf-8-sig"))
    for extension, result in ((".html", html_document(items)), (".docx", docx_document(items))):
        destination = SOURCE.with_suffix(extension)
        if "--check" in sys.argv:
            if destination.read_bytes() != result:
                raise SystemExit(f"Stale generated manuscript: {destination.name}")
        else:
            destination.write_bytes(result)
    print("Manuscript HTML and DOCX " + ("match source." if "--check" in sys.argv else "generated."))


if __name__ == "__main__":
    main()
