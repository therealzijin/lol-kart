# 開發用伺服器：關閉快取，改完重新整理就一定是新版。用法：python3 dev.py [port]
# 指定的 port 被占用時，自動改用下一個空的 port。
import http.server, sys, os, errno
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def log_message(self,*a): pass
port=int(sys.argv[1]) if len(sys.argv)>1 else 8766
for p in range(port,port+20):
    try:
        srv=http.server.ThreadingHTTPServer(('127.0.0.1',p),H)
    except OSError as e:
        if e.errno!=errno.EADDRINUSE: raise
        print(f'port {p} は使用中です。次を試します…'); continue
    print(f'起動しました: http://localhost:{p}  （Ctrl+C で終了）', flush=True)
    try: srv.serve_forever()
    except KeyboardInterrupt: print('\n終了しました')
    break
