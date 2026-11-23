import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Environment } from '../../config/environment';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ExchangesService } from '../exchanges/exchanges.service';
import { SkillsService } from '../skills/skills.service';
import { TutoringService } from '../tutoring/tutoring.service';
import { UserSkillsService } from '../user-skills/user-skills.service';
import { UsersService } from '../users/users.service';
import { decryptSecret, encryptSecret, keyHint } from './assistant-crypto';
import { AssistantProfileStore } from './assistant-profile.store';
import { rankByTokens } from './assistant-tools';
import { AssistantService } from './assistant.service';

const SECRET = randomBytes(32).toString('base64');
const OWN_KEY = 'gsk_personalKey1234567890abcdef';
const settings: Partial<Environment> = {
  PERSISTENCE_MODE: 'memory',
  ASSISTANT_API_KEY: 'app-key',
  ASSISTANT_API_URL: 'https://llm.example/openai/v1/chat/completions',
  ASSISTANT_MODEL: 'modelo-prueba',
  ASSISTANT_TIMEOUT_MS: 5000,
  ASSISTANT_KEYS_SECRET: SECRET,
  ASSISTANT_FREE_MESSAGES: 5,
  REGISTRATION_INITIAL_CREDITS: 8,
};
const offer = {
  id_oferta: '11111111-1111-4111-8111-111111111111',
  titulo: 'Repaso de punteros',
  descripcion: 'Ejercicios de C++',
  materia: { nombre: 'Programación I', codigo: 'SIS-112' },
  tutor: { nombre: 'Valeria', apellido: 'Mendoza' },
  costo_creditos: '3.5',
  fecha_inicio: new Date('2026-11-25T19:00:00Z'),
};

function setup(overrides: Partial<Environment> = {}) {
  const config = {
    get: (key: keyof Environment) => ({ ...settings, ...overrides })[key],
  } as unknown as ConfigService<Environment, true>;
  const users = {
    requireActive: jest.fn(async () => ({})),
    me: jest.fn(async (id: string) => ({
      id,
      nombre: id === 'ana' ? 'Ana' : 'Luis',
    })),
  };
  const tutoring = {
    list: jest.fn(async () => ({ data: [offer], meta: {} })),
  };
  const exchanges = {
    getAccount: jest.fn(async () => ({
      saldo: '8',
      creditos_retenidos: '0',
      disponibles: '8',
    })),
    listReservations: jest.fn(async () => []),
    listRequests: jest.fn(async () => []),
  };
  const userSkills = {
    list: jest.fn(async () => [
      { habilidad: { nombre: 'Excel' }, nivel: 'Avanzado' },
    ]),
  };
  const skills = { requireActive: jest.fn(async () => ({ nombre: 'Excel' })) };
  const store = new AssistantProfileStore({} as PrismaService, config);
  const service = new AssistantService(
    config,
    store,
    tutoring as unknown as TutoringService,
    exchanges as unknown as ExchangesService,
    userSkills as unknown as UserSkillsService,
    users as unknown as UsersService,
    skills as unknown as SkillsService,
  );
  return { service, store, tutoring };
}

type Reply = { status?: number; message?: unknown };
const llm = (...replies: Reply[]) =>
  jest.fn(async () => {
    const reply = replies.shift() ?? { message: { content: 'ok' } };
    const status = reply.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ choices: [{ message: reply.message }] }),
    };
  }) as unknown as jest.Mock & typeof fetch;
const toolCall = (name: string, args: object) => ({
  content: null,
  tool_calls: [
    {
      id: `call-${name}`,
      type: 'function',
      function: { name, arguments: JSON.stringify(args) },
    },
  ],
});
const sentBody = (fetcher: jest.Mock, index = 0) => {
  const [, init] = fetcher.mock.calls[index] as [string, RequestInit];
  return {
    auth: (init.headers as Record<string, string>).authorization,
    body: JSON.parse(init.body as string) as {
      messages: { role: string; content: string | null }[];
      tools?: unknown[];
    },
  };
};

describe('cifrado de llaves', () => {
  it('cifra y descifra sin guardar la llave en claro y detecta alteraciones', () => {
    const cipher = encryptSecret(OWN_KEY, SECRET);
    expect(cipher).not.toContain(OWN_KEY);
    expect(decryptSecret(cipher, SECRET)).toBe(OWN_KEY);
    const parts = cipher.split(':');
    parts[3] = Buffer.from('otra cosa').toString('base64');
    expect(() => decryptSecret(parts.join(':'), SECRET)).toThrow();
    expect(() =>
      decryptSecret(cipher, randomBytes(32).toString('base64')),
    ).toThrow();
    expect(keyHint(OWN_KEY)).toBe('gsk_…cdef');
  });
});

describe('búsqueda por palabras', () => {
  it('ignora tildes y palabras vacías y ordena por coincidencias', () => {
    const rows = ['Cálculo I', 'Programación I punteros', 'Inglés'];
    expect(
      rankByTokens(rows, 'quiero aprender programacion con punteros', (r) => r),
    ).toEqual(['Programación I punteros']);
    expect(rankByTokens(rows, 'calculo', (r) => r)).toEqual(['Cálculo I']);
  });
});

