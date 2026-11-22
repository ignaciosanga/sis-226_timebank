import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { paginate } from '../../common/dto/list-query.dto';
import { OffersQueryDto } from './dto/offers-query.dto';
import {
  AvailabilityStatus,
  UserStatus,
} from '../../common/enums/record-status.enum';
import { Environment } from '../../config/environment';
import { availabilityInterval } from '../availability/availability-interval';
import { validateReservationInterval } from '../exchanges/credits';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../exchanges/exchange.repository';
import {
  ExchangeState,
  RequestStatus,
  ReservationStatus,
} from '../exchanges/exchange.types';
import { SkillsService } from '../skills/skills.service';
import { TutoringBannerService } from './banners/banner.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { offerMetrics } from './offer-metrics';
import { parseOfferPrice } from './offer-price';
import { TutoringOffer } from './offer.types';

@Injectable()
export class TutoringService {
  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly persistence: ExchangeRepository,
    private readonly skills: SkillsService,
    private readonly banners: TutoringBannerService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  private view(
    state: ExchangeState,
    offer: TutoringOffer,
    skill: { id_habilidad: string; nombre: string },
  ) {
    const tutor = state.users.get(offer.id_tutor)!;
    const slot = state.availability.get(offer.id_disponibilidad)!;
    return {
      id_oferta: offer.id_oferta,
      id_usuario: offer.id_tutor,
      id_tutor: offer.id_tutor,
      id_habilidad: offer.id_habilidad,
      id_disponibilidad: offer.id_disponibilidad,
      nivel: offer.nivel,
      titulo: offer.titulo,
      descripcion: offer.descripcion,
      costo_creditos: offer.costo_creditos,
      bannerUrl: offer.id_banner
        ? `${this.config.get('PUBLIC_API_URL', { infer: true })}/tutoring/banners/${offer.id_banner}`
        : null,
      fecha_inicio: slot.fecha_inicio.toISOString(),
      fecha_fin: slot.fecha_fin.toISOString(),
      tutor: {
        id: tutor.id_usuario,
        id_usuario: tutor.id_usuario,
        nombre: tutor.nombre,
        apellido: tutor.apellido,
      },
      materia: { id_habilidad: skill.id_habilidad, nombre: skill.nombre },
      metricas: offerMetrics(state, offer.id_tutor, offer.id_habilidad),
    };
  }

