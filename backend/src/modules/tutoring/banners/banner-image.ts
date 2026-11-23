import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import {
  BannerUpload,
  MAX_BANNER_BYTES,
  MAX_BANNER_PIXELS,
} from './banner.types';

const formats = {
  jpeg: { mime: 'image/jpeg', extension: 'jpg' },
  png: { mime: 'image/png', extension: 'png' },
  webp: { mime: 'image/webp', extension: 'webp' },
} as const;

/** Decodifica y recodifica el contenido; no confia en nombre, extension ni MIME. */
export async function decodeBanner(file: BannerUpload | undefined) {
  if (
    !file ||
    !Buffer.isBuffer(file.buffer) ||
    file.buffer.length === 0 ||
    file.size !== file.buffer.length ||
    file.buffer.length > MAX_BANNER_BYTES
  )
    throw new BadRequestException('Se requiere una imagen de hasta 3 MiB');
  try {
    const image = sharp(file.buffer, {
      failOn: 'error',
      limitInputPixels: MAX_BANNER_PIXELS,
      animated: false,
    });
    const metadata = await image.metadata();
    if (
      !metadata.format ||
      !(metadata.format in formats) ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MAX_BANNER_PIXELS ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error('Formato o dimensiones no admitidos');
    const format = metadata.format as keyof typeof formats;
    const detected = formats[format];
    if (file.mimetype !== detected.mime)
      throw new Error('El MIME no corresponde al contenido');
    // toBuffer fuerza la decodificacion completa. La recodificacion omite EXIF y
    // datos adjuntos originales, manteniendo solo una imagen de formato admitido.
    const bytes = await image.rotate().toFormat(format).toBuffer();
    if (bytes.length > MAX_BANNER_BYTES)
      throw new Error('La imagen decodificada excede el limite');
    return { bytes, mime: detected.mime, extension: detected.extension };
  } catch {
    throw new BadRequestException(
      'Banner invalido: se admite JPG, PNG o WebP real, sin animacion, hasta 3 MiB y 16 megapixeles',
    );
  }
}
