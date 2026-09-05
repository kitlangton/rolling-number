import { impacts } from "./board-sound";
import { glyphs, makeAtlas } from "./gpu-flap-atlas";
import { endsAt, retarget, sweepDelay, type DrumMotion } from "./gpu-flap-motion";
import { fragment, vertex } from "./gpu-flap-shaders";

interface Slot { motion: DrumMotion; wheel: string; offset: number; target: string }
interface Field { node: HTMLElement; slots: Slot[]; start: number }

/** One board, one atlas, one buffer, one instanced draw. Not a library backend. */
export function createGpuFlaps(board: HTMLElement, onMotion: () => void, onUnavailable: () => void) {
  const canvas = document.createElement("canvas");
  canvas.className = "gpu-flaps";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true, depth: false, stencil: false, premultipliedAlpha: false });
  if (!context) { onUnavailable(); return; }
  const gl = context;
  const program = gl.createProgram()!;
  const buffer = gl.createBuffer()!;
  const texture = gl.createTexture()!;
  const vao = gl.createVertexArray()!;
  let destroyed = false;
  let ready = false;
  let frame = 0;
  let end = 0;
  let width = 0;
  let height = 0;
  const epoch = performance.now(); // Keep shader float times small on long-lived pages.
  let fields: Field[] = [];
  let data = new Float32Array(0);
  let wheelData = new Int32Array(128);
  let uniforms: { viewport: WebGLUniformLocation | null; now: WebGLUniformLocation | null };

  function setActive(active: boolean) {
    if (active) board.setAttribute("data-gpu-active", "");
    else board.removeAttribute("data-gpu-active");
  }
  function draw(time: number) {
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(uniforms.viewport, width, height);
    gl.uniform1f(uniforms.now, time - epoch);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, data.length / 16 * 4);
  }
  function tick(time: number) {
    frame = 0;
    if (destroyed || document.hidden) return;
    draw(time);
    if (time < end) frame = requestAnimationFrame(tick);
    else setActive(false);
  }
  function wake() {
    if (!ready || destroyed || document.hidden) return;
    if (!frame) frame = requestAnimationFrame(tick);
    setActive(end > performance.now());
    onMotion();
  }
  function upload() {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    end = 0;
    for (const field of fields) for (const slot of field.slots) end = Math.max(end, endsAt(slot.motion));
    wake();
  }

  // Geometry is read only here: initial enhancement, font completion, and resize.
  // Never called from the animation callback. Plain HTML determines the layout.
  function measure() {
    if (!ready || destroyed) return;
    const bounds = board.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    for (const field of fields) {
      const rect = field.node.getBoundingClientRect();
      const style = getComputedStyle(field.node);
      const size = parseFloat(style.fontSize);
      const advance = rect.width / field.slots.length;
      const spacing = parseFloat(style.letterSpacing) || 0;
      for (let i = 0; i < field.slots.length; i++) {
        const offset = (field.start + i) * 16;
        data.set([rect.left - bounds.left + i * advance, rect.top - bounds.top, advance, rect.height], offset);
        data[offset + 14] = advance - spacing;
        data[offset + 15] = size;
      }
    }
    upload();
  }

  function update() {
    if (!ready || destroyed) return;
    const now = performance.now();
    for (const field of fields) {
      const text = field.node.textContent!;
      const changed = field.slots.filter((slot, i) => slot.target !== text[i]).length;
      // Read style once per value update, never per rendered frame.
      const color = getComputedStyle(field.node).color.match(/[\d.]+/g)!.slice(0, 3).map((v) => Number(v) / 255);
      let rank = 0;
      for (const [i, slot] of field.slots.entries()) {
        if (slot.target !== text[i]) {
          slot.motion = retarget(slot.motion, slot.wheel.indexOf(text[i]!), slot.wheel.length, now, field.node.dataset.stagger === "none" ? 0 : sweepDelay(rank++, changed));
          slot.target = text[i]!;
        }
        const offset = (field.start + i) * 16;
        data.set([...color, Number(field.node.dataset.blur), slot.motion.from, slot.motion.to, slot.motion.start - epoch, slot.motion.cadence, slot.offset, slot.wheel.length], offset + 4);
      }
    }
    upload();
  }

  function release() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("resize", measure);
    document.fonts.removeEventListener("loadingdone", measure);
    document.removeEventListener("visibilitychange", visibility);
    canvas.removeEventListener("webglcontextlost", lost);
    board.removeAttribute("data-gpu-ready");
    setActive(false);
    canvas.remove();
    gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program);
    // This private canvas will never be reused. Release its context on mode switches.
    if (!gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
    fields = []; data = new Float32Array(0); wheelData = new Int32Array(0);
  }
  function lost(event: Event) { event.preventDefault(); release(); onUnavailable(); }
  function visibility() {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; setActive(false); }
    else wake(); // Sample elapsed time; never replay frames missed in a hidden tab.
  }
  const observer = new ResizeObserver(measure);

  async function initialize() {
    try {
      await document.fonts.ready;
      if (destroyed) return;
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source); gl.compileShader(shader);
        const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        const log = gl.getShaderInfoLog(shader);
        gl.attachShader(program, shader); gl.deleteShader(shader);
        if (!compiled) throw new Error(log ?? "Shader compilation failed");
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Shader link failed");
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      for (let i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 64, i * 16);
        gl.vertexAttribDivisor(i, 4); // Four half-planes reuse each slot's data.
      }
      const style = getComputedStyle(board);
      const atlas = makeAtlas(style.fontFamily, style.fontWeight);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.width, atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform2f(gl.getUniformLocation(program, "atlasSize"), atlas.width, atlas.height);
      uniforms = { viewport: gl.getUniformLocation(program, "viewport"), now: gl.getUniformLocation(program, "now") };
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const wheels = new Map<string, number>();
      let wheelCount = 0;
      let count = 0;
      fields = [...board.querySelectorAll<HTMLElement>(".gpu-field")].map((node) => {
        const choices = node.dataset.wheels!.split("|");
        const start = count;
        const slots = [...node.textContent!].map((target, i) => {
          const wheel = choices.length === 1 ? choices[0]! : choices[i]!;
          if (!wheel.includes(target) || [...wheel].some((char) => !glyphs.includes(char))) throw new Error("Unsupported board glyph");
          let offset = wheels.get(wheel);
          if (offset === undefined) {
            offset = wheelCount;
            if (offset + wheel.length > wheelData.length) throw new Error("Board wheel capacity exceeded");
            wheels.set(wheel, offset);
            for (const char of wheel) wheelData[wheelCount++] = glyphs.indexOf(char);
          }
          count++;
          const index = wheel.indexOf(target);
          return { wheel, offset, target, motion: { from: index, to: index, start: epoch, cadence: Number(node.dataset.cadence) } };
        });
        return { node, slots, start };
      });
      data = new Float32Array(count * 16);
      gl.uniform1iv(gl.getUniformLocation(program, "wheels"), wheelData);
      ready = true;
      board.append(canvas);
      measure(); update(); draw(performance.now());
      if (gl.getError() !== gl.NO_ERROR) throw new Error("WebGL board initialization failed");
      board.setAttribute("data-gpu-ready", "");
      observer.observe(board);
      window.addEventListener("resize", measure);
      document.fonts.addEventListener("loadingdone", measure);
      document.addEventListener("visibilitychange", visibility);
      canvas.addEventListener("webglcontextlost", lost);
    } catch (error) {
      if (!destroyed) { console.warn("GPU flap board unavailable", error); release(); onUnavailable(); }
    }
  }
  void initialize();
  return {
    update, destroy: release,
    impacts(previous: number, now: number) {
      let ticks = 0; let clacks = 0;
      for (const field of fields) for (const { motion } of field.slots) {
        const count = motion.to - motion.from;
        ticks += impacts(motion.start + motion.cadence / 2, motion.cadence, count, previous, now);
        clacks += impacts(motion.start + motion.cadence, motion.cadence, count, previous, now);
      }
      return { ticks, clacks, active: ready && now < end };
    },
  };
}
