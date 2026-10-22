"""A differentiable splatter for cylindrical 3D Gaussians in plain PyTorch (no CUDA extension to build; a GPU when torch
sees one). GaussianHair (Luo et al. 2024) renders its hair as 3DGS does: each Gaussian projected to a 2D Gaussian
(the EWA Jacobian, eq. 2), composited front to back (eq. 3). Here the projection, the pixel pairs and the compositing
are tensor ops: every (Gaussian, pixel) pair inside the Gaussian's 3-sigma box is listed, sorted by pixel then depth,
and the transmittance is a segmented cumulative sum of log(1 - alpha). Autograd gives the gradients.

A cylindrical Gaussian is an axis d (unit), a radius r across it and a sigma s along it: Sigma = r^2 I + (s^2 - r^2) d d^T
(the paper's R S S^T R^T with S = diag(r, r, s), without a rotation matrix: a cylinder doesn't care about the spin round
its axis). Any per-Gaussian features (colour, the orientation channels, depth) are splatted together.

Cameras are OpenCV's: x right, y down, z forward; R (3,3) world->camera, t (3); K = (fx, fy, cx, cy); pixel centres at +0.5.
"""
import math

import torch

DILATE = 0.3          # 3DGS's low-pass filter: a Gaussian never thinner than ~0.5 px, so a hair never falls between pixels
MIN_ALPHA = 1 / 255   # a pair with less isn't composited (3DGS)
MAX_ALPHA = 0.99


def rodrigues(w):
    """axis-angle (3,) -> rotation (3,3), differentiable"""
    th = torch.linalg.norm(w) + 1e-12
    k = w / th
    K = torch.stack([torch.stack([torch.zeros_like(th), -k[2], k[1]]), torch.stack([k[2], torch.zeros_like(th), -k[0]]),
                     torch.stack([-k[1], k[0], torch.zeros_like(th)])])
    return torch.eye(3, device=w.device, dtype=w.dtype) + torch.sin(th) * K + (1 - torch.cos(th)) * (K @ K)


def project(mu, axis, r, s, R, t, K):
    """means (N,3), axes (N,3) unit, r (N) or scalar, s (N): sigma along the axis -> uv (N,2), z (N), cov2d (N,3) as
    (a, b, c) of [[a, b], [b, c]] (dilated), d2 (N,2) the axis projected to the image plane (unnormalised)"""
    fx, fy, cx, cy = K
    tc = mu @ R.T + t
    z = tc[:, 2]
    zc = z.clamp(min=1e-3)
    x, y = tc[:, 0] / zc, tc[:, 1] / zc
    uv = torch.stack([fx * x + cx, fy * y + cy], 1)
    # the Jacobian rows of the affine projection at the centre
    J0 = torch.stack([fx / zc, torch.zeros_like(zc), -fx * x / zc], 1)       # (N,3)
    J1 = torch.stack([torch.zeros_like(zc), fy / zc, -fy * y / zc], 1)
    ac = axis @ R.T                                                           # the axis in the camera
    da = torch.stack([(J0 * ac).sum(1), (J1 * ac).sum(1)], 1)               # J R d: the axis on the image, (N,2)
    r2 = (r * r) if torch.is_tensor(r) else r * r
    k = s * s - r2
    a = r2 * (J0 * J0).sum(1) + k * da[:, 0] * da[:, 0] + DILATE
    b = r2 * (J0 * J1).sum(1) + k * da[:, 0] * da[:, 1]
    c = r2 * (J1 * J1).sum(1) + k * da[:, 1] * da[:, 1] + DILATE
    return uv, z, torch.stack([a, b, c], 1), da


def quat_to_mat(q):
    """unit quaternions (N,4) as (w, x, y, z) -> rotation matrices (N,3,3)"""
    q = q / (torch.linalg.norm(q, dim=1, keepdim=True) + 1e-12)
    w, x, y, z = q[:, 0], q[:, 1], q[:, 2], q[:, 3]
    return torch.stack([
        torch.stack([1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], 1),
        torch.stack([2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], 1),
        torch.stack([2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)], 1)], 1)


