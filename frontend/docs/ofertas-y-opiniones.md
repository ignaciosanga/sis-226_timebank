# Ofertas personalizadas, otros tutores y mis clases

## Entrega de frontend

- Conserva las tarjetas por tutor/materia y la búsqueda por nombre sin restricciones
  por la carrera del estudiante. Muestra promedio en estrellas, opiniones y tutorías
  completadas **en esa materia**, cuando existan datos reales.
- Incluye el enfoque, la descripción y el banner en la tarjeta cuando el servidor
  los proporcione. Las imágenes tienen texto alternativo y portada predeterminada.
- «Ver oferta» abre una ventana con portada, tutor/nivel/métricas, descripción,
  disponibilidad y tres apartados: La oferta, Opiniones y **Otros tutores**.
  No hay un apartado «Mis clases» dentro de la oferta.
- «Otros tutores» incluye únicamente otros ofertantes de la misma materia; no
  incluye al tutor abierto ni cruza calificaciones entre materias.
- La solicitud conserva `POST /exchanges` y su DTO vigente. Antes de enviarla
  recarga `GET /users/:id/availability` y valida horario, futuro, duración máxima
  de 8 horas e intervalos de 15 minutos. Una respuesta 409 muestra el conflicto
  y recarga disponibilidad; el backend sigue siendo la autoridad de concurrencia.
- Ofertar una habilidad conserva la selección de una materia previamente publicada
  en Perfil y su nivel. Agrega título/enfoque (1–100), descripción (1–1500), banner
  opcional (JPG/PNG/WebP, 3 MB), fecha, horario y costo total en créditos enteros positivos elegido por el tutor. El costo no depende de la duración. Incluye vista previa de portada,
  contenido y horario. La imagen se lee y verifica en el navegador; quitarla o
  cerrar evita que una lectura anterior reemplace la selección actual.
- **Intercambios → Mis clases** es una subpantalla real, `/intercambios/mis-clases`.
  Separa Aprendí/Enseñé y solo presenta reservas completadas. `/mis-cursos`
  redirige a ella; Solicitudes y Reservas conservan sus rutas y operaciones.
- El solicitante de una clase completada, posterior al fin, puede dejar una nota
  general de 1 a 5 y comentario opcional (hasta 500). Una opinión por reserva;
  no puede calificarse a sí mismo ni calificar una clase cancelada/pendiente.
  La vista permite consultar una opinión existente y bloquea duplicados.

## Disponibilidad de las funciones

No se modificó el backend ni la base compartida. Sus endpoints actuales no
incluyen ofertas personalizadas ni opiniones. Los servicios nuevos se mantienen
**desactivados por defecto** con `VITE_TUTORING_API_ENABLED=false` o sin definir.
Así no se realizan peticiones a rutas inexistentes ni se muestran publicaciones
simuladas como reales. El formulario se puede preparar y revisar; el botón de
publicación indica que estará disponible próximamente. Los datos de la oferta
se descartan al cerrar; no se afirma que se guardó un borrador.

Las métricas desconocidas muestran «—», no ceros inventados. Un tutor con datos
reales y cero opiniones muestra «Sin calificaciones». La consulta de opiniones
muestra un estado pendiente hasta activar la integración. Mis clases conserva
las reservas reales; si no existen clases completadas, presenta un estado vacío.

## Contrato propuesto para el equipo de backend

**Este contrato es una propuesta pendiente de implementar y acordar, no un
contrato que ya esté disponible en la API desplegada.** La adaptación está
centralizada en `src/services/tutoring.js`; ajustar ese archivo si cambian las
rutas o nombres de campos. Activar la variable y recompilar solo cuando el
backend implemente todo el contrato. No activarla sobre el despliegue actual.

### Catálogo público

`GET /tutoring/offers?page=1&limit=100` devuelve `{ data, meta: { totalPages } }`.
Cada oferta incluye:

```json
{
  "id_oferta": "UUID",
  "id_usuario": "UUID_TUTOR",
  "id_habilidad": "UUID_MATERIA_CATALOGO",
  "nivel": "Avanzado",
  "costo_creditos": 7,
  "titulo": "Recursividad y ejercicios guiados",
  "descripcion": "Temas y forma de trabajo...",
  "bannerUrl": "https://servidor/imagenes/portada.webp",
  "tutor": { "id": "UUID_TUTOR", "nombre": "Ana", "apellido": "Rojas" },
  "metricas": { "promedio": 4.8, "opiniones": 12, "tutorias_completadas": 18 }
}
```

