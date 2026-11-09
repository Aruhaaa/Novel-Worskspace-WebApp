import { t } from '../i18n';
import { isNetworkFailure } from './offlineCache';

/**
 * Cover pictures a writer uploads for a novel.
 *
 * A picture is shrunk in the browser before it leaves the device (at most 800 x 1200, JPEG), so a 12 MB photo from a phone becomes
 * about 100 to 200 KB. With an account it is stored in the public "covers" bucket (supabase/setup_scripts/20261106_cover_uploads.sql)
 * and `projects.cover_url` holds its address. With no account (this device only) it is kept inside the project as a data address,
 * because there is no server to put it on.
 */

export const COVER_BUCKET = 'covers';
/** Biggest picture a person may choose. It is shrunk anyway; this only stops a gigantic file from being decoded. */
export const COVER_MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** The longest a cover can be after shrinking. A picture already smaller is never enlarged. */
export const COVER_BOX = { width: 800, height: 1200 };
export const COVER_QUALITY = 0.85;

export type CoverProblem = 'type' | 'size';

/** Why this file cannot be a cover, or null when it can */
export const checkCoverFile = (file: { type: string; size: number }): CoverProblem | null => {
  if (!COVER_TYPES.includes(file.type)) return 'type';
  if (file.size > COVER_MAX_SOURCE_BYTES) return 'size';
  return null;
};

/** The size to draw a picture at so it fits inside the box, keeping its shape and never making it bigger */
export const fitWithin = (width: number, height: number, box = COVER_BOX): { width: number; height: number } => {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, box.width / width, box.height / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

const decode = async (file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Shrink a picture to a cover-sized JPEG. Throws when the file is not a picture the browser can read. */
export const prepareCover = async (file: Blob): Promise<Blob> => {
  const { source, width, height, release } = await decode(file);
  try {
    const size = fitWithin(width, height);
    if (!size.width) throw new Error('empty picture');
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    // A see-through PNG would turn black in a JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(source, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not encode'))), 'image/jpeg', COVER_QUALITY));
  } finally {
    release();
  }
};

/** A picture as a data address, for a device with no account */
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('could not read'));
    reader.readAsDataURL(blob);
  });

/** Where in the bucket a cover goes: the person's own folder, which is the only place the database lets them write */
export const coverFileName = (userId: string, id: string): string => `${userId}/${id}.jpg`;

/**
 * The file name inside the bucket, when this address is one of our stored covers. Anything else (a pasted link, a data address, a
 * sample novel's picture) gives null, and is never deleted.
 */
export const storedCoverName = (url: string | undefined | null): string | null => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${COVER_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const name = decodeURIComponent(url.slice(at + marker.length).split(/[?#]/)[0]);
  return name && name.includes('/') ? name : null;
};

/** What a form holds while a cover is being chosen: the address now saved, and a picture picked in the form that has not been sent yet */
export interface CoverChoice {
  url: string;
  picture: Blob | null;
}

/** A link a person typed or pasted: not one of our stored covers, and not a picture kept inside the project */
export const isPastedLink = (url: string | undefined | null): boolean => !!url && !url.startsWith('data:') && !storedCoverName(url);

/** The address to save for what the form holds, sending the picked picture first when there is one */
export const resolveCover = async (
  choice: CoverChoice,
  upload: (picture: Blob) => Promise<{ url: string | null; error: string | null }>,
): Promise<{ url: string; error: string | null }> => {
  if (!choice.picture) return { url: choice.url.trim(), error: null };
  const sent = await upload(choice.picture);
  return sent.url ? { url: sent.url, error: null } : { url: choice.url, error: sent.error ?? t('The picture could not be saved. Try again, or paste a link to a picture instead.') };
};

/** A sentence for a person about why a cover could not be used or saved */
export const coverProblemText = (problem: CoverProblem): string =>
  problem === 'type' ? t('Choose a JPEG, PNG or WebP picture.') : t('That picture is too large. Choose one under 15 MB.');

export const describeCoverError = (error: unknown): string => {
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? '');
  if (isNetworkFailure(error)) return t('You seem to be offline. Try again when you are connected.');
  if (/bucket not found/i.test(message)) return t('Picture upload is not switched on for this site yet. Paste a link to a picture instead.');
  if (/row-level security|unauthorized|not authori[sz]ed|jwt/i.test(message)) return t('Your account could not save the picture. Sign in again, or paste a link to a picture instead.');
  if (/payload too large|exceeded the maximum|413/i.test(message)) return t('That picture is too large. Choose one under 15 MB.');
  if (/mime type|invalid_mime|415/i.test(message)) return t('Choose a JPEG, PNG or WebP picture.');
  return t('The picture could not be saved. Try again, or paste a link to a picture instead.');
};
