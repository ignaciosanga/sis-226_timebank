<script setup>
import { computed } from 'vue'
const props = defineProps({ kind: { type: String, required: true }, payload: { type: Object, default: null }, loading: Boolean, error: { type: String, default: '' } })
const rows = computed(() => Array.isArray(props.payload?.data) ? props.payload.data : [])
</script>
<template>
  <section class="vd-section">
    <h3>{{ kind === 'academic' ? 'Demanda y cobertura por materia' : 'Opiniones y clases por tutor' }}</h3>
    <p v-if="loading" role="status">Cargando información…</p><p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else-if="payload">
      <p class="field-hint">{{ kind === 'academic' ? 'El índice de brecha requiere la cantidad de solicitudes pendientes por materia. Mientras se publica ese indicador, aquí puedes consultar las solicitudes registradas y su cobertura en el período.' : 'El reconocimiento de alto impacto requiere indicadores de cumplimiento y un puntaje confirmado. Aquí puedes consultar las opiniones y clases completadas disponibles.' }}</p>
      <div v-if="rows.length" class="vd-table-wrap"><table class="vd-table"><thead><tr><th>Materia</th><template v-if="kind === 'academic'"><th>Solicitudes del período</th><th>Tutores activos</th><th>Cubiertas</th></template><template v-else><th>Tutor</th><th>Calificación</th><th>Opiniones</th><th>Tutorías completadas</th></template></tr></thead><tbody><tr v-for="(row, n) in rows" :key="`${row.codigo}:${row.tutor_id || n}`"><td>{{ row.codigo }} {{ row.nombre || '' }}</td><template v-if="kind === 'academic'"><td>{{ row.solicitudes ?? '—' }}</td><td>{{ row.tutores_activos ?? '—' }}</td><td>{{ row.cubiertas ?? '—' }}</td></template><template v-else><td>{{ row.tutor_nombre || row.tutor_id }}</td><td>{{ row.promedio == null ? 'Sin opiniones' : `${row.promedio} ★` }}</td><td>{{ row.opiniones ?? '—' }}</td><td>{{ row.tutorias_completadas ?? '—' }}</td></template></tr></tbody></table></div>
      <p v-else class="vd-empty">Todavía no hay actividad registrada para este informe.</p>
    </template>
  </section>
</template>
