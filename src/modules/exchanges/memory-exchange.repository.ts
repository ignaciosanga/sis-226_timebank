import { Injectable } from '@nestjs/common';
import { ExchangeRepository } from './exchange.repository';
import { ExchangeState } from './exchange.types';

@Injectable()
export class MemoryExchangeRepository implements ExchangeRepository {
  readonly scope = 'memory-process' as const;
  private state: ExchangeState = {
    users: new Map(),
    availability: new Map(),
    userSkills: new Map(),
    requests: new Map(),
    reservations: new Map(),
    movements: new Map(),
    requestMetadata: new Map(),
    reservationMetadata: new Map(),
    idempotency: new Map(),
  };

  private queue: Promise<void> = Promise.resolve();

  async read<T>(reader: (state: ExchangeState) => T): Promise<T> {
    return structuredClone(reader(structuredClone(this.state)));
  }

  async transaction<T>(
    work: (state: ExchangeState) => Promise<T> | T,
  ): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      // El snapshot se toma despues de adquirir el turno, nunca antes.
      const draft = structuredClone(this.state);
      const result = structuredClone(await work(draft));
      // Tampoco una referencia al borrador retenida por work puede mutar datos
      // confirmados. Si falla cualquiera de los clones no existe commit parcial.
      const committed = structuredClone(draft);
      this.state = committed;
      return result;
    } finally {
      release();
    }
  }
}
