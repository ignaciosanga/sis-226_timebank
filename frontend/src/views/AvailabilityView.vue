<script setup>
import { computed, reactive, ref } from 'vue'
import { CalendarDays, Clock3 } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import Dialog from '../features/admin/AdminDialog.vue'
import {
  dateLabel,
  localDate,
  timeLabel,
} from '../features/timebank/format'

const store = useAppStore()

const feedback = ref('')
const busy = ref(false)
const slots = computed(() =>
  [...store.myAvailability].sort((a, b) => Date.parse(a.fecha_inicio) - Date.parse(b.fecha_inicio)),
)

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
      <p>Consulta y gestiona los horarios que ya publicaste.</p>
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

  <div class="schedule-workspace">
    <section
      class="availability-list"
      aria-labelledby="availability-list-title"
    >
      <div class="section-heading">
        <h2 id="availability-list-title">
          Horarios publicados
        </h2>

        <span class="subtle-label">
          {{ slots.length }} {{ slots.length === 1 ? 'bloque' : 'bloques' }}
        </span>
      </div>

      <article
        v-for="slot in slots"
        :key="slot.id_disponibilidad"
        class="availability-row"
      >
        <span class="date-icon">
          <CalendarDays :size="24" />
        </span>

        <div>
          <h3>{{ dateLabel(slot.fecha_inicio) }}</h3>

          <p>
            {{ timeLabel(slot.fecha_inicio) }}–
            <template
              v-if="
                localDate(slot.fecha_inicio) !==
                localDate(slot.fecha_fin)
              "
            >
              {{ dateLabel(slot.fecha_fin) }},
            </template>
            {{ timeLabel(slot.fecha_fin) }}
          </p>
        </div>

        <span
          class="state-label"
          :class="{
            'state-muted':
              Date.parse(slot.fecha_fin) <= Date.now(),
          }"
        >
          {{
            Date.parse(slot.fecha_fin) <= Date.now()
              ? 'Finalizado'
              : 'Disponible'
          }}
        </span>

        <div
          v-if="store.authenticated"
          class="slot-actions"
        >
          <button
            class="button button-outline"
            type="button"
            :disabled="busy"
            :aria-label="`Editar horario del ${dateLabel(
              slot.fecha_inicio,
            )} a las ${timeLabel(slot.fecha_inicio)}`"
            @click="openEdit(slot)"
          >
            Editar
          </button>

          <button
            class="button button-outline"
            type="button"
            :disabled="busy"
            :aria-label="`Desactivar horario del ${dateLabel(
              slot.fecha_inicio,
            )} a las ${timeLabel(slot.fecha_inicio)}`"
            @click="askDeactivate(slot)"
          >
            Desactivar
          </button>
        </div>
      </article>

      <div
        v-if="!slots.length"
        class="panel empty-state"
      >
        <CalendarDays :size="28" />
        <h3>Aún no tienes horarios publicados</h3>
        <p>La preparación de nuevas ofertas ahora está en Habilidades.</p>
        <RouterLink class="button button-outline" :to="{ name: 'home', query: { ofertar: '1' } }">Ir a Habilidades</RouterLink>
      </div>

      <p class="field-hint">
        Una reserva se genera después de aceptar una solicitud.
        Los horarios que respaldan reservas activas pueden
        tener restricciones para su edición o desactivación.
      </p>
    </section>
  </div>

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

<style scoped>
.availability-row {
  flex-wrap: wrap;
  gap: 1rem;
}

.slot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
