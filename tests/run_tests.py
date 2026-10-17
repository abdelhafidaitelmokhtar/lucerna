"""Run the Lucerna browser test suite in headless Edge/Chrome.

Usage: python tests/run_tests.py [--grep TEXT]
"""
import argparse
import functools
import html
import http.server
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BROWSER_PATHS = [
    r"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    r"C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    r"C:/Program Files/Google/Chrome/Application/chrome.exe",
]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def find_browser():
    for path in BROWSER_PATHS:
        if os.path.exists(path):
            return path
    for name in ("msedge", "chrome", "google-chrome", "chromium"):
        found = shutil.which(name)
        if found:
            return found
    sys.exit("No Edge/Chrome browser found.")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--grep", default="")
    args = parser.parse_args()

    handler = functools.partial(QuietHandler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]

    url = "http://127.0.0.1:%d/tests/test.html?grep=%s" % (port, urllib.parse.quote(args.grep))
    with tempfile.TemporaryDirectory() as profile:
        proc = subprocess.run(
            [find_browser(), "--headless=new", "--disable-gpu", "--no-first-run",
             "--user-data-dir=" + profile, "--virtual-time-budget=120000",
             "--dump-dom", url],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
    server.shutdown()

    dom = proc.stdout
    match = re.search(r'<pre id="results">(.*?)</pre>', dom, re.S)
    if match:
        print(html.unescape(match.group(1)).strip())
    if 'data-done="1"' not in dom:
        print("TIMEOUT: test page did not finish")
        return 1
    if not match or not re.search(r"failed=0\b", match.group(1)):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
