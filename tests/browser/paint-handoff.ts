import type {} from "../../demo/test";

/** Shared by Playwright and the installed-Safari check; all functions run in-page. */
export async function preparePaintHandoff({ size, blur, entry = false }: { size: number; blur: boolean; entry?: boolean }): Promise<void> {
  document.body.style.cssText = "background: white; color: black; -webkit-font-smoothing: antialiased";
  document.querySelector<HTMLElement>("#fixture")!.style.cssText = "position: absolute; top: 200px; left: 200.25px";
  window.mountNumber({ value: entry ? 999 : 2, locales: "en-US", duration: 600, motionBlur: blur, pauseOffscreen: false });
  document.querySelector<HTMLElement>("#number")!.style.cssText = `font: 450 ${size}px/1.25 system-ui; letter-spacing: -.065em; font-variant-numeric: tabular-nums`;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  const animate = Element.prototype.animate;
  try {
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.pause();
      animation.currentTime = 0;
      return animation;
    };
    window.testNumber.update({ value: entry ? 1000 : 3 });
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  } finally { Element.prototype.animate = animate; }
  const key = entry ? "digit:3" : "digit:0";
  for (const slot of document.querySelectorAll<HTMLElement>(".rn-slot")) {
    if (slot.dataset.rnKey !== key) slot.style.visibility = "hidden";
  }
  const animations = document.querySelector("#number")!.getAnimations({ subtree: true });
  if (!animations.length) throw new Error("Paint probe did not start a native animation");
  const finish = animations.map((animation) => {
    const callback = animation.onfinish;
    animation.onfinish = null;
    animation.playbackRate = .000001;
    animation.play();
    animation.currentTime = Number(animation.effect!.getTiming().duration) - 1;
    return () => callback?.call(animation, new Event("finish") as AnimationPlaybackEvent);
  });
  Reflect.set(window, "paintHandoff", (phase: string) => {
    if (phase === "cleanup") finish.forEach((callback) => callback());
    else for (const animation of animations) animation.currentTime = Number(animation.effect!.getTiming().duration) - (phase === "live" ? 1 : 0);
  });
  Reflect.set(window, "paintHandoffKey", key);
}

export async function samplePaintHandoff(phase: "live" | "end" | "cleanup") {
  Reflect.get(window, "paintHandoff")(phase);
  // Safari's screenshot endpoint can return the previous paint without this.
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  const reel = document.querySelector(`[data-rn-key='${Reflect.get(window, "paintHandoffKey")}'] .rn-reel`)!;
  return {
    x: reel.getBoundingClientRect().x,
    faces: reel.querySelectorAll(".rn-face").length,
    effects: document.querySelector("#number")!.getAnimations({ subtree: true }).length,
  };
}

/** Horizontal ink centroid, not a DOM rectangle. The white fixture isolates one digit. */
export async function horizontalInkCenter(base64: string): Promise<number> {
  const image = new Image();
  image.src = `data:image/png;base64,${base64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  const dpr = devicePixelRatio;
  const { data, width, height } = context.getImageData(160 * dpr, 170 * dpr, 200 * dpr, 240 * dpr);
  let mass = 0;
  let moment = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const ink = 255 - data[(y * width + x) * 4]!;
    mass += ink;
    moment += ink * x;
  }
  if (!mass) throw new Error("Paint probe captured no visible glyph");
  return moment / mass / dpr;
}
