import sharp from 'sharp';

export interface CropMeta {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function parseCropMeta(raw: string | undefined | null): CropMeta | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const x = Number(obj.x);
  const y = Number(obj.y);
  const width = Number(obj.width);
  const height = Number(obj.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/**
 * Generates the 1:1 file from the original image. When `crop` is omitted,
 * calculates a centered square crop from the image dimensions.
 */
export async function generateSquareThumbnail(
  originalPath: string,
  croppedPath: string,
  crop: CropMeta | null,
): Promise<CropMeta> {
  const image = sharp(originalPath);
  const metadata = await image.metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;

  if (sourceWidth === 0 || sourceHeight === 0) {
    throw new Error('Could not read the original image dimensions.');
  }

  const effectiveCrop = crop ?? defaultCenteredSquareCrop(sourceWidth, sourceHeight);
  const safeCrop = clampCrop(effectiveCrop, sourceWidth, sourceHeight);

  await sharp(originalPath)
    .extract({
      left: Math.round(safeCrop.x),
      top: Math.round(safeCrop.y),
      width: Math.round(safeCrop.width),
      height: Math.round(safeCrop.height),
    })
    .resize(512, 512, { fit: 'cover' })
    .toFile(croppedPath);

  return safeCrop;
}

function defaultCenteredSquareCrop(width: number, height: number): CropMeta {
  const side = Math.min(width, height);
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}

function clampCrop(crop: CropMeta, srcWidth: number, srcHeight: number): CropMeta {
  const side = Math.min(crop.width, crop.height, srcWidth, srcHeight);
  const x = Math.max(0, Math.min(crop.x, srcWidth - side));
  const y = Math.max(0, Math.min(crop.y, srcHeight - side));
  return { x, y, width: side, height: side };
}
