"""PNG/WAV를 교체한 후 Python 3으로 실행. 추가 패키지 불필요."""
from pathlib import Path
import base64, json
root = Path(__file__).resolve().parents[1]
for directory, suffix, variable, output in [
    ('toys', '.png', 'MALLANG_ART', 'toys.js'),
    ('audio', '.wav', 'MALLANG_SOUNDS', 'sounds.js'),
]:
    folder = root / 'assets' / directory
    data = {}
    for path in sorted(folder.glob('*' + suffix)):
        encoded = base64.b64encode(path.read_bytes()).decode('ascii')
        data[path.stem] = ('data:image/png;base64,' if suffix == '.png' else '') + encoded
    (folder / output).write_text('window.' + variable + ' = ' + json.dumps(data) + ';\n', encoding='utf-8')
    print(f'{output}: {len(data)} assets')
