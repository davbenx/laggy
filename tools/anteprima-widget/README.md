# Anteprima del widget

Disegna il widget Android su un computer (Paparazzi / layoutlib), senza telefono né emulatore, in chiaro e scuro, a varie
altezze e nei vari momenti della giornata. Lo lancia il workflow «Anteprima widget» (GitHub › Actions), che copia qui le
risorse e le classi del widget (`app/android/app/src/main`), registra le immagini e le carica come artefatto `anteprima-widget`.
Non è parte dell'app né della release: è solo per guardare il risultato prima di installarlo.

## In locale (Linux, provato il 25/10/2026)
Serve un JDK 21 e l'Android SDK (platform 35/36 e build-tools; con `ANDROID_HOME` e le licenze accettate Gradle scarica da solo quel che manca). Da una copia di lavoro, per non sporcare il repository:

```
P=/tmp/anteprima; cp -r tools/anteprima-widget $P; M=app/android/app/src/main
cp -r app/android/gradle $P/gradle; cp app/android/gradlew $P/gradlew
cp -r $M/res $P/app/src/main/res; mkdir -p $P/app/src/main/java/club/notturnisti/twa
for f in WidgetStato WidgetPiano CalendarioModel CalendarioWidget NotturnistiWidget; do cp $M/java/club/notturnisti/twa/$f.java $P/app/src/main/java/club/notturnisti/twa/; done
cd $P && ./gradlew recordPaparazziDebug --no-daemon   # circa 1-2 minuti
```
Le immagini sono in `app/src/test/snapshots/images/`.
