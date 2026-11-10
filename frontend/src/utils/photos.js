/* ------------------------------------------------------------------
   Report photos. Each photo is resized in the browser (longest side
   1280 px, JPEG) and kept as a data URL, so it survives a reload and
   every desk sees the same evidence. Temporary blob: links did not:
   they died with the tab that made them.
   With the backend, upload the original instead and keep the URL the
   server returns (services/uploadService.js).
------------------------------------------------------------------- */

export const PHOTO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
export const PHOTO_MAX = 4; // per report
export const PHOTO_MAX_MB = 10; // per original file, before resizing
const SIDE = 1280;
const QUALITY = 0.72;

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

/** Resize one image file. Resolves { id, name, url, w, h, kb } or rejects with a reason a citizen can read. */
export async function preparePhoto(file) {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error(`${file.name}: only PNG, JPG or WEBP photos.`);
  if (file.size > PHOTO_MAX_MB * 1024 * 1024) throw new Error(`${file.name}: larger than ${PHOTO_MAX_MB} MB.`);
  let img;
  try {
    img = await readImage(file);
  } catch {
    throw new Error(`${file.name}: this image could not be read.`);
  }
  const scale = Math.min(1, SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const url = canvas.toDataURL("image/jpeg", QUALITY);
  return {
    id: `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name,
    url,
    w,
    h,
    kb: Math.round((url.length * 3) / 4 / 1024),
  };
}