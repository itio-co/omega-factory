#!/usr/bin/env python3
"""Verify the deployed game and its entry assets, using only the standard library."""
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and "src" in attrs:
            self.urls.append(attrs["src"])
        if tag == "link" and attrs.get("rel") in ("stylesheet", "modulepreload", "icon"):
            self.urls.append(attrs["href"])

opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", "curl/8.5.0")]
urllib.request.install_opener(opener)

base = sys.argv[1].rstrip("/") + "/"
with urllib.request.urlopen(base.rstrip("/"), timeout=20) as response:
    assert response.url == base, f"Slashless URL did not redirect to {base}: {response.url}"
with urllib.request.urlopen(base, timeout=20) as response:
    assert response.headers.get_content_type() == "text/html"
    html = response.read().decode()
    assert "Omega Factory" in html
parser = Assets()
parser.feed(html)
assert any(".js" in u for u in parser.urls), "No game script"
assert any(".css" in u for u in parser.urls), "No game stylesheet"
for asset in parser.urls:
    url = urllib.parse.urljoin(base, asset)
    assert url.startswith(base), f"Asset escapes app prefix: {url}"
    with urllib.request.urlopen(url, timeout=20) as response:
        content_type = response.headers.get_content_type()
        expected = ("text/javascript", "application/javascript") if ".js" in asset else ("text/css",) if ".css" in asset else ("image/svg+xml",)
        assert content_type in expected, (url, content_type)
        assert response.read(), f"Empty asset: {url}"
with urllib.request.urlopen(base + "healthz", timeout=20) as response:
    assert response.read().strip() == b"ok"
try:
    urllib.request.urlopen(base + "assets/does-not-exist.js", timeout=20)
except urllib.error.HTTPError as error:
    assert error.code == 404, error.code
else:
    raise AssertionError("Missing asset did not return 404")
print(f"PASS: {base} redirect, HTML, {len(parser.urls)} assets, health, missing asset")
