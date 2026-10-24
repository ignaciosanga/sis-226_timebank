# Pantallas Nexo U: modelo de intercambio de tiempo

Implementación local de Frontend, 24 de octubre de 2026, basada en `main`.
Contrato consultado: `backend/docs/frontend-integration.md` y DTOs del backend.
No se modificaron Backend, Base de Datos ni `frontend/src/services`.

## Dirección de diseño

Se conserva Red universitaria: personas reconocibles, formularios claros y un
flujo que muestra cuándo se reserva tiempo y cuándo circulan los créditos.

- Fondo: `#F2F5F7`; superficie: `#FFFFFF`; texto: `#20313D`.
- Texto secundario: `#566773`; acción: `#005289`; detalle UCB: `#F6C500`.
- Sora en títulos; Source Sans 3 en formularios, textos y datos.
- Alineación izquierda. Las ofertas y formularios tienen contenedores porque
  contienen interacciones; la agenda, los enlaces y las explicaciones son ligeros.
- Movimiento reducido respetado, foco visible, formularios etiquetados y ventanas
  con recorrido de teclado, Escape y restauración del foco.

```text
Cabecera: Habilidades | Intercambios | Disponibilidad | Créditos | Perfil | Admin
Inicio: perfil | búsqueda y ofertas de habilidades | reserva y créditos
Registro: identidad de comunidad | formulario académico
Disponibilidad: publicar horario | bloques publicados
Intercambios: solicitudes recibidas/enviadas | reservas y confirmaciones
Créditos: disponibles / retenidos / saldo | movimientos y explicación
```

La revisión del plan conserva el diseño aprobado y concentra la personalidad en
los estudiantes que comparten conocimientos. Se retiraron las estadísticas,
valoraciones, cupos e inscripciones de cursos que no pertenecen al contrato.

## Rutas e interacciones

| Ruta | Contenido |
| --- | --- |
| `/` | Ofertas ilustrativas de habilidades, búsqueda por habilidad/estudiante y filtro de categoría; selección de disponibilidad y solicitud. |
| `/registro` | Nombre/apellido (hasta 100), correo institucional `@ucb.edu.bo` (hasta 254), contraseña (12–128), confirmación, carrera por UUID y semestre (1–12). |
| `/disponibilidad` | Publicación de intervalos futuros en horario de La Paz, validación de duración y superposiciones. |
| `/intercambios` | Solicitudes recibidas/enviadas: aceptar, rechazar y cancelar según participante y estado. |
| `/intercambios?tab=reservas` | Reservas: cancelar antes del inicio con motivo, confirmar después del fin y esperar la segunda confirmación. |
| `/reservas` | Redirección a la pestaña de reservas. |
| `/creditos` | Saldo, retenidos, disponibles y movimientos filtrados por tipo. |
| `/perfil` | Datos académicos y publicación de habilidades del catálogo con nivel. |
| `/administracion` | Alta con contraseña, baja lógica, reactivación exclusiva de Inactivos y filtro de Suspendidos. |

Las rutas antiguas `/mis-cursos` y `/analiticas` redirigen a Intercambios y
Créditos. Se retiraron las vistas/componentes y datos del modelo anterior de
cursos para evitar referencias al estado retirado.

## Alcance demostrativo y credenciales

La aplicación muestra una nota explícita de demostración. El registro valida el
formulario y muestra un recibo; no crea cuentas reales ni inicia sesión. No se
almacena la contraseña. El login real está pendiente; la entrada a la demo usa
un botón explícito con el perfil de Valeria, sin aparentar que se verificaron
credenciales. Los secretos se limpian al cerrar o completar formularios.

El registro y el alta administrativa admiten únicamente el dominio exacto
`ucb.edu.bo`, sin distinguir mayúsculas y quitando espacios exteriores. Los
subdominios y dominios parecidos se rechazan. Esta regla está implementada en
la validación compartida del frontend; el equipo de Backend debe aplicarla
también en los endpoints de creación para garantizarla en el sistema real.

