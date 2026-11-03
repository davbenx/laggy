import json, sys, numpy as np
from circadian.models import Hannay19TP, Jewett99, Hannay19, Forger99
O=sys.argv[1]; pats=sys.argv[2].split(","); dt=10/60
reg=np.array([0 if (m>=1410 or m<450) else (600 if 420<=m<1020 else 150) for m in range(0,1440,10)],float)
tot={}
for M in (Hannay19TP, Jewett99):
    m=M(); L=np.tile(reg,30); t=np.arange(len(L))*dt; tr=m.integrate(t,input=L); c=m.cbt(tr); c=c[c>20*24]
    ang=(c%24)/24*2*np.pi; xm=(np.arctan2(np.sin(ang).mean(),np.cos(ang).mean())/(2*np.pi)*24)%24; fase=5.5-xm; y0=tr.states[-1]
    print(M.__name__)
    for pat in pats:
        ide=np.array(json.load(open(f"{O}/{pat}_ideale.json")))/60; out=[]
        for k in ("nulla","regole","ottimo"):
            Lk=np.array(json.load(open(f"{O}/{pat}_{k}.json")),float); tt=np.arange(len(Lk))*dt
            mm=M(); cc=mm.cbt(mm.integrate(tt,input=Lk,initial_condition=y0))+fase
            out.append(np.mean([min(abs(cc-x)) for x in ide[7:-1]]))
        print("  %-12s senza %.2f · regole %.2f · ottimizzatore %.2f h"%(pat,*out))
