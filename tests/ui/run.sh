#!/usr/bin/env bash
# Test dell'interfaccia nel browser (Playwright): flussi utente, onboarding,
# inviti, notifiche, adattamento, condivisione, app nativa simulata,
# accessibilità (axe-core) e testo ingrandito.
#   tests/ui/run.sh            tutte le suite
#   tests/ui/run.sh comp nudge solo alcune
# Serve: Playwright con Chromium (npm i -g playwright), python3.
# Le suite "nativo" usano app/www: si rigenera qui con build:web.
set -uo pipefail
cd "$(dirname "$0")/../.."
OUT="${OUT:-$(mktemp -d)}"; export OUT
# Ora locale verso mezzogiorno: tra mezzanotte e la sveglia l'app conta
# ancora il giorno prima (voluto), e alcune suite che dicono "oggi"
# fallivano solo se lanciate di notte. TZ=... dal chiamante vince.
if [ -z "${TZ:-}" ]; then
  n=$((12 - 10#$(date -u +%H)))
  if [ $n -ge 0 ]; then export TZ="Etc/GMT-$n"; else export TZ="Etc/GMT+$((-n))"; fi
fi
(cd app && npm run -s build:web >/dev/null)
python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 & S1=$!
(cd app/www && exec python3 -m http.server 8766 --bind 127.0.0.1 >/dev/null 2>&1) & S2=$!
trap 'kill $S1 $S2 2>/dev/null' EXIT
sleep 1
if [ -z "${AXE_JS:-}" ]; then
  mkdir -p "$OUT/axe" && (cd "$OUT/axe" && npm i --silent --no-save axe-core@4.10.2 >/dev/null 2>&1)
  export AXE_JS="$OUT/axe/node_modules/axe-core/axe.min.js"
fi
SUITE=("$@"); [ ${#SUITE[@]} -eq 0 ] && SUITE=(personas comp nudge robust opz attiva fix5 msg share3 ux3 adatta notif3 native2 inviti indietro cancella footlinks notiftap ios crescita push primo mese prossimi ferie acasa doponotte medico priorita limitato scimmia scimmia-nativo overflow perf pesante offline e2e)
fail=0
for s in "${SUITE[@]}"; do
  f=tests/ui/$s.mjs; [ -f "$f" ] || f=tests/ui/$s.cjs
  outp=$(node "$f" 2>&1); ok=$(grep -c "✔" <<<"$outp"); ko=$(grep -c "✘" <<<"$outp")
  err=$(grep -E "pageerror|^errori.*[A-Za-z]{3}|Error:" <<<"$outp" | grep -vE "errori:? \[\]|errori pagina: \[\]" | head -3)
  printf "%-10s %3s ✔  %s ✘ %s\n" "$s" "$ok" "$ko" "$( [ -n "$err" ] && echo "· $err" )"
  [ "$ko" -gt 0 ] && { grep "✘" <<<"$outp" | sed 's/^/           /'; fail=1; }
  [ -n "$err" ] && fail=1
done
echo "screenshot in $OUT"
exit $fail
