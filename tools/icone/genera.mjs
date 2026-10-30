// Genera tutte le icone dell'app (web, Play, Android) dall'originale `civetta.jpg` (1335×1335: civetta su luna piena, sfondo blu notte).
//   node tools/icone/genera.mjs        (serve Playwright con Chromium: si usa il canvas del browser, niente altre dipendenze)
// Cosa scrive: icone web (192, 512, 180 per iPhone, maskable, il «marchio» tondo e il distintivo delle notifiche web),
// l'icona di Play (512), le icone Android (adattive: primo piano e a tema; quelle vecchie quadrate e tonde) e le schermate di avvio.
import pw from "../../tests/ui/_pw.mjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const qui=dirname(fileURLToPath(import.meta.url)), radice=join(qui,"..","..");
const RES=join(radice,"app/android/app/src/main/res");
const b64=readFileSync(join(qui,"civetta.jpg")).toString("base64");
const scrivi=(rel,b)=>{ const f=join(radice,rel); mkdirSync(dirname(f),{recursive:true}); writeFileSync(f,Buffer.from(b,"base64")); console.log("  ",rel); };

const browser=await pw.chromium.launch(); const page=await browser.newPage();
await page.setContent("<canvas id=c></canvas>");
// tutto il disegno gira nel browser: ritorna PNG in base64
const R=await page.evaluate(async src=>{
  const img=new Image(); img.src="data:image/jpeg;base64,"+src; await img.decode();
  const N=img.naturalWidth, C=N/2, RD=612*(N/1335);   // luna: centro e raggio (leggermente dentro il bordo, niente frangia blu)
  const tela=(w,h)=>{ const c=document.createElement("canvas"); c.width=w; c.height=h; const x=c.getContext("2d"); x.imageSmoothingEnabled=true; x.imageSmoothingQuality="high"; return [c,x]; };
  // riduzione a passi di metà: qualità migliore che un salto solo (le icone piccole restano nitide)
  const ridotto=(sorgente,w)=>{ let c=sorgente; while(c.width/2>w){ const [d,x]=tela(Math.round(c.width/2),Math.round(c.height/2)); x.drawImage(c,0,0,d.width,d.height); c=d; } const [d,x]=tela(w,Math.round(w*sorgente.height/sorgente.width)); x.drawImage(c,0,0,d.width,d.height); return d; };
  const png=c=>c.toDataURL("image/png").split(",")[1];
  const [pieno,xp]=tela(N,N); xp.drawImage(img,0,0);
  const sfondo=(()=>{ const d=xp.getImageData(8,8,1,1).data; return [d[0],d[1],d[2]]; })();
  const hex="#"+sfondo.map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();
  const out={sfondo:hex};
  // quadrato pieno a una data misura
  const quadrato=w=>png(ridotto(pieno,w));
  // la sola luna con la civetta, ritagliata tonda (fuori: trasparente), alla misura w con il diametro d (frazione della tela)
  const luna=(w,frazione)=>{
    const [g,xg]=tela(N,N); xg.save(); xg.beginPath(); xg.arc(C,C,RD,0,Math.PI*2); xg.clip(); xg.drawImage(img,0,0); xg.restore();
    const lato=Math.round(2*RD), [t,xt]=tela(lato,lato); xt.drawImage(g,C-RD,C-RD,lato,lato,0,0,lato,lato);   // ritaglio stretto sulla luna
    const piccolo=ridotto(t,Math.round(w*frazione)); const [u,xu]=tela(w,w); xu.drawImage(piccolo,Math.round((w-piccolo.width)/2),Math.round((w-piccolo.height)/2)); return u; };
  // la civetta sola, in un colore solo (alfa dalla luminosità): per le icone a tema e il distintivo
  const silhouette=(w,frazione)=>{
    const [t,xt]=tela(N,N); xt.drawImage(img,0,0); const dati=xt.getImageData(0,0,N,N), p=dati.data;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i=(y*N+x)*4, r=p[i], g=p[i+1], bl=p[i+2];
      const dentro=(x-C)**2+(y-C)**2<=RD*RD; let a=0;
      if(dentro){ const lum=.299*r+.587*g+.114*bl; if(r>200 && g<175 && bl<100) a=255; else a=Math.max(0,Math.min(255,(205-lum)/95*255)); }
      p[i]=p[i+1]=p[i+2]=255; p[i+3]=a; }
    xt.putImageData(dati,0,0);
    const lato=Math.round(2*RD), [s,xs]=tela(lato,lato); xs.drawImage(t,C-RD,C-RD,lato,lato,0,0,lato,lato);
    const piccolo=ridotto(s,Math.round(w*frazione)); const [u,xu]=tela(w,w); xu.drawImage(piccolo,Math.round((w-piccolo.width)/2),Math.round((w-piccolo.height)/2)); return u; };
  // quadrato con angoli arrotondati / tondo (icone vecchie, prima di Android 8)
  const arrotondato=(w,raggio)=>{ const q=ridotto(pieno,w); const [u,xu]=tela(w,w); xu.beginPath(); xu.roundRect(0,0,w,w,raggio*w); xu.clip(); xu.drawImage(q,0,0); return u; };
  // maskable: tutto dentro l'80% centrale, il resto è il blu di sfondo
  const maskable=w=>{ const [u,xu]=tela(w,w); xu.fillStyle=hex; xu.fillRect(0,0,w,w); const q=ridotto(pieno,Math.round(w*.84)); xu.drawImage(q,Math.round((w-q.width)/2),Math.round((w-q.height)/2)); return u; };

  out.web={ "icon-512.png":quadrato(512), "icon-192.png":quadrato(192), "icon-180.png":quadrato(180),
    "icon-maskable-512.png":png(maskable(512)), "owl-mark.png":png(luna(256,1)), "badge-96.png":png(silhouette(96,.86)) };
  out.play={ "icona-app-512.png":quadrato(512) };
  // Android: adattiva da 108dp (primo piano e a tema: la luna di 66dp, dentro la zona sicura), vecchie da 48dp
  const dens={mdpi:1,hdpi:1.5,xhdpi:2,xxhdpi:3,xxxhdpi:4};
  out.android={};
  for(const [d,k] of Object.entries(dens)){
    out.android["mipmap-"+d+"/ic_launcher_foreground.png"]=png(luna(Math.round(108*k),66/108));
    out.android["mipmap-"+d+"/ic_launcher.png"]=png(arrotondato(Math.round(48*k),.22));
    out.android["mipmap-"+d+"/ic_launcher_round.png"]=png(arrotondato(Math.round(48*k),.5));
    out.android["drawable-"+d+"/ic_launcher_monochrome.png"]=png(silhouette(Math.round(108*k),66/108*.98));
  }
  return out;
}, b64);
console.log("sfondo blu:",R.sfondo);
for(const [n,v] of Object.entries(R.web)) scrivi(n,v);
for(const [n,v] of Object.entries(R.play)){ scrivi("docs/play/img/"+n,v); scrivi("docs/play/img/sviluppatore-icona-512.png",v); }
for(const [n,v] of Object.entries(R.android)) scrivi("app/android/app/src/main/res/"+n,v);
writeFileSync(join(RES,"values/ic_launcher_background.xml"),`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${R.sfondo}</color>\n</resources>\n`);
console.log("   values/ic_launcher_background.xml");

