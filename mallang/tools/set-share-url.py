from pathlib import Path
import sys, re, html
from urllib.parse import urlsplit
base=sys.argv[1].rstrip('/')+'/'
if urlsplit(base).scheme not in ('http','https') or not urlsplit(base).netloc: raise SystemExit('전체 웹 주소를 입력하세요.')
path=Path(__file__).resolve().parents[1]/'index.html'
s=path.read_text(encoding='utf-8')
s=re.sub(r'<meta property="og:url"[^>]*>', '', s)
s=re.sub(r'(<meta property="og:image" content=")[^"]*/(og-thumbnail[^"/]+)(")', lambda m:m[1]+html.escape(base+'assets/'+m[2],quote=True)+m[3],s)
s=s.replace('</head>','<meta property="og:url" content="'+html.escape(base,quote=True)+'"></head>')
path.write_text(s,encoding='utf-8')
print('공유 주소와 썸네일 주소를 설정했습니다.')
