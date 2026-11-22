# Informe de aporte — Kevin Tapia Ali

Proyecto: NEXO U / Banco de Tiempo Universitario. Entrega: tercer parcial, backend académico, reputación, analítica e integración económica. Fecha: 22 de noviembre de 2026.

## Base y atribución

Mi trabajo continúa el núcleo de Gonzalo en `8fe275bc465b061e9df651dfc870ef293b3870f7`, mediante `feat/backend-academico-reputacion-parcial3`. El núcleo de autenticación, reservas, retenciones, doble confirmación, libro de créditos y las seis migraciones previas son trabajo heredado, no autoría nueva mía. Las reglas económicas, funciones de penalización, vistas y deuda pendiente fueron entregadas por Base de Datos en SkillSwap v4. Mi aporte integra esos contratos con el backend y los verifica.

## Trabajo realizado

| Área | Mi implementación y resultado |
| --- | --- |
| A01–A02: catálogo académico | Transcripción del pensum del frontend: 49 materias publicables, áreas, semestres y prerrequisitos. MAT-030 es externo y no publica una habilidad; las dos electivas sin definición quedan excluidas. Modelo académico y carga idempotente que conserva UUID y detecta duplicados ambiguos. |
| A03: Mi ruta | Consulta y actualización por materia de la cuenta autenticada; approved/current/pending. Pending elimina la declaración. Escrituras concurrentes no sobrescriben otras materias ni otras cuentas. |
| A04–A05: opiniones y reputación | Una opinión del solicitante por clase completada y finalizada; validación 1–5, reintentos sin duplicar, promedio por tutor/materia y evidencia de cantidad de opiniones. Integración de la fórmula Knowledge Score de BD, sin inventar penalizaciones al score. |
| A06–A09: indicadores | Consultas ADMIN para demanda/cobertura, proyección etiquetada, ranking por materia, distribución de importes, horarios en La Paz y cancelaciones registradas. Resumen personal Aprendí/Enseñé con horas y créditos exactos. |
| HU-05: ofertas | Detalle, filtros por UUID/código/tutor, edición por propietario e idempotencia. Se preservan precios pactados y se impide mover horarios ya comprometidos. |
| HU-06: economía | Conversión exacta entre décimas INTEGER de BD y textos decimales de API, lectura de configuración real, precio calculado en servidor, snapshot al solicitar, aceptación y liquidación conservando el pacto. Se preserva soporte de esquemas anteriores. |
| HU-08: cancelaciones | Motivo, actor, fecha, anticipación y liberación única. Integración del trigger v4: cobro inmediato de 0,5 por cancelación tardía o deuda pendiente si falta saldo; cobro posterior completo y sin duplicación. Consulta privada de deudas. |
| Persistencia y seguridad | Claves de cifrado por conexión, recuperación de reintentos desde auditoría cifrada, puente de escritura controlada y pruebas con rol de aplicación restringido. Respuestas reconciliadas con el saldo real después de los triggers. |
| A10: entrega técnica | README, contratos, instrucciones de preparación, arquitectura, modelo Prisma y verificación reproducible; integración destinada a la rama Backend. |

Los puntos 6 y 7 del plan son la lista A01–A10 y su orden de ejecución; no se confunden con HU-06/HU-07. Esta entrega cubre mi frente académico y añade HU-06/HU-08 con la información que BD entregó después.

## Reglas que integré, suministradas por BD

Precio = 1 + 1,5 por escasez (<3 tutores activos) + 1,3 en horario de demanda (18–21, La Paz) + 1,2 por promedio global >4,5. Los adicionales aplican sólo cuando se cumple cada condición. No son factores multiplicativos ni tarifa por duración. Una cancelación con anticipación menor a cinco horas genera penalización de 0,5; sin saldo no hay cobro parcial. Las deudas se cobran completas por FIFO al aumentar saldo disponible. Estos valores son configurables y no se inventaron en Backend.

## Evidencia y límites de la entrega

Entorno: Node 26.13.1, npm 11.20.0, NestJS 11.2.7, TypeScript 5.9, Prisma 7.10.1 y PostgreSQL 16.15 en Docker aislado. No se utilizaron credenciales del ZIP ni se borraron volúmenes existentes. Las verificaciones y sus comandos se registran en `docs/verification-2026-11-22.md`.

La integración HTTP real usa permisos de aplicación, no superusuario. Incluye lectura/escritura académica, reservas, créditos fraccionarios, opiniones, cancelaciones, deuda y cobro, control de integridad y reconexión. Las pruebas SQL de BD validan sus funciones y vistas. Se distingue esta evidencia de los tests de memoria.

El alcance no incluye desplegar Neon, modificar pantallas de Frontend, activar sus flags, publicar tableros BI ni sustituir el módulo de APIs del equipo. El registro usa un capturador de correo en las pruebas; SMTP y OAuth externos requieren sus credenciales y validación de integración. La preparación local funcional no equivale a que BD haya aplicado la migración a una base compartida. El historial Prisma unificado para Neon sigue correspondiendo a coordinación BD/APIs; el puente v4 está entregado y probado.

## Archivos y uso

- `docs/skillswap-v4-integration.md`: preparación, reglas, permisos, validación y recuperación.
- `docs/academic-integration.md`: contrato A01–A10 y diccionario de indicadores.
- `src/modules/academic`: currículo, ruta, opiniones y consultas.
- `src/modules/exchanges/economy.ts`: conversión exacta y costo dinámico.
- `scripts/prepare-skillswap.cjs`: instalación del complemento en BD v4.
- `scripts/test-skillswap.cjs`: verificación real y reproducible en base temporal.
- `prisma/vendor/skillswap-v4`: SQL original de BD, conservando su atribución.
- `prisma/proposals`: ampliaciones propias para integrar el frente académico y la auditoría.

La rama `Backend` usa el backend en la raíz; la rama de desarrollo usa `backend/` dentro del monorepositorio. Se publica el mismo contenido del backend respetando esa diferencia de estructura y conservando la historia de `Backend`.
