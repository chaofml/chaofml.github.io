# -*- coding: utf-8 -*-
"""textdiff 本地静态服务。

为什么不用 `python -m http.server`：
  1. 它不返回任何缓存头，浏览器会对 index.html / vs 资源做启发式缓存，
     换了新版本后仍然可能拿旧内容（表现为页面一直卡在"正在加载编辑器内核…"）。
  2. 它不记录请求日志，出问题时无法判断浏览器究竟请求了哪个文件、返回了什么。

本服务：
  - ThreadingHTTPServer，并发处理（预连接/并发请求不会互相堵住）
  - 所有响应带 no-store，杜绝缓存旧版本
  - 每个请求追加一行日志到 server.log
"""
import datetime
import os
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(ROOT, 'server.log')
CLIENT_LOG = os.path.join(ROOT, 'client.log')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # ---- 禁止缓存 ----
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    # ---- 记录每个请求 ----
    def handle_one_request(self):
        self._t0 = time.time()
        super().handle_one_request()

    def log_request(self, code='-', size='-'):
        elapsed = int((time.time() - getattr(self, '_t0', time.time())) * 1000)
        line = '%s %-4s %5dms %s\n' % (
            datetime.datetime.now().strftime('%H:%M:%S'), code, elapsed, self.path
        )
        try:
            with open(LOG, 'a', encoding='utf-8') as f:
                f.write(line)
        except Exception:
            pass
        try:
            sys.stdout.write(line)
            sys.stdout.flush()
        except Exception:
            pass

    # ---- 接收浏览器侧日志：页面每推进一步就上报一条，即使卡死也能看到卡在哪一步 ----
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(n) if n else b''
        if self.path.startswith('/__log'):
            try:
                with open(CLIENT_LOG, 'ab') as f:
                    f.write(body + b'\n')
            except Exception:
                pass
            self.send_response(204)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        self.send_error(404)

    # ---- favicon 直接 204，少一点日志噪音 ----
    def do_GET(self):
        if self.path.startswith('/favicon'):
            self.send_response(204)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8780
    srv = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    srv.daemon_threads = True
    sys.stdout.write('textdiff serving %s at http://127.0.0.1:%d/index.html\n' % (ROOT, port))
    sys.stdout.flush()
    srv.serve_forever()


if __name__ == '__main__':
    main()
