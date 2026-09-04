import { direction, model, textModel, type FormatOptions, type Model, type TextOptions, type Token, type Value } from "./format.js";
import { delayed, entrance, face, rollTarget, spring } from "./motion.js";
import { collapsePositions, entryRanks, type Stagger } from "./layout.js";
import { Scheduler, type Participant } from "./scheduler.js";
import { Track } from "./track.js";
import { ReelBlur } from "./blur.js";
import { buildFlaps, flapCadence, flapMotion } from "./flap.js";

export { formatValue, FLAP_CHARSET } from "./format.js";
export type { Value, Locales } from "./format.js";
export type { Stagger } from "./layout.js";

export interface MotionOptions {
  /** Duration in milliseconds. Zero disables animation. Default: 500. */
  duration?: number | undefined;
  animated?: boolean | undefined;
  /** Optional velocity-driven vertical blur for prominent counters. Default: false. */
  motionBlur?: boolean | undefined;
  /** Auto follows displayed magnitude, including for negative values. */
  direction?: "auto" | "up" | "down" | undefined;
  /** Offscreen numbers retain their latest value without animation. Default: true. */
  pauseOffscreen?: boolean | undefined;
  /** Order in which new glyphs cascade in. Default: "outward" from retained glyphs. */
  stagger?: Stagger | undefined;
  /**
   * "roll" (default) glides a wheel of faces through the slot. "flap" hinges one
   * card per face at the midline like a split-flap board; new glyphs flap in from
   * the wheel's blank face and motion blur does not apply.
   */
  mode?: "roll" | "flap" | undefined;
}

export interface RollingNumberOptions extends FormatOptions, MotionOptions {
  value: Value;
}

export interface RollingTextOptions extends TextOptions, MotionOptions {
  text: string;
}

export interface RollingController<Options> {
  update(options: Partial<Options>): void;
  /** Explicit invalidation for theme/variable-font changes. */
  refresh(): void;
  /** Immediately show the latest target without motion. */
  finish(): void;
  /** Releases all resources and leaves the final formatted text. Idempotent. */
  destroy(): void;
}

export type RollingNumberController = RollingController<RollingNumberOptions>;
export type RollingTextController = RollingController<RollingTextOptions>;

interface Geometry { x: number; y: number; width: number; height: number }
interface Column {
  token: Token;
  element: HTMLSpanElement;
  reel: HTMLSpanElement;
  x: Track;
  roll: Track;
  opacity: Track;
  exiting: boolean;
  height: number;
  width: number;
  entry?: { element: HTMLSpanElement; track: Track; blurred: boolean } | undefined;
}

const mounted = new WeakSet<HTMLElement>();
const translate = (x: number): string => `translateX(${x}px)`;
const scale = (value: number): string => `scale(${value})`;
const opacity = (value: number): string => String(Math.max(0, Math.min(1, value)));

function validate(options: MotionOptions): void {
  if (options.duration !== undefined && (!Number.isFinite(options.duration) || options.duration < 0 || options.duration > 10_000)) {
    throw new RangeError("duration must be between 0 and 10000 milliseconds");
  }
}

interface Source<Options extends MotionOptions> {
  validate(options: Options): void;
  model(options: Options): Model;
  /** Trend for wheels when `direction` is "auto". */
  direction(previous: Model, next: Model): -1 | 0 | 1;
}

const numberSource: Source<RollingNumberOptions> = {
  validate(options) {
    if (typeof options.value !== "number" && typeof options.value !== "bigint") throw new TypeError("value must be a number or bigint");
    validate(options);
  },
  model: (options) => model(options.value, options),
  direction,
};

const textSource: Source<RollingTextOptions> = {
  validate(options) {
    if (typeof options.text !== "string") throw new TypeError("text must be a string");
    validate(options);
  },
  model: (options) => textModel(options.text, options),
  // Boards only ever advance; a wheel never runs backwards to reach a letter.
  direction: () => 1,
};

class Renderer<Options extends MotionOptions> implements Participant, RollingController<Options> {
  private options: Options;
  private target: Model;
  private displayed: Model;
  private semantic: HTMLSpanElement;
  private measurement: HTMLSpanElement;
  private visual: HTMLSpanElement;
  private measures = new Map<string, HTMLSpanElement>();
  private columns = new Map<string, Column>();
  private sizes = new Map<Element, { width: number; height: number }>();
  private scheduler: Scheduler | undefined;
  private enhanced = false;
  private destroyed = false;
  private visible = true;
  private reset = true;
  private measurementPending = false;
  private hadClass: boolean;
  private previousLeft: number | undefined;
  private blur: ReelBlur | undefined;
  private blurIntensity = 1;

