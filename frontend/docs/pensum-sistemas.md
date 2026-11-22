# Pensum de Ingeniería de Sistemas — entrega de frontend

## Alcance

Perfil → **Añadir habilidad** abre la malla de Ingeniería de Sistemas de UCB
La Paz. La fuente es la imagen del pensum entregada por el equipo en esta tarea;
no se afirma que sea la versión vigente para todas las cohortes.

Se transcribieron 51 casillas de nueve semestres: 49 materias con código y dos
espacios de asignaturas libres. Se preservan el área y los prerrequisitos.
`MAT-030` aparece como requisito de Cálculo I en la referencia, pero no como
materia de la malla. Los requisitos son información: no se consulta ni se valida
el historial académico del estudiante.

La malla permite búsqueda por nombre/código sin distinguir acentos, filtro de
semestre y área, selección de una materia y los niveles existentes:
`Basico`, `Intermedio`, `Avanzado`, `Experto`.
Las libres son espacios informativos y no se publican como materias genéricas.
En este sprint el selector presenta únicamente Sistemas, independientemente de
la carrera del perfil; no se cambian los datos académicos del usuario.

El cambio afecta la selección desde Perfil, no la navegación general, las
ofertas horarias ni la disponibilidad. Las habilidades anteriores se conservan
y se pueden retirar. No incluye calificaciones, ranking, precios ni roadmap.

## Integración para backend

No se modificó el backend ni se cargaron catálogos en la base compartida.
La lista está en `src/features/curriculum/systems-curriculum.js`, exportación
`SYSTEMS_CURRICULUM`. Cada fila tiene:

```json
{
  "semestre": 3,
  "codigo": "SIS-113",
  "nombre": "Programación II",
  "area": "software",
  "requisitos": ["SIS-112"],
  "electiva": false
}
```

Para habilitar publicación, backend debe incorporar las 49 materias no electivas
al catálogo existente de habilidades, con UUID reales y estado `activo`.
Cada materia debe aparecer en `GET /skills?page=1&limit=100`, con la paginación
actual `{ data, meta }`. Su categoría también debe estar activa.
No debe borrarse el catálogo anterior ni cambiarse sus UUID: existen referencias
en perfiles e intercambios.

Se recomienda devolver un campo opcional `codigo` estable para identificar la
materia aunque cambie su nombre. El frontend busca primero una coincidencia
exacta de ese código en las habilidades activas. Mientras el endpoint no tenga
`codigo`, admite el nombre exacto normalizado (mayúsculas, acentos y espacios),
únicamente en registros sin código. Las coincidencias ambiguas no se publican.
Nunca se equipara automáticamente Programación Java con Programación I/II.

La publicación mantiene el contrato vigente y requiere sesión:

```http
POST /users/me/skills
Authorization: Bearer <token>
Content-Type: application/json

{"skillId":"UUID_REAL_DEL_CATALOGO","nivel":"Intermedio"}
```

Después se recarga `GET /users/me/skills`; solo una respuesta satisfactoria
muestra éxito. No se envía el código académico como UUID, ni se guarda una
publicación simulada en el navegador. Una materia que todavía no tiene
equivalente activo se puede explorar, pero muestra «Esta materia aún no está
habilitada para tutorías» y no permite publicar. Una materia ya compartida
muestra su estado y tampoco permite duplicarla.

La asignación de materias a carreras y las cohortes del pensum necesitarán un
contrato propio cuando se amplíe a otras carreras. Este sprint no inventa ese
contrato ni modifica el de reservas.

## Validación

`npm test` incluye `tests/curriculum.integration.test.js`, que usa el formulario,
el store y los servicios reales con HTTP controlado. Verifica el DTO y Bearer,
recarga del perfil, bloqueo de duplicados/inactivas/electivas, errores de API,
filtros, cierre de sesión y limpieza al reabrir. No escribe en la API compartida.

`npm run build` comprueba la compilación del frontend.
