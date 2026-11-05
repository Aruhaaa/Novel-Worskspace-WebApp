"""Composes the sound effects for the Novelist Workspace tour, numpy only.

One stereo WAV per frame, with every cue already placed at its time inside the
frame, so the project mounts one clip per frame at the frame's start.
Times follow the beat grid of the music (96 BPM, beat 0.625 s, bar 2.5 s) and the
motion in compositions/frames. Deterministic (fixed seed).
usage: python3 compose-sfx.py <out-dir>
"""
import os
import sys
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(1014)

FRAME_SECONDS = {1: 5.0, 2: 5.0, 3: 7.5, 4: 7.5, 5: 7.5, 6: 5.0, 7: 7.5, 8: 7.5, 9: 5.0}
# loudest sample of each frame's effects track (the music peaks at about 0.6)
TARGET_PEAK = {1: 0.4, 2: 0.4, 3: 0.3, 4: 0.45, 5: 0.5, 6: 0.45, 7: 0.4, 8: 0.5, 9: 0.2}


def band(x, lo, hi):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.clip((f - lo) / max(lo * 0.3, 1), 0, 1) * np.clip((hi - f) / max(hi * 0.3, 1), 0, 1)
    return np.fft.irfft(spec * m, len(x))


def paper_soft():
    n = int(0.42 * SR)
    x = band(rng.standard_normal(n), 1500, 7000)
    t = np.arange(n) / SR
    e = np.minimum(t / 0.05, 1) * np.exp(-np.maximum(t - 0.05, 0) / 0.12)
    return x * e * 0.5


def tick(pitch=1800.0):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    click = band(rng.standard_normal(n), 1200, 6000) * np.exp(-t / 0.004) * 0.5
    body = np.sin(2 * np.pi * pitch * t) * np.exp(-t / 0.018) * 0.45
    return click + body


def clock_tick(low=False):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 980.0 if low else 1320.0
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.022) * 0.5
            + band(rng.standard_normal(n), 800, 5000) * np.exp(-t / 0.006) * 0.4)


def tap_soft():
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (170 - 60 * np.minimum(t / 0.08, 1)) * t) * np.exp(-t / 0.045) * 0.7
    skin = band(rng.standard_normal(n), 500, 3500) * np.exp(-t / 0.012) * 0.25
    return thump + skin


def key_soft(vel):
    n = int(0.11 * SR)
    t = np.arange(n) / SR
    click = band(rng.standard_normal(n), 900, 4200) * np.exp(-t / 0.005) * 0.6
    thud = np.sin(2 * np.pi * 220 * t) * np.exp(-t / 0.02) * 0.35
    return (click + thud) * vel


def whoosh(length=0.6, rev=False):
    """Air moving past: the band sweeps up while the level rises and falls."""
    n = int(length * SR)
    t = np.arange(n) / SR
    low = band(rng.standard_normal(n), 250, 1400)
    high = band(rng.standard_normal(n), 1800, 7500)
    p = np.clip(t / length, 0, 1)
    if rev:
        p = 1 - p
    mix = low * (1 - p) + high * p
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2.2
    return mix * env * 0.7


def slam():
    """A word landing: a short low thump with a tick of air on top."""
    n = int(0.38 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (46 + 70 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.09) * 0.9
    air = band(rng.standard_normal(n), 900, 5200) * np.exp(-t / 0.05) * 0.35
    tick_ = band(rng.standard_normal(n), 2500, 9000) * np.exp(-t / 0.008) * 0.3
    return thump + air + tick_


def slam_soft():
    return slam() * 0.55


def thud():
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (38 + 40 * np.exp(-t / 0.05)) * t) * np.exp(-t / 0.2)
    return body * 0.9 + band(rng.standard_normal(n), 80, 500) * np.exp(-t / 0.05) * 0.4


def pencil_stroke(length=0.5):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = band(rng.standard_normal(n), 2500, 8500)
    wob = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 7.5 * t))
    e = np.minimum(t / 0.04, 1) * np.minimum((length - t) / 0.08, 1)
    return x * wob * e * 0.45


