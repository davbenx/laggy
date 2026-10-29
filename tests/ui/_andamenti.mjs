// «Sonno e carico» ha un elenco di voci che aprono ciascuna la propria pagina: per i test che guardano i grafici
// si aprono tutte, una dopo l'altra, e i loro contenuti si mettono in #andTutte dentro #andamenti.
export async function espandi(p){
  await p.evaluate(()=>{
    const out=[];
    for(const id of ["carico","dormi","orari","orologio"]){
      const b=document.querySelector('[data-and-sez="'+id+'"]'); if(!b) continue; b.click();
      const c=document.querySelector("#andamenti > .andamento-sezione"); if(c) out.push(c.cloneNode(true));
      document.querySelector("#chiudiAndamenti").click();
    }
    const box=document.createElement("div"); box.id="andTutte"; out.forEach(c=>box.appendChild(c)); document.querySelector("#andamenti").appendChild(box);
  });
}
