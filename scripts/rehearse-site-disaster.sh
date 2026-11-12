#!/usr/bin/env bash
# Répétition de reprise hors GitHub/Kaptain : archive, restauration, navigateur.
set -euo pipefail
cd "$(dirname "$0")/.."
root="$(mktemp -d)"
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf "$root"
}
trap cleanup EXIT
python3 scripts/portable_backup.py create --project Ma-Collection --output "$root/ma-collection.zip"
python3 scripts/portable_backup.py verify --project Ma-Collection --archive "$root/ma-collection.zip"
python3 scripts/portable_backup.py restore --project Ma-Collection --archive "$root/ma-collection.zip" --dest "$root/restore"
test -s "$root/restore/collections/database.js"
python3 -m http.server 8899 --bind 127.0.0.1 --directory "$root/restore" >"$root/http.log" 2>&1 &
server_pid="$!"
for i in $(seq 1 40); do
  if curl --fail --silent --output /dev/null http://127.0.0.1:8899/index.html; then break; fi
  sleep 0.3
done
MA_COLLECTION_TEST_BASE=http://127.0.0.1:8899/ node .github/scripts/qa-kaptain-disparition.mjs
python3 scripts/rehost_ma_art.py --root "$root/restore" --new-origin https://images-backup.example.invalid
python3 scripts/rehost_ma_art.py --root "$root/restore" --new-origin https://images-backup.example.invalid --apply
python3 - "$root/restore" <<'PY'
from pathlib import Path
import sys
root=Path(sys.argv[1])
body=(root/'collections/database.js').read_text(encoding='utf-8')
assert 'https://ma-art.mailpromahe.workers.dev' not in body, 'Ancien hébergement conservé'
assert 'https://images-backup.example.invalid/media/' in body, 'Chemins des médias perdus'
assert (root/'index.html').is_file(), 'Index perdu'
print('REPRISE_SITE_OK : archive complète, site local et nouvelle origine visuelle préparée')
PY