  constructor(private host: HTMLElement, options: Options, private source: Source<Options>) {
    source.validate(options);
    this.options = { ...options };
    this.target = this.displayed = source.model(options);
    const doc = host.ownerDocument;
    const span = (className: string): HTMLSpanElement => {
      const element = doc.createElement("span");
      element.className = className;
      return element;
    };
    this.semantic = span("rn-value");
    this.measurement = span("rn-measure");
    this.visual = span("rn-visual");
    this.measurement.setAttribute("aria-hidden", "true");
    this.visual.setAttribute("aria-hidden", "true");
    this.semantic.textContent = this.target.text;
    this.hadClass = host.classList.contains("rn-root");
    host.classList.add("rn-root");
    host.replaceChildren(this.semantic, this.measurement, this.visual);
    const view = doc.defaultView;
    if (view && typeof view.matchMedia === "function" && typeof view.requestAnimationFrame === "function" && typeof host.animate === "function") {
      this.scheduler = Scheduler.for(view);
      this.scheduler.add(this, host);
      this.scheduler.watch(this.measurement, this);
    }
    this.prepare();
  }

  private canAnimate(): boolean {
    return !!this.scheduler && this.options.animated !== false && (this.options.duration ?? 500) > 0 &&
      !this.scheduler.media.matches && !this.host.ownerDocument.hidden &&
      (this.visible || this.options.pauseOffscreen === false) && this.target.rollable && this.host.isConnected;
  }

  update(patch: Partial<Options>): void {
    if (this.destroyed) return;
    const options = { ...this.options, ...patch };
    this.source.validate(options);
    const next = this.source.model(options); // Validate before changing any visible state.
    const unchanged = next.text === this.target.text && next.signature === this.target.signature;
    if (this.options.motionBlur && !options.motionBlur) {
      this.blur?.destroy();
      this.blur = undefined;
    }
    this.options = options;
    // Rollable formats share digit-place identities; symbols enter/exit by token key.
    this.target = next;
    if (!this.canAnimate()) { this.finish(); return; }
    if (unchanged && this.enhanced) return;
    this.semantic.textContent = next.text;
    this.prepare();
  }

  private prepare(): void {
    if (!this.canAnimate()) { this.finish(); return; }
    this.measurementPending = true;
    this.scheduler?.enqueue(this);
  }

  stage(): (() => void) | undefined {
    if (this.destroyed) return;
    if (!this.canAnimate()) return () => this.finish();
    this.previousLeft = this.enhanced && !this.reset ? this.measurement.getBoundingClientRect().left : undefined;
    return () => this.stageMeasurement();
  }

  private stageMeasurement(): void {
    const keys = new Set(this.target.tokens.map((token) => token.key));
    for (const [key, node] of this.measures) {
      if (keys.has(key)) continue;
      this.scheduler?.unwatch(node);
      this.sizes.delete(node);
      node.remove();
      this.measures.delete(key);
    }
    let previous: ChildNode | null = null;
    for (const token of this.target.tokens) {
      let node = this.measures.get(token.key);
      if (!node) {
        node = this.host.ownerDocument.createElement("span");
        node.className = "rn-token";
        this.measures.set(token.key, node);
        this.scheduler?.watch(node, this);
      }
      if (node.textContent !== token.text) node.textContent = token.text;
      const next: ChildNode | null = previous ? previous.nextSibling : this.measurement.firstChild;
      if (node !== next) this.measurement.insertBefore(node, next);
      previous = node;
    }
    this.host.dataset.rnMeasuring = "";
  }

