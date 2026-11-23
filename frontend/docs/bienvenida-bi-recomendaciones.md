# Bienvenida e integración de BI y recomendaciones

Cambios de Frontend sobre `apis/integracion-parcial3` en `f2739e5`.
Rama de entrega: `front_end_bienvenida_bi_recomendaciones`.
La implementación inicial se revisó en `0edd452`; después se actualizó la base
sin conflictos con las entregas de Postman y persistencia de banners.

## Bienvenida

`WelcomeGuide.vue` se monta en AppShell después de cargar la sesión del
estudiante. La ventana permite comenzar un recorrido de cinco pasos o
explorar por cuenta propia. El recorrido explica búsqueda entre carreras,
ofertas y precio total, créditos, intercambios y habilidades del perfil.

- Cada paso navega a su pantalla y resalta el control correspondiente.
- Atrás, Siguiente, cierre y Escape están disponibles; el recorrido no envía
  solicitudes, publica ofertas ni mueve créditos.
- El foco permanece en el diálogo y vuelve a la página al cerrarlo.
- La página de fondo permanece inerte durante la guía.
- El estado visto se guarda por ID de cuenta, versión y modo demo/real en
  este navegador. No se sincroniza entre dispositivos.
- Si el almacenamiento está deshabilitado, se conserva el estado durante
  la sesión y la guía sigue funcionando.
- Perfil incluye **Ver guía de bienvenida** para repetirla.
- No se abre automáticamente para invitados, administradores, durante la
  carga inicial ni en registro/verificación de correo.

El personaje reutiliza `AssistantAvatar.vue`. No se modificaron
`ChatbotWidget.vue` ni el servicio `tutoring.js` mantenidos por APIs.

## Integración con BI