def project_cov(mu, cov, R, t, K, axis=None):
    """general Gaussians: cov (N,3,3) the world covariance -> uv, z, cov2d (a, b, c) dilated, d2 (the axis on the
    image, or None)"""
    fx, fy, cx, cy = K
    tc = mu @ R.T + t
    z = tc[:, 2]
    zc = z.clamp(min=1e-3)
    x, y = tc[:, 0] / zc, tc[:, 1] / zc
    uv = torch.stack([fx * x + cx, fy * y + cy], 1)
    J0 = torch.stack([fx / zc, torch.zeros_like(zc), -fx * x / zc], 1)
    J1 = torch.stack([torch.zeros_like(zc), fy / zc, -fy * y / zc], 1)
    M0, M1 = J0 @ R, J1 @ R                                                   # the rows of J R (N,3)
    SM0 = torch.einsum("nij,nj->ni", cov, M0); SM1 = torch.einsum("nij,nj->ni", cov, M1)
    a = (M0 * SM0).sum(1) + DILATE
    b = (M0 * SM1).sum(1)
    c = (M1 * SM1).sum(1) + DILATE
    d2 = None
    if axis is not None:
        ac = axis @ R.T
        d2 = torch.stack([(J0 * ac).sum(1), (J1 * ac).sum(1)], 1)
    return uv, z, torch.stack([a, b, c], 1), d2


def splat(uv, z, cov2d, opacity, feats, W, H, bg=None, max_radius=48, near=0.05, pair_budget=40_000_000):
    """composite the projected Gaussians: feats (N,C) -> image (H,W,C), alpha (H,W). bg (C,) or None (black).
    Returns (image, alpha, pairs) with pairs the number composited (for the log)."""
    N = uv.shape[0]
    dev = uv.device
    a, b, c = cov2d[:, 0], cov2d[:, 1], cov2d[:, 2]
    det = a * c - b * b
    lam = 0.5 * (a + c) + torch.sqrt((0.25 * (a - c) ** 2 + b * b).clamp(min=0))
    rad = torch.ceil(3 * torch.sqrt(lam.clamp(min=0))).clamp(max=max_radius)
    ok = (z > near) & (det > 1e-12) & (opacity > MIN_ALPHA)
    with torch.no_grad():
        u, v = uv[:, 0].detach(), uv[:, 1].detach()
        x0 = torch.floor(u - rad).clamp(0, W - 1).long(); x1 = torch.ceil(u + rad).clamp(0, W - 1).long()
        y0 = torch.floor(v - rad).clamp(0, H - 1).long(); y1 = torch.ceil(v + rad).clamp(0, H - 1).long()
        ok &= (u + rad >= 0) & (u - rad <= W - 1) & (v + rad >= 0) & (v - rad <= H - 1)
        w = torch.where(ok, x1 - x0 + 1, torch.zeros_like(x0)); h = torch.where(ok, y1 - y0 + 1, torch.zeros_like(y0))
        counts = w * h
        total = int(counts.sum())
        if total > pair_budget:
            raise RuntimeError(f"{total} pixel pairs: over the budget of {pair_budget}; a lower --res or fewer Gaussians")
        gid = torch.repeat_interleave(torch.arange(N, device=dev), counts)
        starts = torch.cumsum(counts, 0) - counts
        local = torch.arange(total, device=dev) - torch.repeat_interleave(starts, counts)
        wg = w[gid]
        px = x0[gid] + local % wg
        py = y0[gid] + local // wg
    # the Gaussian's weight at each pixel centre
    dx = px.to(uv.dtype) + 0.5 - uv[gid, 0]
    dy = py.to(uv.dtype) + 0.5 - uv[gid, 1]
    dg = det[gid]
    conA, conB, conC = c[gid] / dg, -b[gid] / dg, a[gid] / dg
    power = -0.5 * (conA * dx * dx + 2 * conB * dx * dy + conC * dy * dy)
    alpha = (opacity[gid] * torch.exp(power)).clamp(max=MAX_ALPHA)
    keep = (alpha >= MIN_ALPHA) & (power <= 0)
    gid, px, py, alpha = gid[keep], px[keep], py[keep], alpha[keep]
    pairs = int(gid.numel())
    C = feats.shape[1]
    img = torch.zeros(H * W, C, device=dev, dtype=feats.dtype)
    acc = torch.zeros(H * W, device=dev, dtype=feats.dtype)
    if pairs:
        with torch.no_grad():
            pix = py * W + px
            rank = torch.argsort(torch.argsort(z.detach()))                # nearer first
            order = torch.argsort(pix * N + rank[gid])
        pix, gid, alpha = pix[order], gid[order], alpha[order]
        with torch.no_grad():
            new = torch.ones_like(pix, dtype=torch.bool); new[1:] = pix[1:] != pix[:-1]
            seg = torch.cumsum(new.long(), 0) - 1
            seg_first = torch.nonzero(new).squeeze(1)
        logT = torch.log1p(-alpha).to(torch.float64)
        cs = torch.cumsum(logT, 0)
        before = cs - logT                                                 # the sum over the pairs before this one
        T = torch.exp(before - before[seg_first][seg]).to(feats.dtype)     # the transmittance in front of this pair
        wgt = T * alpha
        img.index_add_(0, pix, wgt[:, None] * feats[gid])
        acc.index_add_(0, pix, wgt)
    img = img.view(H, W, C); acc = acc.view(H, W)
    if bg is not None:
        img = img + (1 - acc)[..., None] * bg
    return img, acc, pairs


