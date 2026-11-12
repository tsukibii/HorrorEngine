# over.py OUT.jpg MESH.json[:colour] ...: bodies' outlines over the T-pose picture
import sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
COL={"g":(0,255,60),"c":(0,220,255),"r":(255,60,60),"y":(255,230,0)}
ref=Image.open("Saved/Body/ref/t1.jpg").convert("RGB"); sc=1.0; W,H=ref.size; a=np.asarray(ref).copy()
for k,t in enumerate(sys.argv[2:]):
    f,col=(t.split(":")+["gcry"[k]])[:2]; M=json.load(open(f)); xy=np.array(M["xy"]).reshape(-1,2); tris=np.array(M["tris"]).reshape(-1,3)
    m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
    for p,q,r in tris: d.polygon([tuple(xy[p]),tuple(xy[q]),tuple(xy[r])],fill=255)
    b=np.asarray(m)>0; e=np.zeros_like(b); e[1:,:]|=b[1:,:]!=b[:-1,:]; e[:,1:]|=b[:,1:]!=b[:,:-1]
    e=np.asarray(Image.fromarray((e*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)))>0; a[e]=COL[col]
Image.fromarray(a).save(sys.argv[1],quality=90); print(sys.argv[1])
