<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight, Info, Search, UserMinus, UserPlus, UsersRound, X } from '@lucide/vue'
import AdminDialog from '../features/admin/AdminDialog.vue'
import {
  CAREERS, DEMO_ADMIN_ID, AdminUserError, addAdminUser, deactivateAdminUser,
  filterAdminUsers, loadAdminUsers, saveAdminUsers,
} from '../features/admin/user-management'
import '../styles/admin.css'

const users = ref([])
const ready = ref(false)
const storageError = ref('')
const query = ref('')
const status = ref('Todos')
const page = ref(1)
const pageSize = 6
const feedback = ref('')
const dialogMode = ref(null)
const selectedId = ref(null)
const errors = ref({})
const operationError = ref('')
const reason = ref('')
const createForm = ref(null)
const form = reactive({ nombre: '', apellido: '', correo: '', carrera: '', semestre: '' })
const filtered = computed(() => filterAdminUsers(users.value, query.value, status.value))
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const pageUsers = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const selectedUser = computed(() => users.value.find((user) => user.id === selectedId.value))
const tabs = computed(() => [
  { value: 'Todos', label: 'Todos', count: users.value.length },
  { value: 'Activo', label: 'Activos', count: users.value.filter((user) => user.estado === 'Activo').length },
  { value: 'Inactivo', label: 'Inactivos', count: users.value.filter((user) => user.estado === 'Inactivo').length },
])
const dateFormatter = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/La_Paz' })
const formatDate = (value) => dateFormatter.format(new Date(value))
const initials = (user) => `${user.nombre.charAt(0)}${user.apellido.charAt(0)}`.toUpperCase()

function hydrate() {
  try {
    users.value = loadAdminUsers(window.localStorage)
    ready.value = true
    storageError.value = ''
  } catch {
    ready.value = false
    storageError.value = 'No pudimos recuperar los usuarios guardados. Revisa que el almacenamiento del navegador esté disponible. Tus datos no se han reemplazado.'
  }
}
onMounted(hydrate)
watch([query, status], () => { page.value = 1 })
watch(pageCount, (count) => { page.value = Math.min(page.value, count) })

