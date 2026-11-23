# Matching: integración directa del motor de BD

`GET /tutoring/recommendations` requiere JWT. Backend llama directamente a `public.fn_obtener_top_tutores(uuid,timestamptz,timestamptz,text)` entregada por BD; no implementa otra fórmula ni modifica su SQL.

Parámetros: `skillId` (UUID obligatorio), `fechaInicio` y `fechaFin` (opcionales, ambas ISO con zona, futuras, inicio menor que fin), `modalidad` (Presencial, Virtual, Hibrida o Cualquiera). No acepta identidad de usuario en parámetros: usa la sesión.

Ejemplo: `/tutoring/recommendations?skillId=UUID_DE_GET_SKILLS&modalidad=Virtual`.

Respuesta: `{ skillId, modelo: "skillswap-v4-afinidad-100", data: [{ tutor_id, nombre_tutor, afinidad }], aviso }`. Afinidad es la puntuación numérica devuelta por BD, no una probabilidad ni porcentaje de éxito. Front puede usar tutor_id para consultar las ofertas del tutor.

BD pondera dominio 30, disponibilidad 25, impacto 20, cumplimiento 15 y experiencia en modalidad 10. Backend valida materia/categoría activas, excluye al propio usuario y, con fechas, exige cobertura del intervalo y ausencia de reservas confirmadas superpuestas para ambos participantes.

La función de BD limita primero a tres candidatos. Los filtros posteriores pueden dejar menos de tres, incluso ninguno; no se inventan reemplazos ni se altera la función. Sin fechas la disponibilidad es un criterio de puntuación, no una garantía de poder reservar. La modalidad representa experiencia anterior. Contratar sigue usando los endpoints existentes y revalida saldo y horario.

Errores: 400 parámetros/materia inválidos, 401 sin sesión, 503 si falta la función o PostgreSQL. La ausencia de candidatos devuelve 200 con `data: []`. No modifica datos ni mueve créditos.

Neon debe tener la función y sus dependencias de BD, con EXECUTE para el usuario de aplicación y SELECT sobre los catálogos/reservas/disponibilidades usados. La entrega v4 y su archivo 05 ya contemplan ese permiso. No ejecutar indiscriminadamente todo el SQL sobre producción: APIs/BD adaptan e instalan los objetos que falten. No se aplica ningún cambio en Neon desde este trabajo.

Verificación incorporada en `test:skillswap`: petición sin JWT, exclusión propia, puntuación base, horario disponible, fechas incompletas/inválidas, habilidad inexistente y horario ocupado, usando PostgreSQL y rol_app reales. Build y lint forman parte de la comprobación.