  async publish(actor: string, input: CreateOfferDto, key: string | undefined) {
    if (!key || !/^[A-Za-z0-9._:-]{16,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key requerida: 16 a 128 caracteres alfanumericos o . _ : -',
      );
    const price = parseOfferPrice(input.costoCreditos);
    const interval = availabilityInterval(input.fechaInicio, input.fechaFin);
    validateReservationInterval(interval.fecha_inicio, interval.fecha_fin);
    const payload = {
      skillId: input.skillId,
      nivel: input.nivel,
      titulo: input.titulo.trim(),
      descripcion: input.descripcion.trim(),
      costoCreditos: price,
      fechaInicio: interval.fecha_inicio.toISOString(),
      fechaFin: interval.fecha_fin.toISOString(),
      bannerUrl: input.bannerUrl ?? null,
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    return this.persistence.transaction(async (state) => {
      const tutor = state.users.get(actor);
      if (tutor?.estado !== UserStatus.ACTIVO)
        throw new ForbiddenException(
          'La cuenta debe estar activa para publicar',
        );
      const scope = `${actor}:tutoring-offers:${key}`;
      const prior = state.idempotency.get(scope);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictException(
            'Idempotency-Key ya utilizada con otro contenido',
          );
        return structuredClone(prior.result);
      }
      const skill = await this.skills
        .requireActive(input.skillId)
        .catch((error: unknown) => {
          if (error instanceof NotFoundException)
            throw new BadRequestException(
              'La materia debe existir y estar activa en el catálogo',
            );
          throw error;
        });
      const own = state.userSkills.get(`${actor}:${input.skillId}`);
      if (!own)
        throw new ForbiddenException(
          'Solo puedes publicar una habilidad propia',
        );
      if (own.nivel !== input.nivel)
        throw new ConflictException(
          'El nivel debe coincidir con el perfil del tutor',
        );
      const now = new Date(Date.now());
      if (interval.fecha_inicio <= now)
        throw new BadRequestException('La oferta debe tener un horario futuro');
      for (const offer of state.offers.values()) {
        const slot = state.availability.get(offer.id_disponibilidad);
        if (
          offer.id_tutor === actor &&
          offer.id_habilidad === input.skillId &&
          offer.estado === 'Activa'
        ) {
          if (slot && slot.fecha_fin <= now) offer.estado = 'Finalizada';
          else
            throw new ConflictException(
              'Ya existe una oferta activa para este tutor y materia',
            );
        }
      }
      const overlaps = (start: Date, end: Date) =>
        interval.fecha_inicio < end && interval.fecha_fin > start;
      if (
        [...state.availability.values()].some(
          (slot) =>
            slot.id_usuario === actor &&
            slot.estado !== AvailabilityStatus.CANCELADO &&
            overlaps(slot.fecha_inicio, slot.fecha_fin),
        ) ||
        [...state.reservations.values()].some(
          (row) =>
            row.estado === ReservationStatus.CONFIRMADA &&
            (row.id_ofertante === actor || row.id_solicitante === actor) &&
            overlaps(row.fecha_inicio, row.fecha_fin),
        )
      )
        throw new ConflictException(
          'El horario se superpone con disponibilidad o reserva del tutor',
        );
      const offerId = randomUUID(),
        availabilityId = randomUUID();
      const bannerId = await this.banners.validateAndAttach(
        state,
        actor,
        input.bannerUrl,
        offerId,
      );
      const offer: TutoringOffer = {
        id_oferta: offerId,
        id_tutor: actor,
        id_habilidad: input.skillId,
        id_disponibilidad: availabilityId,
        id_banner: bannerId,
        nivel: input.nivel,
        titulo: payload.titulo,
        descripcion: payload.descripcion,
        costo_creditos: price,
        estado: 'Activa',
        created_at: now,
      };
      state.availability.set(availabilityId, {
        id_disponibilidad: availabilityId,
        id_usuario: actor,
        ...interval,
        estado: AvailabilityStatus.DISPONIBLE,
      });
      state.offers.set(offerId, offer);
      const result = this.view(state, offer, skill);
      state.idempotency.set(scope, { fingerprint, result });
      return result;
    });
  }

  async update(actor: string, id: string, input: CreateOfferDto, key?: string) {
    if (!key || !/^[A-Za-z0-9._:-]{16,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key requerida: 16 a 128 caracteres',
      );
    const price = parseOfferPrice(input.costoCreditos);
    const interval = availabilityInterval(input.fechaInicio, input.fechaFin);
    validateReservationInterval(interval.fecha_inicio, interval.fecha_fin);
    const payload = [
      id,
      input.skillId,
      input.nivel,
      input.titulo.trim(),
      input.descripcion.trim(),
      price,
      interval.fecha_inicio.toISOString(),
      interval.fecha_fin.toISOString(),
      input.bannerUrl ?? null,
    ];
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    return this.persistence.transaction(async (state) => {
      const offer = state.offers.get(id);
      if (!offer) throw new NotFoundException('Oferta no encontrada');
      if (
        offer.id_tutor !== actor ||
        state.users.get(actor)?.estado !== UserStatus.ACTIVO
      )
        throw new ForbiddenException(
          'Solo el tutor activo propietario puede editar',
        );
      const scope = `${actor}:tutoring-offer-update:${key}`;
      const prior = state.idempotency.get(scope);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictException(
            'Idempotency-Key ya utilizada con otro contenido',
          );
        return structuredClone(prior.result);
      }
      if (input.skillId !== offer.id_habilidad)
        throw new BadRequestException(
          'La materia de una oferta existente no puede cambiar',
        );
      const skill = await this.skills.requireActive(input.skillId);
      if (!state.userSkills.has(`${actor}:${input.skillId}`))
        throw new ForbiddenException('La materia debe pertenecer al perfil');
      if (
        state.userSkills.get(`${actor}:${input.skillId}`)!.nivel !== input.nivel
      )
        throw new ConflictException('Nivel incompatible con el perfil');
      const slot = state.availability.get(offer.id_disponibilidad);
      if (
        !slot ||
        offer.estado !== 'Activa' ||
        slot.fecha_inicio.getTime() <= Date.now()
      )
        throw new ConflictException('Solo se editan ofertas activas futuras');
      if (interval.fecha_inicio.getTime() <= Date.now())
        throw new BadRequestException('El horario debe ser futuro');
      const changed =
        slot.fecha_inicio.getTime() !== interval.fecha_inicio.getTime() ||
        slot.fecha_fin.getTime() !== interval.fecha_fin.getTime();
      if (changed) {
        if (
          slot.estado !== AvailabilityStatus.DISPONIBLE ||
          [...state.requests.values()].some(
            (r) =>
              (r.id_oferta === id ||
                state.requestMetadata.get(r.id_solicitud)?.availabilityId ===
                  slot.id_disponibilidad) &&
              (r.estado === RequestStatus.PENDIENTE ||
                r.estado === RequestStatus.ACEPTADA),
          )
        )
          throw new ConflictException(
            'No se cambia el horario con solicitudes o reservas vinculadas',
          );
        const overlaps = (start: Date, end: Date) =>
          interval.fecha_inicio < end && interval.fecha_fin > start;
        if (
          [...state.availability.values()].some(
            (s) =>
              s.id_disponibilidad !== slot.id_disponibilidad &&
              s.id_usuario === actor &&
              s.estado !== AvailabilityStatus.CANCELADO &&
              overlaps(s.fecha_inicio, s.fecha_fin),
          ) ||
          [...state.reservations.values()].some(
            (r) =>
              r.estado === ReservationStatus.CONFIRMADA &&
              (r.id_solicitante === actor || r.id_ofertante === actor) &&
              overlaps(r.fecha_inicio, r.fecha_fin),
          )
        )
          throw new ConflictException('Horario superpuesto');
      }
      const bannerId = await this.banners.validateAndAttach(
        state,
        actor,
        input.bannerUrl,
        id,
      );
      if (offer.id_banner && offer.id_banner !== bannerId) {
        const old = state.banners.get(offer.id_banner);
        if (old) old.attached_offer_id = null;
      }
      Object.assign(offer, {
        titulo: input.titulo.trim(),
        descripcion: input.descripcion.trim(),
        nivel: input.nivel,
        costo_creditos: price,
        id_banner: bannerId,
      });
      Object.assign(slot, interval);
      const result = this.view(state, offer, skill);
      state.idempotency.set(scope, { fingerprint, result });
      return result;
    });
  }

  async detail(id: string) {
    const rows = await this.visibleOffers(new OffersQueryDto());
    const offer = rows.find((row) => row.id_oferta === id);
    if (!offer) throw new NotFoundException('Oferta activa no encontrada');
    return offer;
  }

  async list(query: OffersQueryDto) {
    return paginate(await this.visibleOffers(query), query);
  }

  private async visibleOffers(query: OffersQueryDto) {
    const state = await this.persistence.read((state) => state);
    const codes = await this.skills.academicCodes();
    const now = Date.now();
    const rows = [];
    for (const offer of [...state.offers.values()].sort(
      (a, b) =>
        b.created_at.getTime() - a.created_at.getTime() ||
        a.id_oferta.localeCompare(b.id_oferta),
    )) {
      if (
        (query.skillId && query.skillId !== offer.id_habilidad) ||
        (query.codigo && query.codigo !== codes.get(offer.id_habilidad)) ||
        (query.tutorId && query.tutorId !== offer.id_tutor) ||
        query.excludeTutorId === offer.id_tutor
      )
        continue;
      const user = state.users.get(offer.id_tutor),
        slot = state.availability.get(offer.id_disponibilidad);
      if (
        offer.estado !== 'Activa' ||
        user?.estado !== UserStatus.ACTIVO ||
        !slot ||
        slot.id_usuario !== offer.id_tutor ||
        slot.estado !== AvailabilityStatus.DISPONIBLE ||
        slot.fecha_inicio.getTime() <= now
      )
        continue;
      const own = state.userSkills.get(
        `${offer.id_tutor}:${offer.id_habilidad}`,
      );
      if (!own || own.nivel !== offer.nivel) continue;
      let skill;
      try {
        skill = await this.skills.requireActive(offer.id_habilidad);
      } catch (error) {
        if (error instanceof NotFoundException) continue;
        throw error;
      }
      const view = this.view(state, offer, skill);
      const search = query.search?.toLocaleLowerCase('es');
      if (
        search &&
        !`${codes.get(offer.id_habilidad) ?? ''} ${view.titulo} ${view.descripcion} ${view.materia.nombre} ${view.tutor.nombre} ${view.tutor.apellido}`
          .toLocaleLowerCase('es')
          .includes(search)
      )
        continue;
      rows.push({
        ...view,
        materia: {
          ...view.materia,
          codigo: codes.get(offer.id_habilidad) ?? null,
        },
      });
    }
    return rows;
  }
}
