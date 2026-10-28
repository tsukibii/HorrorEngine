import math
def lab2xyz(L,a,b):
    Xn,Yn,Zn=0.95047,1.0,1.08883
    fy=(L+16)/116; fx=fy+a/500; fz=fy-b/200
    def finv(t): return t**3 if t**3>0.008856 else (t-16/116)/7.787
    return Xn*finv(fx),Yn*finv(fy),Zn*finv(fz)
def xyz2lin(X,Y,Z):
    r= 3.2404542*X-1.5371385*Y-0.4985314*Z
    g=-0.9692660*X+1.8760108*Y+0.0415560*Z
    b= 0.0556434*X-0.2040259*Y+1.0572252*Z
    return r,g,b
def enc(c):
    c=max(0,min(1,c))
    return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
def show(name,L,a,b):
    lin=xyz2lin(*lab2xyz(L,a,b)); s=[enc(c) for c in lin]
    ita=math.degrees(math.atan((L-50)/b)) if b else float('nan')
    print(f"{name:34s} L*{L} a*{a} b*{b} ITA {ita:5.1f}  linear ({lin[0]:.3f},{lin[1]:.3f},{lin[2]:.3f})  sRGB #{''.join(f'{round(x*255):02x}' for x in s)}")
for n,v in [("light E.Asian cheek (est.)",(65,10,16)),("lighter, young (est.)",(68,9,15)),("forehead (yellower, est.)",(64,9,18)),
            ("nose ala / cheek flush (est.)",(60,15,16)),("under-eye (est.)",(58,9,12)),("lip vermilion natural (est.)",(52,22,10))]:
    show(n,*v)
# chromophore weights at representative band centres (R 610, G 550, B 465 nm)
mel=lambda l: 6.6e11*l**-3.33
w=[mel(610),mel(550),mel(465)]; print("melanin mu_a ratio R:G:B =", [round(x/w[2],3) for x in w])
# Prahl molar extinction (cm-1/M), from memory, approximate: HbO2 / Hb at 610, 550, 465(=~460)
hbo2={610:1506,550:43016,460:33209}; hb={610:9443,550:53412,460:16156}
o=[hbo2[610],hbo2[550],hbo2[460]]; d=[hb[610],hb[550],hb[460]]
print("oxy-Hb ratio R:G:B =",[round(x/max(o),3) for x in o]); print("deoxy-Hb ratio R:G:B =",[round(x/max(d),3) for x in d])
# Christensen-Burley s (eq.6) for UE default surface albedo; d = mfp / s
A=(0.91058,0.338275,0.2718); mfp=[2.6748*c for c in (1.0,0.1983/2.229,0.1607/2.229)]
for i,ch in enumerate("RGB"):
    s=1.9-A[i]+3.5*(A[i]-0.8)**2
    print(f"UE default {ch}: albedo {A[i]:.3f}  s={s:.3f}  mfp*0.1 = {mfp[i]*0.1*10:.3f} mm  d = {mfp[i]*0.1*10/s:.3f} mm")
# Jensen 2001 skin1 (memory): sigma_s' and sigma_a in 1/mm
ss=(0.74,0.88,1.01); sa=(0.032,0.17,0.48)
for i,ch in enumerate("RGB"):
    st=ss[i]+sa[i]; tr=math.sqrt(3*sa[i]*st); print(f"skin1 {ch}: mfp {1/st:.2f} mm, dmfp(1/sigma_tr) {1/tr:.2f} mm, alpha' {ss[i]/st:.3f}")
# roughness conversions
for m in (0.3,0.35,0.45): print(f"Beckmann/GGX alpha {m} -> perceptual roughness {math.sqrt(m):.2f}")
for r in (0.45,0.5,0.55):
    print(f"UE dual lobe for material roughness {r}: lobe0 {max(min(r*0.75,1),0.02):.3f} (15%), lobe1 {min(r*1.3,1):.3f} (85%)")
