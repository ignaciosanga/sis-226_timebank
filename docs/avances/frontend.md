# Avances — Equipo Frontend

El historial anterior del equipo está en
[frontend/docs/avances/frontend.md](../../frontend/docs/avances/frontend.md).

## Preparación de ofertas desde Inicio y navegación Horarios

- **Fecha:** 2026-10-27.
- **Estado:** Interfaz preparada localmente; publicación pendiente de integración.
- **Responsables:** Miguel Sanchez, equipo Frontend.
- **Rama:** `frontend/ofertar-habilidad`, desde `f2272d0`.

### Descripción

Se agrega el botón amarillo Ofertar una habilidad junto al catálogo de Inicio.
El estudiante puede elegir una habilidad de su Perfil, fecha y horario de La Paz,
validar los campos y revisar la oferta. Publicar oferta queda deshabilitado:
el contrato actual de disponibilidad no permite asociar una habilidad. El
formulario explica que no guarda ni publica datos y descarta el borrador al cerrar.

Disponibilidad se llama Horarios en los menús y Mis horarios en la vista. Se
retira de ella la publicación de horarios generales y se conservan la consulta,
edición y desactivación de los existentes. Se mantiene `/disponibilidad` y el
nombre de ruta `availability`. **En esta rama no se pueden crear horarios nuevos
hasta conectar el contrato de ofertas**, según el alcance preparado acordado.

### Compatibilidad y dependencias

- Sin cambios en Backend, Base de Datos, Dashboards, servicios HTTP o store.
- Perfil abre el formulario preparado de Inicio con `/?ofertar=1`.
- La validación exige habilidad propia activa, fecha real, inicio futuro y
  límites de 15 minutos con final posterior al inicio en la misma fecha.
- APIs y Backend deben acordar el contrato de habilidad con horario; Base de
  Datos debe resolver su persistencia. La lectura del catálogo y de Horarios
  también necesitará esa relación. No se inventa un endpoint ni se envían
  campos nuevos al contrato de disponibilidad actual.
- La ampliación de materias requiere el catálogo del equipo responsable; no se
  agrega un catálogo local alternativo.
- La entrega técnica está en
  [Ofertas y entrega a APIs](../../frontend/docs/ofertas-habilidades.md).

### Evidencias y pruebas

- Doce pruebas nuevas de validación y funcionamiento con Vue, router y HTTP
  controlado: revisión sin solicitudes de red, roles, descarte, cierre de sesión
  y conservación de edición/desactivación mediante los servicios existentes.
- `npm --prefix frontend test`: 65 pruebas aprobadas, cero fallos, incluidas
  estas pruebas y las verificaciones anteriores.
- `npm --prefix frontend run build`: compilación de producción correcta.
- Pendientes: revisión visual en navegador e intercambio real con el contrato
  de ofertas integrado. Las pruebas no escriben en el backend desplegado.
- Commit y PR: pendientes; cambios locales para revisión del equipo integrador.

## Navegación por sesión, créditos en Perfil e Inicio para visitantes

- **Fecha:** 2026-10-26.
- **Estado:** Completado localmente; pendiente de publicación e integración.
- **Responsables:** Miguel Sanchez, equipo Frontend.
- **Base de comparación:** `main`, commit `37592f524d0b04b758fa966c7a4beb9de1c37eca`.

### Descripción

Se reorganizó la navegación para mostrar las secciones correspondientes a la
sesión y al rol del usuario. Créditos pasa a ser una pestaña interna del Perfil.
Inicio conserva el catálogo y muestra información introductoria únicamente a
visitantes sin sesión. Se mantiene la identidad visual UCB.

### Funcionalidades

- Sin sesión: el menú de escritorio y móvil muestra solo Habilidades. Se
  mantienen los accesos de autenticación y registro.
- Con sesión de rol `ADMIN`: el menú muestra solo Admin.
- Las demás cuentas autenticadas conservan Habilidades, Intercambios,
  Disponibilidad y Perfil.
- Perfil contiene Mi perfil, Mi resumen y Créditos. La pestaña Créditos
  reutiliza la vista existente de saldo, retenciones y movimientos con filtros.
