import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { decodeBanner } from './banner-image';
import { MAX_BANNER_BYTES } from './banner.types';

describe('Contenido real del banner', () => {
  const image = () =>
    sharp({
      create: { width: 3, height: 2, channels: 3, background: '#156369' },
    });

  it.each([
    ['jpeg', 'image/jpeg', 'jpg'],
    ['png', 'image/png', 'png'],
    ['webp', 'image/webp', 'webp'],
  ] as const)(
    'decodifica una imagen %s real',
    async (format, mimetype, ext) => {
      const buffer = await image().toFormat(format).toBuffer();
      const decoded = await decodeBanner({
        buffer,
        mimetype,
        size: buffer.length,
      });
      expect(decoded.mime).toBe(mimetype);
      expect(decoded.extension).toBe(ext);
      const metadata = await sharp(decoded.bytes).metadata();
      expect(metadata).toMatchObject({ width: 3, height: 2, format });
    },
  );

  it('rechaza bytes falsos aunque declaren MIME de imagen', async () => {
    const buffer = Buffer.from('<script>alert(1)</script>');
    await expect(
      decodeBanner({ buffer, size: buffer.length, mimetype: 'image/png' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza SVG y MIME que no coincide con el contenido', async () => {
    const buffer = await image().png().toBuffer();
    await expect(
      decodeBanner({ buffer, size: buffer.length, mimetype: 'image/webp' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>',
    );
    await expect(
      decodeBanner({
        buffer: svg,
        size: svg.length,
        mimetype: 'image/svg+xml',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una imagen truncada que conserva su cabecera', async () => {
    const full = await image().png().toBuffer();
    const buffer = full.subarray(0, full.length - 20);
    await expect(
      decodeBanner({ buffer, size: buffer.length, mimetype: 'image/png' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza ausencia, exceso de bytes y dimensiones excesivas', async () => {
    await expect(decodeBanner(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const tooBig = Buffer.alloc(MAX_BANNER_BYTES + 1);
    await expect(
      decodeBanner({
        buffer: tooBig,
        size: tooBig.length,
        mimetype: 'image/png',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const buffer = await sharp({
      create: { width: 4001, height: 4000, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    await expect(
      decodeBanner({ buffer, size: buffer.length, mimetype: 'image/png' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
