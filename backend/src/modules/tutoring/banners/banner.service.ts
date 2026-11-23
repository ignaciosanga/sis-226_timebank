import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../../exchanges/exchange.repository';
import { ExchangeState } from '../../exchanges/exchange.types';
import { decodeBanner } from './banner-image';
import {
  BannerUpload,
  BANNER_PENDING_TTL_MS,
  TutoringBanner,
} from './banner.types';

const storageName =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

@Injectable()
export class TutoringBannerService implements OnModuleInit {
  private readonly directory: string;
  private readonly publicOrigin: string;

  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly persistence: ExchangeRepository,
    config: ConfigService,
  ) {
    this.directory = resolve(
      config.get<string>('BANNER_STORAGE_DIR') ?? '.local/tutoring-banners',
    );
    this.publicOrigin = (
      config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:4000'
    ).replace(/\/$/, '');
  }

  async onModuleInit(): Promise<void> {
    await this.cleanupExpired();
  }

  private async legacyDirectory(): Promise<void> {
    const directory = await lstat(this.directory);
    if (!directory.isDirectory() || directory.isSymbolicLink())
      throw new ServiceUnavailableException('Almacenamiento no disponible');
  }

  private filePath(name: string): string {
    const path = resolve(join(this.directory, name));
    if (!storageName.test(name) || dirname(path) !== this.directory)
      throw new ServiceUnavailableException('Almacenamiento no disponible');
    return path;
  }

  private url(id: string): string {
    return `${this.publicOrigin}/tutoring/banners/${id}`;
  }

  private active(state: ExchangeState, actor: string): void {
    if (state.users.get(actor)?.estado !== 'Activo')
      throw new ForbiddenException('Se requiere una cuenta activa');
  }

  /** Conserva metadata e idempotencia de expirados; retira solamente sus bytes. */
  async cleanupExpired(): Promise<void> {
    const now = new Date(Date.now());
    const { discarded, known } = await this.persistence.transaction((state) => {
      const discarded: string[] = [];
      const known: string[] = [];
      for (const banner of state.banners.values()) {
        known.push(banner.storage_name);
        if (!banner.attached_offer_id && banner.expires_at <= now) {
          banner.deleted_at ??= now;
          banner.content_bytes = null;
          discarded.push(banner.storage_name);
        }
      }
      return { discarded, known };
    });
    // El disco legado es opcional: ni arranque ni nuevas cargas dependen de el.
    try {
      await this.legacyDirectory();
    } catch {
      return;
    }
    for (const name of discarded)
      await rm(this.filePath(name), { force: true }).catch(() => undefined);
    // Retira tambien archivos huerfanos de la implementacion anterior.
    const knownNames = new Set(known);
    for (const name of await readdir(this.directory).catch(() => [])) {
      if (!storageName.test(name) || knownNames.has(name)) continue;
      const path = this.filePath(name);
      const info = await lstat(path).catch(() => null);
      if (
        info?.isFile() &&
        !info.isSymbolicLink() &&
        info.mtimeMs <= now.getTime() - BANNER_PENDING_TTL_MS
      )
        await rm(path, { force: true }).catch(() => undefined);
    }
  }

  async upload(actor: string, file: BannerUpload | undefined, key?: string) {
    if (!key || !/^[A-Za-z0-9._:-]{16,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key requerida: 16 a 128 caracteres alfanumericos o . _ : -',
      );
    await this.persistence.read((state) => this.active(state, actor));
    const decoded = await decodeBanner(file);
    // La identidad del reintento corresponde a los bytes enviados, no a los
    // detalles internos de la recodificacion de una version del decoder.
    const fingerprint = createHash('sha256')
      .update(file!.mimetype)
      .update('\0')
      .update(file!.buffer)
      .digest('hex');
    await this.cleanupExpired();
    const id = randomUUID();
    const name = `${id}.${decoded.extension}`;
    return this.persistence.transaction(async (state) => {
      this.active(state, actor);
      const scope = `${actor}:tutoring.banner:${key}`;
      const previous = state.idempotency.get(scope);
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ConflictException(
            'Idempotency-Key ya utilizada con otro contenido',
          );
        const result = previous.result as { url: string };
        const previousBanner = [...state.banners.values()].find(
          (banner) => this.url(banner.id_banner) === result.url,
        );
        if (!previousBanner || previousBanner.deleted_at)
          throw new GoneException(
            'La carga pendiente vencio; usar otra Idempotency-Key para cargar nuevamente',
          );
        // Un replay antiguo solo responde con exito si tambien conserva bytes.
        const bytes = await this.readBytes(previousBanner);
        previousBanner.content_bytes = new Uint8Array(bytes);
        return structuredClone(result);
      }
      const now = new Date(Date.now());
      const banner: TutoringBanner = {
        id_banner: id,
        id_tutor: actor,
        storage_name: name,
        mime_type: decoded.mime,
        byte_size: decoded.bytes.length,
        sha256: createHash('sha256').update(decoded.bytes).digest('hex'),
        content_bytes: new Uint8Array(decoded.bytes),
        created_at: now,
        expires_at: new Date(now.getTime() + BANNER_PENDING_TTL_MS),
        attached_offer_id: null,
        deleted_at: null,
      };
      state.banners.set(id, banner);
      const result = { url: this.url(id) };
      state.idempotency.set(scope, { fingerprint, result });
      return result;
    });
  }

  /** Ejecutar dentro de la misma transaccion que crea oferta y disponibilidad. */
  async validateAndAttach(
    state: ExchangeState,
    actor: string,
    bannerUrl: string | undefined,
    offerId: string,
  ): Promise<string | null> {
    if (!bannerUrl) return null;
    const banner = [...state.banners.values()].find(
      (entry) => this.url(entry.id_banner) === bannerUrl,
    );
    if (!banner || banner.id_tutor !== actor)
      throw new BadRequestException(
        'El banner no corresponde a una carga propia',
      );
    if (
      banner.deleted_at ||
      (!banner.attached_offer_id && banner.expires_at <= new Date(Date.now()))
    )
      throw new GoneException('La carga pendiente del banner vencio');
    if (banner.attached_offer_id && banner.attached_offer_id !== offerId)
      throw new ConflictException('El banner ya pertenece a otra oferta');
    await this.readBytes(banner);
    banner.attached_offer_id = offerId;
    return banner.id_banner;
  }

  private async readBytes(banner: TutoringBanner): Promise<Buffer> {
    try {
      let bytes: Buffer;
      if (banner.content_bytes != null) {
        bytes = Buffer.from(banner.content_bytes);
      } else {
        await this.legacyDirectory();
        const path = this.filePath(banner.storage_name);
        const info = await lstat(path);
        if (
          !info.isFile() ||
          info.isSymbolicLink() ||
          info.size !== banner.byte_size
        )
          throw new Error('Archivo');
        bytes = await readFile(path);
      }
      if (
        bytes.length !== banner.byte_size ||
        createHash('sha256').update(bytes).digest('hex') !== banner.sha256
      )
        throw new Error('Contenido');
      return bytes;
    } catch {
      throw new ServiceUnavailableException(
        'Imagen temporalmente no disponible',
      );
    }
  }

  async get(id: string) {
    const banner = await this.persistence.read((state) => {
      const banner = state.banners.get(id);
      const offer = banner?.attached_offer_id
        ? state.offers.get(banner.attached_offer_id)
        : undefined;
      if (
        !banner ||
        banner.deleted_at ||
        !offer ||
        offer.estado !== 'Activa' ||
        offer.id_banner !== id ||
        offer.id_tutor !== banner.id_tutor ||
        state.users.get(banner.id_tutor)?.estado !== 'Activo'
      )
        throw new NotFoundException('Banner publicado no encontrado');
      return structuredClone(banner);
    });
    return {
      bytes: await this.readBytes(banner),
      mime: banner.mime_type,
      filename: banner.storage_name,
    };
  }
}