- Las categorías del catálogo se eligen en una lista desplegable. Las opciones
  siguen procediendo del catálogo cargado por la API y se conserva la búsqueda.
- Se retiran de Inicio los accesos rápidos y los bloques Tu próxima reserva y
  Tu tiempo tiene valor. La tarjeta personal aparece solo con sesión.
- Sin sesión, la columna izquierda explica el intercambio de habilidades y
  ofrece acceso al registro; la derecha contiene Sobre nosotros. La distribución
  se adapta a escritorio, tableta y móvil.
- Con sesión, Inicio muestra a la derecha las habilidades propias con su nivel
  y los créditos disponibles, retenidos y totales. Se reutilizan `mySkills` y
  `account` del store, con enlaces a Perfil y Créditos. En pantallas pequeñas
  estos bloques se sitúan debajo del catálogo. Se comprobó el estado sin
  habilidades, los valores del saldo y su actualización mediante renderizado Vue.

### Rutas y compatibilidad

| Ruta | Comportamiento |
| --- | --- |
| `/perfil/creditos` | Nueva ubicación de Créditos; conserva el nombre de ruta `credits`. |
| `/creditos` | Redirige a `/perfil/creditos`, conservando parámetros y fragmento. |
| `/perfil` | Conserva los datos del perfil y la publicación/retiro de habilidades. |
| `/perfil/resumen` | Conserva Mi resumen y el contenedor `dashboard-estudiante`. |
| `/administracion/metricas` | Conserva las métricas y el contenedor `dashboard-administrador`. |
| `/intercambios` | Conserva solicitudes, reservas, acciones y el retorno desde Google Calendar. |

La visibilidad del menú es una condición de interfaz. Se mantienen los controles
de autorización existentes del backend; no se añadieron controles de acceso al
router como parte de esta entrega.

### Impacto en otros equipos

- Sin cambios en `frontend/src/services`, `frontend/src/stores`, autenticación,
  contratos HTTP, dependencias o configuración de los informes.
- Sin cambios en Backend, Base de Datos, `dashboards/` ni scripts compartidos.
- Se mantienen los componentes de administración, créditos, disponibilidad e
  intercambios y sus servicios existentes.
- Se modifica la presentación de vistas compartidas de Frontend: Inicio,
  Perfil, menú, rutas y estilos. La documentación de integración refleja la
  nueva ubicación de Créditos.

### Evidencias y pruebas

- `npm --prefix frontend test`: 53 pruebas aprobadas, incluidas las 14 pruebas
  de integración de administración con respuestas HTTP controladas.
- `npm --prefix frontend run build`: compilación de producción correcta.
- Comprobaciones locales de renderizado Vue con historial en memoria: menús
  por sesión/rol en escritorio y móvil, cierre de sesión, separación entre
  Perfil/Mi resumen/Créditos, saldo reactivo, movimientos, redirección antigua
  y bloques de visitantes. Estas comprobaciones no forman parte de la suite
  versionada ni sustituyen una revisión visual en navegador.
- Consultas mediante los servicios reales del frontend contra el backend
  desplegado: login, perfil, cuenta de créditos, movimientos, habilidades,
  disponibilidad, solicitudes, reservas y categorías. Las consultas fueron
  correctas; las listas de actividad de la cuenta de prueba estaban vacías.
- El endpoint administrativo devolvió 403 al utilizar una cuenta de estudiante.
- No se crearon reservas ni se movieron créditos durante esta verificación.
- Pendiente: revisión visual, un intercambio completo contra el servidor y
  comprobación con informes reales de Looker Studio.
- Commit o PR: añadir el enlace real al publicar esta entrega.

### Dependencias

Esta entrega no requiere cambios adicionales de Backend, APIs o Base de Datos.
Los informes de Looker mantienen sus dependencias de configuración y permisos.

La propuesta de asociar cada horario a una habilidad concreta no está incluida.
Ese cambio debe coordinarse por separado con Backend, APIs y Base de Datos
mediante un Issue que defina persistencia, contrato y validaciones.

El README raíz establece revisión mediante PR y publicación separada de los
registros de avances. El equipo recibió posteriormente la indicación de trabajar
sobre `main`; el acuerdo de integración aplicable debe quedar registrado en
GitHub para que los demás equipos conozcan la excepción.