def render(mu, axis, r, s, opacity, feats, cam, bg=None, **kw):
    """the two steps in one: cam = dict(R, t, K, W, H)"""
    uv, z, cov, _ = project(mu, axis, r, s, cam["R"], cam["t"], cam["K"])
    img, acc, pairs = splat(uv, z, cov, opacity, feats, cam["W"], cam["H"], bg, **kw)
    return img, acc, pairs


def orient_feats(d2):
    """the projected axes (N,2) as doubled-angle unit vectors (cos 2t, sin 2t): a flip of the axis is the same hair"""
    n2 = (d2 * d2).sum(1) + 1e-12
    return torch.stack([(d2[:, 0] ** 2 - d2[:, 1] ** 2) / n2, 2 * d2[:, 0] * d2[:, 1] / n2], 1)


def gaussian_window(size=11, sigma=1.5, device="cpu", dtype=torch.float32):
    g = torch.tensor([math.exp(-((x - size // 2) ** 2) / (2 * sigma ** 2)) for x in range(size)], device=device, dtype=dtype)
    g = g / g.sum()
    return (g[:, None] @ g[None, :])[None, None]


def ssim(a, b, mask=None):
    """SSIM (H,W,C) images in [0,1], 11x11 Gaussian window as 3DGS; mean over the mask if given"""
    C = a.shape[2]
    x = a.permute(2, 0, 1)[None]; y = b.permute(2, 0, 1)[None]
    win = gaussian_window(device=a.device, dtype=a.dtype).expand(C, 1, 11, 11)
    f = lambda t: torch.nn.functional.conv2d(t, win, padding=5, groups=C)
    mx, my = f(x), f(y)
    sxx, syy, sxy = f(x * x) - mx * mx, f(y * y) - my * my, f(x * y) - mx * my
    c1, c2 = 0.01 ** 2, 0.03 ** 2
    m = ((2 * mx * my + c1) * (2 * sxy + c2)) / ((mx * mx + my * my + c1) * (sxx + syy + c2))
    m = m[0].mean(0)
    if mask is None: return m.mean()
    return (m * mask).sum() / (mask.sum() + 1e-6)


def psnr(a, b, mask=None):
    e = (a - b) ** 2
    if mask is not None: e = e[mask > 0.5]
    mse = e.mean().clamp(min=1e-10)
    return float(10 * torch.log10(1 / mse))