  measure(): (() => void) | undefined {
    if (this.destroyed) return;
    if (!this.canAnimate()) return () => this.finish();
    const bounds = this.measurement.getBoundingClientRect();
    // getBoundingClientRect includes ancestor scaling. Convert back to local CSS pixels.
    const view = this.host.ownerDocument.defaultView;
    if (!view) return () => this.finish();
    const style = view.getComputedStyle(this.measurement);
    // Splitting a bidi run into flex items changes its native visual ordering.
    if (style.direction === "rtl") return () => this.finish();
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    if (!width || !height || !bounds.width || !bounds.height) return () => this.finish();
    const scaleX = bounds.width / width;
    const scaleY = bounds.height / height;
    // Per-counter blur strength, read here so playback never touches computed style.
    this.blurIntensity = Math.max(0, parseFloat(style.getPropertyValue("--rn-blur")) || 1);
    this.sizes.set(this.measurement, { width, height });
    const geometry = new Map<string, Geometry>();
    for (const [key, node] of this.measures) {
      const rect = node.getBoundingClientRect();
      const size = { width: rect.width / scaleX, height: rect.height / scaleY };
      this.sizes.set(node, size);
      geometry.set(key, { ...size, x: (rect.left - bounds.left) / scaleX, y: (rect.top - bounds.top) / scaleY });
    }
    const originShift = this.previousLeft === undefined ? 0 : (this.previousLeft - bounds.left) / scaleX;
    return () => this.commit(geometry, originShift);
  }

  private makeColumn(token: Token): Column {
    const element = this.host.ownerDocument.createElement("span");
    element.className = "rn-slot";
    element.dataset.rnKey = token.key;
    if (token.index !== undefined) element.dataset.rnWheel = "";
    if (this.options.mode === "flap") element.dataset.rnFlap = "";
    const reel = this.host.ownerDocument.createElement("span");
    reel.className = "rn-reel";
    element.append(reel);
    this.visual.append(element);
    return { token, element, reel, x: new Track(element, "transform"), opacity: new Track(element, "opacity"), roll: new Track(reel, "transform"), exiting: false, height: 0, width: 0 };
  }

  private face(column: Column, text: string): void {
    const face = this.host.ownerDocument.createElement("span");
    face.className = "rn-face";
    face.textContent = text;
    face.style.height = `${column.height}px`;
    column.reel.append(face);
  }

  private rest(column: Column): void {
    this.blur?.remove(column.reel);
    column.reel.replaceChildren();
    column.reel.style.removeProperty("height");
    this.face(column, column.token.text);
    if (column.token.index === undefined) column.roll.set(1, scale);
    else column.roll.set(column.token.index, () => "translateY(0px)");
  }

  private finishEntry(column: Column): void {
    if (!column.entry) return;
    if (column.entry.blurred) this.blur?.remove(column.reel);
    column.entry.track.cancel();
    column.entry.element.replaceWith(column.reel);
    column.entry = undefined;
  }

  private enter(column: Column, duration: number, delay: number): void {
    const element = this.host.ownerDocument.createElement("span");
    element.className = "rn-enter";
    column.reel.replaceWith(element);
    element.append(column.reel);
    const track = new Track(element, "transform");
    column.entry = { element, track, blurred: false };
    const motion = delayed(entrance(column.height, duration), delay);
    if (this.options.motionBlur && column.token.text.trim()) {
      this.blur ??= new ReelBlur(this.host);
      this.blur.intensity = this.blurIntensity;
      const rows = { ...motion, points: motion.points.map((y) => y / column.height) };
      column.entry.blurred = this.blur.apply(column.reel, rows, column.height, 0, "entry");
    }
    track.play(motion, (y) => `translateY(${y}px)`, () => this.finishEntry(column));
  }

