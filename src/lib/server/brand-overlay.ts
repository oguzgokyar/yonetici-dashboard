import "server-only";

import net from "node:net";
import sharp from "sharp";

type Brand = Record<string, string>;

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] || character);
}

function safeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

async function logoData(value: string | undefined, size: number) {
  if (!value) return "";
  try {
    let bytes: Buffer;
    if (/^data:image\//i.test(value)) bytes = Buffer.from(value.split(",")[1] || "", "base64");
    else {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (!/^https?:$/.test(url.protocol) || url.hostname === "localhost" || net.isIP(url.hostname) && /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) return "";
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return "";
      bytes = Buffer.from(await response.arrayBuffer());
    }
    const png = await sharp(bytes).resize(size, size, { fit: "contain" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch { return ""; }
}

export async function applyBrandOverlay(image: Buffer, brand: Brand, selectedFields: string[]) {
  const selected = new Set(selectedFields);
  if (!selectedFields.length) return { bytes: image, mimeType: "image/png" };
  const pipeline = sharp(image).rotate();
  const metadata = await pipeline.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;
  const bandHeight = Math.max(220, Math.round(height * 0.25));
  const padding = Math.max(38, Math.round(width * 0.05));
  const logoSize = Math.round(bandHeight * 0.48);
  const logo = selected.has("logo") ? await logoData(brand.logo, logoSize) : "";
  const textX = padding + (logo ? logoSize + Math.round(padding * 0.65) : 0);
  const titleSize = Math.max(30, Math.round(width * 0.04));
  const bodySize = Math.max(19, Math.round(width * 0.022));
  const details = [
    selected.has("phone") && brand.phone ? brand.phone : "",
    selected.has("email") && brand.email ? brand.email : "",
    selected.has("website") && brand.website ? brand.website.replace(/^https?:\/\//i, "") : "",
    selected.has("address") && brand.address ? brand.address : "",
  ].filter(Boolean).map((value) => escapeXml(value.length > 72 ? `${value.slice(0, 69)}…` : value));
  const brandName = selected.has("brandName") && brand.brandName ? escapeXml(brand.brandName) : "";
  const firstY = height - bandHeight + Math.round(bandHeight * 0.35);
  const detailY = brandName ? firstY + Math.round(bodySize * 1.75) : firstY;
  const detailLines = details.slice(0, 4).map((value, index) => `<text x="${textX}" y="${detailY + index * Math.round(bodySize * 1.45)}" font-family="Arial, Helvetica, sans-serif" font-size="${bodySize}" font-weight="500" fill="#ffffff" opacity="0.94">${value}</text>`).join("");
  const primary = safeColor(brand.primaryColor, "#6d5dfc");
  const secondary = safeColor(brand.secondaryColor, "#171826");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="panel" x1="0" x2="1"><stop offset="0" stop-color="${secondary}" stop-opacity="0.96"/><stop offset="1" stop-color="#11131d" stop-opacity="0.9"/></linearGradient></defs><rect x="0" y="${height - bandHeight}" width="${width}" height="${bandHeight}" fill="url(#panel)"/><rect x="0" y="${height - bandHeight}" width="${width}" height="8" fill="${primary}"/>${logo ? `<image href="${logo}" x="${padding}" y="${height - bandHeight + Math.round((bandHeight - logoSize) / 2)}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>` : ""}${brandName ? `<text x="${textX}" y="${firstY}" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="700" fill="#ffffff">${brandName}</text>` : ""}${detailLines}</svg>`;
  const bytes = await pipeline.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
  return { bytes, mimeType: "image/png" };
}
