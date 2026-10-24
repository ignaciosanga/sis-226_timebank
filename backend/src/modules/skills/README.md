# Módulo de habilidades v0.2

Implementado: catálogo activo, detalles, búsqueda, categoría y paginación; creación ADMIN con validación de categoría y unicidad. Controlador → servicio → puerto SKILLS_REPOSITORY → MemorySkillsRepository. Importa CategoriesModule para compartir su catálogo.

Las publicaciones de estudiantes viven en modules/user-skills y referencian este catálogo; no lo duplican. Ver [contrato API](../../../docs/api-contract.md) y [reporte](../../../docs/progress-v0.2.md).
