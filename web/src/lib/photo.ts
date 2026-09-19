// Photos are downscaled on the device so reports stay small on mobile data and under the API's 1.5 MB limit.

const MAX_BYTES = 1.5 * 1024 * 1024;
const ATTEMPTS = [
  { edge: 1280, quality: 0.8 },
  { edge: 1024, quality: 0.7 },
  { edge: 800, quality: 0.6 },
];

// Decoded size of a base64 data URL.
export const dataUrlBytes = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

export async function downscalePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image could not be read. Try a JPEG or PNG photo.");
  }

  try {
    for (const { edge, quality } of ATTEMPTS) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) break;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlBytes(dataUrl) <= MAX_BYTES) return dataUrl;
    }
  } finally {
    bitmap.close();
  }
  throw new Error("This photo is too large to send. Try another one.");
}
