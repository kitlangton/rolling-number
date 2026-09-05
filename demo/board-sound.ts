type SoundState = "off" | "on" | "unavailable";
type Impact = "tick" | "clack";

/** Count crossings in a native animation's time window, dropping a stalled tab's backlog. */
export function impacts(first: number, cadence: number, steps: number, previous: number, current: number): number {
  const after = Math.max(previous, current - 45);
  const index = (time: number) => Math.max(0, Math.min(steps, Math.floor((time - first) / cadence) + 1));
  return Math.max(0, index(current) - index(after));
}

export function impactGain(count: number): number {
  return Math.min(.12, .025 * Math.sqrt(Math.max(0, count)));
}

/** Short, dry plastic/metal impacts; generated locally, never fetched recordings. */
export function synthesizeImpact(rate: number, kind: Impact, random = Math.random): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(Math.ceil(rate * .055));
  const frequency = kind === "tick" ? 1850 : 920;
  for (let i = 0; i < samples.length; i++) {
    const time = i / rate;
    const attack = Math.min(1, time / .0007);
    const noise = (random() * 2 - 1) * Math.exp(-time * 230);
    const body = Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time * 130);
    const rattle = Math.sin(2 * Math.PI * frequency * 2.37 * time) * Math.exp(-time * 210);
    samples[i] = attack * (noise * .55 + body * .28 + rattle * .12) * Math.max(0, 1 - time / .055);
  }
  return samples;
}

interface Drum {
  animation: Animation;
  first: number;
  half: number;
  steps: number;
  previous: number;
}

/** Demo-only sonification of native flap timing. No audio work until explicit opt-in. */
export function createBoardSound(board: HTMLElement, onChange: (state: SoundState) => void, external?: (previous: number, now: number) => { ticks: number; clacks: number; active: boolean }) {
  let context: AudioContext | undefined;
  let buffers: Record<Impact, AudioBuffer> | undefined;
  let enabled = false;
  let destroyed = false;
  let request = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const drums = new Map<HTMLElement, Drum>();
  const voices = new Map<AudioBufferSourceNode, GainNode>();
  let previous = performance.now();

  function strike(kind: Impact, count: number) {
    if (!count || !context || !buffers || voices.size >= 8) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffers[kind];
    source.playbackRate.value = .94 + Math.random() * .12;
    gain.gain.value = impactGain(count) * (kind === "tick" ? .65 : 1);
    source.connect(gain).connect(context.destination);
    voices.set(source, gain);
    source.onended = () => { source.disconnect(); gain.disconnect(); voices.delete(source); };
    source.start();
  }

  function poll() {
    if (document.hidden || context?.state !== "running") { mute(); return; }
    let ticks = 0;
    let clacks = 0;
    const now = performance.now();
    const supplied = external?.(previous, now);
    previous = now;
    if (supplied) { ticks += supplied.ticks; clacks += supplied.clacks; }
    for (const [reel, drum] of drums) {
      const time = drum.animation.currentTime;
      if (!board.contains(reel) || drum.animation.playState === "idle" || typeof time !== "number") {
        drums.delete(reel); continue;
      }
      if (drum.animation.playState === "paused") { drum.previous = time; continue; }
      ticks += impacts(drum.first, drum.half * 2, drum.steps, drum.previous, time);
      clacks += impacts(drum.first + drum.half, drum.half * 2, drum.steps, drum.previous, time);
      drum.previous = time;
      if (drum.animation.playState === "finished") drums.delete(reel);
    }
    // At most two grouped impacts per 25 ms, not one audio node per turning card.
    strike("tick", ticks);
    strike("clack", clacks);
    if (!drums.size && !supplied?.active) { clearInterval(timer); timer = undefined; }
  }

  function collect(reel: HTMLElement) {
    drums.delete(reel);
    if (!board.contains(reel)) return;
    const bottoms = reel.querySelectorAll<HTMLElement>(".rn-flap-bottom");
    // The landing plane keeps its effect throughout the sequence, including when
    // sound is enabled midway. Its first two keyframes delimit a half-card period.
    const effect = bottoms[bottoms.length - 1]?.getAnimations()[0]?.effect;
    const animation = reel.getAnimations()[0];
    if (!(effect instanceof KeyframeEffect) || !animation) return;
    const timing = effect.getComputedTiming();
    const half = Number(timing.duration) * (effect.getKeyframes()[1]?.computedOffset ?? 0);
    if (!(half > 0)) return;
    const steps = Math.round(Number(timing.duration) / (half * 2));
    drums.set(reel, { animation, first: Number(timing.delay) + half, half, steps, previous: Number(animation.currentTime ?? 0) });
  }

  function wake() {
    if (enabled && (drums.size || external) && timer === undefined) {
      previous = performance.now();
      timer = setInterval(poll, 25);
    }
  }
  const observer = new MutationObserver((records) => {
    const changed = new Set<HTMLElement>();
    for (const record of records) {
      if (record.target instanceof HTMLElement && record.target.matches(".rn-reel")) {
        changed.add(record.target);
        continue; // Reel children are cards, never nested reels.
      }
      for (const node of record.addedNodes) if (node instanceof HTMLElement) {
        if (node.matches(".rn-reel")) changed.add(node);
        for (const reel of node.querySelectorAll<HTMLElement>(".rn-reel")) changed.add(reel);
      }
    }
    for (const reel of changed) collect(reel);
    wake();
  });

  function mute() {
    request++;
    enabled = false;
    observer.disconnect();
    clearInterval(timer); timer = undefined;
    drums.clear();
    for (const [source, gain] of voices) {
      source.onended = null;
      source.stop(); source.disconnect(); gain.disconnect();
    }
    voices.clear();
    // Queue suspension even while resume() is pending (notably in Firefox).
    if (!destroyed && context && context.state !== "closed") void context.suspend().catch(() => {});
    if (!destroyed) onChange("off");
  }

  async function toggle() {
    if (destroyed) return;
    if (enabled) { mute(); return; }
    const attempt = ++request;
    enabled = true;
    onChange("on");
    try {
      context ??= new AudioContext();
      if (!buffers) {
        const make = (kind: Impact) => {
          const data = synthesizeImpact(context!.sampleRate, kind);
          const buffer = context!.createBuffer(1, data.length, context!.sampleRate);
          buffer.copyToChannel(data, 0);
          return buffer;
        };
        buffers = { tick: make("tick"), clack: make("clack") };
      }
      await context.resume(); // Called directly from the user's Sound button gesture.
      if (attempt !== request || destroyed) return;
      if (document.hidden || context.state !== "running") { mute(); return; }
      if (!external) {
        observer.observe(board, { childList: true, subtree: true });
        for (const reel of board.querySelectorAll<HTMLElement>(".rn-reel")) collect(reel);
      }
      wake();
    } catch {
      if (attempt !== request || destroyed) return;
      mute();
      if (!destroyed) onChange("unavailable");
    }
  }

  const hide = () => { if (document.hidden) mute(); };
  document.addEventListener("visibilitychange", hide);
  return {
    toggle, mute, wake,
    destroy() {
      destroyed = true;
      mute();
      document.removeEventListener("visibilitychange", hide);
      if (context && context.state !== "closed") void context.close().catch(() => {});
    },
  };
}
