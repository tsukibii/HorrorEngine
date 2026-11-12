# targets.py: what the T-pose picture says, as shares of the bare height (the sole to the skull's top), for the fit: the legs' edges, the trunk's
# half width (as drawn, with the cardigan), the arms' top and bottom by how far out, the face's marks. Writes t1_targets.json
import json
import numpy as np
from PIL import Image
import os
S=os.environ.get("BODYFIT","Saved/Body/fit")+"/"                 # where the fit's own files go (run from the repo's root)
os.makedirs(S,exist_ok=True)
m=np.asarray(Image.open(S+"t1_mask.png").convert("L"))>0; m[:,:4]=False
TOP,FLOOR,CX=281.0,1592.0,550.0; ST=FLOOR-TOP
def runs(y):
    r=m[int(round(y))]; x=np.where(r)[0]
    if not len(x): return []
    out=[]; s=x[0]; p=x[0]
    for v in x[1:]:
        if v-p>3: out.append((s,p)); s=v
        p=v
    out.append((s,p)); return [(a,b) for a,b in out if b-a>3]
legs=[]
for t in np.arange(0.05,0.462,0.01):
    y=FLOOR-t*ST; r=runs(y)
    L=[q for q in r if q[1]<CX+6]; R=[q for q in r if q[0]>CX-6]
    if len(r)>=2 and L and R:
        l=L[0]; rr=R[-1]                     # her right leg (the picture's left), her left leg
        inner=((CX-l[1])+(rr[0]-CX))/2/ST; outer=((CX-l[0])+(rr[1]-CX))/2/ST
        legs.append(dict(t=round(float(t),3),inner=float(inner),outer=float(outer)))
trunk=[]
for t in np.arange(0.47,0.80,0.01):
    y=FLOOR-t*ST; r=runs(y); 
    if r:
        w=max(r,key=lambda q:q[1]-q[0]); trunk.append(dict(t=round(float(t),3),half=float((w[1]-w[0])/2/ST),mid=float(((w[0]+w[1])/2-CX)/ST)))
arm=[]
for d in np.arange(0.20,0.37,0.01):         # how far out from the middle, both arms averaged
    tb=[]
    for sx in (-1,1):
        x=int(round(CX+sx*d*ST)); c=np.where(m[430:620,x])[0]
        if len(c): tb.append(((FLOOR-(430+c.min()))/ST,(FLOOR-(430+c.max()))/ST))
    if len(tb)==2: arm.append(dict(d=round(float(d),3),top=float((tb[0][0]+tb[1][0])/2),bottom=float((tb[0][1]+tb[1][1])/2)))
marks=dict(eyes=(FLOOR-367)/ST,mouth=(FLOOR-412)/ST,chin=(FLOOR-440)/ST,pit=(FLOOR-491)/ST,cuff=((CX-70)+(1044-CX))/2/ST,fingertip=((CX-14)+(1087-CX))/2/ST,
           eyesApart=57/ST,neck=68/ST,hairTop=(FLOOR-256)/ST,shoeBottom=(FLOOR-1612)/ST,hem=(FLOOR-980)/ST)
json.dump(dict(stature_px=ST,top=TOP,floor=FLOOR,cx=CX,legs=legs,trunk=trunk,arm=arm,marks=marks),open(S+"t1_targets.json","w"),indent=1)
print("height in px",ST,"; marks:",{k:round(v,4) for k,v in marks.items()})
print("legs",len(legs),"rows; trunk",len(trunk),"; arm",len(arm))
print("arm (how far out: top, bottom, thickness in cm at 163):"," ".join(f"{a['d']:.2f}:{a['top']*163:.1f},{a['bottom']*163:.1f},{(a['top']-a['bottom'])*163:.1f}" for a in arm[::2]))
