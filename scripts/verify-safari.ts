// Installed Safari exercises a compositor handoff that Playwright WebKit snapshots
// can flatten away. Start the local demo and safaridriver before running this check.
import { horizontalInkCenter, preparePaintHandoff, sampleBlurPaint, samplePaintHandoff, verticalInkEdges } from "../tests/browser/paint-handoff";

const driver = process.env.SAFARI_WEBDRIVER_URL ?? "http://127.0.0.1:4445";
const base = process.env.ROLLING_NUMBER_URL ?? "http://127.0.0.1:4173";
let session: string | undefined;
async function request(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(`${driver}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json() as { value: any };
  if (!response.ok || data.value?.error) throw new Error(`${method} ${path}: ${JSON.stringify(data.value)}`);
  return data.value;
}
async function evaluate<A, B>(fn: (argument: A) => B, argument: A): Promise<Awaited<B>> {
  return request(`/session/${session}/execute/sync`, { script: `return (${fn.toString()})(...arguments)`, args: [argument] });
}

try {
  const created = await request("/session", { capabilities: { alwaysMatch: { browserName: "safari" } } });
  session = created.sessionId;
  console.log(`Safari ${created.capabilities.browserVersion}, macOS ${created.capabilities["safari:platformVersion"]}`);
  const handles = await request(`/session/${session}/window/handles`) as string[];
  const handle = handles[0] ?? (await request(`/session/${session}/window/new`, { type: "window" })).handle;
  await request(`/session/${session}/window`, { handle });
  await request(`/session/${session}/window/rect`, { width: 1000, height: 1000 });
  await request(`/session/${session}/url`, { url: `${base}/test.html` });
  await evaluate(async () => {
    for (let i = 0; i < 300 && !window.ready; i++) await new Promise((resolve) => setTimeout(resolve, 20));
    if (!window.ready) throw new Error("Local fixture did not become ready");
  }, null);
  let failures = 0;
  for (const entry of [false, true]) for (const size of [16, 24, 30, 32, 36, 48, 144]) for (const blur of [false, true]) {
    await evaluate(preparePaintHandoff, { size, blur, entry });
    const centers: number[] = [];
    for (const phase of ["live", "end", "cleanup"] as const) {
      const state = await evaluate(samplePaintHandoff, phase);
      if (phase === "cleanup" && (state.faces !== 1 || state.effects !== 0)) throw new Error("Native cleanup retained faces or effects");
      const image = await request(`/session/${session}/screenshot`) as string;
      centers.push(await evaluate(horizontalInkCenter, image));
    }
    const shift = Math.max(...centers) - Math.min(...centers);
    console.log(`${shift < .1 ? "PASS" : "FAIL"} ${entry ? "entry" : "roll"} ${size}px blur=${blur}: ${shift.toFixed(4)} CSS px horizontal paint shift`);
    if (shift >= .1) failures++;
  }
  for (const size of [16, 32, 144]) {
    await evaluate(preparePaintHandoff, { size, blur: true });
    const edges: number[] = [];
    for (const blurred of [true, false]) {
      await evaluate(sampleBlurPaint, blurred);
      const image = await request(`/session/${session}/screenshot`) as string;
      edges.push(await evaluate(verticalInkEdges, image));
    }
    const ratio = edges[0]! / edges[1]!;
    console.log(`${ratio < .95 ? "PASS" : "FAIL"} blur ${size}px: ${(ratio * 100).toFixed(1)}% of sharp vertical edge energy`);
    if (ratio >= .95) failures++;
  }
  if (failures) throw new Error(`${failures} installed-Safari paint checks failed`);
} finally {
  if (session) await request(`/session/${session}`, undefined, "DELETE");
}
