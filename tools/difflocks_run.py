"""DiffLocks' inference with torch.hub pointed at the local DINOv2 (tools/difflocks.py run starts this inside
unshare -rn, in DiffLocks' environment, from its source folder). Its own arguments pass through to
inference_difflocks.py."""
import os
import sys

import torch

_load = torch.hub.load


def local_hub(repo_or_dir, model, *args, **kw):
    """'facebookresearch/dinov2' from GitHub -> the clone setup made; its weights come from TORCH_HOME's cache"""
    if repo_or_dir == "facebookresearch/dinov2":
        kw.pop("source", None); kw.pop("trust_repo", None); kw.pop("force_reload", None)
        return _load(os.path.join(os.environ["DIFFLOCKS_HUB"], "dinov2"), model, *args, source="local", **kw)
    raise RuntimeError(f"torch.hub.load({repo_or_dir!r}) isn't one DiffLocks needs: refused")


torch.hub.load = local_hub
sys.path.insert(0, os.getcwd())
import inference_difflocks  # noqa: E402 - after the patch

sys.argv = ["inference_difflocks.py"] + sys.argv[1:]
inference_difflocks.run()
