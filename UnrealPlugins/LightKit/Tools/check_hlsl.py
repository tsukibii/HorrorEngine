"""Compile every Custom node in Content/Python/lightkit_materials.py with DXC, the way Unreal wraps it: a function
whose parameters are the node's inputs, called from a pixel shader. No editor needed.

    DXC=/path/to/dxc-linux python Tools/check_hlsl.py      (the folder with bin/dxc and lib/)

DXC: github.com/microsoft/DirectXShaderCompiler/releases (linux_dxc_*.tar.gz). Ends "HLSL ok".
"""
import importlib.util
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TYPES = {"uv": "float2", "time": "float", "scalar": "float", "vector": "float4", "worldpos": "float3",
         "normal": "float3", "camera": "float3", "scenedepth": "float", "pixeldepth": "float"}


def main():
    spec = importlib.util.spec_from_file_location("lightkit_materials",
                                                  os.path.join(HERE, "..", "Content", "Python", "lightkit_materials.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    dxc = os.environ.get("DXC")
    if not dxc:
        sys.exit("set DXC to the unpacked DXC release folder")
    env = dict(os.environ, LD_LIBRARY_PATH=os.path.join(dxc, "lib"))
    bad = 0
    for name, (_kind, code, outputs, inputs) in mod.MATERIALS.items():
        ret = "float3" if outputs == 3 else "float"
        params = ", ".join(f"{TYPES[src]} {n}" for n, src, _ in inputs)
        args = ", ".join(f"({TYPES[src]})0.37" for n, src, _ in inputs)
        src = f"{ret} CustomExpression0({params})\n{{\n{code}\n}}\n\n" \
              f"float4 MainPS(float4 Pos : SV_POSITION) : SV_Target0\n{{\n    return float4(CustomExpression0({args}).xxx * 1.0, 1.0);\n}}\n"
        if ret == "float3":
            src = src.replace(".xxx * 1.0", " * 1.0")
        with tempfile.NamedTemporaryFile("w", suffix=".hlsl", delete=False) as f:
            f.write(src)
        for extra in ([], ["-spirv"]):
            r = subprocess.run([os.path.join(dxc, "bin", "dxc"), *extra, "-T", "ps_6_0", "-E", "MainPS", "-HV", "2021",
                                f.name, "-Fo", os.devnull], capture_output=True, text=True, env=env)
            msg = (r.stdout + r.stderr).strip()
            if r.returncode or "warning" in msg:
                bad += 1
                print(f"{name} {'spirv' if extra else 'dxil'}:\n{msg}\n")
        os.unlink(f.name)
        print(f"{name}: compiled")
    if bad:
        sys.exit(f"HLSL: {bad} problems")
    print("HLSL ok")


if __name__ == "__main__":
    main()
