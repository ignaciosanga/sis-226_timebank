# Nexo U: frontend del banco de tiempo

Pantallas universitarias para intercambiar habilidades por tiempo, con el diseño
Red universitaria y la identidad UCB.

## Ejecutar desde esta carpeta

```bash
npm install
npm run dev
```

## Pantallas

- Habilidades: `/`.
- Registro de estudiantes con validaciones: `/registro`.
- Disponibilidad: `/disponibilidad`.
- Solicitudes: `/intercambios`.
- Reservas: `/intercambios?tab=reservas` (o `/reservas`).
- Créditos y movimientos: `/creditos`.
- Perfil y habilidades propias: `/perfil`.
- Alta, baja y reactivación de usuarios: `/administracion`.

## Comprobar

```bash
npm test
npm run build
```

## Alcance actual

Las pantallas tienen un flujo demostrativo explícito. Los intercambios se
reinician al recargar; las altas/bajas administrativas se conservan solo en el
navegador. No se guardan contraseñas. El registro no crea cuentas ni inicia sesión
real. Para explorar las acciones privadas, usa **Ingresar → Explorar como Valeria**.

Un crédito equivale a 15 minutos. Aceptar una solicitud genera una reserva y
retiene créditos; cancelar antes del inicio los libera. La segunda confirmación,
después del fin, completa el intercambio y transfiere los créditos una sola vez.

El equipo de APIs e Implementación es responsable de `src/services`. Esta entrega
no modifica esa carpeta ni implementa conexiones a Backend o PostgreSQL.
El contrato vigente está en `../backend/docs/frontend-integration.md`.

Consulta [Pantallas y entrega a APIs](docs/pantallas-timebank.md) para los estados,
campos, límites y puntos de integración pendientes.