  private commit(geometry: Map<string, Geometry>, originShift: number): void {
    if (this.destroyed) return;
    this.measurementPending = false;
    const animate = this.enhanced && !this.reset;
    const duration = animate ? this.options.duration ?? 500 : 0;
    const flap = this.options.mode === "flap";
    const trend = this.options.direction === "up" ? 1 : this.options.direction === "down" ? -1 : this.source.direction(this.displayed, this.target);
    if (this.target.text !== this.displayed.text) this.host.dataset.rnTrend = trend > 0 ? "up" : trend < 0 ? "down" : "none";
    const previous = new Map([...this.columns].map(([key, column]) => {
      const sample = column.x.read();
      return [key, { ...sample, x: sample.position, width: column.width }];
    }));
    const starts = collapsePositions(this.target.tokens.map((token) => token.key), previous);
    const oldOrder = [...previous.keys()].sort((a, b) => previous.get(a)!.x - previous.get(b)!.x);
    const exits = collapsePositions(oldOrder, geometry);
    const oldSymbols = new Map(this.displayed.tokens.filter((token) => token.index === undefined).map((token) => [token.identity, token.key]));
    const newSymbols = new Map(this.target.tokens.filter((token) => token.index === undefined).map((token) => [token.identity, token.key]));
    // New glyphs cascade outward from the digits already on screen (symbols such as
    // a retained currency sign do not anchor it); the whole cascade stays inside a
    // fraction of the duration so it still reads as one update, not typing.
    // "outward" staggers only new places; explicit "start"/"end" also sweep across
    // wheels that change in place, the way a board runs along a row.
    const sweep = this.options.stagger === "start" || this.options.stagger === "end";
    const moving = this.target.tokens.map((token) => {
      const column = this.columns.get(token.key);
      return !column || column.exiting || (sweep && token.index !== undefined && column.token.text !== token.text);
    });
    const ranks = entryRanks(this.target.tokens.map((token, index) => token.index !== undefined && !moving[index]), this.options.stagger);
    const span = Math.max(0, ...this.target.tokens.map((_, index) => moving[index] ? ranks[index]! - 1 : 0));
    const step = Math.min(duration * .045, duration * .3 / Math.max(1, span));
    for (const [index, token] of this.target.tokens.entries()) {
      const size = geometry.get(token.key);
      if (!size) continue;
      const delay = Math.max(0, ranks[index]! - 1) * step;
      const oldKey = oldSymbols.get(token.identity);
      const replacement = oldKey !== undefined && oldKey !== token.key ? previous.get(oldKey) : undefined;
      let column = this.columns.get(token.key);
      const fresh = !column;
      if (!column) {
        column = this.makeColumn(token);
        this.columns.set(token.key, column);
        column.x.set(animate ? (replacement?.x ?? starts.get(token.key) ?? size.x) + originShift : size.x, translate);
        column.opacity.set(animate ? 0 : 1, opacity);
      }
      const changed = column.token.text !== token.text;
      const resized = Math.abs(column.height - size.height) > 0.1;
      const reentered = column.exiting;
      column.exiting = false;
      column.element.style.width = `${size.width}px`;
      column.element.style.height = `${size.height}px`;
      column.element.style.top = `${size.y}px`;
      const x = previous.get(token.key);
      column.x.play(spring(x ? x.position + originShift : column.x.read().position, size.x, x?.velocity ?? 0, duration), translate);
      if (fresh || reentered || !animate) {
        const alpha = column.opacity.read();
        const fade = spring(alpha.position, 1, alpha.velocity, token.index === undefined ? Math.min(duration, 180) : duration);
        column.opacity.play(fresh ? delayed(fade, delay) : fade, opacity);
      }
      column.height = size.height;
      column.width = size.width;
      if (!animate || resized) this.finishEntry(column);
      // New flap cards start on the wheel's blank face (or its first face) and flap to the target.
      if (fresh && flap && token.wheel && duration) column.roll.set(Math.max(0, token.wheel.indexOf(" ")), () => "translateY(0px)");
      if (flap && !resized && (changed || fresh) && token.index !== undefined && token.wheel && duration && column.roll.read().position !== token.index) {
        const current = column.roll.read();
        // A card mid-flip snaps to whichever face is nearer; the sequence resumes from there.
        const from = Math.round(current.position);
        const to = rollTarget(from, token.index, trend, token.wheel.length);
        const cadence = flapCadence(duration);
        this.blur?.remove(column.reel);
        buildFlaps(column.reel, token.wheel, from, to, size.height, cadence, delay);
        column.token = token;
        const active = column;
        column.roll.play(delayed(flapMotion(from, to, cadence), delay), () => "translateY(0px)", () => this.rest(active));
      } else if (!fresh && !resized && changed && token.index !== undefined && token.wheel && column.token.index !== undefined && duration) {
        const current = column.roll.read();
        const target = rollTarget(current.position, token.index, trend, token.wheel.length);
        const motion = sweep ? delayed(spring(current.position, target, current.velocity, duration), delay) : spring(current.position, target, current.velocity, duration);
        const start = Math.floor(Math.min(...motion.points));
        const end = Math.ceil(Math.max(...motion.points));
        // A new roll takes over the blend; entry completion must not cancel it.
        if (column.entry) column.entry.blurred = false;
        const blur = this.blur?.remove(column.reel) ?? 0;
        column.reel.replaceChildren();
        for (let position = start; position <= end; position++) this.face(column, face(token.wheel, position));
        if (this.options.motionBlur) {
          this.blur ??= new ReelBlur(this.host);
          this.blur.intensity = this.blurIntensity;
          this.blur.apply(column.reel, motion, size.height, blur);
        }
        column.token = token;
        const active = column;
        column.roll.play(motion, (position) => `translateY(${(start - position) * size.height}px)`, () => this.rest(active));
      } else if (fresh || resized || changed || !animate) {
        column.token = token;
        this.rest(column);
      }
      if (fresh && duration && token.index !== undefined && !flap) this.enter(column, duration, delay);
      if (replacement && duration && (fresh || reentered)) {
        const current = column.roll.read();
        const active = column;
        column.roll.play(spring(fresh ? .96 : current.position, 1, current.velocity, Math.min(duration, 180)), scale, () => this.rest(active));
      }
    }
    for (const [key, column] of this.columns) {
      if (geometry.has(key)) continue;
      const x = previous.get(key)!;
      const replacementKey = newSymbols.get(column.token.identity);
      const replacement = replacementKey ? geometry.get(replacementKey) : undefined;
      column.x.play(spring(x.position + originShift, replacement?.x ?? exits.get(key) ?? x.position, x.velocity, duration), translate);
      if (column.exiting) continue;
      column.exiting = true;
      if (replacement && duration) {
        const current = column.roll.read();
        column.roll.play(spring(current.position, 1.04, current.velocity, Math.min(duration, 180)), scale);
      }
      const alpha = column.opacity.read();
      column.opacity.play(spring(alpha.position, 0, alpha.velocity, column.token.index === undefined ? Math.min(duration, 180) : duration * 0.65), opacity, () => {
        if (!column.exiting) return;
        this.removeColumn(column);
        this.columns.delete(key);
      });
    }
    this.enhanced = true;
    this.reset = false;
    this.displayed = this.target;
    this.host.dataset.rnReady = "";
  }

