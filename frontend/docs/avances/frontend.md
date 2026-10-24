# Avances Equipo Frontend

## Administración de usuarios: alta y baja demostrativas

- **Fecha:** 2026-10-23
- **Estado:** Implementado en Frontend; integración real pendiente
- **Responsable:** Equipo Frontend

### Descripción

Se agregó `/administracion`, accesible desde «Admin · Demo», siguiendo la dirección visual Red universitaria. El alcance corresponde al pedido de alta y baja de usuarios; toda la operación es una simulación local sin llamadas a Backend.

### Funcionalidades

- Listado paginado con búsqueda por nombre, correo y carrera, y filtros Todos/Activos/Inactivos con contadores.
- Alta de estudiantes con nombre, apellido, correo, carrera y semestre. Se validan campos obligatorios, formato de correo, duplicados (incluidos usuarios inactivos) y semestre.
- Baja lógica con confirmación, fecha y motivo opcional; conserva la identidad y los datos académicos.
- Cuenta administrativa de demostración protegida frente a la baja.
- Guardado en `localStorage` bajo `nexo-u.admin-users.v1`; sin contraseñas ni credenciales. Se recuperan las altas y bajas al recargar en el mismo navegador y origen.
- Errores de lectura/escritura visibles. Los datos guardados no se reemplazan si están dañados ni se anuncia éxito si falla la escritura.
- Estados vacíos, mensajes de resultado, diseño adaptable y ventanas con etiquetas accesibles, recorrido de teclado, cierre con Escape y restauración del foco.

### Evidencias y pruebas

- `npm run test:admin`: 11 pruebas de creación, validación, duplicados, bajas, conservación de datos, búsqueda, persistencia y fallos de almacenamiento.
- `npm run build`: compilación de producción correcta.
- Renderizado en servidor de las cinco rutas y de la ventana modal sin errores.
- `git diff --check`: sin errores.
- Revisión visual en navegador pendiente: la herramienta de navegador bloqueó previamente el acceso a la URL local por su política de seguridad.

### Dependencias y límites

El acceso a esta ruta es público dentro del mockup y está identificado como demostración; no representa una autorización de administrador. Quedan para el equipo Backend y su integración: comprobación real del rol ADMIN, contratos de listado/alta/baja, credenciales de cuentas nuevas, bloqueo efectivo de acceso al dar de baja y persistencia/auditoría en PostgreSQL. Las carreras y los usuarios de esta vista son ejemplos, no un catálogo oficial obtenido de BD. La baja se presenta como cambio a Inactivo, pendiente de confirmar la regla definitiva con la responsable del producto. No se modificaron Backend ni Base de Datos, ni se crearon commits o publicaciones en GitHub.

## Red universitaria: identidad visual de Nexo U

- **Fecha:** 2026-10-23
- **Estado:** Implementado localmente; revisión visual pendiente
- **Responsable:** Equipo Frontend

### Descripción

Se implementó la dirección visual «Red universitaria», conservando la estructura social de tres columnas y dando prioridad a los estudiantes que comparten conocimientos.

### Cambios

- Sora para títulos y Source Sans 3 para lectura, alojadas localmente con sus licencias OFL; precarga de ambas fuentes.
- Fondo gris azulado, azul UCB para acciones y amarillo como detalle en el perfil.
- Ofertas encabezadas por el tutor, su carrera, materia y valoración; información de sesión sin cajas interiores y acción principal visible.
- Inicio con una sola búsqueda. Desde otras vistas, la búsqueda navega al catálogo y conserva el término en la URL.
- Agenda y enlaces con menos contenedores; la agenda enlaza a Mis cursos y contempla el estado vacío.
- Adaptación de cabecera y contenido para celular, acceso visible al inicio de sesión, foco de teclado y respeto por movimiento reducido.
- Indicadores de analíticas agrupados en una franja y gráficos con un color principal.

### Evidencias y pruebas

- Compilación de producción: `npm run build`.
- Renderizado en servidor de inicio, Mis cursos, Perfil y Analíticas sin errores.
- Verificación de búsqueda por URL (Figma), resultado único, estado sin coincidencias y un único buscador por vista.
- Comprobación de diferencias sin errores de espacios: `git diff --check`.
- No se verificó visualmente en navegador: la herramienta bloqueó el acceso a la URL local por su política de seguridad.
- Entrega local; sin commits ni publicación en GitHub.

### Dependencias

Se conserva el funcionamiento demostrativo y la denominación actual de puntos. La autenticación y las inscripciones reales continúan dependiendo de la integración con Backend; no se modificaron contratos ni base de datos.

## Actualización visual inspirada en LinkedIn

- **Fecha:** 2026-10-20
- **Estado:** Completado localmente
- **Responsable:** Equipo Frontend

### Descripción

Se ajustó la presentación de Nexo U con tipografía del sistema, tarjetas blancas y una jerarquía centrada en las personas, conservando la identidad UCB.

### Funcionalidades

- Buscador con avatar y filtros en una tarjeta compacta.
- Tarjetas de cursos encabezadas por el tutor, su carrera y la modalidad.
- Navegación más compacta, bordes discretos y menos decoración multicolor.
- Texto secundario de al menos 12 px con la configuración predeterminada del navegador y pesos tipográficos más moderados.
- Estilos compartidos consistentes en inicio, agenda, perfil y analíticas.

### Evidencias y pruebas

- Compilación de producción: `pnpm run build`.
- Navegador: búsqueda por Figma, estado sin resultados y restablecimiento de filtros.
- Filtros: modalidad virtual y combinación con la categoría Tecnología.
- Inscripción demostrativa: apertura del acceso, inicio de sesión e incorporación del curso a la agenda.
- Revisión visual en escritorio y móvil; las cuatro rutas se comprobaron a 320 px sin desbordamiento horizontal.
- Entrega local, sin commits ni publicación en GitHub.

### Dependencias

- Se mantienen los datos simulados y los contratos de integración existentes.
- Pendiente: validación de la profesora e integración con los servicios reales de los equipos responsables.

## Mockup navegable Nexo U

- **Fecha:** 2026-10-15
- **Estado:** Completado
- **Responsable:** Equipo Frontend

### Descripción

Se implementó un mockup local y navegable para validar la experiencia de una plataforma universitaria de aprendizaje entre pares. El alcance comprende la presentación visual y las interacciones demostrativas solicitadas.

### Funcionalidades

- Catálogo de cursos con búsqueda y filtros.
- Solicitud de inicio de sesión antes de la inscripción.
- Agenda y calendario de cursos elegidos.
- Perfil académico del estudiante.
- Panel personal de analíticas.
- Navegación adaptable a distintos tamaños de pantalla.

### Evidencias y pruebas

- Compilación: `npm run build`.
- Datos: simulados en el navegador.
- Pruebas pendientes: integración con servicios reales y validación con usuarios.

### Dependencias

- Backend: autenticación, cursos e inscripciones.
- Base de Datos: persistencia de usuarios, cursos, sesiones y puntos.
- Dashboards: agregaciones y métricas oficiales.
- APIs e Implementación: contratos, seguridad y despliegue de servicios.
