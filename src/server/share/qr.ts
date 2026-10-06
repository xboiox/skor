import QRCode from "qrcode";

/** Server-rendered QR code (no client JS). Medium error correction survives screen glare. */
export async function qrSvg(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
  return svg.replace("<svg", '<svg role="img" aria-label="QR code"');
}
