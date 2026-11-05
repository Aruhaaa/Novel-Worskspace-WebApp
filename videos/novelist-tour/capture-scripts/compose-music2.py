"""Cinematic music for the Novelist Workspace tour (no voice), numpy only.

96 BPM, one beat = 0.625 s, one bar = 2.5 s, 57.5 s long. D minor, a Picardy lift to D major
at the very end. Everything is placed on the beat grid so cuts and hits line up with the picture:

  0.0-2.5   sub drone + riser                    frame 1 (dark open)
  2.5       IMPACT, 3.125 small hit              the paper floods in, the title slams
  5.0-17.5  heartbeat + soft plucked arpeggio    frames 2-3
  17.5-32.5 builds: pad, kick, hats, claps       frames 4-5
  32.5/35.0 hits on the in/out frame             frame 6
  37.5-45.0 the breath: pad and sparse piano     frame 7, then a big riser
  45.0      CLIMAX hit, 47.5 hit                 frame 8 (phones)
  52.5-57.5 pad + piano, final D major           frame 9 (resolve)

Deterministic: a fixed seed, no clock. usage: python3 compose-music2.py <out.wav>
"""
import sys
import wave

import numpy as np

SR = 44100
BEAT = 0.625
BAR = 2.5
TOTAL = 57.5
TAIL = 4.0
rng = np.random.default_rng(96)
N = int((TOTAL + TAIL) * SR)

# stereo buses: dry, and a reverb send
DL, DR = np.zeros(N), np.zeros(N)
SL, SR_ = np.zeros(N), np.zeros(N)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def put(sig, t0, gain=1.0, pan=0.0, send=0.0):
    i0 = int(t0 * SR)
    if i0 >= N or i0 < 0:
        return
    n = min(len(sig), N - i0)
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    s = sig[:n] * gain
    DL[i0:i0 + n] += s * gl
    DR[i0:i0 + n] += s * gr
    if send:
        SL[i0:i0 + n] += s * gl * send
        SR_[i0:i0 + n] += s * gr * send


def band_noise(n, lo, hi):
    x = rng.standard_normal(n)
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.clip((f - lo) / max(lo * 0.3, 1), 0, 1) * np.clip((hi - f) / max(hi * 0.3, 1), 0, 1)
    return np.fft.irfft(spec * m, n)


