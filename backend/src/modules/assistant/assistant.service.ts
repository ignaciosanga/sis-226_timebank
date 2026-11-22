import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';
import { assistantInstructions } from './assistant-knowledge';
import { AskAssistantDto } from './dto/ask-assistant.dto';

type ChatCompletion = {
  choices?: { message?: { content?: unknown } }[];
};

@Injectable()
export class AssistantService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async ask(
    input: AskAssistantDto,
    fetcher: typeof fetch = fetch,
  ): Promise<{ answer: string }> {
    const apiKey = this.config.get('ASSISTANT_API_KEY', { infer: true });
    if (!apiKey)
      throw new ServiceUnavailableException('El asistente no esta configurado');
    const messages = [
      {
        role: 'system',
        content: assistantInstructions(
          this.config.get('REGISTRATION_INITIAL_CREDITS', { infer: true }),
        ),
      },
      ...(input.history ?? []).map(({ role, content }) => ({ role, content })),
      { role: 'user', content: input.question },
    ];
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
            max_tokens: 400,
          }),
          signal: AbortSignal.timeout(
            this.config.get('ASSISTANT_TIMEOUT_MS', { infer: true }),
          ),
        },
      );
    } catch {
      throw new BadGatewayException('El asistente no respondio a tiempo');
    }
    if (response.status === 429)
      throw new ServiceUnavailableException(
        'El asistente esta ocupado, intenta en un momento',
      );
    if (!response.ok)
      throw new BadGatewayException('El asistente no esta disponible');
    const body = (await response.json().catch(() => null)) as ChatCompletion;
    const content = body?.choices?.[0]?.message?.content;
    const answer = typeof content === 'string' ? content.trim() : '';
    if (!answer)
      throw new BadGatewayException('El asistente no esta disponible');
    return { answer: answer.slice(0, 2000) };
  }
}
