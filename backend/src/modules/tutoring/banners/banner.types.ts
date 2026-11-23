/** Bytes y metadata se confirman juntos; null identifica una carga anterior. */
export interface TutoringBanner {
  id_banner: string;
  id_tutor: string;
  storage_name: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  content_bytes: Uint8Array<ArrayBuffer> | null;
  created_at: Date;
  expires_at: Date;
  attached_offer_id: string | null;
  deleted_at: Date | null;
}

/** Interfaz minima de la carga en memoria recibida por Multer. */
export interface BannerUpload {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export const MAX_BANNER_BYTES = 3 * 1024 * 1024;
export const MAX_BANNER_PIXELS = 16_000_000;
export const BANNER_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
