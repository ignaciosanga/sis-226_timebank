import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);
const MAILPIT_URL = (
  process.env.MAILPIT_URL ?? 'http://localhost:8025'
).replace(/\/+$/, '');
const DATABASE_URL = process.env.DATABASE_URL;
const PASSWORD = 'Prueba-E2E-segura-2026';
const run = randomUUID().slice(0, 8);

const step = (text) => console.log(`- ${text}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(
  path,
  { method = 'GET', token, body, idempotent = false, expect = [200, 201] } = {},
) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (idempotent) headers['idempotency-key'] = randomUUID();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!expect.includes(response.status))
    throw new Error(
      `${method} ${path} devolvió ${response.status}: ${text.slice(0, 400)}`,
    );
  return data;
}

async function verificationToken(correo) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { messages = [] } = await (
      await fetch(`${MAILPIT_URL}/api/v1/messages`)
    ).json();
    const message = messages.find((item) =>
      item.To?.some((to) => to.Address?.toLowerCase() === correo),
    );
    if (message) {
      const detail = await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)
      ).json();
      const match = `${detail.Text ?? ''} ${detail.HTML ?? ''}`.match(
        /token=([A-Za-z0-9_-]+)/,
      );
      if (match) return match[1];
    }
    await sleep(500);
  }
  throw new Error(`No llegó el correo de verificación a ${correo}`);
}

async function student(nombre, idCarrera) {
  const correo = `${nombre.toLowerCase()}.${run}@ucb.edu.bo`;
  const registered = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre,
      apellido: 'E2E',
      correo,
      password: PASSWORD,
      idCarrera,
      semestre: 5,
    },
  });
  assert.equal(registered.verification_required, true);
  await api('/auth/login', {
    method: 'POST',
    body: { correo, password: PASSWORD },
    expect: [403],
  });
  await api('/auth/verify-email', {
    method: 'POST',
    body: { token: await verificationToken(correo) },
  });
  const session = await api('/auth/login', {
    method: 'POST',
    body: { correo, password: PASSWORD },
  });
  return {
    correo,
    token: session.access_token,
    id:
      session.user?.id ??
      (await api('/users/me', { token: session.access_token })).id,
  };
}

const credits = async (who) => api('/credits/me', { token: who.token });
const asNumber = (value) => Number(value);

async function main() {
  step(`API ${API_URL}, corrida ${run}`);
  await api('/health/ready');

  const careers = await api('/careers?limit=100');
  const idCarrera = (careers.data ?? careers)[0].id_carrera;

  step(
    'registro con correo institucional, verificación por correo y bono de bienvenida',
  );
  const tutor = await student('Tutora', idCarrera);
  const learner = await student('Estudiante', idCarrera);
  const initial = await credits(learner);
  assert.ok(
    asNumber(initial.saldo) > 0,
    'el bono de bienvenida debe acreditarse al verificar',
  );

  step(
    'la tutora agrega una habilidad y publica una oferta con precio decimal',
  );
  const skills = await api('/skills?limit=100');
  const skill = (skills.data ?? skills)[0];
  await api('/users/me/skills', {
    method: 'POST',
    token: tutor.token,
    body: { skillId: skill.id_habilidad, nivel: 'Avanzado' },
  });
  const start = new Date(Date.now() + 2 * 86400000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60000);
  const offer = await api('/tutoring/offers', {
    method: 'POST',
    token: tutor.token,
    idempotent: true,
    body: {
      skillId: skill.id_habilidad,
      nivel: 'Avanzado',
      titulo: `Tutoría E2E ${run}`,
      descripcion: 'Clase de prueba del flujo completo',
      costoCreditos: '3.5',
      fechaInicio: start.toISOString(),
      fechaFin: end.toISOString(),
    },
  });
  assert.equal(offer.costo_creditos, '3.5');

  step(
    'el estudiante encuentra la oferta y envía la solicitud sin que se descuenten créditos',
  );
  const catalog = await api(
    `/tutoring/offers?search=${encodeURIComponent(run)}`,
    { token: learner.token },
  );
  const listed = (catalog.data ?? []).find(
    (item) => item.id_oferta === offer.id_oferta,
  );
  assert.ok(listed, 'la oferta publicada debe aparecer en el catálogo');
  const request = await api('/exchanges', {
    method: 'POST',
    token: learner.token,
    idempotent: true,
    body: {
      providerId: tutor.id,
      skillId: skill.id_habilidad,
      availabilityId: offer.id_disponibilidad,
      offerId: offer.id_oferta,
      fechaInicio: start.toISOString(),
      fechaFin: end.toISOString(),
      descripcion: 'Quiero repasar para el examen',
    },
  });
  assert.equal(asNumber((await credits(learner)).creditos_retenidos), 0);

  step('la tutora acepta y los créditos quedan retenidos');
  const accepted = await api(`/exchanges/${request.id_solicitud}/accept`, {
    method: 'POST',
    token: tutor.token,
    idempotent: true,
    body: {},
  });
  const reservationId =
    accepted.reserva?.id_reserva ??
    accepted.id_reserva ??
    (await api('/reservations/me', { token: learner.token })).data?.find(
      (r) => r.id_solicitud === request.id_solicitud,
    )?.id_reserva;
  assert.ok(reservationId, 'aceptar debe crear una reserva');
  assert.equal(asNumber((await credits(learner)).creditos_retenidos), 3.5);

  if (DATABASE_URL) {
    step('se simula que la clase ya terminó');
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT r.id_solicitud, o.id_disponibilidad, o.id_oferta, r.fecha_fin - (now() - interval '1 hour') AS delta
       FROM "RESERVAS" r JOIN "SOLICITUDES_INTERCAMBIO" s ON s.id_solicitud = r.id_solicitud JOIN "OFERTAS" o ON o.id_oferta = s.id_oferta
       WHERE r.id_reserva = $1`,
      [reservationId],
    );
    const { id_solicitud, id_disponibilidad, id_oferta, delta } = rows[0];
    await client.query(
      `UPDATE "DISPONIBILIDADES" SET fecha_inicio = fecha_inicio - $2::interval, fecha_fin = fecha_fin - $2::interval WHERE id_disponibilidad = $1`,
      [id_disponibilidad, delta],
    );
    await client.query(
      `UPDATE "OFERTAS" SET created_at = created_at - $2::interval WHERE id_oferta = $1`,
      [id_oferta, delta],
    );
    await client.query(
      `UPDATE "SOLICITUDES_INTERCAMBIO" SET fecha_inicio_propuesta = fecha_inicio_propuesta - $2::interval, fecha_fin_propuesta = fecha_fin_propuesta - $2::interval, created_at = created_at - $2::interval, respondida_at = respondida_at - $2::interval WHERE id_solicitud = $1`,
      [id_solicitud, delta],
    );
    await client.query(
      `UPDATE "RESERVAS" SET fecha_inicio = fecha_inicio - $2::interval, fecha_fin = fecha_fin - $2::interval, created_at = created_at - $2::interval WHERE id_reserva = $1`,
      [reservationId, delta],
    );
    await client.query('COMMIT');
    await client.end();
  } else {
    step(
      'sin DATABASE_URL no se puede adelantar la clase: el flujo termina en la reserva',
    );
    return;
  }

  step('ambos confirman y los créditos pasan a la tutora');
  await api(`/reservations/${reservationId}/confirm`, {
    method: 'POST',
    token: learner.token,
    idempotent: true,
    body: {},
  });
  const completed = await api(`/reservations/${reservationId}/confirm`, {
    method: 'POST',
    token: tutor.token,
    idempotent: true,
    body: {},
  });
  assert.equal(completed.estado, 'Completada');
  const learnerAfter = await credits(learner);
  const tutorAfter = await credits(tutor);
  assert.equal(asNumber(learnerAfter.saldo), asNumber(initial.saldo) - 3.5);
  assert.equal(asNumber(learnerAfter.creditos_retenidos), 0);
  assert.equal(asNumber(tutorAfter.saldo), asNumber(initial.saldo) + 3.5);

  step(
    'el estudiante deja una opinión y aparece en las opiniones de la tutora',
  );
  await api(`/tutoring/reservations/${reservationId}/review`, {
    method: 'POST',
    token: learner.token,
    idempotent: true,
    body: { calificacion: 5, comentario: 'Explicó muy claro' },
  });
  const reviews = await api(
    `/tutoring/reviews?tutorId=${tutor.id}&skillId=${skill.id_habilidad}`,
    { token: learner.token },
  );
  assert.ok((reviews.data ?? []).length >= 1, 'la opinión debe listarse');

  step('el asistente responde o informa que no está configurado');
  await api('/assistant/ask', {
    method: 'POST',
    token: learner.token,
    body: { question: '¿Cómo funcionan los créditos?', route: '/' },
    expect: [200, 503],
  });

  console.log('Flujo completo OK');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
