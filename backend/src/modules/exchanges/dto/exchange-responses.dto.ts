import { ApiProperty } from '@nestjs/swagger';
import { Movement, RequestStatus, ReservationStatus } from '../exchange.types';

const creditAmount = {
  type: String,
  pattern: '^\\d+$',
  example: '4',
  description: 'Creditos enteros; un credito equivale a 15 minutos',
};
const date = { type: String, format: 'date-time' };

class ExchangeParticipantsResponse {
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) id_solicitud!:
    string | null;
  @ApiProperty({ format: 'uuid' }) id_solicitante!: string;
  @ApiProperty({ format: 'uuid' }) id_ofertante!: string;
  @ApiProperty({ format: 'uuid' }) id_habilidad!: string;
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Contexto de la API guardado en AUDITORIA',
  })
  id_disponibilidad!: string | null;
  @ApiProperty(date) created_at!: Date;
}

export class ExchangeRequestResponse extends ExchangeParticipantsResponse {
  @ApiProperty(date) fecha_inicio_propuesta!: Date;
  @ApiProperty(date) fecha_fin_propuesta!: Date;
  @ApiProperty({ type: 'integer', minimum: 1 }) creditos_requeridos!: number;
  @ApiProperty({ ...date, nullable: true }) respondida_at!: Date | null;
  @ApiProperty({
    maxLength: 500,
    description: 'Descripcion de API conservada en AUDITORIA',
  })
  descripcion!: string;
  @ApiProperty({ enum: RequestStatus, enumName: 'RequestStatus' })
  estado!: RequestStatus;
  @ApiProperty(creditAmount) costo_creditos!: string;
}

export class ConfirmationResponse {
  @ApiProperty({ format: 'uuid' }) id_reserva!: string;
  @ApiProperty({ format: 'uuid' }) id_usuario!: string;
  @ApiProperty(date) fecha!: Date;
}

export class CancellationResponse {
  @ApiProperty({ format: 'uuid' }) id_reserva!: string;
  @ApiProperty({ format: 'uuid' }) id_usuario!: string;
  @ApiProperty({ maxLength: 500 }) motivo!: string;
  @ApiProperty(date) fecha!: Date;
  @ApiProperty() administrativa!: boolean;
}

export class ReservationResponse extends ExchangeParticipantsResponse {
  @ApiProperty({ format: 'uuid' }) id_reserva!: string;
  @ApiProperty(date) fecha_inicio!: Date;
  @ApiProperty(date) fecha_fin!: Date;
  @ApiProperty({ type: 'integer', minimum: 1 }) creditos!: number;
  @ApiProperty({ enum: ['Presencial', 'Virtual', 'Hibrida'] })
  modalidad!: string;
  @ApiProperty({ type: String, example: 'Por coordinar' }) lugar!: string;
  @ApiProperty({ enum: ReservationStatus, enumName: 'ReservationStatus' })
  estado!: ReservationStatus;
  @ApiProperty({ ...date, nullable: true })
  confirmacion_solicitante_at!: Date | null;
  @ApiProperty({ ...date, nullable: true })
  confirmacion_ofertante_at!: Date | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  cancelado_por!: string | null;
  @ApiProperty({ type: String, maxLength: 500, nullable: true })
  motivo_cancelacion!: string | null;
  @ApiProperty({ type: 'integer', minimum: 0, nullable: true })
  horas_anticipacion_cancelacion!: number | null;
  @ApiProperty({ ...date, nullable: true }) completed_at!: Date | null;
  @ApiProperty({ ...date, nullable: true }) cancelled_at!: Date | null;
  @ApiProperty(creditAmount) monto_creditos!: string;
  @ApiProperty({
    type: () => ConfirmationResponse,
    isArray: true,
    maxItems: 2,
    description: 'Vista derivada de los dos timestamps oficiales',
  })
  confirmaciones!: ConfirmationResponse[];
  @ApiProperty({
    type: () => CancellationResponse,
    nullable: true,
    description: 'Vista derivada de campos de RESERVAS',
  })
  cancelacion!: CancellationResponse | null;
}

export class AccountResponse {
  @ApiProperty({ format: 'uuid' }) id_usuario!: string;
  @ApiProperty(creditAmount) saldo!: string;
  @ApiProperty({ ...creditAmount, example: '1' }) creditos_retenidos!: string;
  @ApiProperty({ ...creditAmount, example: '3' }) disponibles!: string;
  @ApiProperty({ enum: ['CREDITO_15_MINUTOS'] }) unidad!: 'CREDITO_15_MINUTOS';
}

export class MovementResponse {
  @ApiProperty({ format: 'uuid' }) id_movimiento!: string;
  @ApiProperty({ format: 'uuid' }) id_usuario!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) id_reserva!:
    string | null;
  @ApiProperty({
    enum: [
      'BonoInicial',
      'Recompensa',
      'Penalizacion',
      'Transferencia',
      'Ajuste',
      'Retencion',
      'Liberacion',
      'Consumo',
    ],
    enumName: 'MovementType',
  })
  tipo!: Movement['tipo'];
  @ApiProperty({ type: 'integer', example: -4 }) cantidad!: number;
  @ApiProperty({ type: String, pattern: '^-?\\d+$', example: '-4' })
  monto!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) saldo_anterior!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) saldo_posterior!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) retenidos_anterior!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) retenidos_posterior!: number;
  @ApiProperty(date) created_at!: Date;
  @ApiProperty({ type: String, maxLength: 500, nullable: true }) descripcion!:
    string | null;
}

export class GrantCreditsResponse {
  @ApiProperty({ type: () => AccountResponse }) cuenta!: AccountResponse;
  @ApiProperty({ type: () => MovementResponse }) movimiento!: MovementResponse;
}

export class IntegrityIssueResponse {
  @ApiProperty({ example: 'PARTICIPANT_RESERVATION_OVERLAP' }) code!: string;
  @ApiProperty({ type: String, isArray: true }) ids!: string[];
}

export class IntegrityCountsResponse {
  @ApiProperty({ type: 'integer', minimum: 0 }) solicitudes!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) reservas!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) movimientos!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) usuarios!: number;
}

export class IntegrityResponse {
  @ApiProperty({ enum: ['ok', 'inconsistente'] }) status!:
    'ok' | 'inconsistente';
  @ApiProperty({ enum: ['memory-process', 'postgresql-transaction'] })
  scope!: string;
  @ApiProperty({ type: () => IntegrityIssueResponse, isArray: true })
  issues!: IntegrityIssueResponse[];
  @ApiProperty({ type: () => IntegrityCountsResponse })
  counts!: IntegrityCountsResponse;
}
