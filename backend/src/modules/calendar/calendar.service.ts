import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Environment } from '../../config/environment';
import { ReservationStatus } from '../exchanges/exchange.types';
import { ExchangesService } from '../exchanges/exchanges.service';

type CalendarState = {
  action: 'calendar-event';
  reservationId: string;
  sub: string;
};

type TokenResponse = { access_token?: string };
type EventListResponse = { items?: { id?: string }[] };

@Injectable()
export class CalendarService {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly jwt: JwtService,
    private readonly exchanges: ExchangesService,
  ) {}

  async authorizationUrl(actor: string, reservationId: string) {
    const reservation = await this.exchanges.getReservation(
      actor,
      reservationId,
    );
    if (reservation.estado !== ReservationStatus.CONFIRMADA)
      throw new ConflictException(
        'Solo una reserva Confirmada se puede agregar al calendario',
      );
    const state = await this.jwt.signAsync(
      {
        action: 'calendar-event',
        reservationId,
        sub: actor,
      } satisfies CalendarState,
      { expiresIn: 600 },
    );
    const settings = this.settings();
    const params = new URLSearchParams({
      access_type: 'online',
      client_id: settings.clientId,
      include_granted_scopes: 'true',
      redirect_uri: settings.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      state,
    });
    return {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    };
  }

  async createEvent(
    code: string,
    stateValue: string,
  ): Promise<'created' | 'exists'> {
    let state: CalendarState;
    try {
      state = await this.jwt.verifyAsync<CalendarState>(stateValue);
    } catch {
      throw new ConflictException('Autorizacion de Google expirada o invalida');
    }
    if (
      state.action !== 'calendar-event' ||
      typeof state.sub !== 'string' ||
      typeof state.reservationId !== 'string'
    )
      throw new ConflictException('Autorizacion de Google invalida');
    const reservation = await this.exchanges.getReservation(
      state.sub,
      state.reservationId,
    );
    if (reservation.estado !== ReservationStatus.CONFIRMADA)
      throw new ConflictException(
        'La reserva ya no se puede agregar al calendario',
      );
    const accessToken = await this.exchangeCode(code);
    const existing = await this.google<EventListResponse>(
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams(
        {
          maxResults: '1',
          privateExtendedProperty: `timebankReservationId=${reservation.id_reserva}`,
          singleEvents: 'true',
        },
      )}`,
    );
    if (existing.items?.some((event) => event.id)) return 'exists';
    await this.google(
      accessToken,
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        body: JSON.stringify({
          summary: 'Banco de Tiempo: reserva confirmada',
          description: `Reserva ${reservation.id_reserva}. Modalidad: ${reservation.modalidad}. Lugar: ${reservation.lugar}.`,
          start: { dateTime: reservation.fecha_inicio.toISOString() },
          end: { dateTime: reservation.fecha_fin.toISOString() },
          extendedProperties: {
            private: { timebankReservationId: reservation.id_reserva },
          },
        }),
      },
    );
    return 'created';
  }

  frontendResultUrl(result: 'created' | 'exists'): string {
    const frontend = this.settings().frontendUrl;
    return `${frontend}/#/intercambios?calendar=${result}`;
  }

  private settings() {
    const enabled = this.config.get('GOOGLE_CALENDAR_ENABLED', { infer: true });
    const clientId = this.config.get('GOOGLE_CALENDAR_CLIENT_ID', {
      infer: true,
    });
    const clientSecret = this.config.get('GOOGLE_CALENDAR_CLIENT_SECRET', {
      infer: true,
    });
    const redirectUri = this.config.get('GOOGLE_CALENDAR_REDIRECT_URI', {
      infer: true,
    });
    if (!enabled || !clientId || !clientSecret || !redirectUri)
      throw new ServiceUnavailableException(
        'Google Calendar no esta configurado',
      );
    return {
      clientId,
      clientSecret,
      redirectUri,
      frontendUrl: this.config.get('FRONTEND_URL', { infer: true }),
    };
  }

  private async exchangeCode(code: string): Promise<string> {
    const settings = this.settings();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: settings.redirectUri,
      }),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        'No se pudo autorizar Google Calendar',
      );
    const token = (await response.json()) as TokenResponse;
    if (!token.access_token)
      throw new ServiceUnavailableException(
        'Google Calendar no devolvio acceso',
      );
    return token.access_token;
  }

  private async google<T>(
    token: string,
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        'No se pudo actualizar Google Calendar',
      );
    return (await response.json()) as T;
  }
}