# ---- instruments -------------------------------------------------------------
def piano(midi, dur, vel):
    f0 = hz(midi)
    n = int(dur * SR)
    t = np.arange(n) / SR
    tau = 3.2 if f0 < 200 else (2.0 if f0 < 500 else 1.2)
    sig = np.zeros(n)
    for k in range(1, 11):
        fk = k * f0 * np.sqrt(1 + 0.00018 * k * k)
        if fk > 9000:
            break
        a = (1.0 / k ** 1.25) * (vel ** (0.6 + 0.12 * k))
        dec = tau / (1 + 0.42 * (k - 1))
        for det in (-0.25, 0.25):
            sig += 0.5 * a * np.sin(2 * np.pi * (fk + det * k * 0.3) * t) * np.exp(-t / dec)
    nb = int(0.012 * SR)
    sig[:nb] += np.convolve(rng.standard_normal(nb) * np.hanning(nb) * 0.02 * vel, np.ones(8) / 8, mode='same')
    att = int(0.004 * SR)
    sig[:att] *= np.linspace(0, 1, att)
    rel = int(0.35 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return sig * vel * 0.9


def pluck(midi, dur, vel):
    """A bright, short synth pluck: saw-like partials that darken quickly."""
    f0 = hz(midi)
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k in range(1, 14):
        fk = k * f0
        if fk > 10000:
            break
        a = 1.0 / k ** 1.05
        dec = 0.55 / (1 + 0.55 * (k - 1) ** 0.8)
        sig += a * np.sin(2 * np.pi * fk * t + 0.3 * k) * np.exp(-t / max(dec, 0.02))
        sig += 0.6 * a * np.sin(2 * np.pi * (fk * 1.004) * t) * np.exp(-t / max(dec, 0.02))
    att = int(0.003 * SR)
    sig[:att] *= np.linspace(0, 1, att)
    rel = int(0.08 * SR)
    sig[-rel:] *= np.linspace(1, 0, rel)
    return sig * vel * 0.33


def pad(midis, dur, att=1.6, rel=1.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for m in midis:
        f0 = hz(m)
        for det in (-1.1, 0.0, 1.1):
            for k in range(1, 9):
                sig += (1.0 / k ** 1.3) * np.sin(2 * np.pi * (f0 * k + det * k * 0.5) * t + rng.uniform(0, 6.28))
    env = np.ones(n)
    na, nr = int(att * SR), min(int(rel * SR), n)
    env[:na] = np.linspace(0, 1, na) ** 1.6
    env[-nr:] *= np.linspace(1, 0, nr) ** 1.6
    return sig * env / (len(midis) * 3.5)


def sub(midi, dur, vel):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f0 = hz(midi)
    sig = np.sin(2 * np.pi * f0 * t) + 0.35 * np.sin(2 * np.pi * 2 * f0 * t) + 0.12 * np.sin(2 * np.pi * 3 * f0 * t)
    env = np.minimum(t / 0.04, 1) * np.exp(-t / (dur * 0.55))
    rel = int(0.2 * SR)
    env[-rel:] *= np.linspace(1, 0, rel)
    return sig * env * vel * 0.5


def kick(vel):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 42 + 95 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.15)
    click = band_noise(n, 1500, 5000) * np.exp(-t / 0.004) * 0.25
    return (body + click) * vel * 0.9


def hat(vel):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    return band_noise(n, 6500, 15000) * np.exp(-t / 0.018) * vel * 0.45


def clap(vel):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    body = band_noise(n, 1200, 6500) * (np.exp(-t / 0.08) + 0.5 * np.exp(-((t - 0.012) / 0.006) ** 2))
    return body * vel * 0.6


def riser(dur, level=1.0):
    """Noise that sweeps up in pitch and gets louder, with a rising tone underneath."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # spectral sweep: a band-pass whose centre moves up exponentially
    size, hop = 2048, 512
    win = np.hanning(size)
    out = np.zeros(n + size)
    for i in range(0, n - size, hop):
        fr = noise[i:i + size] * win
        spec = np.fft.rfft(fr)
        f = np.fft.rfftfreq(size, 1 / SR)
        p = (i / n)
        fc = 250 * (9000 / 250) ** p
        m = np.exp(-((np.log2(np.maximum(f, 1) / fc)) ** 2) / (2 * 0.9 ** 2))
        out[i:i + size] += np.fft.irfft(spec * m, size) * win
    out = out[:n]
    env = (t / dur) ** 2.4
    tone_f = 110 * (1760 / 110) ** (t / dur)
    tone = np.sin(2 * np.pi * np.cumsum(tone_f) / SR) * 0.07
    sig = (out / (np.max(np.abs(out)) + 1e-9) * 0.9 + tone) * env
    sig[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return sig * level * 0.55


def impact(scale=1.0):
    n = int(4.0 * SR)
    t = np.arange(n) / SR
    f = 28 + 60 * np.exp(-t / 0.18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * np.exp(-t / 1.1)
    crash = band_noise(n, 300, 12000) * np.exp(-t / 0.7) * np.minimum(t / 0.006, 1)
    crash2 = band_noise(n, 3000, 14000) * np.exp(-t / 1.4) * 0.35
    thud = band_noise(n, 60, 400) * np.exp(-t / 0.12) * 0.8
    return (boom * 0.95 + crash * 0.5 + crash2 * 0.5 + thud * 0.5) * scale


def shimmer(midi, dur=3.0, vel=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f0 = hz(midi)
    sig = sum(np.sin(2 * np.pi * f0 * k * t) / k * np.exp(-t / (1.4 / k ** 0.5)) for k in (1, 2, 3, 5))
    sig *= np.minimum(t / 0.01, 1)
    return sig * vel * 0.4


# ---- harmony -------------------------------------------------------------------
CHORDS = {
    'Dm': dict(bass=38, pad=[50, 53, 57], arp=[62, 65, 69, 74, 77]),
    'Bb': dict(bass=34, pad=[46, 50, 53], arp=[58, 62, 65, 70, 74]),
    'F': dict(bass=41, pad=[48, 53, 57], arp=[57, 60, 65, 69, 72]),
    'C': dict(bass=36, pad=[48, 52, 55], arp=[55, 60, 64, 67, 72]),
    'D': dict(bass=38, pad=[50, 54, 57], arp=[62, 66, 69, 74, 78]),
}
CYCLE = ['Dm', 'Bb', 'F', 'C']
NBARS = int(round(TOTAL / BAR))  # 23


def chord_of(bar):
    if bar == 22:
        return 'D'
    return CYCLE[(bar - 1) % 4]


def bar_t(b):
    return b * BAR


# ---- drone and cold open (bar 0) --------------------------------------------------
n_open = int(2.7 * SR)
t = np.arange(n_open) / SR
drone = (np.sin(2 * np.pi * hz(26) * t) * 0.9 + np.sin(2 * np.pi * hz(38) * t) * 0.35 + np.sin(2 * np.pi * hz(45) * t) * 0.2)
drone *= np.minimum(t / 1.4, 1) ** 1.5
put(drone, 0.0, 0.55, 0.0, 0.1)
put(riser(2.5, 0.9), 0.0, 1.0, 0.0, 0.25)
for tt in (1.25, 1.875, 2.19):  # two low heartbeats and a flutter before the hit
    put(kick(0.55), tt, 0.7)

# ---- bars -------------------------------------------------------------------------
def level(t):
    if t < 5: return 0.0
    if t < 10: return 0.45
    if t < 17.5: return 0.55
    if t < 25: return 0.7
    if t < 37.5: return 0.85
    if t < 45: return 0.5
    if t < 52.5: return 1.0
    return 0.5


for b in range(1, NBARS):
    t0 = bar_t(b)
    ch = CHORDS[chord_of(b)]
    lv = level(t0)
    # sub bass: one long note per bar once the music has started
    if t0 >= 5.0 and not (t0 >= 52.5 and b != 22):
        put(sub(ch['bass'], BAR - 0.05, 0.9 if t0 >= 25 else 0.6), t0, 0.7 * (0.6 if t0 >= 37.5 and t0 < 45 else 1.0), 0, 0.05)
    # pad
    if t0 >= 5.0:
        put(pad(ch['pad'], BAR + 2.0), t0 - 0.9, 0.5 * (0.75 if t0 >= 52.5 else 1.0) * min(lv + 0.2, 1.0), rng.uniform(-0.3, 0.3), 0.45)

    # plucked arpeggio: 8ths (16ths in the climax), absent in the breath and the resolve
    if 5.0 <= t0 < 37.5 or 45.0 <= t0 < 52.5:
        sixteenths = 45.0 <= t0 < 52.5
        step = BEAT / 2 / (2 if sixteenths else 1)
        pattern = [0, 1, 2, 3, 4, 3, 2, 1]
        for s in range(int(BAR / step)):
            tt = t0 + s * step + rng.normal(0, 0.004)
            idx = pattern[s % len(pattern)]
            vel = lv * (0.55 + 0.25 * rng.random()) * (1.1 if s % 2 == 0 else 0.8)
            if t0 < 10 and s % 2:
                continue  # frames 2-3: sparser
            m = ch['arp'][idx] + (12 if sixteenths and s % 8 >= 6 else 0)
            put(pluck(m, 0.9, vel), tt, 1.0, rng.uniform(-0.4, 0.4), 0.3)

    # the breath (frame 7, 37.5-45): sparse piano on the beats
    if 37.5 <= t0 < 45.0:
        for s, idx in enumerate([0, 2, 3, 2]):
            put(piano(ch['arp'][idx], 2.6, 0.38 + 0.06 * (s == 0)), t0 + s * BEAT * 1.0 * 1.0, 1.0, rng.uniform(-0.2, 0.2), 0.4)

    # heartbeat and drive
    if t0 >= 7.5 and not (37.5 <= t0 < 45) and t0 < 52.5:
        if t0 < 25:
            beats = [0, 2] if t0 >= 10 else [0]
            kv = 0.5
        else:
            beats = [0, 1, 2, 3]
            kv = 0.8 if t0 < 45 else 1.0
        for k in beats:
            put(kick(kv), t0 + k * BEAT, 0.75)
    # hats and claps
    if (25.0 <= t0 < 37.5) or (45.0 <= t0 < 52.5):
        for s in range(8):
            put(hat(0.5 + 0.2 * (s % 2 == 1)), t0 + s * BEAT / 2, 0.5, rng.uniform(-0.3, 0.3))
        if t0 >= 27.5:
            for k in (1, 3):
                put(clap(0.6), t0 + k * BEAT, 0.5, 0.0, 0.25)

# ---- the big moments --------------------------------------------------------------
put(impact(1.0), 2.5, 0.95, 0.0, 0.35)
put(impact(0.4), 3.125, 0.7, 0.0, 0.3)
put(shimmer(86, 3.5, 0.4), 3.125, 0.6, 0.2, 0.6)
put(impact(0.45), 32.5, 0.7, 0.0, 0.3)
put(riser(2.5, 0.55), 30.0, 0.9, 0.0, 0.25)
put(impact(0.8), 35.0, 0.85, 0.0, 0.35)
put(riser(2.5, 1.0), 42.5, 1.0, 0.0, 0.3)
put(impact(1.35), 45.0, 1.0, 0.0, 0.4)
put(shimmer(86, 3.5, 0.4), 45.0, 0.6, -0.2, 0.6)
put(impact(0.7), 47.5, 0.8, 0.0, 0.35)
put(riser(2.5, 0.35), 52.5, 0.7, 0.0, 0.3)  # a breath of air into the last chord

# ---- the last chord: D major, left to ring ----------------------------------------------
fin = CHORDS['D']
for i, m in enumerate(fin['arp'][:4]):
    put(piano(m - (12 if i == 0 else 0), 5.0, 0.5 - 0.04 * i), 55.0 + 0.09 * i, 0.9, -0.3 + 0.2 * i, 0.5)
put(shimmer(90, 4.0, 0.3), 55.0, 0.5, 0.0, 0.6)

# ---- reverb and master --------------------------------------------------------------
def reverb_ir(seconds=3.0, decay=0.75, seed=1):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / decay)
    for a in (0.55, 0.82):
        sm = np.zeros(n)
        acc = 0.0
        for i in range(n):
            acc = a * acc + (1 - a) * ir[i]
            sm[i] = acc
        ir = sm
    ir[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))


def convolve(x, ir):
    size = 1
    while size < len(x) + len(ir):
        size *= 2
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]


wetL = convolve(SL, reverb_ir(seed=11))
wetR = convolve(SR_, reverb_ir(seed=29))
pre = int(0.025 * SR)
wetL = np.concatenate([np.zeros(pre), wetL[:-pre]])
wetR = np.concatenate([np.zeros(pre), wetR[:-pre]])
outL, outR = DL + wetL * 0.8, DR + wetR * 0.8

n_out = int(TOTAL * SR)
outL, outR = outL[:n_out], outR[:n_out]
env = np.ones(n_out)
fi = int(0.4 * SR)
env[:fi] *= np.linspace(0, 1, fi)
fo = int(2.6 * SR)
env[-fo:] *= np.linspace(1, 0, fo) ** 1.5
outL, outR = outL * env, outR * env
peak = max(np.max(np.abs(outL)), np.max(np.abs(outR)))
outL, outR = np.tanh(outL / peak * 1.6) * 0.62, np.tanh(outR / peak * 1.6) * 0.62

pcm = (np.stack([outL, outR], axis=1) * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'wrote {sys.argv[1]}: {TOTAL}s, peak {np.max(np.abs(pcm)) / 32767:.2f}')
