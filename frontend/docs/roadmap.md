# Mi ruta de aprendizaje

Ruta `/perfil/ruta`, dentro de los apartados del perfil. Disponible para estudiantes de cualquier carrera. Usa el pensum de Sistemas aportado por el equipo: 49 materias identificadas y dos espacios electivos sin materia definida (excluidos del avance).

El estudiante declara manualmente cada materia como `approved` (aprobada), `current` (en curso) o `pending` (sin marcar). No se deduce del semestre del perfil, las habilidades ofrecidas ni las clases completadas. Marcar una materia tampoco marca automáticamente sus prerrequisitos.

Las sugerencias son reglas locales: una materia sin estado declarado se sugiere si todos sus prerrequisitos están marcados como aprobados. Orden por semestre y código. Una materia en curso no satisface un prerrequisito. MAT-030 es un requisito externo al pensum mostrado; puede declararse aprobado desde Cálculo I, pero no suma al progreso de 49 materias. Los espacios electivos no se pueden marcar hasta definir sus materias.

Las descripciones son orientación editorial para aprender, no programas oficiales. Los requisitos nunca bloquean el acceso a tutorías. El enlace usa `/#/?q=<nombre>&materia=<codigo>` para buscar la materia exacta, sin filtrar por carrera.

## Persistencia y activación

- `?demo=1` en desarrollo: adaptador local, avance sintético inicial independiente de los datos de tutorías. Persiste al navegar, se reinicia al recargar. Ninguna petición llega al servidor.
- Sin demo y sin flag: vista previa con avance en memoria por sesión; al recargar se reinicia. No se llama a un backend que aún no tiene el contrato.
- Para activar persistencia real, implementar el contrato siguiente y configurar `VITE_ROADMAP_API_ENABLED=true`. No está activado por defecto.
- Cerrar sesión o cambiar de usuario borra el estado visible. Se ignoran respuestas tardías de otra sesión. Un error de carga ofrece reintento; uno al guardar conserva el último avance confirmado.

## Contrato propuesto para backend

Autenticación Bearer obligatoria. El usuario siempre se obtiene de la sesión; nunca aceptar un ID de estudiante enviado por el cliente.

`GET /roadmap/me` → 200 con objeto directo (sin envelope):

```json
{"curriculum":"systems","courses":{"SIS-111":"approved","SIS-113":"current"}}
```

Sin registros devolver `{"curriculum":"systems","courses":{}}`.

`PUT /roadmap/me/courses/:codigo` con `{"estado":"approved"}` → 200 con la ruta completa actualizada, en el mismo formato de GET. Operación idempotente: actualizar solo esa materia. `pending` elimina la declaración; los cursos sin entrada se consideran sin marcar. No enviar estados calculados `recommended` ni `elective`.

Validar código contra el catálogo, incluyendo MAT-030; este último admite solo `approved` o `pending`. Rechazar códigos inexistentes, electivas sin definir y estados inválidos con 400. Evitar escrituras perdidas: actualizar la fila por usuario/currículum/código de forma atómica. No modificar habilidades, reservas, créditos o calificaciones.

Errores estándar: 401 sesión expirada; 403 sin permiso; 400 datos inválidos; 503 temporal. Mensajes de error como `{"message":"…"}`. Antes de activar, verificar aislamiento entre usuarios y persistencia tras recarga.

## Validación

Pruebas de reglas, requisitos externos, orden, exclusión de electivas, separación de registros de tutorías, errores, persistencia local al navegar y respuestas tardías entre cuentas. Verificación visual en escritorio y móvil.
