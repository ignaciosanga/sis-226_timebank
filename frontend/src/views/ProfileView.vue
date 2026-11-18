<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowLeftRight,
  CalendarDays,
  GraduationCap,
  Pencil,
  Plus,
} from '@lucide/vue'
import { useAppStore } from '../stores/app'
import Dialog from '../features/admin/AdminDialog.vue'
import UcbLogo from '../components/ui/UcbLogo.vue'
import ReportPanel from '../features/metrics/ReportPanel.vue'
import CreditsView from './CreditsView.vue'
import RoadmapView from './RoadmapView.vue'
import { fullName, initials } from '../features/timebank/format'
import { levelLabel } from '../features/timebank/catalogs'
import CoursePublishDialog from '../features/curriculum/CoursePublishDialog.vue'

const store = useAppStore()
const route = useRoute()
const showingSummary = computed(() => route.name === 'student-metrics')
const showingRoadmap = computed(() => route.name === 'learning-path')
const showingProfile = computed(() => route.name === 'profile')

// Selección de materias del pensum; la publicación conserva el contrato de habilidades.
const open = ref(false)
function showForm() {
  if (store.requireSession()) open.value = true
}

// Retiro de habilidades.
const removeOpen = ref(false)
const selectedSkill = ref(null)
const removeError = ref('')
const withdrawing = ref(false)

const selectedSkillName = computed(() => {
  if (!selectedSkill.value) return 'esta materia'

  return (
    store.findSkill(selectedSkill.value.id_habilidad)?.nombre ||
    'esta materia'
  )
})

function askRemove(row) {
  if (withdrawing.value || !store.requireSession()) return

  selectedSkill.value = row
  removeError.value = ''
  removeOpen.value = true
}

async function confirmRemove() {
  if (
    withdrawing.value ||
    !selectedSkill.value ||
    !store.requireSession()
  ) {
    return
  }

  withdrawing.value = true
  removeError.value = ''

  try {
    await store.removeSkill(selectedSkill.value.id_habilidad)

    removeOpen.value = false
    selectedSkill.value = null
    store.showToast('Materia retirada.')
  } catch (failure) {
    removeError.value = failure.message
  } finally {
    withdrawing.value = false
  }
}

// Edición del perfil existente.
const editOpen = ref(false)
const editError = ref('')
const saving = ref(false)

const edit = reactive({
  nombre: '',
  apellido: '',
  idCarrera: '',
  semestre: '',
})

const activeCareers = computed(() =>
  store.careers.filter((career) => career.estado === 'activo'),
)

function showEdit() {
  if (!store.requireSession()) return

  Object.assign(edit, {
    nombre: store.user.nombre,
    apellido: store.user.apellido,
    idCarrera: store.user.idCarrera ?? '',
    semestre: store.user.semestre ?? '',
  })

  editError.value = ''
  editOpen.value = true
}