describe('AssistantService', () => {
  it('responde con la key de la app y descuenta los mensajes gratis del día', async () => {
    const { service } = setup();
    const fetcher = llm({ message: { content: ' Hola Ana ' } });
    const result = await service.ask('ana', { question: 'Hola' }, fetcher);
    expect(result).toMatchObject({
      answer: 'Hola Ana',
      actions: [],
      offers: [],
      quota: { llavePropia: false, limite: 5, usados: 1, restantes: 4 },
    });
    const { auth, body } = sentBody(fetcher);
    expect(auth).toBe('Bearer app-key');
    expect(body.tools).toHaveLength(3);
    expect(body.messages[0]?.content).toContain('bono de bienvenida de 8');
  });

  it('bloquea el sexto mensaje del día con ASSISTANT_QUOTA_EXCEEDED', async () => {
    const { service } = setup();
    for (let i = 0; i < 5; i++)
      await service.ask(
        'ana',
        { question: `Pregunta ${i}` },
        llm({ message: { content: 'ok' } }),
      );
    const blocked = service.ask('ana', { question: 'Otra' }, llm({}));
    await expect(blocked).rejects.toBeInstanceOf(HttpException);
    await expect(blocked).rejects.toMatchObject({
      status: 429,
      response: { code: 'ASSISTANT_QUOTA_EXCEEDED' },
    });
  });

  it('no consume mensajes si el modelo falla', async () => {
    const { service } = setup();
    await expect(
      service.ask('ana', { question: 'Hola' }, llm({ status: 500 })),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect((await service.profile('ana')).quota.usados).toBe(0);
  });

  it('guarda la key propia cifrada después de validarla y la usa sin límite', async () => {
    const { service, store } = setup({ ASSISTANT_FREE_MESSAGES: 0 });
    const groq = jest.fn(async () => ({ ok: true, status: 200 }));
    const profile = await service.saveKey(
      'ana',
      { apiKey: OWN_KEY },
      groq as unknown as typeof fetch,
    );
    expect(groq).toHaveBeenCalledWith(
      'https://llm.example/openai/v1/models',
      expect.objectContaining({
        headers: { authorization: `Bearer ${OWN_KEY}` },
      }),
    );
    expect(profile).toMatchObject({
      llavePista: 'gsk_…cdef',
      quota: { llavePropia: true },
    });
    expect(JSON.stringify(profile)).not.toContain(OWN_KEY);
    const saved = await store.get('ana');
    expect(saved.groq_key_cifrada).not.toContain(OWN_KEY);
    const fetcher = llm({ message: { content: 'Con tu key' } });
    await service.ask('ana', { question: 'Hola' }, fetcher);
    expect(sentBody(fetcher).auth).toBe(`Bearer ${OWN_KEY}`);
    const cleared = await service.clearKey('ana');
    expect(cleared.llavePista).toBeNull();
  });

  it('rechaza una key que Groq no acepta y no la guarda', async () => {
    const { service, store } = setup();
    const groq = jest.fn(async () => ({ ok: false, status: 401 }));
    await expect(
      service.saveKey(
        'ana',
        { apiKey: OWN_KEY },
        groq as unknown as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await store.get('ana')).groq_key_cifrada).toBeNull();
  });

  it('no acepta llaves personales si el servidor no tiene secreto de cifrado', async () => {
    const { service } = setup({ ASSISTANT_KEYS_SECRET: undefined });
    await expect(
      service.saveKey('ana', { apiKey: OWN_KEY }, llm({})),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('ejecuta herramientas: muestra una sección y devuelve tarjetas de ofertas', async () => {
    const { service, tutoring } = setup();
    const fetcher = llm(
      { message: toolCall('buscar_ofertas', { texto: 'punteros' }) },
      { message: toolCall('mostrar_en_pantalla', { seccion: 'ofertar' }) },
      { message: { content: 'Encontré una tutoría de Valeria.' } },
    );
    const result = await service.ask(
      'luis',
      { question: 'Quiero aprender punteros', route: '/perfil' },
      fetcher,
    );
    expect(tutoring.list).toHaveBeenCalledWith(
      expect.objectContaining({ excludeTutorId: 'luis' }),
    );
    expect(result.offers).toEqual([
      expect.objectContaining({
        id_oferta: offer.id_oferta,
        tutor: 'Valeria Mendoza',
        costo_creditos: '3.5',
      }),
    ]);
    expect(result.actions).toEqual([
      {
        type: 'navigate',
        route: '/',
        target: 'ofertar',
        label: 'Ofertar una habilidad',
      },
    ]);
    const second = sentBody(fetcher, 1).body.messages;
    expect(second.at(-1)).toMatchObject({ role: 'tool' });
    expect(second.at(-1)?.content).toContain('Repaso de punteros');
    expect(sentBody(fetcher, 0).body.messages[0]?.content).toContain(
      'ruta /perfil',
    );
  });

  it('el resumen da créditos y materias sin correos ni datos sensibles', async () => {
    const { service } = setup();
    const raw = await service.runTool('mi_resumen', '{}', {
      userId: 'ana',
      actions: [],
      offers: [],
    });
    expect(JSON.parse(raw)).toMatchObject({
      nombre: 'Ana',
      creditos: { disponibles: '8' },
      materias: [{ materia: 'Excel', nivel: 'Avanzado' }],
      solicitudesPorResponder: 0,
    });
    expect(raw).not.toMatch(/correo|password|@/);
  });

  it('una herramienta o sección desconocida no rompe la conversación', async () => {
    const { service } = setup();
    const context = { userId: 'ana', actions: [], offers: [] };
    expect(await service.runTool('borrar_todo', '{}', context)).toContain(
      'desconocida',
    );
    expect(
      await service.runTool(
        'mostrar_en_pantalla',
        '{"seccion":"admin"}',
        context,
      ),
    ).toContain('desconocida');
    expect(await service.runTool('mi_resumen', 'no json', context)).toContain(
      'Ana',
    );
  });
});
