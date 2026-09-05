// Board font only, deliberately not a general text/layout engine. One channel per
// treatment means both samples share a texture lookup. Rasterized only at setup.
export const glyphs = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/&+'";
export const cellWidth = 64;
export const cellHeight = 96;
export const atlasColumns = 8;

export function makeAtlas(fontFamily: string, fontWeight: string) {
  const canvas = document.createElement("canvas");
  canvas.width = cellWidth * atlasColumns;
  canvas.height = cellHeight * Math.ceil(glyphs.length / atlasColumns);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Glyph atlas needs Canvas2D");
  context.font = `${fontWeight} 64px ${fontFamily}`;
  context.textAlign = "center";
  context.fillStyle = "white";
  const metrics = context.measureText("0");
  // Match CSS line-height: 1.2, including the font's ascent/descent, not the ink box.
  const ascent = metrics.fontBoundingBoxAscent || 60;
  const descent = metrics.fontBoundingBoxDescent || 16;
  const baseline = cellHeight / 2 + (ascent - descent) / 2;
  for (let i = 0; i < glyphs.length; i++) context.fillText(glyphs[i]!, (i % atlasColumns + .5) * cellWidth, Math.floor(i / atlasColumns) * cellHeight + baseline);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = new Uint8Array(canvas.width * canvas.height * 4);
  // CPU convolution once: zero horizontal deviation; two vertical strengths.
  const kernels = [1, 1.6].map((strength) => {
    const sigma = 76.8 * .035 * strength;
    const radius = Math.ceil(sigma * 3);
    const weights = Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-.5 * ((i - radius) / sigma) ** 2));
    const sum = weights.reduce((a, b) => a + b);
    return { radius, weights: weights.map((value) => value / sum) };
  });
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const pixel = (y * canvas.width + x) * 4;
    data[pixel] = image.data[pixel + 3]!;
    for (const [channel, kernel] of kernels.entries()) {
      let alpha = 0;
      for (let k = -kernel.radius; k <= kernel.radius; k++) {
        const row = y + k;
        if (Math.floor(row / cellHeight) !== Math.floor(y / cellHeight)) continue;
        alpha += image.data[(row * canvas.width + x) * 4 + 3]! * kernel.weights[k + kernel.radius]!;
      }
      data[pixel + channel + 1] = Math.round(alpha);
    }
    data[pixel + 3] = 255;
  }
  return { data, width: canvas.width, height: canvas.height };
}
