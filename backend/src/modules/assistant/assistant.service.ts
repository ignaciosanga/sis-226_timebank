import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';
import { ExchangesService } from '../exchanges/exchanges.service';
import { RequestStatus, ReservationStatus } from '../exchanges/exchange.types';
import { SkillsService } from '../skills/skills.service';
import { OffersQueryDto } from '../tutoring/dto/offers-query.dto';
import { TutoringService } from '../tutoring/tutoring.service';
import { UserSkillsService } from '../user-skills/user-skills.service';
import { UsersService } from '../users/users.service';
import { decryptSecret, encryptSecret, keyHint } from './assistant-crypto';
import { assistantInstructions } from './assistant-knowledge';
import {
  AssistantProfile,
  AssistantProfileStore,
} from './assistant-profile.store';
import {
  ASSISTANT_TOOLS,
  parseToolArguments,
  rankByTokens,
  SCREEN_SECTIONS,
  ScreenSection,
} from './assistant-tools';
import {
  AskAssistantDto,
  AssistantActionDto,
  AssistantAnswerDto,
  AssistantAvatarDto,
  AssistantKeyDto,
  AssistantOfferCardDto,
  AssistantProfileDto,
  AssistantQuotaDto,
} from './dto/ask-assistant.dto';

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};
type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
type ChatCompletion = {
  choices?: {
    message?: { content?: unknown; tool_calls?: ToolCall[] };
  }[];
};
type TurnContext = {
  userId: string;
  actions: AssistantActionDto[];
  offers: AssistantOfferCardDto[];
};

const MAX_TOOL_ROUNDS = 4;
const dateLabel = (value: Date | string) =>
  new Date(value).toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

