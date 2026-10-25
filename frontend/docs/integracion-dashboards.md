# Contenedores de métricas para Looker Studio

Frontend prepara las vistas. Dashboards construye los informes y entrega el
`iframe` de Looker Studio. No se implementan gráficos ficticios ni nuevos
endpoints de estadísticas.

| Vista | Ruta | Contenedor |
| --- | --- | --- |
| Mi resumen | `/#/perfil/resumen` | `div#dashboard-estudiante` |
| Métricas generales | `/#/administracion/metricas` | `div#dashboard-administrador` |

Accesos: Perfil → pestaña Mi resumen; Administración → Métricas generales.
El resumen conserva la cabecera del perfil y las pestañas Mi perfil / Mi resumen.
No aparece como pestaña independiente del menú principal ni como acceso en Inicio.
`/#/analiticas` vuelve a conducir al resumen personal. Créditos conserva su ruta
y sus operaciones. La administración de usuarios usa los servicios reales del
PR #14, incluidas las altas, bajas, reactivaciones y cargas de créditos.

## Activar los informes

Copiar el valor de `src` del iframe que entregue Dashboards, sin pegar la etiqueta
HTML completa, en `frontend/.env.local`:

```dotenv
VITE_LOOKER_STUDENT_URL=https://lookerstudio.google.com/embed/reporting/ID_ESTUDIANTE/page/ID_PAGINA
VITE_LOOKER_ADMIN_URL=https://lookerstudio.google.com/embed/reporting/ID_ADMIN/page/ID_PAGINA
```

Los IDs anteriores son marcadores, no informes reales. Dejar vacía cada variable
hasta recibir su enlace. `.env.example` documenta ambas variables. Reiniciar
Vite después de configurar; en un despliegue hay que volver a compilar con las
variables del entorno de build. Las variables `VITE_` son públicas: nunca guardar
tokens, contraseñas ni credenciales de PostgreSQL en ellas.

Sin URL, las dos vistas muestran «En preparación». Con una URL inválida, no se
crea un iframe y aparece un aviso. Solo se admiten URLs HTTPS del dominio exacto
`lookerstudio.google.com` con la ruta `/embed/reporting/...`.

El componente `features/metrics/ReportPanel.vue` contiene el iframe compartido:
ancho 100%, altura 750 px en escritorio y 650 px en móvil, título accesible,
carga diferida, pantalla completa, recarga y enlace alternativo en otra pestaña.
No se insertan etiquetas mediante `v-html`. Los filtros y la fecha de actualización
los proporciona el propio informe, para evitar controles externos sin efecto.

## Sesión y privacidad

Los contenedores vacíos se pueden revisar sin sesión. Cuando se configure un
informe, el personal exige una sesión real de Nexo U; el global exige además
`rol: Administrador` o `roles: ['ADMIN']`. Se conservan los controles de rol
del equipo de APIs en la gestión real de usuarios.

Esta comprobación de interfaz no autoriza el acceso a los datos de Looker. El
equipo de Dashboards debe configurar los permisos y la separación de datos por
estudiante dentro de su solución. No publicar un informe personal con datos de
todos los estudiantes. Una única URL o un filtro de usuario no sustituyen esa
protección. No se adjuntan el JWT, correo ni ID del usuario de Nexo U a la URL.

El navegador no permite inspeccionar el contenido de un iframe externo. Su evento
`load` no demuestra que los datos se cargaron o que los permisos sean correctos.
Por eso se mantiene un enlace alternativo para abrir el informe en otra pestaña.
La validación final requiere los enlaces reales y probarlos con las cuentas
autorizadas por el equipo de Dashboards.

## Diseño

Se conserva Red universitaria: azul UCB `#005289`, amarillo `#F6C500`, fondo
`#F2F5F7`, blanco y tinta `#20313D`; Sora para títulos y Source Sans 3 para texto.
Cabecera alineada a la izquierda, navegación local y un único contenedor amplio
para cada informe. Los textos inferiores describen su alcance previsto, sin
inventar indicadores ni porcentajes. Sin animaciones automáticas.

## Verificación

`npm test` valida las URLs y los accesos además de las pruebas existentes.
`npm run build` comprueba la compilación. Se comprueban mediante renderizado
las vistas vacías, la redirección y los estados de acceso e iframe con URLs
sintéticas, sin consultar informes externos. La revisión visual en navegador
y con informes reales queda pendiente.

La integración conserva sin modificaciones los servicios y el store recibidos
de `main` (PR #14). Los cambios locales solo añaden navegación, vistas y contenedores;
no modifican Backend ni Base de Datos y no se publican en GitHub.