function clearFilters() {
  query.value = ''
  status.value = 'Todos'
  page.value = 1
}
function closeDialog() {
  dialogMode.value = null
  selectedId.value = null
  errors.value = {}
  operationError.value = ''
}
function openCreate() {
  Object.assign(form, { nombre: '', apellido: '', correo: '', carrera: '', semestre: '' })
  errors.value = {}
  operationError.value = ''
  dialogMode.value = 'create'
}
function openDeactivate(user) {
  selectedId.value = user.id
  reason.value = ''
  operationError.value = ''
  dialogMode.value = 'deactivate'
}
async function submitCreate() {
  operationError.value = ''
  try {
    const snapshot = loadAdminUsers(window.localStorage)
    const result = addAdminUser(snapshot, form)
    if (result.errors) {
      errors.value = result.errors
      await nextTick()
      createForm.value?.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    saveAdminUsers(window.localStorage, result.users)
    users.value = result.users
    clearFilters()
    closeDialog()
    feedback.value = `${result.user.nombre} ${result.user.apellido} se agregó como estudiante activo en esta demostración.`
  } catch {
    operationError.value = 'No se pudo guardar el usuario en este navegador. Revisa el almacenamiento y vuelve a intentarlo.'
  }
}
function confirmDeactivate() {
  operationError.value = ''
  try {
    const snapshot = loadAdminUsers(window.localStorage)
    const result = deactivateAdminUser(snapshot, selectedId.value, reason.value)
    saveAdminUsers(window.localStorage, result.users)
    users.value = result.users
    closeDialog()
    feedback.value = `${result.user.nombre} ${result.user.apellido} pasó a Inactivo. Sus datos se conservaron en esta demostración.`
  } catch (error) {
    operationError.value = error instanceof AdminUserError ? error.message
      : 'No se pudo guardar la baja en este navegador. Revisa el almacenamiento y vuelve a intentarlo.'
  }
}
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-sidebar" aria-label="Sección de administración">
      <div class="admin-sidebar-title"><UsersRound :size="22" aria-hidden="true" /><span>Administración</span></div>
      <RouterLink class="admin-sidebar-current" to="/administracion" aria-current="page"><UsersRound :size="18" aria-hidden="true" />Usuarios</RouterLink>
      <p class="admin-sidebar-copy">Altas y bajas de quienes forman parte de Nexo U.</p>
      <RouterLink class="admin-back-link" to="/"><ArrowLeft :size="16" aria-hidden="true" />Volver a la comunidad</RouterLink>
    </aside>

    <section class="admin-workspace" aria-labelledby="admin-title">
      <header class="admin-page-header">
        <div><h1 id="admin-title">Usuarios</h1><p>Gestiona las altas y bajas de tu comunidad.</p></div>
        <button class="button button-primary" type="button" data-dialog-return-focus :disabled="!ready" @click="openCreate"><UserPlus :size="18" aria-hidden="true" />Agregar usuario</button>
      </header>

      <div class="admin-demo-note"><Info :size="19" aria-hidden="true" /><p><strong>Demostración.</strong> Los cambios se guardan solo en este navegador. No se crean ni modifican cuentas reales.</p></div>
      <p v-if="feedback" class="admin-feedback" role="status">{{ feedback }}</p>
      <div v-if="storageError" class="admin-load-error" role="alert"><p>{{ storageError }}</p><button class="button button-outline" type="button" @click="hydrate">Volver a intentar</button></div>
      <p v-else-if="!ready" class="admin-loading" role="status">Cargando usuarios…</p>

      <div v-else class="admin-directory">
        <div class="admin-toolbar">
          <div class="admin-status-filters" role="group" aria-label="Filtrar usuarios por estado">
            <button v-for="tab in tabs" :key="tab.value" type="button" :class="{ 'is-selected': status === tab.value }" :aria-pressed="status === tab.value" @click="status = tab.value">{{ tab.label }}<span>{{ tab.count }}</span></button>
          </div>
          <label class="admin-search"><Search :size="18" aria-hidden="true" /><input v-model="query" type="search" placeholder="Nombre, correo o carrera" aria-label="Buscar usuarios por nombre, correo o carrera" /><button v-if="query" type="button" aria-label="Limpiar búsqueda de usuarios" @click="query = ''"><X :size="16" /></button></label>
        </div>
        <p class="admin-results" role="status" aria-live="polite">{{ filtered.length }} {{ filtered.length === 1 ? 'usuario encontrado' : 'usuarios encontrados' }}</p>

        <div v-if="filtered.length" class="admin-table-wrap">
          <table class="admin-users-table">
            <caption class="sr-only">Usuarios de demostración de Nexo U. Consulta su estado y utiliza Dar de baja para desactivarlos.</caption>
            <colgroup><col class="admin-col-user" /><col class="admin-col-academic" /><col class="admin-col-status" /><col class="admin-col-date" /><col class="admin-col-action" /></colgroup>
            <thead><tr><th scope="col">Usuario</th><th scope="col">Información académica</th><th scope="col">Estado</th><th scope="col">Registro</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              <tr v-for="user in pageUsers" :key="user.id">
                <th scope="row" class="admin-user-cell"><div class="admin-user-identity"><span class="avatar admin-user-avatar" :class="{ 'admin-avatar-inactive': user.estado === 'Inactivo' }" aria-hidden="true">{{ initials(user) }}</span><span><strong>{{ user.nombre }} {{ user.apellido }}</strong><span class="admin-user-email">{{ user.correo }}</span><small v-if="user.rol === 'Administrador'" class="admin-role-label">Administrador de demostración</small></span></div></th>
                <td class="admin-academic-cell"><template v-if="user.rol === 'Estudiante'"><span>{{ user.carrera }}</span><small>{{ user.semestre }}.º semestre</small><small v-if="user.estado === 'Inactivo' && user.motivoBaja" class="admin-deactivation-reason">Motivo de baja: {{ user.motivoBaja }}</small></template><span v-else>Administración de la plataforma</span></td>
                <td class="admin-status-cell"><span class="admin-user-state" :class="user.estado === 'Activo' ? 'is-active' : 'is-inactive'"><i aria-hidden="true"></i>{{ user.estado }}</span><small v-if="user.fechaBaja">Baja: {{ formatDate(user.fechaBaja) }}</small></td>
                <td class="admin-date-cell"><span class="admin-mobile-label">Registro</span><time :datetime="user.fechaRegistro">{{ formatDate(user.fechaRegistro) }}</time></td>
                <td class="admin-action-cell"><button v-if="user.estado === 'Activo' && user.id !== DEMO_ADMIN_ID && user.rol !== 'Administrador'" class="admin-deactivate-button" type="button" :aria-label="`Dar de baja a ${user.nombre} ${user.apellido}`" @click="openDeactivate(user)"><UserMinus :size="16" aria-hidden="true" />Dar de baja</button><span v-else class="admin-action-note">{{ user.rol === 'Administrador' ? 'Cuenta protegida' : 'Baja registrada' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="admin-empty-state"><UsersRound :size="32" aria-hidden="true" /><h2>No encontramos usuarios</h2><p>Prueba con otro nombre, correo o estado.</p><button class="button button-outline" type="button" @click="clearFilters">Limpiar filtros</button></div>
        <footer v-if="filtered.length" class="admin-pagination"><p>Mostrando {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, filtered.length) }} de {{ filtered.length }}</p><nav aria-label="Páginas de usuarios"><button class="icon-button" type="button" :disabled="page === 1" aria-label="Página anterior de usuarios" @click="page--"><ChevronLeft :size="18" /></button><span aria-live="polite">{{ page }} de {{ pageCount }}</span><button class="icon-button" type="button" :disabled="page === pageCount" aria-label="Página siguiente de usuarios" @click="page++"><ChevronRight :size="18" /></button></nav></footer>
      </div>
      <p class="admin-preservation-note"><UserMinus :size="16" aria-hidden="true" />La baja cambia el estado a Inactivo y conserva el registro del usuario.</p>
    </section>

    <AdminDialog :open="dialogMode !== null" labelledby="admin-dialog-title" describedby="admin-dialog-description" @close="closeDialog">
      <template v-if="dialogMode === 'create'">
        <div class="admin-dialog-symbol"><UserPlus :size="24" aria-hidden="true" /></div>
        <h2 id="admin-dialog-title">Agregar usuario</h2>
        <p id="admin-dialog-description" class="admin-dialog-description">Registra un estudiante en esta demostración. Todos los campos son obligatorios.</p>
        <form ref="createForm" class="admin-user-form" novalidate @submit.prevent="submitCreate">
          <div class="admin-form-pair">
            <div class="admin-form-field"><label for="admin-first-name">Nombre</label><input id="admin-first-name" v-model="form.nombre" data-autofocus name="nombre" autocomplete="given-name" maxlength="80" required :aria-invalid="!!errors.nombre" :aria-describedby="errors.nombre ? 'admin-first-name-error' : undefined" /><small v-if="errors.nombre" id="admin-first-name-error" class="admin-field-error">{{ errors.nombre }}</small></div>
            <div class="admin-form-field"><label for="admin-last-name">Apellido</label><input id="admin-last-name" v-model="form.apellido" name="apellido" autocomplete="family-name" maxlength="80" required :aria-invalid="!!errors.apellido" :aria-describedby="errors.apellido ? 'admin-last-name-error' : undefined" /><small v-if="errors.apellido" id="admin-last-name-error" class="admin-field-error">{{ errors.apellido }}</small></div>
          </div>
          <div class="admin-form-field"><label for="admin-email">Correo electrónico</label><input id="admin-email" v-model="form.correo" name="correo" type="email" autocomplete="email" placeholder="nombre@ucb.edu.bo" maxlength="254" required :aria-invalid="!!errors.correo" :aria-describedby="errors.correo ? 'admin-email-error' : undefined" /><small v-if="errors.correo" id="admin-email-error" class="admin-field-error">{{ errors.correo }}</small></div>
          <div class="admin-form-field"><label for="admin-career">Carrera</label><select id="admin-career" v-model="form.carrera" name="carrera" required :aria-invalid="!!errors.carrera" :aria-describedby="errors.carrera ? 'admin-career-error' : undefined"><option disabled value="">Selecciona una carrera</option><option v-for="career in CAREERS" :key="career" :value="career">{{ career }}</option></select><small v-if="errors.carrera" id="admin-career-error" class="admin-field-error">{{ errors.carrera }}</small></div>
          <div class="admin-form-field"><label for="admin-semester">Semestre</label><select id="admin-semester" v-model="form.semestre" name="semestre" required :aria-invalid="!!errors.semestre" :aria-describedby="errors.semestre ? 'admin-semester-error' : undefined"><option disabled value="">Selecciona un semestre</option><option v-for="semester in 12" :key="semester" :value="semester">{{ semester }}.º semestre</option></select><small v-if="errors.semestre" id="admin-semester-error" class="admin-field-error">{{ errors.semestre }}</small></div>
          <p v-if="Object.keys(errors).length" class="admin-field-error" role="alert">Revisa los campos indicados antes de guardar.</p>
          <p v-if="operationError" class="admin-operation-error" role="alert">{{ operationError }}</p>
          <footer class="admin-dialog-actions"><button class="button button-outline" type="button" @click="closeDialog">Cancelar</button><button class="button button-primary" type="submit">Agregar usuario</button></footer>
        </form>
      </template>
      <template v-else-if="dialogMode === 'deactivate' && selectedUser">
        <div class="admin-dialog-symbol admin-dialog-symbol-danger"><UserMinus :size="24" aria-hidden="true" /></div>
        <h2 id="admin-dialog-title">Dar de baja a este usuario</h2>
        <p id="admin-dialog-description" class="admin-dialog-description">Pasará al estado Inactivo y seguirá apareciendo en el listado. Sus datos se conservarán en esta demostración.</p>
        <div class="admin-selected-user"><span class="avatar" aria-hidden="true">{{ initials(selectedUser) }}</span><div><strong>{{ selectedUser.nombre }} {{ selectedUser.apellido }}</strong><span>{{ selectedUser.correo }}</span></div></div>
        <form class="admin-user-form" @submit.prevent="confirmDeactivate">
          <div class="admin-form-field"><label for="admin-deactivation-reason">Motivo <span class="admin-optional">(opcional)</span></label><textarea id="admin-deactivation-reason" v-model="reason" name="motivo" rows="3" maxlength="300" aria-describedby="admin-reason-hint"></textarea><small id="admin-reason-hint" class="admin-field-hint">Hasta 300 caracteres. Se conservará junto a la baja.</small></div>
          <p v-if="operationError" class="admin-operation-error" role="alert">{{ operationError }}</p>
          <footer class="admin-dialog-actions"><button class="button button-outline" type="button" data-autofocus @click="closeDialog">Cancelar</button><button class="button admin-button-danger" type="submit">Confirmar baja</button></footer>
        </form>
      </template>
    </AdminDialog>
  </div>
</template>