`bannerUrl` es opcional. `promedio` es null sin opiniones; los conteos son enteros
no negativos y calculados en el servidor por tutor/materia. El endpoint entrega
solo ofertas activas de usuarios activos, sin correo ni campos privados.
La paginación es independiente del catálogo de materias existente.
Los horarios siguen consultándose por usuario con el endpoint vigente. Al
incorporar horarios vinculados a ofertas, debe adaptarse la resolución de slots.

### Publicación y banner

- `POST /tutoring/banners`: multipart/form-data, campo `banner`, autenticado.
  Devuelve `{ "url": "https://..." }`. El frontend deja que el navegador escriba
  el boundary; no fuerza `Content-Type: application/json` en archivos.
- `POST /tutoring/offers`: autenticado, JSON con
  `{ skillId, nivel, titulo, descripcion, costoCreditos, fechaInicio, fechaFin, bannerUrl? }`.
  Devuelve la oferta creada. El nivel debe corresponder a la habilidad propia.
  Una sola oferta activa por tutor/materia es la interpretación de este sprint.
  Aplicar validación/propiedad y creación de horario/oferta atómica, sin reutilizar
  el contrato general de `/availability`, que carece de `skillId`.
- El servidor valida tamaño y contenido real del archivo, genera nombres/rutas
  propios y administra imágenes huérfanas. El frontend acepta JPG, PNG y WebP;
  rechaza SVG y esquemas de URL ejecutables. No debe confiarse solo en el MIME.
- Ambos POST reciben `Idempotency-Key`. La publicación conserva la misma clave
  al reintentar el mismo borrador, y la carga usa el sufijo `.banner`.

### Opiniones

- `GET /tutoring/reviews?tutorId=UUID&skillId=UUID&page=1&limit=100`: público,
  paginado con `{ data, meta }`; opiniones del tutor solo en esa materia.
- `GET /tutoring/reviews/me?page=1&limit=100`: autenticado, paginado; opiniones
  escritas por el usuario actual. No exponer opiniones privadas de otras cuentas.
- `POST /tutoring/reservations/:id/review`: autenticado, JSON
  `{ calificacion: 1..5, comentario: "" }`, con `Idempotency-Key`.
  `comentario` es opcional para el usuario y se envía como string vacío si falta.
- Una opinión devuelve `{ id_calificacion, id_reserva, calificacion, comentario,
  created_at }`. La consulta de opiniones existentes requiere `id_reserva`.
- El servidor exige solicitante autenticado, reserva Completada y fin pasado,
  distinta persona como ofertante y unicidad por reserva. La identidad/tutor y
  materia se derivan de la reserva, no de campos editables del cliente. Mantener
  consistencia de agregados y evitar duplicados en transacciones concurrentes.
- 409 representa duplicado/conflicto; el frontend conserva el formulario y
  recarga las opiniones propias. Un error de lectura no habilita una escritura
  cuando se desconoce si esa reserva ya tiene opinión.

### Precio fijado por el tutor

`costoCreditos` es obligatorio al publicar: un entero positivo representable de forma segura. El servidor define y valida su límite de negocio. La respuesta devuelve `costo_creditos`, el precio total por clase. Se muestra en tarjetas, detalle y revisión; no se multiplica por minutos ni por horas. Una oferta sin precio conocido muestra «Costo por definir» y no permite enviar una solicitud con un precio supuesto.

`POST /exchanges` mantiene sus identificadores de tutor, materia y disponibilidad. El servidor debe resolver la oferta activa del tutor/materia, validar la disponibilidad y guardar su precio publicado en `creditos_requeridos` junto con `id_oferta`. No tomar importes arbitrarios enviados por el solicitante ni calcular el precio a partir del intervalo. La reserva copia ese importe acordado; retención, cancelación y transferencia deben operar sobre esa copia, aunque la oferta cambie después. Las reservas anteriores conservan el importe que ya acordaron.

**El backend desplegado aún no implementa esta regla.** Mantener la integración desactivada hasta implementar publicación, lectura y cobro por precio fijo de forma consistente. La demo local ya simula el precio manual y todo el recorrido de créditos.

La propuesta no inventa estadísticas ni agrega roadmap/chatbot.

## Validación

`npm test` ejecuta las pruebas existentes y `tests/tutoring.integration.test.js`.
Las nuevas pruebas usan componentes, store y servicios reales con HTTP controlado:
DTO/Bearer/idempotencia, multipart, elegibilidad y duplicados, errores sin éxito
falso, filtrado por materia, vistas de clases, disponibilidad obsoleta y 409.
No escriben en el servidor compartido. `npm run build` valida la compilación.
