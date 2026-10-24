<script setup>
import { CalendarDays, Clock3, MapPin, Star, UsersRound, Video } from '@lucide/vue'
import { useAppStore } from '../../stores/app'

defineProps({
  course: { type: Object, required: true },
})

const store = useAppStore()
</script>

<template>
  <article class="course-card" :aria-labelledby="`course-title-${course.id}`">
    <div class="course-card-body">
      <header class="tutor-row">
        <span class="avatar tutor-avatar" :class="`avatar-${course.tone}`" aria-hidden="true">{{ course.initials }}</span>
        <span class="tutor-copy">
          <strong>{{ course.tutor }}</strong>
          <small>{{ course.career }}</small>
          <small class="tutor-offer">Comparte <strong>{{ course.subject }}</strong></small>
        </span>
        <span class="rating" :aria-label="`Valoración: ${course.rating} de 5, ${course.reviews} valoraciones`"><Star :size="14" fill="currentColor" aria-hidden="true" /> {{ course.rating }}<small>{{ course.reviews }} valoraciones</small></span>
      </header>

      <div class="course-topline">
        <span class="subject-pill">{{ course.format }}</span>
        <span class="course-tag">{{ course.tag }}</span>
      </div>
      <h3 :id="`course-title-${course.id}`">{{ course.title }}</h3>
      <p class="course-description">{{ course.description }}</p>

      <div class="course-meta">
        <span><CalendarDays :size="16" />{{ course.dateLabel }}</span>
        <span><Clock3 :size="16" />{{ course.time }} · {{ course.duration }}</span>
        <span><component :is="course.format === 'Virtual' ? Video : MapPin" :size="16" />{{ course.location }}</span>
        <span><UsersRound :size="16" />{{ course.seats }} cupos</span>
      </div>

      <div class="course-footer">
        <span class="points-price"><strong>{{ course.points }}</strong> puntos</span>
        <button
          class="button"
          :class="store.enrollmentIds.includes(course.id) ? 'button-enrolled' : 'button-primary'"
          type="button"
          :aria-label="`${store.enrollmentIds.includes(course.id) ? 'Ya inscrito en' : 'Inscribirme en'} ${course.title}`"
          @click="store.requestEnrollment(course.id)"
        >
          {{ store.enrollmentIds.includes(course.id) ? 'Ya inscrito' : 'Inscribirme' }}
        </button>
      </div>
    </div>
  </article>
</template>
