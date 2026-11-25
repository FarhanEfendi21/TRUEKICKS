import api from "./api";

export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB before compression
export const MAX_DETAIL_IMAGES = 6;
const SUPPORTED_UPLOAD_MIMES = new Set([
  "image/webp",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const loadImageElement = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode image file."));
    };
    img.src = objectUrl;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

/**
 * Resizes and compresses an image file in-browser to lightweight WebP
 * (max 1200px on the longest edge) while preserving transparency.
 */
export const compressImageFile = async (
  file,
  { maxDimension = 1200, quality = 0.86 } = {}
) => {
  if (!file || !(file instanceof Blob)) {
    throw new Error("Invalid file selected.");
  }
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Only image files (WebP, PNG, JPG) are supported.");
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error("Image file is too large (maximum 10 MB).");
  }

  try {
    const img = await loadImageElement(file);
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    if (!origW || !origH) {
      throw new Error("Empty image dimensions.");
    }

    const scale = Math.min(1, maxDimension / Math.max(origW, origH));
    const targetW = Math.max(1, Math.round(origW * scale));
    const targetH = Math.max(1, Math.round(origH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context unavailable.");
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const webpBlob = await canvasToBlob(canvas, "image/webp", quality);
    if (webpBlob && webpBlob.size > 0 && webpBlob.type === "image/webp") {
      return { blob: webpBlob, contentType: "image/webp" };
    }

    const fallbackType =
      file.type === "image/png" ? "image/png" : "image/jpeg";
    const fallbackBlob = await canvasToBlob(canvas, fallbackType, quality);
    if (fallbackBlob && fallbackBlob.size > 0) {
      return { blob: fallbackBlob, contentType: fallbackType };
    }
  } catch {
    // Fall back to original file if it is already a supported format
    const rawMime = String(file.type || "").toLowerCase();
    if (SUPPORTED_UPLOAD_MIMES.has(rawMime)) {
      return {
        blob: file,
        contentType: rawMime === "image/jpg" ? "image/jpeg" : rawMime,
      };
    }
  }

  throw new Error("Unsupported image format. Please use PNG, JPG, or WebP.");
};

/**
 * Compresses and uploads an image straight to Supabase Storage via a
 * backend-signed upload URL (bypasses Vercel serverless body size limits).
 */
export const uploadProductImage = async (
  file,
  { productType = "sneakers", productId = null } = {}
) => {
  const { blob, contentType } = await compressImageFile(file);

  const signRes = await api.post("/api/admin/uploads/sign", {
    product_type: productType,
    product_id: productId ? Number(productId) : null,
    content_type: contentType,
    filename: file.name || "detail",
  });

  const { signed_url, public_url, path } = signRes.data || {};
  if (!signed_url || !public_url) {
    throw new Error("Server did not return a valid upload URL.");
  }

  const buffer = await blob.arrayBuffer();
  const uploadRes = await fetch(signed_url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "max-age=3600",
      "x-upsert": "true",
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    let detail = "";
    try {
      detail = await uploadRes.text();
    } catch {
      // ignore read failure
    }
    throw new Error(
      `Storage upload failed (${uploadRes.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`
    );
  }

  return {
    public_url,
    path,
    size_bytes: blob.size,
  };
};

export const deleteUploadedImage = async (publicUrl) => {
  if (!publicUrl || typeof publicUrl !== "string") return;
  try {
    await api.post(
      "/api/admin/uploads/delete",
      { public_url: publicUrl },
      { skipAuthRedirect: true }
    );
  } catch {
    // Best-effort storage cleanup; never block UI
  }
};