@Injectable()
export class AssistantService {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly store: AssistantProfileStore,
    private readonly tutoring: TutoringService,
    private readonly exchanges: ExchangesService,
    private readonly userSkills: UserSkillsService,
    private readonly users: UsersService,
    private readonly skills: SkillsService,
  ) {}

  today(now = new Date()): string {
    return now.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
  }

  private quota(profile: AssistantProfile): AssistantQuotaDto {
    const limite = this.config.get('ASSISTANT_FREE_MESSAGES', { infer: true });
    const usados =
      profile.mensajes_dia === this.today() ? profile.mensajes_usados : 0;
    return {
      llavePropia: Boolean(profile.groq_key_cifrada),
      limite,
      usados,
      restantes: Math.max(limite - usados, 0),
    };
  }

  private toProfile(profile: AssistantProfile): AssistantProfileDto {
    return {
      avatar: {
        estilo: profile.avatar_estilo,
        color: profile.avatar_color,
        accesorio: profile.avatar_accesorio,
        nombre: profile.avatar_nombre,
      },
      llavePista: profile.groq_key_pista,
      quota: this.quota(profile),
      llavesHabilitadas: Boolean(this.keysSecret()),
    };
  }

  private keysSecret() {
    return this.config.get('ASSISTANT_KEYS_SECRET', { infer: true }) || null;
  }

  async profile(userId: string) {
    await this.users.requireActive(userId);
    return this.toProfile(await this.store.get(userId));
  }

  async saveAvatar(userId: string, input: AssistantAvatarDto) {
    await this.users.requireActive(userId);
    return this.toProfile(
      await this.store.saveAvatar(userId, {
        avatar_estilo: input.estilo,
        avatar_color: input.color,
        avatar_accesorio: input.accesorio,
        avatar_nombre: input.nombre,
      }),
    );
  }

  async saveKey(
    userId: string,
    input: AssistantKeyDto,
    fetcher: typeof fetch = fetch,
  ) {
    await this.users.requireActive(userId);
    const secret = this.keysSecret();
    if (!secret)
      throw new ServiceUnavailableException(
        'El servidor no tiene habilitadas las llaves personales',
      );
    let response: Response;
    try {
      response = await fetcher(this.modelsUrl(), {
        headers: { authorization: `Bearer ${input.apiKey}` },
        signal: AbortSignal.timeout(
          this.config.get('ASSISTANT_TIMEOUT_MS', { infer: true }),
        ),
      });
    } catch {
      throw new BadGatewayException('No pudimos comprobar la API key');
    }
    if (response.status === 401 || response.status === 403)
      throw new BadRequestException(
        'Groq rechazó esta API key. Revisa que esté activa.',
      );
    if (!response.ok)
      throw new BadGatewayException('No pudimos comprobar la API key');
    return this.toProfile(
      await this.store.saveKey(
        userId,
        encryptSecret(input.apiKey, secret),
        keyHint(input.apiKey),
      ),
    );
  }

  async clearKey(userId: string) {
    await this.users.requireActive(userId);
    return this.toProfile(await this.store.clearKey(userId));
  }

  async ask(
    userId: string,
    input: AskAssistantDto,
    fetcher: typeof fetch = fetch,
  ): Promise<AssistantAnswerDto> {
    await this.users.requireActive(userId);
    const profile = await this.store.get(userId);
    const ownKey = this.ownKey(profile);
    const quota = this.quota(profile);
    const apiKey =
      ownKey ?? this.config.get('ASSISTANT_API_KEY', { infer: true });
    if (!apiKey)
      throw new ServiceUnavailableException('El asistente no esta configurado');
    if (!ownKey && quota.restantes <= 0)
      throw new HttpException(
        {
          code: 'ASSISTANT_QUOTA_EXCEEDED',
          message: `Usaste tus ${quota.limite} mensajes de hoy. Agrega tu propia API key de Groq en Personalizar para seguir conversando.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const context: TurnContext = { userId, actions: [], offers: [] };
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: assistantInstructions(
          this.config.get('REGISTRATION_INITIAL_CREDITS', { infer: true }),
          profile.avatar_nombre,
          input.route ?? '/',
        ),
      },
      ...(input.history ?? []).map(({ role, content }) => ({ role, content })),
      { role: 'user', content: input.question },
    ];
    let answer = '';
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const message = await this.complete(
        apiKey,
        messages,
        fetcher,
        Boolean(ownKey),
        round < MAX_TOOL_ROUNDS - 1,
      );
      const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      if (!calls.length) {
        answer =
          typeof message.content === 'string' ? message.content.trim() : '';
        break;
      }
      messages.push({
        role: 'assistant',
        content: typeof message.content === 'string' ? message.content : null,
        tool_calls: calls,
      });
      for (const call of calls)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: await this.runTool(
            call.function?.name,
            call.function?.arguments,
            context,
          ),
        });
    }
    if (!answer && context.actions.length)
      answer = `Listo, te muestro ${context.actions[0]?.label.toLowerCase() ?? 'la sección'}.`;
    if (!answer)
      throw new BadGatewayException('El asistente no esta disponible');
    let nextQuota = { ...quota };
    if (!ownKey) {
      const usados = await this.store.countFreeMessage(userId, this.today());
      nextQuota = {
        ...quota,
        usados,
        restantes: Math.max(quota.limite - usados, 0),
      };
    }
    return {
      answer: answer.slice(0, 2000),
      actions: context.actions.slice(0, 1),
      offers: context.offers.slice(0, 3),
      quota: nextQuota,
    };
  }

  private ownKey(profile: AssistantProfile): string | null {
    if (!profile.groq_key_cifrada) return null;
    const secret = this.keysSecret();
    if (!secret) return null;
    try {
      return decryptSecret(profile.groq_key_cifrada, secret);
    } catch {
      throw new BadRequestException(
        'No pudimos leer tu API key. Bórrala y vuelve a guardarla en Personalizar.',
      );
    }
  }

  private modelsUrl() {
    return this.config
      .get('ASSISTANT_API_URL', { infer: true })
      .replace(/\/chat\/completions$/, '/models');
  }

  private async complete(
    apiKey: string,
    messages: ChatMessage[],
    fetcher: typeof fetch,
    ownKey: boolean,
    allowTools: boolean,
  ) {
    let response: Response;
    try {
      response = await fetcher(
        this.config.get('ASSISTANT_API_URL', { infer: true }),
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.get('ASSISTANT_MODEL', { infer: true }),
            messages,
            temperature: 0.2,
            max_tokens: 500,
            ...(allowTools
              ? { tools: ASSISTANT_TOOLS, tool_choice: 'auto' }
              : {}),
          }),
          signal: AbortSignal.timeout(
            this.config.get('ASSISTANT_TIMEOUT_MS', { infer: true }),
          ),
        },
      );
    } catch {
      throw new BadGatewayException('El asistente no respondio a tiempo');
    }
    if (ownKey && (response.status === 401 || response.status === 403))
      throw new BadRequestException(
        'Groq rechazó tu API key. Revísala en Personalizar.',
      );
    if (response.status === 429)
      throw new ServiceUnavailableException(
        'El asistente esta ocupado, intenta en un momento',
      );
    if (!response.ok)
      throw new BadGatewayException('El asistente no esta disponible');
    const body = (await response.json().catch(() => null)) as ChatCompletion;
    const message = body?.choices?.[0]?.message;
    if (!message)
      throw new BadGatewayException('El asistente no esta disponible');
    return message;
  }

  async runTool(
    name: string | undefined,
    rawArguments: unknown,
    context: TurnContext,
  ): Promise<string> {
    const args = parseToolArguments(rawArguments);
    try {
      if (name === 'buscar_ofertas')
        return JSON.stringify(
          await this.searchOffers(context, String(args.texto ?? '')),
        );
      if (name === 'mi_resumen')
        return JSON.stringify(await this.summary(context.userId));
      if (name === 'mostrar_en_pantalla') {
        const key = String(args.seccion ?? '') as ScreenSection;
        const section = SCREEN_SECTIONS[key];
        if (!section) return JSON.stringify({ error: 'Sección desconocida' });
        context.actions.push({ type: 'navigate', ...section });
        return JSON.stringify({ mostrado: section.label });
      }
      return JSON.stringify({ error: 'Herramienta desconocida' });
    } catch {
      return JSON.stringify({ error: 'No se pudo consultar ahora' });
    }
  }

  private async searchOffers(context: TurnContext, text: string) {
    const page = await this.tutoring.list(
      Object.assign(new OffersQueryDto(), {
        page: 1,
        limit: 200,
        excludeTutorId: context.userId,
      }),
    );
    const found = rankByTokens(
      page.data,
      text,
      (offer) =>
        `${offer.titulo} ${offer.descripcion} ${offer.materia.nombre} ${offer.materia.codigo ?? ''} ${offer.tutor.nombre} ${offer.tutor.apellido}`,
    );
    const cards = found.map((offer) => ({
      id_oferta: offer.id_oferta,
      titulo: offer.titulo,
      materia: offer.materia.nombre,
      tutor: `${offer.tutor.nombre} ${offer.tutor.apellido}`.trim(),
      costo_creditos: String(offer.costo_creditos),
      fecha_inicio: new Date(offer.fecha_inicio).toISOString(),
    }));
    context.offers.push(...cards);
    return {
      total: cards.length,
      ofertas: cards.map((card) => ({
        titulo: card.titulo,
        materia: card.materia,
        tutor: card.tutor,
        precio: `${card.costo_creditos} créditos`,
        fecha: dateLabel(card.fecha_inicio),
      })),
    };
  }

  private async summary(userId: string) {
    const me = await this.users.me(userId);
    const [account, skills, reservations, requests] = await Promise.all([
      this.exchanges.getAccount(userId).catch(() => null),
      this.userSkills.list(userId).catch(() => []),
      this.exchanges.listReservations(userId).catch(() => []),
      this.exchanges.listRequests(userId).catch(() => []),
    ]);
    const now = Date.now();
    const upcoming = reservations
      .filter(
        (row) =>
          row.estado === ReservationStatus.CONFIRMADA &&
          new Date(row.fecha_inicio).getTime() > now,
      )
      .sort(
        (a, b) =>
          new Date(a.fecha_inicio).getTime() -
          new Date(b.fecha_inicio).getTime(),
      )
      .slice(0, 3);
    const proximasClases = await Promise.all(
      upcoming.map(async (row) => {
        const teaches = row.id_ofertante === userId;
        const [skill, other] = await Promise.all([
          this.skills.requireActive(row.id_habilidad).catch(() => null),
          this.users
            .me(teaches ? row.id_solicitante : row.id_ofertante)
            .catch(() => null),
        ]);
        return {
          materia: skill?.nombre ?? 'Materia',
          rol: teaches ? 'enseñas' : 'aprendes',
          con: other?.nombre ?? 'otro estudiante',
          fecha: dateLabel(row.fecha_inicio),
          creditos: String(row.creditos),
        };
      }),
    );
    return {
      nombre: me.nombre,
      creditos: account
        ? {
            disponibles: String(account.disponibles),
            retenidos: String(account.creditos_retenidos),
            saldo: String(account.saldo),
          }
        : null,
      materias: skills.map((skill) => ({
        materia: skill.habilidad.nombre,
        nivel: skill.nivel,
      })),
      proximasClases,
      solicitudesPorResponder: requests.filter(
        (row) =>
          row.id_ofertante === userId && row.estado === RequestStatus.PENDIENTE,
      ).length,
    };
  }
}
