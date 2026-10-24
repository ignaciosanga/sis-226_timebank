<script setup>
import { ArrowDownRight, ArrowUpRight, Award, BookOpenCheck, CheckCircle2, Clock3, Download, Star, Target } from '@lucide/vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const metrics = [
  { key: 'enrolled', label: 'Cursos tomados', value: () => store.analytics.enrolled, change: '+3 este mes', icon: BookOpenCheck, tone: 'blue', up: true },
  { key: 'completed', label: 'Completados', value: () => store.analytics.completed, change: '+2 este mes', icon: CheckCircle2, tone: 'green', up: true },
  { key: 'success', label: 'Tasa de éxito', value: () => `${store.analytics.success}%`, change: '+4% vs. sep.', icon: Target, tone: 'yellow', up: true },
  { key: 'hours', label: 'Horas aprendidas', value: () => `${store.analytics.hours} h`, change: '2 h pendientes', icon: Clock3, tone: 'cyan', up: false },
]
</script>

<template>
  <div class="page-header analytics-header">
    <div><p class="eyebrow">RESUMEN PERSONAL</p><h1>Analíticas de aprendizaje</h1><p>Una vista clara de tu actividad, constancia y contribución a la comunidad.</p></div>
    <button class="button button-outline" type="button" @click="store.showToast('El reporte de demostración fue preparado.', 'info')"><Download :size="17" /> Descargar reporte</button>
  </div>

  <section class="metrics-grid" aria-label="Indicadores principales">
    <article v-for="metric in metrics" :key="metric.key" class="panel metric-card">
      <span class="stat-icon" :class="metric.tone"><component :is="metric.icon" :size="21" /></span>
      <p>{{ metric.label }}</p>
      <strong>{{ metric.value() }}</strong>
      <small :class="{ positive: metric.up, neutral: !metric.up }"><component :is="metric.up ? ArrowUpRight : ArrowDownRight" :size="15" />{{ metric.change }}</small>
    </article>
  </section>

  <div class="analytics-grid">
    <section class="panel chart-panel activity-chart">
      <div class="panel-title-row"><div><p class="panel-label">ÚLTIMOS 6 MESES</p><h2>Actividad de aprendizaje</h2></div><select aria-label="Periodo"><option>6 meses</option><option>12 meses</option></select></div>
      <div class="chart-summary"><strong>27 horas</strong><span><ArrowUpRight :size="15" /> 18% más actividad</span></div>
      <div class="bar-chart" role="img" aria-label="Actividad mensual: mayo 38, junio 56, julio 42, agosto 68, septiembre 78 y octubre 92 por ciento">
        <div class="chart-guides"><span></span><span></span><span></span><span></span></div>
        <div v-for="item in store.monthlyActivity" :key="item.month" class="bar-column">
          <div class="bar-value" :style="{ height: `${item.value}%` }"><span>{{ item.value }}</span></div>
          <small>{{ item.month }}</small>
        </div>
      </div>
    </section>

    <section class="panel completion-panel">
      <p class="panel-label">PROGRESO GENERAL</p><h2>Cursos completados</h2>
      <div class="donut" role="img" aria-label="Siete de diez cursos completados"><div><strong>7</strong><small>de 10</small></div></div>
      <div class="donut-legend"><span><i class="legend-complete"></i>Completados <strong>70%</strong></span><span><i class="legend-active"></i>En curso <strong>20%</strong></span><span><i class="legend-pending"></i>Pendientes <strong>10%</strong></span></div>
    </section>

    <section class="panel categories-panel">
      <div class="panel-title-row"><div><p class="panel-label">ÁREAS DE INTERÉS</p><h2>Tiempo por categoría</h2></div></div>
      <div class="category-progress"><div><span><strong>Tecnología</strong><small>8,5 horas</small></span><div><i style="width: 82%"></i></div></div><strong>35%</strong></div>
      <div class="category-progress"><div><span><strong>Negocios</strong><small>6,2 horas</small></span><div><i style="width: 64%"></i></div></div><strong>26%</strong></div>
      <div class="category-progress"><div><span><strong>Ciencias</strong><small>5,4 horas</small></span><div><i style="width: 52%"></i></div></div><strong>22%</strong></div>
      <div class="category-progress"><div><span><strong>Idiomas</strong><small>4,1 horas</small></span><div><i style="width: 40%"></i></div></div><strong>17%</strong></div>
    </section>

    <section class="panel impact-panel">
      <div class="impact-copy"><span class="impact-icon"><Award :size="25" /></span><div><p class="panel-label">TU IMPACTO</p><h2>También estás ayudando a otros</h2><p>Las clases que impartiste generaron <strong>12 horas</strong> de aprendizaje para 19 estudiantes.</p></div></div>
      <div class="impact-stats"><span><strong>4</strong><small>cursos impartidos</small></span><span><strong>4.9</strong><small>valoración promedio</small></span><span><strong>+40</strong><small>puntos obtenidos</small></span></div>
    </section>
  </div>
</template>
