import { expect, it } from "vitest";
import { textModel } from "../src/format";
import { directRoll } from "../src/motion";

it("direct text models lowercase and emoji as glyphs, not alphabet wheels", () => {
  const model = textModel("Hi 🙂", { transition: "direct" });
  expect(model.tokens.map((token) => token.wheel)).toEqual([["H"], ["i"], [" "], ["🙂"]]);
  expect(model.tokens.map((token) => token.key)).toEqual(["char:0", "char:1", "char:2", "char:3"]);
});

it("retains the visible pair on interruption and bounds the strip to three glyphs", () => {
  expect(directRoll(["a"], 0, "b")).toEqual({ wheel: ["a", "b"], from: 0, target: 1 });
  expect(directRoll(["a", "b"], .4, "c")).toEqual({ wheel: ["a", "b", "c"], from: .4, target: 2 });
  expect(directRoll(["a", "b", "c"], 1.4, "d")).toEqual({ wheel: ["b", "c", "d"], from: 1.4 - 1, target: 2 });
  expect(directRoll(["a", "b"], .4, "b")).toEqual({ wheel: ["a", "b"], from: .4, target: 1 });
  expect(directRoll(["a", "b"], 1, "b")).toEqual({ wheel: ["b"], from: 0, target: 0 });
});