def chime_soft():
    n = int(2.4 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f0, g, delay in ((880.0, 0.5, 0.0), (1318.5, 0.32, 0.11)):
        i0 = int(delay * SR)
        tt = t[: n - i0]
        note = sum(a * np.sin(2 * np.pi * f0 * k * tt) * np.exp(-tt / d)
                   for k, a, d in ((1, 1.0, 1.1), (2.76, 0.28, 0.5), (5.4, 0.08, 0.2)))
        note *= np.minimum(tt / 0.006, 1)
        out[i0:] += note * g
    return out


def warm_swell(length=2.8):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = band(rng.standard_normal(n), 120, 1100)
    e = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2.2
    tone = sum(np.sin(2 * np.pi * f * t) for f in (146.8, 220.0, 293.7)) * 0.12
    return (x * 0.6 + tone) * e * 0.5


def typing(start, end):
    cues = []
    t = start
    while t < end - 0.1:
        for _ in range(int(rng.integers(3, 8))):
            cues.append((t, rng.uniform(0.35, 0.8)))
            t += rng.uniform(0.09, 0.2)
            if t >= end:
                break
        t += rng.uniform(0.35, 0.9)
    return cues


# (frame, time, sound, gain, pan)
CUES = [
    # 1 Cover: the music carries the riser and the first impact; these are the words landing
    (1, 2.65, slam, 0.7, -0.2), (1, 3.17, slam, 0.7, -0.2), (1, 3.2, lambda: whoosh(0.9), 0.35, 0.3),
    # 2 Contents
    (2, 0.3, slam, 0.6, -0.1), (2, 0.9, slam, 0.6, -0.1),
    *[(2, 1.25 + 0.2 * i, (lambda i=i: tick(1500 + 120 * i)), 0.5, -0.3 + 0.05 * i) for i in range(6)],
    (2, 2.45, lambda: whoosh(0.6), 0.5, 0.35), (2, 3.1, lambda: whoosh(0.5), 0.4, 0.2),
    (2, 3.4, tap_soft, 0.4, 0.3), (2, 4.2, tap_soft, 0.4, 0.3),
    # 3 Write
    (3, 0.3, slam, 0.6, -0.1), (3, 0.9, slam, 0.6, -0.1), (3, 0.4, lambda: whoosh(0.7), 0.45, 0.35),
    *[(3, t, (lambda v=v: key_soft(v)), 0.3, rng.uniform(-0.15, 0.15)) for t, v in typing(1.5, 6.2)],
    (3, 1.2, lambda: whoosh(0.7), 0.5, 0.0), (3, 3.1, lambda: whoosh(0.55), 0.5, -0.3),
    (3, 4.35, lambda: whoosh(0.6), 0.5, 0.3), (3, 6.2, lambda: whoosh(0.8, rev=True), 0.4, 0.0),
    # 4 Plan
    (4, 0.3, slam, 0.6, -0.1), (4, 0.9, slam, 0.6, -0.1), (4, 0.35, lambda: whoosh(0.7), 0.45, 0.3),
    (4, 1.3, thud, 0.45, 0.0), (4, 1.875, lambda: whoosh(0.6), 0.5, 0.3), (4, 2.7, thud, 0.5, 0.0),
    (4, 3.75, lambda: whoosh(0.6), 0.5, 0.3), (4, 4.6, thud, 0.5, 0.0), (4, 5.625, lambda: whoosh(0.6), 0.45, -0.2),
    # 5 Track
    (5, 0.1, lambda: whoosh(0.8), 0.45, -0.3), (5, 0.4, slam, 0.7, -0.1), (5, 0.9, lambda: pencil_stroke(0.5), 0.55, -0.2),
    (5, 0.95, thud, 0.4, 0.0), (5, 1.9, slam, 0.7, -0.1), (5, 1.9, lambda: whoosh(0.6), 0.4, 0.4),
    *[(5, 2.0 + 0.3 * i, (lambda i=i: clock_tick(i % 2 == 1)), 0.45, 0.2) for i in range(4)],
    (5, 3.125, chime_soft, 0.55, 0.0), (5, 3.125, thud, 0.7, 0.0), (5, 3.125, slam, 0.6, 0.2),
    (5, 4.4, slam, 0.7, -0.1), (5, 4.4, lambda: whoosh(1.3, rev=False), 0.35, 0.0),
    # 6 In and out
    (6, 0.3, slam, 0.6, -0.1), (6, 0.3, lambda: whoosh(0.7), 0.5, -0.45),
    *[(6, 1.25 + 0.2 * i, (lambda i=i: tick(1500 + 120 * i)), 0.45, -0.3) for i in range(4)],
    (6, 2.0, lambda: pencil_stroke(0.5), 0.45, 0.0), (6, 2.45, lambda: whoosh(0.7), 0.5, 0.45),
    (6, 2.5, slam, 0.7, 0.1), (6, 2.5, thud, 0.6, 0.0),
    # 7 Read
    (7, 0.3, lambda: whoosh(0.7), 0.45, 0.0), (7, 1.2, lambda: whoosh(0.6), 0.4, 0.35),
    (7, 1.9, slam, 0.6, -0.1), (7, 2.5, slam, 0.7, -0.1), (7, 2.5, lambda: warm_swell(2.6), 0.55, 0.0),
    (7, 4.2, lambda: whoosh(0.5), 0.35, 0.3), (7, 4.6, lambda: whoosh(0.6), 0.4, 0.3),
    # 8 Two doors
    (8, 0.3, slam, 0.6, -0.1), (8, 0.6, lambda: whoosh(0.6), 0.4, -0.4),
    *[(8, t, tap_soft, 0.5, p) for t, p in ((1.05, -0.5), (1.7, -0.17), (2.3, 0.17), (2.95, 0.5))],
    (8, 2.5, slam, 0.8, 0.0), (8, 2.5, thud, 0.7, 0.0),
    # 9 Close
    (9, 0.5, slam_soft, 0.7, 0.0), (9, 1.2, slam_soft, 0.7, 0.0),
]


def write_wav(path, left, right):
    pcm = (np.clip(np.stack([left, right], axis=1), -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


out_dir = sys.argv[1]
os.makedirs(out_dir, exist_ok=True)
for frame, dur in FRAME_SECONDS.items():
    mine = [c for c in CUES if c[0] == frame]
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for _, t, fn, gain, pan in mine:
        sig = fn() * gain
        i0 = int(t * SR)
        m = min(len(sig), n - i0)
        if m <= 0:
            continue
        gl = np.cos((pan + 1) * np.pi / 4)
        gr = np.sin((pan + 1) * np.pi / 4)
        L[i0:i0 + m] += sig[:m] * gl
        R[i0:i0 + m] += sig[:m] * gr
    peak = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9)
    L, R = L / peak * TARGET_PEAK[frame], R / peak * TARGET_PEAK[frame]
    path = os.path.join(out_dir, f'sfx-frame-{frame:02d}.wav')
    write_wav(path, L, R)
    print(f'frame {frame}: {len(mine)} cues, {dur}s -> {path}')
