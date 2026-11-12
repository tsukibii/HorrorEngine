# sil.py: the T-pose reference's figure cut from its backdrop (Saved/Body/ref/t1.jpg): a mask, and by height the runs of the figure across the picture
import numpy as np
from PIL import Image, ImageFilter
import os
S=os.environ.get("BODYFIT","Saved/Body/fit")+"/"                 # where the fit's own files go (run from the repo's root)
os.makedirs(S,exist_ok=True)
im=Image.open("Saved/Body/ref/t1.jpg").convert("RGB"); a=np.asarray(im).astype(float); H,W=a.shape[:2]
# the backdrop: its colour by height (it shades a little), from the picture's columns beside the figure
bg=np.median(np.concatenate([a[:,150:300,:],a[:,820:950,:]],axis=1),axis=1)          # above the arms and below them these columns are backdrop... except the arm's rows
rows=np.arange(H); armrows=(rows>455)&(rows<575)
for c in range(3): bg[armrows,c]=np.interp(rows[armrows],rows[~armrows],bg[~armrows,c])
d=np.abs(a-bg[:,None,:]).max(axis=2)
mask=d>26
m=Image.fromarray((mask*255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5)); mask=np.asarray(m)>0
Image.fromarray((mask*255).astype(np.uint8)).save(S+"t1_mask.png")
print("picture",W,H,"backdrop",bg[100].round(),bg[800].round(),bg[1500].round())
ys=np.where(mask.any(axis=1))[0]; print("figure rows",ys.min(),ys.max())
def runs(y):
    r=mask[y]; x=np.where(r)[0]
    if not len(x): return []
    out=[]; s=x[0]; p=x[0]
    for v in x[1:]:
        if v-p>3: out.append((s,p)); s=v
        p=v
    out.append((s,p)); return [(int(s),int(e)) for s,e in out if e-s>3]
for y in list(range(250,470,10))+list(range(470,1000,20))+list(range(1000,1622,20)): print(y, runs(y))
