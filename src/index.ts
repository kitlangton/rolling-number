import { direction, model, type FormatOptions, type Model, type Token, type Value } from "./format.js";
import { entrance, numeral, rollTarget, spring } from "./motion.js";
import { collapsePositions } from "./layout.js";
import { Scheduler, type Participant } from "./scheduler.js";
import { Track } from "./track.js";

export { formatValue } from "./format.js";
export type { Value, Locales } from "./format.js";

export interface RollingNumberOptions extends FormatOptions {
  value: Value;
  /** Duration in milliseconds. Zero disables animation. Default: 500. */
  duration?: number | undefined;
  animated?: boolean | undefined;
  /** Auto follows displayed magnitude, including for negative values. */
  direction?: "auto" | "up" | "down" | undefined;
  /** Offscreen numbers retain their latest value without animation. Default: true. */
  pauseOffscreen?: boolean | undefined;
}

export interface RollingNumberController {
  update(options: Partial<RollingNumberOptions>): void;
  /** Explicit invalidation for theme/variable-font changes. */
  refresh(): void;
  /** Immediately show the latest target without motion. */
  finish(): void;
  /** Releases all resources and leaves the final formatted text. Idempotent. */
  destroy(): void;
}

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
  entry?: { element: HTMLSpanElement; track: Track } | undefined;
}

const mounted = new WeakSet<HTMLElement>();
const translate = (x: number): string => `translateX(${x}px)`;
const opacity = (value: number): string => String(Math.max(0, Math.min(1, value)));

function validate(options: RollingNumberOptions): void {
  if (typeof options.value !== "number" && typeof options.value !== "bigint") throw new TypeError("value must be a number or bigint");
  if (options.duration !== undefined && (!Number.isFinite(options.duration) || options.duration < 0 || options.duration > 10_000)) {
    throw new RangeError("duration must be between 0 and 10000 milliseconds");
  }
}

class Renderer implements Participant, RollingNumberController {
  private options: RollingNumberOptions;
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

  constructor(private host: HTMLElement, options: RollingNumberOptions) {
    validate(options);
    this.options = { ...options };
    this.target = this.displayed = model(options.value, options);
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

  update(patch: Partial<RollingNumberOptions>): void {
    if (this.destroyed) return;
    const options = { ...this.options, ...patch };
    validate(options);
    const next = model(options.value, options); // Validate before changing any visible state.
    const unchanged = next.text === this.target.text && next.signature === this.target.signature;
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
    column.reel.replaceChildren();
    this.face(column, column.token.text);
    column.roll.set(column.token.digit ?? 0, () => "translateY(0px)");
  }

  private finishEntry(column: Column): void {
    if (!column.entry) return;
    column.entry.track.cancel();
    column.entry.element.replaceWith(column.reel);
    column.entry = undefined;
  }

  private enter(column: Column, duration: number): void {
    const element = this.host.ownerDocument.createElement("span");
    element.className = "rn-enter";
    column.reel.replaceWith(element);
    element.append(column.reel);
    const track = new Track(element, "transform");
    column.entry = { element, track };
    track.play(entrance(column.height, duration), (y) => `translateY(${y}px)`, () => this.finishEntry(column));
  }

  private commit(geometry: Map<string, Geometry>, originShift: number): void {
    if (this.destroyed) return;
    this.measurementPending = false;
    const animate = this.enhanced && !this.reset;
    const duration = animate ? this.options.duration ?? 500 : 0;
    const trend = this.options.direction === "up" ? 1 : this.options.direction === "down" ? -1 : direction(this.displayed, this.target);
    const previous = new Map([...this.columns].map(([key, column]) => {
      const sample = column.x.read();
      return [key, { ...sample, x: sample.position, width: column.width }];
    }));
    const starts = collapsePositions(this.target.tokens.map((token) => token.key), previous);
    const oldOrder = [...previous.keys()].sort((a, b) => previous.get(a)!.x - previous.get(b)!.x);
    const exits = collapsePositions(oldOrder, geometry);
    for (const token of this.target.tokens) {
      const size = geometry.get(token.key);
      if (!size) continue;
      let column = this.columns.get(token.key);
      const fresh = !column;
      if (!column) {
        column = this.makeColumn(token);
        this.columns.set(token.key, column);
        column.x.set(animate ? (starts.get(token.key) ?? size.x) + originShift : size.x, translate);
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
        column.opacity.play(spring(alpha.position, 1, alpha.velocity, duration), opacity);
      }
      column.height = size.height;
      column.width = size.width;
      if (!animate || resized) this.finishEntry(column);
      if (!fresh && !resized && changed && token.digit !== undefined && column.token.digit !== undefined && duration) {
        const current = column.roll.read();
        const motion = spring(current.position, rollTarget(current.position, token.digit, trend), current.velocity, duration);
        const start = Math.floor(Math.min(...motion.points));
        const end = Math.ceil(Math.max(...motion.points));
        column.reel.replaceChildren();
        for (let face = start; face <= end; face++) this.face(column, numeral(face));
        column.token = token;
        const active = column;
        column.roll.play(motion, (position) => `translateY(${(start - position) * size.height}px)`, () => this.rest(active));
      } else if (fresh || resized || changed || !animate) {
        column.token = token;
        this.rest(column);
      }
      if (fresh && duration) this.enter(column, duration);
    }
    for (const [key, column] of this.columns) {
      if (geometry.has(key)) continue;
      const x = previous.get(key)!;
      column.x.play(spring(x.position + originShift, exits.get(key) ?? x.position, x.velocity, duration), translate);
      if (column.exiting) continue;
      column.exiting = true;
      const alpha = column.opacity.read();
      column.opacity.play(spring(alpha.position, 0, alpha.velocity, duration * 0.65), opacity, () => {
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

  preferenceChanged(): void { this.refresh(); }

  finish(): void {
    if (this.destroyed) return;
    this.measurementPending = false;
    for (const column of this.columns.values()) this.removeColumn(column);
    this.columns.clear();
    this.semantic.textContent = this.target.text;
    delete this.host.dataset.rnReady;
    delete this.host.dataset.rnMeasuring;
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
  const renderer = new Renderer(host, options);
  mounted.add(host);
  return renderer;
}
