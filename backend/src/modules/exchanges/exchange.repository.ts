import { ExchangeState } from './exchange.types';

export const EXCHANGE_REPOSITORY = Symbol('EXCHANGE_REPOSITORY');

export interface ExchangeRepository {
  readonly scope?: 'memory-process' | 'postgresql-transaction';
  /** Snapshot aislado del ultimo estado confirmado, sin exponer referencias. */
  read<T>(reader: (state: ExchangeState) => T): Promise<T>;
  /**
   * Serializa, valida y confirma todas las escrituras juntas. Un error descarta
   * el borrador completo. El callback no debe iniciar otra transaccion anidada.
   */
  transaction<T>(work: (state: ExchangeState) => Promise<T> | T): Promise<T>;
}
