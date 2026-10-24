# Nexo U Mockup

Mockup funcional de una plataforma de aprendizaje entre pares para estudiantes de la Universidad Católica Boliviana, sede La Paz. La interfaz toma como referencia la organización de LinkedIn y aplica identidad visual institucional de la UCB.

## Funcionalidades

- Catálogo con búsqueda y filtros por modalidad y categoría.
- Inicio de sesión demostrativo al intentar inscribirse.
- Inscripción local y actualización inmediata de la agenda.
- Calendario de cursos elegidos.
- Perfil con carrera, intereses, reputación, puntos y cursos impartidos.
- Analíticas personales de aprendizaje y contribución.
- Diseño adaptable y navegación accesible.

## Tecnologías

- Vue 3 con Composition API.
- Vite.
- Vue Router.
- Pinia.
- Lucide Vue.
- CSS sin framework visual.

## Ejecución

```bash
npm install
npm run dev
```

Abrir la dirección indicada por Vite, normalmente `http://localhost:5173`.

## Compilación

```bash
npm run build
```

## Publicar en GitHub Pages

El proyecto incluye `.github/workflows/deploy.yml`, que compila y publica el sitio
cuando se suben cambios a `main`. GitHub instala pnpm automáticamente; en tu
computador puedes seguir usando `npm run dev`.

1. En GitHub, abre **Settings → Pages** del repositorio.
2. En **Build and deployment → Source**, selecciona **GitHub Actions**.
3. Sube los cambios a la rama `main`:

   ```bash
   git add .github/workflows/deploy.yml vite.config.js src/router/index.js src/components/ui/UcbLogo.vue README.md
   git commit -m "Configurar publicacion en GitHub Pages"
   git push origin main
   ```

4. En la pestaña **Actions**, espera a que **Publicar en GitHub Pages** termine
   correctamente. Si los cambios ya estaban subidos antes de activar Pages,
   ejecuta el flujo con **Run workflow**.

La dirección será:
https://migusaper1530.github.io/front_end_decisiones_gerenciales/

La navegación utiliza `#` (por ejemplo, `/#/perfil`) para permitir abrir enlaces
y recargar las páginas internas en GitHub Pages.

## Acceso demostrativo

El correo aparece precargado y cualquier contraseña permite continuar. No existe autenticación real ni se envían credenciales.

## Integración futura

Los datos de prueba se encuentran en `src/data/mockData.js`. El estado demostrativo está en `src/stores/app.js` y el cliente HTTP base en `src/services/api.js`. Consulta `docs/integracion-api.md` para los contratos propuestos.

## Alcance

Este proyecto es un mockup de Frontend. No implementa autenticación, persistencia, cálculos analíticos del servidor ni base de datos.
