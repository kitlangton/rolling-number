import { createComponent, createEffect, mergeProps, onCleanup, onMount, splitProps, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { createRollingNumber, createRollingText, formatValue, type MotionOptions, type RollingController, type RollingNumberOptions, type RollingTextOptions } from "./index.js";

type SpanProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children" | "innerHTML" | "textContent" | "innerText">;
export type RollingNumberProps = RollingNumberOptions & SpanProps;
export type RollingTextProps = RollingTextOptions & SpanProps;

const motionKeys = ["duration", "animated", "motionBlur", "direction", "pauseOffscreen", "stagger"] as const satisfies readonly (keyof MotionOptions)[];

/** Solid owns semantic text; the same DOM core owns only the decorative mount. */
function rolling<Options extends MotionOptions>(
  own: readonly (keyof Options)[],
  create: (host: HTMLElement, options: Options) => RollingController<Options>,
  semantic: (options: Options) => string,
) {
  return function Rolling(props: Options & SpanProps): JSX.Element {
    const [options, local, attributes] = splitProps(props, [...own, ...motionKeys] as (keyof (Options & SpanProps))[], ["class", "ref"]);
    let root: HTMLSpanElement;
    let mount: HTMLSpanElement;
    let controller: RollingController<Options> | undefined;
    onMount(() => {
      controller = create(mount, { ...options } as Options);
      root.dataset.rnHydrated = "";
    });
    createEffect(() => {
      const next = { ...options } as Options; // Track every option even before the mount effect runs.
      controller?.update(next);
    });
    onCleanup(() => {
      controller?.destroy();
      if (root) delete root.dataset.rnHydrated;
    });
    // Dynamic uses Solid's native browser/SSR implementations. No consumer JSX transform required.
    return createComponent(Dynamic, mergeProps(attributes, {
      component: "span",
      get class() { return ["rn-solid", local.class].filter(Boolean).join(" "); },
      ref(element: HTMLSpanElement) {
        root = element;
        if (typeof local.ref === "function") local.ref(element);
      },
      get children() {
        return [
          createComponent(Dynamic, {
            component: "span",
            class: "rn-semantic",
            get children() { return semantic(options as Options); },
          }),
          createComponent(Dynamic, {
            component: "span",
            class: "rn-mount",
            "aria-hidden": "true",
            ref(element: HTMLSpanElement) { mount = element; },
          }),
        ];
      },
    }));
  };
}

export const RollingNumber = rolling<RollingNumberOptions>(["value", "locales", "format"], createRollingNumber, (options) => formatValue(options.value, options));

/** Split-flap style text. Characters in `charset` roll; others crossfade in place. */
export const RollingText = rolling<RollingTextOptions>(["text", "charset"], createRollingText, (options) => options.text);
