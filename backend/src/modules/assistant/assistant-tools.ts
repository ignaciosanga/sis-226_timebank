export const SCREEN_SECTIONS = {
  buscar_tutorias: {
    route: '/',
    target: 'buscar-ofertas',
    label: 'Buscar tutorías',
  },
  ofertar: { route: '/', target: 'ofertar', label: 'Ofertar una habilidad' },
  anadir_materia: {
    route: '/perfil',
    target: 'anadir-habilidad',
    label: 'Añadir una materia a tu perfil',
  },
  perfil: { route: '/perfil', target: 'perfil', label: 'Mi perfil' },
  mi_ruta: { route: '/perfil/ruta', target: null, label: 'Mi ruta' },
  creditos: { route: '/perfil/creditos', target: null, label: 'Mis créditos' },
  intercambios: {
    route: '/intercambios',
    target: null,
    label: 'Solicitudes y reservas',
  },
  mis_clases: {
    route: '/intercambios/mis-clases',
    target: null,
    label: 'Mis clases',
  },
  horarios: { route: '/disponibilidad', target: null, label: 'Mis horarios' },
} as const;

export type ScreenSection = keyof typeof SCREEN_SECTIONS;

export const ASSISTANT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_ofertas',
      description:
        'Busca ofertas de tutoría publicadas por otros estudiantes. Úsala cuando la persona quiera aprender algo, busque una materia o un tutor.',
      parameters: {
        type: 'object',
        properties: {
          texto: {
            type: 'string',
            description:
              'Palabras clave de la materia o el tema, por ejemplo "programación punteros" o "cálculo"',
          },
        },
        required: ['texto'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mi_resumen',
      description:
        'Devuelve el nombre de la persona, sus créditos, sus materias, sus próximas clases y sus solicitudes pendientes. Úsala cuando pregunte por su cuenta o necesites conocerla para recomendar algo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mostrar_en_pantalla',
      description:
        'Lleva a la persona a una sección de Nexo U y resalta el botón o la zona indicada. Úsala cuando pregunte dónde está algo o cómo hacer algo en la página.',
      parameters: {
        type: 'object',
        properties: {
          seccion: {
            type: 'string',
            enum: Object.keys(SCREEN_SECTIONS),
            description: Object.entries(SCREEN_SECTIONS)
              .map(([key, value]) => `${key}: ${value.label}`)
              .join('; '),
          },
        },
        required: ['seccion'],
      },
    },
  },
] as const;

const STOP_WORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'y',
  'en',
  'para',
  'con',
  'un',
  'una',
  'que',
  'me',
  'quiero',
  'aprender',
  'ayuda',
  'tutoria',
  'tutorias',
  'clase',
  'clases',
]);

export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function searchTokens(text: string): string[] {
  return [
    ...new Set(
      normalizeText(text)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
    ),
  ];
}

export function rankByTokens<T>(
  rows: T[],
  text: string,
  haystack: (row: T) => string,
  limit = 5,
): T[] {
  const tokens = searchTokens(text);
  if (!tokens.length) return rows.slice(0, limit);
  return rows
    .map((row) => {
      const content = normalizeText(haystack(row));
      return {
        row,
        score: tokens.filter((token) => content.includes(token)).length,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.row);
}

export function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