Referencias: [issue 50](https://github.com/ignaciosanga/sis-226_timebank/issues/50)
y [PR 55](https://github.com/ignaciosanga/sis-226_timebank/pull/55).

`ReportPanel.vue` es el contenedor de Frontend: controla acceso y carga las
fuentes, luego entrega `reportData` y `sources` a los componentes de BI.
Se conserva su presentación nativa Vue y se elimina el iframe del contenedor.

`services/analytics.js` consume:

| Audiencia | Fuentes |
| --- | --- |
| ADMIN | `/analytics/overview`, `/analytics/users`, `/analytics/exchanges`, `/analytics/credits`, `/analytics/skills`, `/analytics/academic`, `/analytics/reputation`, `/analytics/economy` |
| Cuenta autenticada | `/credits/me`, `/credits/me/movements`, `/reservations/me`, `/intercambios/mis-clases`, `/roadmap/me` |

La lectura de Mis clases recorre sus páginas. Cada fuente puede fallar de
forma independiente: se informa el error y se conservan los otros apartados.
Cambiar de cuenta, perder el rol o cerrar sesión limpia los datos e invalida
respuestas anteriores. Las solicitudes ADMIN no se disparan para estudiantes
o invitados. El backend sigue siendo responsable de autorizar cada endpoint.

`report-data.js` adapta las respuestas al esquema visual de BI. La falta de
datos no activa generadores sintéticos; los ejemplos se usan únicamente en el
modo de demostración explícito. Los importes se formatean desde texto decimal
sin convertir sumas grandes a Number. La clasificación de movimientos distingue
transferencias recibidas de transferencias pagadas.

Los cambios dentro de `vue-dashboards/` se limitan al consumo de props y a la
presentación de sus fuentes; no se cambiaron las fórmulas de `knowledge-gap.js`
ni `knowledge-score.js`. Sus siete pruebas se incorporaron a `npm test`.

### Campos que faltan en la API integrada revisada

1. **Brecha por materia:** `/analytics/academic` expone solicitudes del período,
   mientras la definición de BD usa solicitudes pendientes. El contenedor
   solo habilita el Knowledge Gap Index real cuando cada fila declara
   `solicitudes_pendientes`. Mientras tanto presenta demanda y cobertura con
   sus nombres correctos, sin publicar otro cálculo como si fuera ese índice.
2. **Reconocimiento de tutores:** se requieren `knowledge_score` numérico,
   `tasa_cumplimiento` y `cancelaciones_injustificadas` por fila. Si faltan,
   se muestran opiniones y clases disponibles sin asumir cumplimiento perfecto
   ni conceder la insignia de alto impacto.
3. **Series no publicadas:** los gráficos de tendencia de solicitudes, motivos
   de cancelación, usuarios por semestre e histórico de saldo permanecen
   vacíos cuando no existe una fuente. No se reconstruyen con supuestos.

Estos campos requieren coordinación de APIs/Backend/BI; no se alteraron sus
consultas SQL ni se aplicaron migraciones en Neon.

## Recomendaciones de tutores

El catálogo conserva la búsqueda por nombre y añade opciones de materias.
Al seleccionar o escribir el nombre completo de una materia activa, aparece
**Otros tutores** con hasta tres sugerencias. No hay restricción por carrera.

El componente distingue nota en estrellas y afinidad. Mantiene el orden
recibido del motor, excluye la cuenta propia y duplicados, valida la materia
de la respuesta y admite únicamente afinidades numéricas entre 0 y 100.
Cada botón abre una oferta del mismo tutor y materia en el catálogo actual;
si no se encontró, no se inventa un enlace de reserva.

Cambiar de materia o cuenta invalida las respuestas anteriores. Una respuesta
vacía o un error no elimina la búsqueda general. La recomendación no confirma
disponibilidad, reserva ni saldo.

### Demo y activación real

- En `?demo=1` se generan ejemplos con los tutores y horarios de esa materia,
  con el aviso **Sugerencias de demostración**. Las afinidades son cifras de
  muestra y no reproducen la fórmula de BD.
- Fuera de demo, el servicio consume
  `GET /tutoring/recommendations?skillId=<UUID del catálogo>`.
- El contrato está implementado en la rama Backend, commit `5719d55`; aún
  no estaba publicado en OpenAPI ni registrado en la base integrada revisada.
- Por eso `VITE_RECOMMENDATIONS_API_ENABLED=false` es el valor por defecto.
  APIs debe incorporar el controlador y registrar el contrato antes de
  activar esa variable en la compilación del frontend.
- La dependencia está declarada en `tests/contract-pending.json` con responsable
  y motivo; no se agregó una ruta ficticia al OpenAPI.

El roadmap mantiene sus sugerencias académicas por prerrequisitos; son una
funcionalidad distinta de la selección de tutores del motor de matching.

## Límites del cambio

La implementación es de Frontend y no certifica un despliegue productivo ni
la ejecución de matching en Neon. Se conserva la política de precio del tutor.
La alineación completa del formulario de reserva con el intervalo de su oferta
y los avisos de la política de cancelación son tareas separadas del análisis
anterior; este cambio conserva códigos HTTP estructurados para poder tratarlas.

## Verificación

`npm test` incluye las nuevas comprobaciones de bienvenida, adaptación de
reportes, permisos, paginación, cambio de cuenta, errores parciales y respuestas
tardías de recomendaciones. Las llamadas HTTP se verifican con respuestas
controladas; no se usan cuentas reales ni se escriben datos en producción.
La revisión visual se realiza en la demo local, en escritorio y móvil.

Resultados de la revisión local:

- **153 pruebas aprobadas**, sin fallos (`npm test`).
- **Compilación de producción correcta** (`npm run build`).
- Recorrido completo en escritorio y móvil de 390 × 844, cierre, persistencia
  después de recargar y reapertura desde Perfil comprobados en navegador.
- Búsqueda de Programación II, tres sugerencias y apertura de la oferta del
  mismo tutor comprobadas en demo. Panel personal y Command Center visibles.
- Sin cambios en backend, `main`, `ChatbotWidget.vue` ni `services/tutoring.js`.

Para probar: iniciar el frontend y abrir `http://localhost:5173/?demo=1#/`.
Si la guía ya se vio en ese navegador: **Perfil → Ver guía de bienvenida**.
