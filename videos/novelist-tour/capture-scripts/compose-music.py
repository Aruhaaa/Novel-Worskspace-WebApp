"""Composes the 63 s music bed for the Novelist Workspace tour with numpy only.

Soft piano arpeggios over a quiet pad, in D major. The first note lands on "world"
(frame 1, ~3.0 s), the line lifts a whole step at 51 s ("on your phone"), and the last
chord rings out over the final 3-4 seconds. Deterministic: a fixed seed, no clock.

usage: python3 compose-music.py <out.wav>
"""
import sys
import wave

import numpy as np

SR = 44100
TOTAL = 63.0
TAIL = 4.0  # render past the end so the last chord can ring, then trim
rng = np.random.default_rng(20261014)

N = int((TOTAL + TAIL) * SR)
L = np.zeros(N, dtype=np.float64)
R = np.zeros(N, dtype=np.float64)
PADL = np.zeros(N, dtype=np.float64)
PADR = np.zeros(N, dtype=np.float64)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(buf_l, buf_r, sig, t0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    n = min(len(sig), N - i0)
    gl = np.cos((pan + 1) * np.pi / 4)
    gr = np.sin((pan + 1) * np.pi / 4)
    buf_l[i0:i0 + n] += sig[:n] * gl
    buf_r[i0:i0 + n] += sig[:n] * gr


def piano(midi, dur, vel):
    f0 = hz(midi)
    n = int(dur * SR)
    t = np.arange(n) / SR
    tau = 3.4 if f0 < 200 else (2.1 if f0 < 500 else 1.3)
    sig = np.zeros(n)
    for k in range(1, 11):
        fk = k * f0 * np.sqrt(1 + 0.00018 * k * k)
        if fk > 9000:
            break
        a = (1.0 / k ** 1.25) * (vel ** (0.6 + 0.12 * k))
        dec = tau / (1 + 0.42 * (k - 1))
        for det in (-0.25, 0.25):  # two strings, a hair apart
            sig += 0.5 * a * np.sin(2 * np.pi * (fk + det * k * 0.3) * t) * np.exp(-t / dec)
    # felt hammer: a short soft noise burst
    nb = int(0.012 * SR)
    noise = rng.standard_normal(nb) * np.hanning(nb) * 0.02 * vel
    sig[:nb] += np.convolve(noise, np.ones(8) / 8, mode='same')
    att = int(0.004 * SR)
    sig[:att] *= np.linspace(0, 1, att)
    rel = int(0.35 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return sig * vel * 0.9


def pad_note(midi, dur, att=1.4, rel=1.8):
    f0 = hz(midi)
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for det in (-0.9, 0.0, 0.9):
        for k, a in ((1, 1.0), (2, 0.35), (3, 0.14), (4, 0.06)):
            sig += a * np.sin(2 * np.pi * (f0 * k + det) * t + rng.uniform(0, 6.28))
    env = np.ones(n)
    na, nr = int(att * SR), int(rel * SR)
    env[:na] = np.linspace(0, 1, na) ** 1.5
    env[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return sig * env / 3.0


def reverb_ir(seconds=2.6, decay=0.62, seed=1):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / decay)
    # darken the tail: smooth progressively harder
    out = ir.copy()
    for a in (0.55, 0.8):
        sm = np.zeros(n)
        acc = 0.0
        for i in range(n):
            acc = a * acc + (1 - a) * out[i]
            sm[i] = acc
        out = sm
    out[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    return out / np.sqrt(np.sum(out ** 2))


def convolve(x, ir):
    size = 1
    while size < len(x) + len(ir):
        size *= 2
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]


# ---- harmony ---------------------------------------------------------------
# (start second, tonic midi pitch class offset, chord name, bass, arpeggio notes)
def chord(root, quality):
    q = {
        'maj7': [0, 7, 11, 14, 16],
        'm7': [0, 7, 10, 15, 19],
        'sus': [0, 7, 12, 14, 19],
    }[quality]
    return [root + i for i in q]


# D major: I vi IV V, then lift a whole step to E major for the phone section
PLAN = [
    (4.0, 62, 'maj7'), (8.0, 59, 'm7'), (12.0, 55, 'maj7'), (16.0, 57, 'sus'),
    (20.0, 62, 'maj7'), (24.0, 59, 'm7'), (28.0, 55, 'maj7'), (32.0, 57, 'sus'),
    (36.0, 62, 'maj7'), (40.0, 59, 'm7'), (44.0, 55, 'maj7'), (48.0, 57, 'sus'),
    (51.0, 64, 'maj7'), (55.0, 61, 'm7'), (59.0, 64, 'maj7'),
]
ENDS = [p[0] for p in PLAN[1:]] + [TOTAL]


def level(t):
    """How present the piano is at second t."""
    if t < 10:
        return 0.55
    if t < 20:
        return 0.62
    if t < 43:
        return 0.78
    if t < 51:
        return 0.82
    if t < 59:
        return 0.95
    return 0.8


# ---- the first note: lands on "world" -----------------------------------------
add(L, R, piano(69, 6.0, 0.5), 2.95, -0.1)         # A4
add(L, R, piano(57, 6.0, 0.35), 2.95, 0.05)        # A3 underneath

# ---- piano arpeggios -----------------------------------------------------------
STEP = 0.5
PATTERN = [0, 1, 2, 3, 4, 3, 2, 1]
for (start, root, q), end in zip(PLAN, ENDS):
    notes = chord(root, q)
    bass = notes[0] - 24
    add(L, R, piano(bass, 5.0, 0.55 * level(start)), start, -0.05)
    last = start >= 59.0
    if last:
        # the closing chord: a slow broken chord that is left to ring
        for i, idx in enumerate([0, 1, 2, 3, 4]):
            add(L, R, piano(notes[idx] - 12 if idx == 0 else notes[idx], 7.0, 0.5 - 0.04 * i), start + 0.12 * i * 2.4, -0.3 + 0.15 * i)
        continue
    bar = end - start
    steps = int(round(bar / STEP))
    for s in range(steps):
        idx = PATTERN[s % len(PATTERN)]
        t = start + s * STEP + rng.normal(0, 0.008)
        sparse = start < 20.0
        if sparse and s % 2 == 1 and s not in (1, 5):
            continue  # frames 2-3: leave the room quiet
        vel = level(t) * (0.42 + 0.14 * rng.random()) * (1.15 if idx == 4 else 1.0) * (0.85 if s % 4 else 1.0)
        midi = notes[idx] + (12 if start >= 51.0 and idx >= 3 else 0)  # sparkle when the phone arrives
        add(L, R, piano(midi, 3.4, vel), t, rng.uniform(-0.35, 0.35))

# ---- pad ----------------------------------------------------------------------
for (start, root, q), end in zip(PLAN, ENDS):
    notes = chord(root, q)
    dur = (end - start) + 2.0
    for m in (notes[0] - 12, notes[1] - 12, notes[2]):
        add(PADL, PADR, pad_note(m, dur), start - 0.6, rng.uniform(-0.5, 0.5))
# a warm swell under the light-to-dark change at the reader (about 46-50 s)
sw0, sw1 = 45.0, 51.0
nsw = int((sw1 - sw0) * SR)
tsw = np.arange(nsw) / SR
env = np.sin(np.pi * np.clip(tsw / (sw1 - sw0), 0, 1)) ** 2
swell = sum(np.sin(2 * np.pi * hz(m) * tsw + rng.uniform(0, 6.28)) for m in (50, 57, 62, 66, 69)) * env
add(PADL, PADR, swell * 0.22, sw0, -0.3)
add(PADL, PADR, swell * 0.22, sw0, 0.3)

# ---- room tone -----------------------------------------------------------------
tone = rng.standard_normal(N)
acc = 0.0
rt = np.zeros(N)
for i in range(N):
    acc = 0.985 * acc + 0.015 * tone[i]
    rt[i] = acc
rt /= np.max(np.abs(rt))
tt = np.arange(N) / SR
rt_env = np.clip(tt / 1.0, 0, 1)
room = rt * rt_env * 0.012

# ---- reverb and mix --------------------------------------------------------------
irL, irR = reverb_ir(seed=11), reverb_ir(seed=29)
wet_l = convolve(L + 0.4 * PADL, irL)
wet_r = convolve(R + 0.4 * PADR, irR)
pre = int(0.02 * SR)
wet_l = np.concatenate([np.zeros(pre), wet_l[:-pre]])
wet_r = np.concatenate([np.zeros(pre), wet_r[:-pre]])

outL = L + 0.9 * PADL + 0.55 * wet_l + room
outR = R + 0.9 * PADR + 0.55 * wet_r + room * 0.9

# trim, fade the very end, soft-limit
n_out = int(TOTAL * SR)
outL, outR = outL[:n_out], outR[:n_out]
fade = int(2.2 * SR)
env_out = np.ones(n_out)
env_out[-fade:] = np.linspace(1, 0, fade) ** 1.6
fade_in = int(1.0 * SR)
env_out[:fade_in] *= np.linspace(0, 1, fade_in)
outL, outR = outL * env_out, outR * env_out
peak = max(np.max(np.abs(outL)), np.max(np.abs(outR)))
outL, outR = np.tanh(outL / peak * 1.1) * 0.78, np.tanh(outR / peak * 1.1) * 0.78

pcm = (np.stack([outL, outR], axis=1) * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'wrote {sys.argv[1]}: {TOTAL}s, peak {np.max(np.abs(pcm)) / 32767:.2f}')
