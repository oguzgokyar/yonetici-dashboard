import "server-only";

import net from "node:net";
import sharp from "sharp";

type Brand = Record<string, string>;
type CreativeText = { headline?: string; supportingText?: string; cta?: string };

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character] || character);
}

function safeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function wrapText(value: string, maxCharacters: number, maxLines: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1) || "";
    if (!current || `${current} ${word}`.length > maxCharacters) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = `${lines[maxLines - 1].replace(/…$/, "")}…`; break; }
  }
  return lines.map(escapeXml);
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

export async function applyBrandOverlay(image: Buffer, brand: Brand, selectedFields: string[], concept: Brand = {}, creative: CreativeText = {}) {
  const selected = new Set(selectedFields);
  if (!selectedFields.length) return { bytes: image, mimeType: "image/png" };
  const pipeline = sharp(image).rotate();
  const metadata = await pipeline.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;
  const margin = Math.max(28, Math.round(width * 0.045));
  const padding = Math.max(24, Math.round(width * 0.028));
  const cardWidth = Math.min(Math.round(width * 0.62), width - margin * 2);
  const logoSize = Math.max(70, Math.round(width * 0.105));
  const logo = selected.has("logo") ? await logoData(brand.logo, logoSize) : "";
  const titleSize = Math.max(25, Math.round(width * 0.031));
  const bodySize = Math.max(16, Math.round(width * 0.018));
  const details = [
    selected.has("phone") && brand.phone ? brand.phone : "",
    selected.has("email") && brand.email ? brand.email : "",
    selected.has("website") && brand.website ? brand.website.replace(/^https?:\/\//i, "") : "",
    selected.has("address") && brand.address ? brand.address : "",
  ].filter(Boolean).map((value) => escapeXml(value.length > 72 ? `${value.slice(0, 69)}…` : value));
  const brandName = selected.has("brandName") && brand.brandName ? escapeXml(brand.brandName) : "";
  const lineCount = Math.max(details.length, brandName ? 1 : 0);
  const contentHeight = Math.max(logo ? logoSize : 0, titleSize + Math.max(0, lineCount - 1) * Math.round(bodySize * 1.45));
  const cardHeight = Math.max(118, contentHeight + padding * 2);
  const cardX = margin;
  const cardY = height - margin - cardHeight;
  const textX = cardX + padding + (logo ? logoSize + Math.round(padding * 0.7) : 0);
  const firstY = cardY + padding + titleSize;
  const detailY = brandName ? firstY + Math.round(bodySize * 1.65) : firstY;
  const detailLines = details.slice(0, 4).map((value, index) => `<text x="${textX}" y="${detailY + index * Math.round(bodySize * 1.45)}" font-family="Arial, Helvetica, sans-serif" font-size="${bodySize}" font-weight="500" fill="#ffffff" opacity="0.92">${value}</text>`).join("");
  const primary = safeColor(concept.primaryColor || brand.primaryColor, "#6d5dfc");
  const secondary = safeColor(concept.secondaryColor || brand.secondaryColor, "#171826");
  const radius = Math.max(18, Math.round(width * 0.022));
  const logoY = cardY + Math.round((cardHeight - logoSize) / 2);
  const headlineLines = wrapText(creative.headline || "", 27, 2);
  const supportLines = wrapText(creative.supportingText || "", 48, 2);
  const headlineFont = Math.max(34, Math.round(width * 0.052));
  const supportFont = Math.max(18, Math.round(width * 0.023));
  const copyX = margin;
  const copyY = margin + headlineFont;
  const headlineSvg = headlineLines.map((line, index) => `<text x="${copyX}" y="${copyY + index * Math.round(headlineFont * 1.08)}" font-family="Arial, Helvetica, sans-serif" font-size="${headlineFont}" font-weight="800" fill="#ffffff" stroke="#000000" stroke-opacity="0.2" stroke-width="1">${line}</text>`).join("");
  const supportY = copyY + headlineLines.length * Math.round(headlineFont * 1.08) + Math.round(supportFont * 1.1);
  const supportSvg = supportLines.map((line, index) => `<text x="${copyX}" y="${supportY + index * Math.round(supportFont * 1.35)}" font-family="Arial, Helvetica, sans-serif" font-size="${supportFont}" font-weight="500" fill="#ffffff">${line}</text>`).join("");
  const cta = creative.cta ? escapeXml(creative.cta) : "";
  const ctaY = supportY + supportLines.length * Math.round(supportFont * 1.35) + Math.round(supportFont * 0.7);
  const ctaWidth = cta ? Math.min(cardWidth, Math.max(180, cta.length * Math.round(supportFont * 0.72) + padding * 2)) : 0;
  const copyBackdropHeight = cta ? ctaY + Math.round(supportFont * 2.4) - margin : supportY + supportLines.length * Math.round(supportFont * 1.35) - margin + padding;
  const copyBackdrop = headlineLines.length ? `<rect x="${margin - 14}" y="${margin - 14}" width="${Math.min(width - margin * 2 + 28, Math.round(width * 0.88))}" height="${copyBackdropHeight + 14}" rx="${radius}" fill="#000000" fill-opacity="0.28"/>` : "";
  const ctaSvg = cta ? `<rect x="${copyX}" y="${ctaY}" width="${ctaWidth}" height="${Math.round(supportFont * 2.15)}" rx="${Math.round(supportFont * 1.08)}" fill="${primary}"/><text x="${copyX + padding}" y="${ctaY + Math.round(supportFont * 1.42)}" font-family="Arial, Helvetica, sans-serif" font-size="${supportFont}" font-weight="700" fill="#ffffff">${cta}</text>` : "";
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="panel" x1="0" x2="1"><stop offset="0" stop-color="${secondary}" stop-opacity="0.88"/><stop offset="1" stop-color="${primary}" stop-opacity="0.72"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000000" flood-opacity="0.28"/></filter></defs>${copyBackdrop}${headlineSvg}${supportSvg}${ctaSvg}<rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="${radius}" fill="url(#panel)" stroke="#ffffff" stroke-opacity="0.22" filter="url(#shadow)"/>${logo ? `<rect x="${cardX + padding - 8}" y="${logoY - 8}" width="${logoSize + 16}" height="${logoSize + 16}" rx="${Math.round(radius * 0.65)}" fill="#ffffff" fill-opacity="0.94"/><image href="${logo}" x="${cardX + padding}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>` : ""}${brandName ? `<text x="${textX}" y="${firstY}" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="700" fill="#ffffff">${brandName}</text>` : ""}${detailLines}</svg>`;
  const bytes = await pipeline.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
  return { bytes, mimeType: "image/png" };
}
