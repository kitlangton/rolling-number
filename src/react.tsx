"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { createRollingNumber, createRollingText, formatValue, type MotionOptions, type RollingController, type RollingNumberOptions, type RollingTextOptions } from "./index.js";

type SpanProps = Omit<ComponentPropsWithoutRef<"span">, "children" | "dangerouslySetInnerHTML">;
export type RollingNumberProps = RollingNumberOptions & SpanProps;
export type RollingTextProps = RollingTextOptions & SpanProps;
const useCommitEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const motionKeys = ["duration", "animated", "motionBlur", "direction", "pauseOffscreen", "stagger", "mode"] as const satisfies readonly (keyof MotionOptions)[];

/** Splits engine options from span attributes without enumerating every option twice. */
function partition<Options extends MotionOptions>(props: Options & SpanProps, own: readonly (keyof Options)[]): [Options, SpanProps] {
  const options = {} as Record<string, unknown>;
  const rest = { ...props } as Record<string, unknown>;
  for (const key of [...own, ...motionKeys] as string[]) {
    if (key in rest) { options[key] = rest[key]; delete rest[key]; }
  }
  return [options as Options, rest as SpanProps];
}

/** React owns the accessible text. Only the empty aria-hidden mount is imperative. */
function rolling<Options extends MotionOptions>(
  name: string,
  own: readonly (keyof Options)[],
  create: (host: HTMLElement, options: Options) => RollingController<Options>,
  semantic: (options: Options) => string,
) {
  const Component = forwardRef<HTMLSpanElement, Options & SpanProps>(function Rolling(props, forwardedRef) {
    const [options, { className, ...attributes }] = partition(props as Options & SpanProps, own);
    const mount = useRef<HTMLSpanElement>(null);
    const controller = useRef<RollingController<Options> | null>(null);
    useCommitEffect(() => {
      const node = mount.current;
      const element = node?.parentElement;
      if (!node || !element) return;
      const renderer = create(node, options);
      controller.current = renderer;
      element.dataset.rnHydrated = "";
      return () => {
        renderer.destroy();
        controller.current = null;
        delete element.dataset.rnHydrated;
      };
    }, []);
    useCommitEffect(() => { controller.current?.update(options); });
    return (
      <span {...attributes} className={["rn-react", className].filter(Boolean).join(" ")} ref={forwardedRef}>
        <span className="rn-semantic">{semantic(options)}</span>
        <span className="rn-mount" aria-hidden="true" ref={mount} />
      </span>
    );
  });
  Component.displayName = name;
  return Component;
}

export const RollingNumber = rolling<RollingNumberOptions>("RollingNumber", ["value", "locales", "format"], createRollingNumber, (options) => formatValue(options.value, options));

/** Split-flap style text. Characters in `charset` roll; others crossfade in place. */
export const RollingText = rolling<RollingTextOptions>("RollingText", ["text", "charset"], createRollingText, (options) => options.text);
