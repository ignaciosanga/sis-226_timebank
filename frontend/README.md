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
- Preparación de ofertas: botón amarillo en Inicio; acceso desde Perfil mediante `/?ofertar=1`.
- Solicitudes: `/intercambios`.
- Reservas: `/intercambios?tab=reservas` (o `/reservas`).
- Créditos y movimientos: Perfil → Créditos, en `/perfil/creditos`. La ruta anterior `/creditos` redirige a esta pestaña.
- Perfil y habilidades propias: `/perfil`.
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
