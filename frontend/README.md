# Nexo U: frontend del banco de tiempo

Pantallas universitarias para intercambiar habilidades por tiempo, con el diseño
Red universitaria y la identidad UCB.

El registro de esta entrega está en [Avances del equipo Frontend](../docs/avances/frontend.md).

## Ejecutar desde esta carpeta

```bash
npm install
npm run dev
```

## Pantallas

- Habilidades: `/`.
- Registro de estudiantes con validaciones: `/registro`.
- Horarios existentes (consulta, edición y desactivación): `/disponibilidad`.
- Preparación de ofertas: botón amarillo en Habilidades; el perfil permite añadir materias y niveles.
- Solicitudes: `/intercambios`.
- Reservas: `/intercambios?tab=reservas` (o `/reservas`).
- Créditos y movimientos: Perfil → Créditos, en `/perfil/creditos`. La ruta anterior `/creditos` redirige a esta pestaña.
- Perfil y habilidades propias: `/perfil`.
- Selector del pensum de Ingeniería de Sistemas en Perfil → Añadir habilidad. Ver [alcance e integración del pensum](docs/pensum-sistemas.md).
- Pestaña Mi resumen dentro de Perfil (contenedor Looker Studio): `/perfil/resumen`.
- Alta, baja y reactivación de usuarios: `/administracion`.
- Métricas generales (contenedor Looker Studio): `/administracion/metricas`.

El menú principal y el móvil muestran solo Habilidades sin sesión, solo Admin
con una sesión de rol `ADMIN`, y Habilidades, Intercambios, Horarios y
Perfil para las demás cuentas autenticadas. Los permisos de las APIs siguen
controlados por el backend.

El formulario de ofertas permite seleccionar una habilidad propia y revisar su
horario. **Todavía no publica:** espera el contrato que asocie habilidad y horario.
Se retiró la creación de horarios generales de Horarios; se conservan las acciones
sobre bloques existentes. Ver [Ofertas y entrega a APIs](docs/ofertas-habilidades.md)
para conocer la integración pendiente antes de habilitar la publicación.

Los informes muestran «En preparación» hasta que el equipo de Dashboards entregue
sus enlaces. Ver [Integración de dashboards](docs/integracion-dashboards.md) para
configurar los iframe, accesos y requisitos de privacidad.

## Comprobar

```bash
npm test
npm run build
```

Para comprobar solo la integración de gestión de usuarios:

```bash
npm run test:admin-api
```

Estas pruebas ejecutan la lógica real de la vista, sus observadores y los servicios
HTTP con respuestas controladas. Comprueban carga, búsqueda, filtros, paginación,
alta, baja, reactivación, carga de créditos y errores de red/sesión. No escriben
en el backend desplegado ni sustituyen la revisión visual en navegador.

## Alcance actual

El registro, login y las operaciones de estudiante están conectados al backend
mediante `src/services`, a cargo de APIs e Implementación. Configurar
`VITE_API_URL` en `.env.local` como se indica en `.env.example`.
La edición del perfil y la administración de usuarios también usan la API:
listado, alta, baja, reactivación y carga de créditos. Administración requiere
una cuenta con rol ADMIN; los cambios afectan los datos del backend. Los informes
Looker Studio se configuran de forma independiente y aún no tienen URL real.

Un crédito equivale a 15 minutos. Aceptar una solicitud genera una reserva y
retiene créditos; cancelar antes del inicio los libera. La segunda confirmación,
después del fin, completa el intercambio y transfiere los créditos una sola vez.

El equipo de APIs e Implementación es responsable de `src/services`. La entrega
de contenedores de métricas no modifica esa carpeta ni sus conexiones.
El contrato vigente está en `../backend/docs/frontend-integration.md`.

Consulta [Pantallas y entrega a APIs](docs/pantallas-timebank.md) para los estados,
campos, límites y puntos de integración pendientes.

## Ofertas personalizadas y opiniones

Las tarjetas conservan el formato por tutor/materia e incluyen información de la
oferta y métricas cuando backend las proporciona. Ofertar una habilidad permite
preparar título, descripción, banner y horario. Mis clases vive en
`/intercambios/mis-clases`, con la calificación de tutorías completadas.
Ver [alcance, estados pendientes y contrato para backend](docs/ofertas-y-opiniones.md).
# Demo con 100 ofertas sintéticas

Con el servidor de desarrollo activo, abre `http://localhost:5173/?demo=1#/`.
Incluye tutores, banners, opiniones y clases para probar la calificación y publicación en memoria. Se reinicia al recargar y conserva la sesión real. Consulta [el recorrido de presentación](docs/datos-sinteticos.md).

En **Horarios** se muestra un calendario mensual: solicitudes enviadas pendientes en rojo, reservas confirmadas en verde y disponibilidad propia en azul. Seleccionar un día muestra la descripción, la persona y las horas, con edición o desactivación para la disponibilidad propia.

El tutor fija el costo total de su oferta en créditos enteros positivos. Las tarjetas, el detalle y la solicitud muestran ese precio, independiente de las horas. La demo lo aplica localmente; la API real debe implementar el contrato de precios de [ofertas y opiniones](docs/ofertas-y-opiniones.md).

La interfaz del chatbot está disponible desde **Ayuda Nexo U**, en la esquina inferior izquierda de todas las pantallas. Incluye preguntas sugeridas, composición, mensajes locales de prueba y cierre con Escape. Es solo interfaz: no consulta una IA, no envía peticiones y no almacena conversaciones entre recargas.

### Ruta de aprendizaje

En Perfil → Mi ruta se puede declarar el avance académico y explorar sugerencias según el pensum de Sistemas. El acceso a tutorías sigue abierto para todas las carreras. La demo incluye un avance ficticio que se reinicia al recargar; fuera de demo, la vista previa conserva el avance solo en memoria. Contrato para habilitar persistencia real: [docs/roadmap.md](docs/roadmap.md).