Los intercambios viven en memoria y se reinician al recargar. La administración
conserva sus registros ilustrativos en el `localStorage` existente y nunca guarda
contraseñas. Se conserva la lectura de los registros administrativos anteriores.
Las carreras de `features/timebank/catalogs.js` son fixtures, no el catálogo real.

El simulador de presentación está aislado en `features/timebank/demo-*.js` y se
consume desde `stores/app.js`. No es un servicio de autorización ni una nueva
implementación del backend. Se utiliza para revisar los estados y recorridos de
las pantallas mientras el equipo responsable entrega las funciones de servicios.

## Entrega a APIs e Implementación

El Issue #1 asigna `frontend/src/services` a APIs e Implementación. Esa carpeta
solo contiene actualmente el cliente HTTP genérico; esta entrega no modifica
su URL, autenticación, funciones ni configuración. No se inventan llamadas a
funciones todavía inexistentes. La integración real debe sustituir la capa demo
con las funciones de servicios que entregue ese equipo; no debe convivir como
fallback silencioso frente a un fallo de red.

| Acción de pantalla | Contrato de servicio que debe conectar APIs |
| --- | --- |
| Cargar carreras | `GET /careers`: `{ data, meta }`; usar `id_carrera`, `nombre`, `estado` y paginación. |
| Registrar estudiante / alta por ADMIN | `POST /auth/register` o `/admin/users`: `{ nombre, apellido, correo, password, idCarrera, semestre }`. |
| Iniciar sesión | `POST /auth/login`; JWT Bearer, expiración y 401. |
| Catálogos | `GET /skills` y `/categories`; IDs y paginación del servidor. |
| Habilidades propias/de un usuario | `GET /users/:id/skills`; `POST /users/me/skills`: `{ skillId, nivel }`. |
| Disponibilidad | `GET /availability/me`, `/users/:id/availability`; `POST /availability`: `{ fechaInicio, fechaFin }`. |
| Solicitar intercambio | `POST /exchanges`: `{ providerId, skillId, availabilityId, fechaInicio, fechaFin, descripcion }`. |
| Aceptar/rechazar/cancelar | `POST /exchanges/:id/accept`, `/reject`, `/cancel`; aceptar devuelve una reserva. |
| Reservas | `GET /reservations/me`; `/confirm` y `/cancel` (motivo hasta 500 caracteres). |
| Créditos | `GET /credits/me`, `/credits/me/movements`. |
| Administración | `GET /admin/users`; `PATCH /admin/users/:id/status`: `{ estado: 'Activo' }` o `{ estado: 'Inactivo', motivo }` (motivo hasta 255). |

`AccountFields` recibe el catálogo como prop con estados `loading`, `ready` y
`error`; el formulario envía el UUID y no el nombre. `setCareers` permite cargar
la respuesta normalizada en el estado de presentación. El reintento actual
recarga fixtures y debe ser sustituido por la función de catálogo real.

El catálogo público del backend no proporciona un buscador global de ofertantes.
Los perfiles/ofertas del inicio son ejemplos. APIs debe acordar cómo se obtiene
el ID de cada ofertante y se unen sus habilidades y disponibilidad, sin asumir un
endpoint que el backend no haya publicado.

Requisitos de integración pendientes: estados de envío/carga/error, 400 de
validación, 401/403 de sesión/rol, 409 por duplicados o conflictos, y 503. Cada
acción de intercambio/reserva debe conservar su `Idempotency-Key` y cuerpo al
reintentar; una nueva acción debe generar otra clave. No se debe tratar un error
real como una operación de demo exitosa. El backend es la autoridad de permisos,
créditos, superposiciones y restricciones de baja/reactivación.

## Verificación local

- `npm test`: validaciones de cuenta, administración y recorridos de intercambio.
- `npm run build`: compilación de producción.
- Renderizado en servidor de las siete rutas y de la pestaña Reservas.
- Recursos y enlaces internos conservan `import.meta.env.BASE_URL` y navegación hash.
- Revisión visual real pendiente: el navegador automatizado bloqueó el acceso
  local en esta conversación; las verificaciones no sustituyen revisión de pantalla.
- Cambios únicamente locales, sin commits, push ni despliegues.