  private removeColumn(column: Column): void {
    this.blur?.remove(column.reel);
    this.finishEntry(column);
    column.x.cancel();
    column.roll.cancel();
    column.opacity.cancel();
    column.element.remove();
  }

  refresh(): void {
    if (this.destroyed) return;
    this.reset = true;
    this.prepare();
  }

  sizeChanged(element: Element, width: number, height: number): boolean {
    // Value updates already have a measurement queued. RO delivery can precede
    // that frame; treating our own writes as external resize would cancel motion.
    if (this.measurementPending || !this.host.hasAttribute("data-rn-measuring")) return false;
    const previous = this.sizes.get(element);
    return !previous || Math.abs(previous.width - width) > 0.2 || Math.abs(previous.height - height) > 0.2;
  }

  visibility(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible || this.options.pauseOffscreen !== false) this.refresh();
  }

  finish(): void {
    if (this.destroyed) return;
    this.measurementPending = false;
    for (const column of this.columns.values()) this.removeColumn(column);
    this.columns.clear();
    this.blur?.destroy();
    this.blur = undefined;
    this.semantic.textContent = this.target.text;
    delete this.host.dataset.rnReady;
    delete this.host.dataset.rnMeasuring;
    delete this.host.dataset.rnTrend;
    this.enhanced = false;
    this.reset = true;
    this.displayed = this.target;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.finish();
    this.destroyed = true;
    for (const node of this.measures.values()) this.scheduler?.unwatch(node);
    this.scheduler?.unwatch(this.measurement);
    this.scheduler?.remove(this, this.host);
    this.host.replaceChildren(this.host.ownerDocument.createTextNode(this.target.text));
    if (!this.hadClass) this.host.classList.remove("rn-root");
    mounted.delete(this.host);
  }
}

/** The host's children belong exclusively to this controller until destroy(). */
export function createRollingNumber(host: HTMLElement, options: RollingNumberOptions): RollingNumberController {
  if (mounted.has(host)) throw new Error("A rolling number is already mounted on this element");
  const renderer = new Renderer(host, options, numberSource);
  mounted.add(host);
  return renderer;
}

/** Split-flap style text: characters in the charset roll through a wheel, others crossfade. */
export function createRollingText(host: HTMLElement, options: RollingTextOptions): RollingTextController {
  if (mounted.has(host)) throw new Error("A rolling number is already mounted on this element");
  const renderer = new Renderer(host, options, textSource);
  mounted.add(host);
  return renderer;
}
