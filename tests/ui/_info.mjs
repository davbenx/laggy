// Il «perché» di una voce del piano si apre in un foglio (#infoModal): per i test che ne leggono il contenuto.
export async function apriVoce(p, id){ await p.click('#essenziale [data-row="'+id+'"]'); await p.waitForTimeout(250); }
export const testoVoce=p=>p.evaluate(()=>document.querySelector("#infoCorpo").innerText);
export async function chiudiVoce(p){ await p.click("#infoChiudi"); await p.waitForTimeout(150); }
