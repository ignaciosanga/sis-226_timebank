<script setup>
import { computed, reactive, ref } from 'vue'
import { Clock3 } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import Dialog from '../features/admin/AdminDialog.vue'
import {
  dateLabel,
  timeLabel,
} from '../features/timebank/format'

import ScheduleCalendar from '../features/timebank/ScheduleCalendar.vue'
import { scheduleEvents } from '../features/timebank/schedule-calendar.js'

const store = useAppStore()

const feedback = ref('')
const busy = ref(false)
const events = computed(() => scheduleEvents({
  userId: store.user.id,
  requests: store.myRequests,
  reservations: store.myReservations,
  availability: store.myAvailability,
  findSkill: (id) => store.findSkill(id),
  findUser: (id) => store.findUser(id),
}))

// Edición y desactivación.
const editOpen = ref(false)
const deactivateOpen = ref(false)
const selectedId = ref('')
const dialogError = ref('')

const edit = reactive({
  start: '',
  end: '',
})

// Convierte UTC a los valores del formulario en horario de La Paz.
function toInput(value) {
  const offset = 4 * 60 * 60 * 1000
  return new Date(Date.parse(value) - offset)
    .toISOString()
    .slice(0, 23)
}

function openEdit(slot) {
  if (busy.value || !store.requireSession()) return

  selectedId.value = slot.id_disponibilidad
  edit.start = toInput(slot.fecha_inicio)
  edit.end = toInput(slot.fecha_fin)

  dialogError.value = ''
  editOpen.value = true
}

async function saveEdit() {
  if (busy.value || !store.requireSession()) return

  dialogError.value = ''
  feedback.value = ''
  busy.value = true

  try {
    // La zona se indica explícitamente para evitar usar
    // la zona horaria configurada en la computadora.
    const start = Date.parse(`${edit.start}-04:00`)
    const end = Date.parse(`${edit.end}-04:00`)

    if (
      !edit.start ||
      !edit.end ||
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    ) {
      throw new Error('Ingresa fechas y horas válidas.')
    }

    if (end <= start) {
      throw new Error('El fin debe ser posterior al inicio.')
    }

    await store.updateAvailability(selectedId.value, {
      fechaInicio: new Date(start).toISOString(),
      fechaFin: new Date(end).toISOString(),
    })

    editOpen.value = false
    feedback.value = 'El horario se actualizó.'
  } catch (failure) {
    dialogError.value = failure.message
  } finally {
    busy.value = false
  }
}

function askDeactivate(slot) {
  if (busy.value || !store.requireSession()) return

  selectedId.value = slot.id_disponibilidad
  dialogError.value = ''
  deactivateOpen.value = true
}

async function deactivate() {
  if (busy.value || !store.requireSession()) return

  dialogError.value = ''
  feedback.value = ''
  busy.value = true

  try {
    await store.deactivateAvailability(selectedId.value)

    deactivateOpen.value = false
    feedback.value = 'El horario se desactivó.'
  } catch (failure) {
    dialogError.value = failure.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <header class="workspace-header">
    <div>
      <h1>Mis horarios</h1>
      <p>Consulta tus solicitudes, reservas y horarios para dar tutoría.</p>
    </div>

    <span class="subtle-label">
      <Clock3 :size="17" />
      Horario de La Paz (UTC−4)
    </span>
  </header>

  <p
    v-if="feedback"
    class="notice notice-success"
    role="status"
  >
    {{ feedback }}
  </p>

  <section aria-labelledby="availability-list-title">
    <div class="section-heading">
      <h2 id="availability-list-title">Horarios publicados</h2>
      <span class="subtle-label">Tu agenda de intercambios y tutorías</span>
    </div>
    <ScheduleCalendar :events="events" :busy="busy" @edit="openEdit" @deactivate="askDeactivate" />
    <p class="field-hint" style="margin-top:18px">Una solicitud enviada está pendiente de respuesta. La reserva se confirma cuando el tutor la acepta. Los horarios con reservas activas pueden tener restricciones para editarse o desactivarse.</p>
  </section>

  <Dialog
    :open="editOpen"
    labelledby="edit-availability-title"
    describedby="edit-availability-description"
    @close="!busy && (editOpen = false)"
  >
    <h2 id="edit-availability-title">Editar horario</h2>

    <p id="edit-availability-description">
      Actualiza el intervalo en horario de La Paz (UTC−4).
    </p>

    <form class="flow-form" @submit.prevent="saveEdit">
      <div class="field">
        <label for="edit-start">
          Fecha y hora de inicio
        </label>

        <input
          id="edit-start"
          v-model="edit.start"
          type="datetime-local"
          step="0.001"
          required
          :disabled="busy"
          data-autofocus
        />
      </div>

      <div class="field">
        <label for="edit-end">
          Fecha y hora de fin
        </label>

        <input
          id="edit-end"
          v-model="edit.end"
          type="datetime-local"
          step="0.001"
          required
          :disabled="busy"
        />
      </div>

      <p
        v-if="dialogError"
        class="notice notice-error"
        role="alert"
      >
        {{ dialogError }}
      </p>

      <footer class="admin-dialog-actions">
        <button
          class="button button-outline"
          type="button"
          :disabled="busy"
          @click="editOpen = false"
        >
          Cancelar
        </button>

        <button
          class="button button-primary"
          type="submit"
          :disabled="busy"
        >
          {{ busy ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </footer>
    </form>
  </Dialog>

  <Dialog
    :open="deactivateOpen"
    labelledby="deactivate-title"
    describedby="deactivate-description"
    @close="!busy && (deactivateOpen = false)"
  >
    <h2 id="deactivate-title">Desactivar horario</h2>

    <p id="deactivate-description">
      ¿Quieres dejar de ofrecer este horario? Dejará de aparecer
      entre tus horarios disponibles.
    </p>

    <p
      v-if="dialogError"
      class="notice notice-error"
      role="alert"
    >
      {{ dialogError }}
    </p>

    <footer class="admin-dialog-actions">
      <button
        class="button button-outline"
        type="button"
        :disabled="busy"
        @click="deactivateOpen = false"
      >
        Cancelar
      </button>

      <button
        class="button button-primary"
        type="button"
        :disabled="busy"
        @click="deactivate"
      >
        {{ busy ? 'Desactivando…' : 'Desactivar horario' }}
      </button>
    </footer>
  </Dialog>
</template>
