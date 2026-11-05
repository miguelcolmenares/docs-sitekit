import { renderSocialCard } from "../../../template/src/infrastructure/socialCard";
import type { SocialCardInput } from "../../../template/src/infrastructure/socialCard";

const COLORS = {
  background: "#09090b",
  title: "#ffffff",
  text: "#a1a1aa",
  muted: "#87878d",
  accent: "#4fc1ff",
};

const card = (overrides: Partial<SocialCardInput> = {}): SocialCardInput => ({
  name: "Acme",
  description: "Acme runs background jobs for your app.",
  host: "acme.example",
  colors: COLORS,
  ...overrides,
});

/** The width and height from the IHDR chunk of a PNG, after its 8-byte signature and the chunk length and type. */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("renderSocialCard", () => {
  it("returns a PNG of 1200 by 630 pixels", async () => {
    const png = await renderSocialCard(card());
    expect(Array.from(png.slice(0, 8))).toEqual(PNG_SIGNATURE);
    expect(Array.from(png.slice(12, 16))).toEqual([0x49, 0x48, 0x44, 0x52]); // "IHDR"
    expect(pngSize(png)).toEqual({ width: 1200, height: 630 });
  }, 60_000);

  it("cuts a long description and a long name, and still returns the size", async () => {
    const png = await renderSocialCard(
      card({
        name: "A very long site name that goes on well past the point where it could ever fit on one line",
        description: "word ".repeat(400),
      }),
    );
    expect(pngSize(png)).toEqual({ width: 1200, height: 630 });
  }, 60_000);

  it("works with a name that has characters outside Latin-1, without throwing", async () => {
    const png = await renderSocialCard(
      card({ name: "Ünïcödé Ärger & 東京 Ελληνικά", description: "Текст на русском and ñandú." }),
    );
    expect(Array.from(png.slice(0, 8))).toEqual(PNG_SIGNATURE);
  }, 60_000);

  it("draws different text as different pictures", async () => {
    const one = await renderSocialCard(card({ name: "Acme" }));
    const two = await renderSocialCard(card({ name: "Another name entirely" }));
    expect(Buffer.from(one).equals(Buffer.from(two))).toBe(false);
  }, 60_000);
});
