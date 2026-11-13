# fitw.py '{"name": {measure: cm, ...}}': MHR body weights from target measures, starting from bodyv2's (mhr.py
# fit_measures; the head's measures held), added to ../alter/out/weights.json (what alter/meas.mjs reads)
import sys, json, os; H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, '..', '..', '..', '..'); sys.path.insert(0, os.path.join(R, 'tools', 'character'))
import mhr, numpy as np
m = mhr.load(); d = json.load(open(os.path.join(R, 'Content', 'Studio', 'Bodies', 'MHR_presets.json')))['presets']; b2 = np.array(d['bodyv2']); a, b = m["header"]["groups"]["body"]
F = os.path.join(H, '..', 'alter', 'out', 'weights.json'); out = json.load(open(F)) if os.path.exists(F) else {}
for name, t in json.loads(sys.argv[1]).items():
    hold = {n: v for n, v in mhr.measures(mhr.body(b2, m), m).items() if n in mhr.GROUP_MEASURES["head"]}
    f = mhr.fit_measures({**t, **hold}, start=b2, keep=0.02, groups=("body",), steps=60, mhr=m); w = b2.copy(); w[a:b] = f[a:b]
    ms = mhr.measures(mhr.body(w, m), m); out[name] = [round(float(x), 4) for x in w]
    print(name, {k: round(ms[k], 1) for k in t}, mhr.girths(mhr.body(w, m)), "max |w|", round(float(np.abs(w[a:b]).max()), 2))
json.dump(out, open(F, 'w'))
