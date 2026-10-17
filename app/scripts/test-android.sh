#!/usr/bin/env bash
# Ambiente di test Android: emulatore + APK di test + prova end-to-end.
#   app/scripts/test-android.sh          prepara tutto (la prima volta scarica
#                                        emulatore e immagine) e lancia la prova
# Senza accelerazione hardware (KVM) l'emulatore va lo stesso, ma lento:
# avvio 7–20 minuti. Con KVM disponibile togliere "-accel off".
# L'APK di test ha il debug del WebView acceso (serve a pilotare l'app):
# NON va distribuito; capacitor.config.json viene rimesso com'era.
set -euo pipefail
cd "$(dirname "$0")/.."                       # app/
SDK="${ANDROID_HOME:-$HOME/android-sdk}"; export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
ADB="$SDK/platform-tools/adb"; IMG="system-images;android-30;google_apis;x86_64"; AVD=nt30
[ -x "$SDK/emulator/emulator" ] || yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --install emulator "$IMG"
[ -d "$SDK/system-images/android-30/google_apis/x86_64" ] || yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --install "$IMG"
[ -d "$HOME/.android/avd/$AVD.avd" ] || { echo no | "$SDK/cmdline-tools/latest/bin/avdmanager" create avd -n $AVD -k "$IMG" -d pixel_4 --force; echo "hw.ramSize=4096" >> "$HOME/.android/avd/$AVD.avd/config.ini"; }
if ! "$ADB" devices | grep -q "emulator-5554"; then
  nohup "$SDK/emulator/emulator" -avd $AVD -no-window -no-audio -no-boot-anim -accel off -gpu guest -no-snapshot -cores 4 -memory 4096 > /tmp/emulator.log 2>&1 &
fi
echo "Attendo l'avvio di Android…"
until [ "$("$ADB" -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 10; done
until "$ADB" -s emulator-5554 shell service check package 2>/dev/null | grep -q found; do sleep 10; done
# APK di test (debug del WebView acceso), poi config ripristinata
CFG="$PWD/capacitor.config.json"   # percorso assoluto: lo script poi fa "cd .."
cp "$CFG" /tmp/cap.config.bak
sed -i 's/"webContentsDebuggingEnabled": false/"webContentsDebuggingEnabled": true/' "$CFG"
trap 'cp /tmp/cap.config.bak "$CFG"' EXIT INT TERM
npm run -s build:web && npx cap sync android >/dev/null && (cd android && ./gradlew assembleDebug --no-daemon -q)
# Senza KVM il sistema dell'emulatore a volte si riavvia appena acceso:
# si riprova finché il gestore dei pacchetti risponde e l'installazione riesce.
for t in 1 2 3 4 5 6; do
  until "$ADB" -s emulator-5554 shell pm path android 2>/dev/null | grep -q package; do sleep 10; done
  "$ADB" -s emulator-5554 install -r -g android/app/build/outputs/apk/debug/app-debug.apk 2>&1 | grep -q Success && break
  echo "installazione non riuscita (tentativo $t), riprovo"; sleep 30
done
cd .. && ADB="$ADB" APK=app/android/app/build/outputs/apk/debug/app-debug.apk node app/scripts/test-android.mjs --no-install