async function saveProfile() {
  if (saving.value || !store.requireSession()) return

  const nombre = edit.nombre.trim()
  const apellido = edit.apellido.trim()
  const semestre = Number(edit.semestre)

  if (
    !nombre ||
    !apellido ||
    nombre.length > 100 ||
    apellido.length > 100
  ) {
    editError.value =
      'Escribe tu nombre y tu apellido (hasta 100 caracteres).'
    return
  }

  if (
    !activeCareers.value.some(
      (career) => career.id_carrera === edit.idCarrera,
    )
  ) {
    editError.value = 'Selecciona una carrera activa.'
    return
  }

  if (
    !Number.isInteger(semestre) ||
    semestre < 1 ||
    semestre > 12
  ) {
    editError.value = 'Selecciona un semestre entre 1 y 12.'
    return
  }

  saving.value = true
  editError.value = ''

  try {
    await store.updateProfile({
      nombre,
      apellido,
      idCarrera: edit.idCarrera,
      semestre,
    })

    editOpen.value = false
  } catch (failure) {
    editError.value = failure.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="profile-layout" :class="{ 'profile-layout-wide': !showingProfile }">
    <section class="profile-main">
      <article v-if="!showingRoadmap" class="panel profile-hero">
        <div class="profile-banner">
          <div class="banner-pattern"></div>
        </div>

        <div class="profile-identity">
          <span class="avatar avatar-xl">
            {{ initials(store.user) }}
          </span>

          <div class="identity-copy">
            <div>
              <h1>{{ fullName(store.user) }}</h1>
              <p>{{ store.career }}</p>
              <small>
                {{ store.user.semestre }}.º semestre, UCB La Paz
              </small>
            </div>

            <UcbLogo />
          </div>

          <p class="profile-bio">
            Perfil de estudiante para explorar el intercambio de
            conocimientos en la comunidad universitaria.
          </p>

          <div class="profile-actions">
            <button
              class="button button-primary"
              type="button"
              aria-haspopup="dialog"
              @click="showForm"
            >
              <Plus :size="18" />
              Añadir habilidad
            </button>

            <button
              v-if="store.authenticated"
              class="button button-outline"
              type="button"
              @click="showEdit"
            >
              <Pencil :size="18" />
              Editar perfil
            </button>
          </div>
        </div>
      </article>

      <nav class="metrics-navigation profile-tabs" aria-label="Apartados de mi perfil">
        <RouterLink to="/perfil">Mi perfil</RouterLink>
        <RouterLink to="/perfil/ruta">Mi ruta</RouterLink>
        <RouterLink to="/perfil/resumen">Mi resumen</RouterLink>
        <RouterLink to="/perfil/creditos">Créditos</RouterLink>
      </nav>

      <section
        v-if="showingProfile"
        class="surface-section"
        aria-labelledby="my-skills-title"
      >
        <div class="section-heading">
          <div>
            <h2 id="my-skills-title">
              Materias que comparto
            </h2>
            <p>
              El conocimiento que pones a disposición de otros.
            </p>
          </div>

          <span class="subtle-label">
            {{ store.mySkills.length }}
          </span>
        </div>

        <article
          v-for="row in store.mySkills"
          :key="row.id_habilidad"
          class="profile-skill-row"
        >
          <span class="date-icon">
            <GraduationCap :size="23" />
          </span>

          <div>
            <h3>
              {{ store.findSkill(row.id_habilidad)?.nombre }}
            </h3>
            <p>{{ levelLabel(row.nivel) }}</p>
          </div>

          <button
            v-if="store.authenticated"
            class="button button-outline"
            type="button"
            :disabled="withdrawing"
            :aria-label="`Retirar ${
              store.findSkill(row.id_habilidad)?.nombre ||
              'habilidad'
            }`"
            @click="askRemove(row)"
          >
            Retirar materia
          </button>
        </article>

        <div
          v-if="!store.mySkills.length"
          class="empty-state"
        >
          <p>
            Aún no compartes materias. Elige una del pensum
            para empezar.
          </p>
        </div>
      </section>

      <RoadmapView v-else-if="showingRoadmap" />
      <ReportPanel v-else-if="showingSummary" audience="student" />
      <section v-else aria-label="Mis créditos">
        <CreditsView />
      </section>
    </section>

    <aside v-if="showingProfile" class="profile-side">
      <section class="profile-academic">
        <h2>Información académica</h2>

        <dl>
          <dt>Correo</dt>
          <dd>{{ store.user.correo }}</dd>

          <dt>Carrera</dt>
          <dd>{{ store.career }}</dd>

          <dt>Semestre</dt>
          <dd>{{ store.user.semestre }}.º semestre</dd>
        </dl>
      </section>

      <section class="community-credit-note">
        <h2>Tu participación</h2>

        <RouterLink
          class="profile-activity-link"
          to="/intercambios/mis-clases"
        >
          <ArrowLeftRight :size="19" />
          <span>Intercambios completados</span>
          <strong>
            {{
              store.myReservations.filter(
                (row) => row.estado === 'Completada',
              ).length
            }}
          </strong>
        </RouterLink>

        <RouterLink
          class="profile-activity-link"
          to="/disponibilidad"
        >
          <CalendarDays :size="19" />
          <span>Horarios publicados</span>
          <strong>{{ store.myAvailability.length }}</strong>
        </RouterLink>

        <RouterLink class="text-link" to="/perfil/creditos">
          {{ store.account.disponibles }} créditos disponibles
        </RouterLink>
      </section>
    </aside>
  </div>

  <CoursePublishDialog :open="open" @close="open = false" />

  <Dialog
    :open="removeOpen"
    labelledby="remove-skill-title"
    describedby="remove-skill-description"
    @close="!withdrawing && (removeOpen = false)"
  >
    <h2 id="remove-skill-title">Retirar materia</h2>

    <p id="remove-skill-description">
      ¿Quieres retirar {{ selectedSkillName }} de tus
      publicaciones?
    </p>

    <p
      v-if="removeError"
      class="notice notice-error"
      role="alert"
    >
      {{ removeError }}
    </p>

    <footer class="admin-dialog-actions">
      <button
        class="button button-outline"
        type="button"
        :disabled="withdrawing"
        @click="removeOpen = false"
      >
        Cancelar
      </button>

      <button
        class="button button-primary"
        type="button"
        :disabled="withdrawing"
        @click="confirmRemove"
      >
        {{ withdrawing ? 'Retirando…' : 'Retirar materia' }}
      </button>
    </footer>
  </Dialog>

  <Dialog
    :open="editOpen"
    labelledby="edit-profile-title"
    describedby="edit-profile-description"
    @close="!saving && (editOpen = false)"
  >
    <h2 id="edit-profile-title">Editar perfil</h2>

    <p id="edit-profile-description" class="lead-copy">
      Actualiza tus datos académicos. El correo no se puede
      cambiar.
    </p>

    <form
      class="flow-form"
      novalidate
      @submit.prevent="saveProfile"
    >
      <div class="field">
        <label for="edit-nombre">Nombre</label>
        <input
          id="edit-nombre"
          v-model="edit.nombre"
          maxlength="100"
          required
          :disabled="saving"
          data-autofocus
        />
      </div>

      <div class="field">
        <label for="edit-apellido">Apellido</label>
        <input
          id="edit-apellido"
          v-model="edit.apellido"
          maxlength="100"
          required
          :disabled="saving"
        />
      </div>

      <div class="field">
        <label for="edit-carrera">Carrera</label>

        <select
          id="edit-carrera"
          v-model="edit.idCarrera"
          required
          :disabled="saving"
        >
          <option disabled value="">
            Selecciona una carrera
          </option>

          <option
            v-for="career in activeCareers"
            :key="career.id_carrera"
            :value="career.id_carrera"
          >
            {{ career.nombre }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="edit-semestre">Semestre</label>

        <select
          id="edit-semestre"
          v-model="edit.semestre"
          required
          :disabled="saving"
        >
          <option disabled value="">
            Selecciona un semestre
          </option>

          <option
            v-for="number in 12"
            :key="number"
            :value="number"
          >
            {{ number }}.º semestre
          </option>
        </select>
      </div>

      <p
        v-if="editError"
        class="notice notice-error"
        role="alert"
      >
        {{ editError }}
      </p>

      <footer class="admin-dialog-actions">
        <button
          class="button button-outline"
          type="button"
          :disabled="saving"
          @click="editOpen = false"
        >
          Cancelar
        </button>

        <button
          class="button button-primary"
          type="submit"
          :disabled="saving"
        >
          {{ saving ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </footer>
    </form>
  </Dialog>
</template>

<style scoped>
.profile-skill-row {
  flex-wrap: wrap;
  gap: 1rem;
}
</style>