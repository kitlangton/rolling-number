import { blurEnvelope, type Motion } from "./motion.js";
import { Track } from "./track.js";

interface Layer {
  sharp: HTMLSpanElement;
  sharpOpacity: Track;
  smearOpacity: Track;
}
const svgNamespace = "http://www.w3.org/2000/svg";
let nextFilterId = 0;

/** Optional, bounded decoration. The reel's one transform moves both copies. */
export class ReelBlur {
  private layers = new Map<HTMLElement, Layer>();
  private filter: { svg: SVGSVGElement; blur: SVGFEGaussianBlurElement; id: string; height: number } | undefined;

  constructor(private host: HTMLElement) {}

  private filterUrl(height: number): string {
    if (!this.filter) {
      const doc = this.host.ownerDocument;
      const svg = doc.createElementNS(svgNamespace, "svg");
      svg.classList.add("rn-blur-defs");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      const filter = doc.createElementNS(svgNamespace, "filter");
      let id: string;
      do { id = `rn-vertical-blur-${++nextFilterId}`; } while (doc.getElementById(id));
      filter.id = id;
      filter.setAttribute("x", "-15%");
      filter.setAttribute("width", "130%");
      filter.setAttribute("color-interpolation-filters", "sRGB");
      const blur = doc.createElementNS(svgNamespace, "feGaussianBlur");
      filter.append(blur);
      svg.append(filter);
      this.host.append(svg);
      this.filter = { svg, blur, id, height: 0 };
    }
    if (this.filter.height !== height) {
      this.filter.blur.setAttribute("stdDeviation", `0 ${height * .035}`);
      this.filter.height = height;
    }
    return `url("#${this.filter.id}")`;
  }

  apply(reel: HTMLElement, motion: Motion, height: number, from: number, kind: "roll" | "entry" = "roll"): boolean {
    const envelope = blurEnvelope(motion, from, kind === "entry" ? 6 : 24);
    if (envelope.points.every((point) => point === 0)) return false;
    const sharp = this.host.ownerDocument.createElement("span");
    sharp.className = "rn-sharp";
    sharp.append(...reel.childNodes);
    const smear = sharp.cloneNode(true) as HTMLSpanElement;
    smear.className = "rn-smear";
    smear.style.filter = this.filterUrl(height);
    reel.append(sharp, smear);
    const sharpOpacity = new Track(sharp, "opacity");
    const smearOpacity = new Track(smear, "opacity");
    this.layers.set(reel, { sharp, sharpOpacity, smearOpacity });
    sharpOpacity.play(envelope, (amount) => String(1 - amount));
    smearOpacity.play(envelope, String);
    return true;
  }

  remove(reel: HTMLElement): number {
    const layer = this.layers.get(reel);
    if (!layer) return 0;
    const amount = layer.smearOpacity.read().position;
    layer.sharpOpacity.cancel();
    layer.smearOpacity.cancel();
    reel.replaceChildren(...layer.sharp.childNodes);
    this.layers.delete(reel);
    return amount;
  }

  destroy(): void {
    for (const reel of this.layers.keys()) this.remove(reel);
    this.filter?.svg.remove();
    this.filter = undefined;
  }
}
