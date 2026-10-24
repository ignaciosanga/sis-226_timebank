<script setup>
import { CalendarDays, Clock3, MapPin, Star, UsersRound, Video } from '@lucide/vue'
import { useAppStore } from '../../stores/app'

const props = defineProps({
  course: { type: Object, required: true },
})

const store = useAppStore()
</script>

<template>
  <article class="course-card" :class="`tone-${course.tone}`">
    <div class="course-accent"></div>
    <div class="course-card-body">
      <div class="course-topline">
        <span class="subject-pill">{{ course.subject }}</span>
        <span class="course-tag">{{ course.tag }}</span>
      </div>
      <h3>{{ course.title }}</h3>
      <p class="course-description">{{ course.description }}</p>

      <div class="tutor-row">
        <span class="avatar tutor-avatar">{{ course.initials }}</span>
        <span>
          <strong>{{ course.tutor }}</strong>
          <small>{{ course.career }}</small>
        </span>
        <span class="rating"><Star :size="15" fill="currentColor" /> {{ course.rating }}</span>
      </div>

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
          :class="store.enrollmentIds.includes(course.id) ? 'button-enrolled' : 'button-outline'"
          type="button"
          @click="store.requestEnrollment(course.id)"
        >
          {{ store.enrollmentIds.includes(course.id) ? 'Ya inscrito' : 'Inscribirme' }}
        </button>
      </div>
    </div>
  </article>
</template>
