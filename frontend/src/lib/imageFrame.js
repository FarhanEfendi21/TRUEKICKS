export const MIN_IMAGE_SCALE = 0.5;
export const MAX_IMAGE_SCALE = 2.2;
export const MAX_IMAGE_OFFSET = 35; // percent

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const round2 = (num) => Math.round(num * 100) / 100;

/**
 * Parses optional non-destructive framing metadata stored in the URL hash fragment:
 *   https://.../photo.webp#scale=1.25&x=-4&y=2
 * Browsers ignore the hash fragment when requesting the image from CDN, so caching
 * stays intact while admin zoom/position adjustments remain 100% reversible.
 */
export const parseImageFrame = (rawUrl) => {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return {
      raw: "",
      src: "",
      scale: 1,
      x: 0,
      y: 0,
      hasCustomFrame: false,
    };
  }

  const trimmed = rawUrl.trim();
  const hashIdx = trimmed.indexOf("#");
  if (hashIdx === -1) {
    return {
      raw: trimmed,
      src: trimmed,
      scale: 1,
      x: 0,
      y: 0,
      hasCustomFrame: false,
    };
  }

  const src = trimmed.slice(0, hashIdx);
  const hash = trimmed.slice(hashIdx + 1);
  const params = new URLSearchParams(hash);

  const scaleParam = params.get("scale");
  const xParam = params.get("x");
  const yParam = params.get("y");

  const rawScale =
    scaleParam !== null && scaleParam.trim() !== "" ? Number(scaleParam) : NaN;
  const rawX =
    xParam !== null && xParam.trim() !== "" ? Number(xParam) : NaN;
  const rawY =
    yParam !== null && yParam.trim() !== "" ? Number(yParam) : NaN;

  const scale = Number.isFinite(rawScale)
    ? round2(clamp(rawScale, MIN_IMAGE_SCALE, MAX_IMAGE_SCALE))
    : 1;
  const x = Number.isFinite(rawX)
    ? Math.round(clamp(rawX, -MAX_IMAGE_OFFSET, MAX_IMAGE_OFFSET))
    : 0;
  const y = Number.isFinite(rawY)
    ? Math.round(clamp(rawY, -MAX_IMAGE_OFFSET, MAX_IMAGE_OFFSET))
    : 0;

  return {
    raw: trimmed,
    src,
    scale,
    x,
    y,
    hasCustomFrame: scale !== 1 || x !== 0 || y !== 0,
  };
};

/**
 * Serializes framing adjustments back into a clean URL string.
 * Strips the hash fragment completely when returned to default (100%, 0, 0).
 */
export const formatImageFrameUrl = (rawUrl, { scale = 1, x = 0, y = 0 } = {}) => {
  const { src } = parseImageFrame(rawUrl);
  if (!src) return "";

  const parsedScale = Number(scale);
  const parsedX = Number(x);
  const parsedY = Number(y);
  const safeScale = round2(
    clamp(
      Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : 1,
      MIN_IMAGE_SCALE,
      MAX_IMAGE_SCALE
    )
  );
  const safeX = Math.round(
    clamp(Number.isFinite(parsedX) ? parsedX : 0, -MAX_IMAGE_OFFSET, MAX_IMAGE_OFFSET)
  );
  const safeY = Math.round(
    clamp(Number.isFinite(parsedY) ? parsedY : 0, -MAX_IMAGE_OFFSET, MAX_IMAGE_OFFSET)
  );

  if (safeScale === 1 && safeX === 0 && safeY === 0) {
    return src;
  }

  const params = new URLSearchParams();
  if (safeScale !== 1) params.set("scale", String(safeScale));
  if (safeX !== 0) params.set("x", String(safeX));
  if (safeY !== 0) params.set("y", String(safeY));
  return `${src}#${params.toString()}`;
};

export const getImageFrameTransform = (frame) => {
  if (!frame || !frame.hasCustomFrame) return undefined;
  return `translate(${frame.x}%, ${frame.y}%) scale(${frame.scale})`;
};
