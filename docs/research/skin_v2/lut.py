import math
# d'Eon & Luebke 2007 sum of Gaussians for skin (variance mm^2, RGB weights), as in iryoku/separable-sss SeparableSSS.h
G=[(0.0064,(0.233,0.455,0.649)),(0.0484,(0.100,0.336,0.344)),(0.187,(0.118,0.198,0.0)),
   (0.567,(0.113,0.007,0.007)),(1.99,(0.358,0.004,0.0)),(7.41,(0.078,0.0,0.0))]
def R(d):  # 2D normalised Gaussians: exp(-d^2/2v)/(2 pi v)
    return [sum(w[c]*math.exp(-d*d/(2*v))/(2*math.pi*v) for v,w in G) for c in range(3)]
def D(theta, r, N=2048):  # Penner: ring of radius r (mm), chord 2r sin(x/2)
    num=[0,0,0]; den=[0,0,0]
    for k in range(N):
        x=-math.pi+2*math.pi*(k+0.5)/N; p=R(2*r*abs(math.sin(x/2))); c=max(math.cos(theta+x),0)
        for i in range(3): num[i]+=c*p[i]; den[i]+=p[i]
    return [num[i]/den[i] for i in range(3)]
print("Pre-integrated diffuse D(NdotL, r) vs Lambert, RGB:")
for r in (3,6,15,50):
    row=[]
    for ndl in (0.5,0.2,0.0,-0.2):
        d=D(math.acos(ndl),r); row.append(f"N.L {ndl:+.1f}: ({d[0]:.3f},{d[1]:.3f},{d[2]:.3f}) L={max(ndl,0):.2f}")
    print(f" r={r:>3} mm |", " | ".join(row))
print("Thin-skin transmittance T(d)=sum w exp(-d^2/v) (Jimenez SSSSTransmittance form), d in mm:")
for d in (0.25,0.5,1.0,2.0,3.0):
    t=[sum(w[c]*math.exp(-d*d/v) for v,w in G) for c in range(3)]
    print(f" d={d:4.2f}: ({t[0]:.3f},{t[1]:.4f},{t[2]:.4f})")
print("Small radii (where the LUT's red band lives):")
for r in (0.5,1.0,2.0):
    row=[]
    for ndl in (0.3,0.0,-0.3):
        d=D(math.acos(ndl),r); row.append(f"N.L {ndl:+.1f}: ({d[0]:.3f},{d[1]:.3f},{d[2]:.3f})")
    print(f" r={r:>3} mm |", " | ".join(row))