// schermate di avvio: stesse misure e posizione del riquadro di prima, con l'icona nuova
const lista=[]; for(const d of ["drawable","drawable-port-mdpi","drawable-port-hdpi","drawable-port-xhdpi","drawable-port-xxhdpi","drawable-port-xxxhdpi","drawable-land-mdpi","drawable-land-hdpi","drawable-land-xhdpi","drawable-land-xxhdpi","drawable-land-xxxhdpi"]) if(existsSync(join(RES,d,"splash.png"))) lista.push(d);
for(const d of lista){
  const vecchio=readFileSync(join(RES,d,"splash.png")).toString("base64");
  const nuovo=await page.evaluate(async ([vec,src])=>{
    const carica=async u=>{ const i=new Image(); i.src=u; await i.decode(); return i; };
    const a=await carica("data:image/png;base64,"+vec), ic=await carica("data:image/jpeg;base64,"+src);
    const c=document.createElement("canvas"); c.width=a.naturalWidth; c.height=a.naturalHeight; const x=c.getContext("2d"); x.drawImage(a,0,0);
    const dati=x.getImageData(0,0,c.width,c.height), p=dati.data, bg=[p[0],p[1],p[2]];
    let x0=c.width,x1=0,y0=c.height,y1=0;   // il riquadro di prima: tutto ciò che non è lo sfondo
    for(let y=0;y<c.height;y++) for(let xx=0;xx<c.width;xx++){ const i=(y*c.width+xx)*4; if(Math.abs(p[i]-bg[0])+Math.abs(p[i+1]-bg[1])+Math.abs(p[i+2]-bg[2])>24){ if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(y<y0)y0=y; if(y>y1)y1=y; } }
    const lato=Math.max(x1-x0,y1-y0)+1, cx=(x0+x1)/2, cy=(y0+y1)/2;
    x.fillStyle="rgb("+bg.join(",")+")"; x.fillRect(0,0,c.width,c.height);
    x.save(); x.beginPath(); x.roundRect(cx-lato/2,cy-lato/2,lato,lato,lato*.25); x.clip(); x.imageSmoothingQuality="high"; x.drawImage(ic,cx-lato/2,cy-lato/2,lato,lato); x.restore();
    return c.toDataURL("image/png").split(",")[1];
  },[vecchio,b64]);
  scrivi("app/android/app/src/main/res/"+d+"/splash.png",nuovo);
}
await browser.close();
