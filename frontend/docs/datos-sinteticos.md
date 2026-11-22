# Demostración local de tutorías

Con `npm run dev`, abre `http://localhost:5173/?demo=1#/`.
La cuenta **Estudiante Demo** se inicia automáticamente. No requiere contraseña.
El parámetro va antes de `#`. Solo se habilita durante desarrollo; el build de producción usa la integración habitual.

El generador determinista crea 100 ofertas, 25 tutores, las 49 materias publicables de Sistemas, 757 reservas (754 completadas y 3 confirmadas), 502 opiniones, 2 solicitudes enviadas pendientes y 78 bloques de disponibilidad. Los horarios futuros se calculan al abrir la página, en horario diurno de La Paz. Los nombres y correos `example.test` son ficticios.

Recorrido para presentar:

1. Buscar una materia por nombre, por ejemplo **Programación II** o **Cálculo I**. La cuenta pertenece a Administración y puede solicitar cualquier materia.
2. Abrir **Ver oferta**, explorar la descripción, **Opiniones** y **Otros tutores** de esa misma materia.
3. Ir a **Intercambios → Mis clases → Aprendí → Calificar tutor**. Guardar estrellas y un comentario. Al volver a la oferta cambian su promedio y cantidad de opiniones.
4. En **Mis clases → Enseñé** hay tres clases impartidas. En **Reservas** hay dos futuras y una pasada pendiente de confirmación; completar esta última permite calificarla y actualiza los créditos locales.
5. En **Ofertar una habilidad**, elegir una de las tres materias del perfil, agregar título, descripción, fecha, costo total elegido por el tutor y banner opcional. Se puede revisar y publicar. La nueva oferta pertenece a la cuenta actual y por eso no aparece entre las ofertas de otros estudiantes del inicio.
6. **Restablecer** recarga y regenera el conjunto inicial; **Salir de demo** vuelve al modo habitual.

## Aislamiento e integración

`src/features/demo/synthetic-data.js` contiene el generador. `local-api.js` adapta el contrato de los servicios a memoria y reutiliza las validaciones del simulador de intercambios. Los promedios se calculan a partir de opiniones únicas de reservas completadas, por tutor y materia. Hay ofertas sin historial para mostrar ese estado.

En la demo, `apiRequest` intercepta todas las operaciones. Las rutas desconocidas fallan localmente con 501; nunca se envían al backend. La sesión sintética usa otra clave de sessionStorage y conserva la sesión real. No se guardan datos de la demo en la base compartida ni entre recargas. Los archivos subidos se convierten en una URL de datos local; no se suben a un servidor. La conexión con Google Calendar no está simulada.

Las pruebas comprueban conteos y referencias, cálculo de métricas, opiniones únicas e idempotencia, publicación atómica, créditos y ausencia de peticiones HTTP al inicializar y utilizar el adaptador.

En **Horarios**, el calendario distingue solicitudes enviadas en rojo, reservas confirmadas en verde y disponibilidad propia en azul. Pulsa un día para consultar sus detalles.

Los precios de las ofertas son importes fijos en créditos, independientes del horario. Las solicitudes nuevas guardan el precio publicado por el tutor. Las reservas existentes conservan el importe ya acordado.
