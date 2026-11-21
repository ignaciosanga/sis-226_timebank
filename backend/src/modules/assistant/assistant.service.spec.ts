import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';
import { AssistantService } from './assistant.service';

const settings: Partial<Environment> = {
  ASSISTANT_API_KEY: 'test-key',
  ASSISTANT_API_URL: 'https://llm.example/v1/chat/completions',
  ASSISTANT_MODEL: 'modelo-prueba',
  ASSISTANT_TIMEOUT_MS: 5000,
  REGISTRATION_INITIAL_CREDITS: 8,
};
const serviceWith = (overrides: Partial<Environment> = {}) =>
  new AssistantService({
    get: (key: keyof Environment) => ({ ...settings, ...overrides })[key],
  } as unknown as ConfigService<Environment, true>);
const reply = (body: unknown, status = 200) =>
  jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as jest.Mock & typeof fetch;

describe('AssistantService', () => {
  it('envía las reglas de Nexo U, el historial y la pregunta, y devuelve la respuesta', async () => {
    const fetcher = reply({
      choices: [
        { message: { content: '  Busca la materia en Habilidades.  ' } },
      ],
    });
    await expect(
      serviceWith().ask(
        {
          question: '¿Cómo reservo?',
          history: [
            { role: 'user', content: 'Hola' },
            { role: 'assistant', content: '¿En qué te ayudo?' },
          ],
        },
        fetcher,
      ),
    ).resolves.toEqual({ answer: 'Busca la materia en Habilidades.' });
    const [url, init] = (fetcher as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://llm.example/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer test-key',
    );
    const body = JSON.parse(init.body as string) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe('modelo-prueba');
    expect(body.messages.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(body.messages[0]?.content).toContain('bono de bienvenida de 8');
    expect(body.messages[3]?.content).toBe('¿Cómo reservo?');
  });

  it('responde 503 sin llamar al modelo cuando no hay clave', async () => {
    const fetcher = reply({});
    await expect(
      serviceWith({ ASSISTANT_API_KEY: undefined }).ask(
        { question: 'Hola' },
        fetcher,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('responde 503 cuando el proveedor limita las peticiones', async () => {
    await expect(
      serviceWith().ask({ question: 'Hola' }, reply({}, 429)),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('responde 502 ante un error del proveedor o una respuesta vacía', async () => {
    await expect(
      serviceWith().ask({ question: 'Hola' }, reply({}, 500)),
    ).rejects.toBeInstanceOf(BadGatewayException);
    await expect(
      serviceWith().ask({ question: 'Hola' }, reply({ choices: [] })),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('responde 502 si el proveedor no contesta', async () => {
    const fetcher = jest.fn(async () => {
      throw new Error('timeout');
    }) as unknown as typeof fetch;
    await expect(
      serviceWith().ask({ question: 'Hola' }, fetcher),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
