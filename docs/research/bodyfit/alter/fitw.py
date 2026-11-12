# fitw.py: MHR body weights for the two alterations of bodyv2, from target measures (mhr.py fit_measures), into bodies/weights.json
import sys, json; import os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'tools', 'character'))
import mhr, numpy as np
m = mhr.load(); d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'Content', 'Studio', 'Bodies', 'MHR_presets.json')))['presets']; b2 = np.array(d['bodyv2']); a, b = m["header"]["groups"]["body"]
T = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {
 "athletic": dict(shoulders=49.0, chest=23.5, bust=14.5, waist=31.5, belly=12.8, hips=38.5, seat=-12.6, thighs=15.8, neck=13.4),
 "hourglass": dict(shoulders=48.5, chest=25.0, bust=17.0, waist=32.5, belly=13.6, hips=44.0, seat=-14.2, thighs=17.8, neck=14.0)}
out = {}
for name, t in T.items():
    hold = {n: v for n, v in mhr.measures(mhr.body(b2, m), m).items() if n in mhr.GROUP_MEASURES["head"]}
    f = mhr.fit_measures({**t, **hold}, start=b2, keep=0.02, groups=("body",), steps=60, mhr=m); w = b2.copy(); w[a:b] = f[a:b]
    ms = mhr.measures(mhr.body(w, m), m); out[name] = [round(float(x), 4) for x in w]
    print(name, {k: round(ms[k], 1) for k in t}, mhr.girths(mhr.body(w, m)), "max |w|", round(float(np.abs(w[a:b]).max()), 2))
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'weights.json'), 'w'))
