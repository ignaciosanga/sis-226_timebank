<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight, Coins, Search, UserCheck, UserMinus, UserPlus, UsersRound, X } from '@lucide/vue'
import AdminDialog from '../features/admin/AdminDialog.vue'
import AccountFields from '../features/auth/AccountFields.vue'
import { emptyAccountForm, toRegisterPayload, validateAccount } from '../features/auth/account-validation'
import { newIdempotencyKey } from '../services/api'
import * as admin from '../services/admin'
import { useAppStore } from '../stores/app'
import '../styles/admin.css'

const store = useAppStore()
const isAdmin = computed(() => store.authenticated && Array.isArray(store.user.roles) && store.user.roles.includes('ADMIN'))
const users = ref([])
const total = ref(0)
const pageCount = ref(1)
const ready = ref(false)
const loadError = ref('')
const query = ref('')
const status = ref('Todos')
const page = ref(1)
const pageSize = 6
const feedback = ref('')
const dialogMode = ref(null)
const selectedId = ref(null)
const errors = ref({})
const operationError = ref('')
const busy = ref(false)
const reason = ref('')
const grantAmount = ref('')
const grantReason = ref('')
let grantKey = ''
const createForm = ref(null)
const form = reactive(emptyAccountForm())
const filtered = computed(() => users.value)
const pageUsers = computed(() => users.value)
const selectedUser = computed(() => users.value.find((user) => user.id === selectedId.value))
const tabs = [
  { value: 'Todos', label: 'Todos' },
  { value: 'Activo', label: 'Activos' },
  { value: 'Inactivo', label: 'Inactivos' },
  { value: 'Suspendido', label: 'Suspendidos' },
]
const dateFormatter = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/La_Paz' })
const formatDate = (value) => dateFormatter.format(new Date(value))
const initials = (user) => `${user.nombre.charAt(0)}${user.apellido.charAt(0)}`.toUpperCase()
const careerName = (user) => store.careers.find((career) => career.id_carrera === user.idCarrera)?.nombre ?? 'Carrera no disponible'

// RF-16: el listado, la búsqueda y el filtro de estado los resuelve el backend.
async function load() {
  if (!isAdmin.value) return
  loadError.value = ''
  try {
    const result = await admin.listUsers({ page: page.value, limit: pageSize, search: query.value, estado: status.value })
    users.value = result.data
    total.value = result.meta.total
    pageCount.value = Math.max(1, result.meta.totalPages)
    ready.value = true
  } catch (failure) {
    ready.value = false
    loadError.value = failure.message
  }
}
watch(isAdmin, (value) => { if (value) load() }, { immediate: true })
let searchTimer
watch([query, status], () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { if (page.value === 1) load(); else page.value = 1 }, 300)
})
watch(page, load)

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
  form.password = ''
  form.confirmPassword = ''
}
function openCreate() {
  Object.assign(form, emptyAccountForm())
  errors.value = {}
  operationError.value = ''
  dialogMode.value = 'create'
}
function openDeactivate(user, mode = 'deactivate') {
  selectedId.value = user.id
  reason.value = ''
  operationError.value = ''
  dialogMode.value = mode
}
// RF-17: la clave se genera al abrir el diálogo y se reutiliza si el envío se reintenta.
function openGrant(user) {
  selectedId.value = user.id
  grantAmount.value = ''
  grantReason.value = ''
  grantKey = newIdempotencyKey()
  operationError.value = ''
  dialogMode.value = 'grant'
}
async function submitCreate() {
  operationError.value = ''
  const found = validateAccount(form, store.careers, { confirm: true })
  if (Object.keys(found).length) {
    errors.value = found
    await nextTick()
    createForm.value?.querySelector('[aria-invalid="true"]')?.focus()
    return
  }
  busy.value = true
  try {
    const created = await admin.createUser(toRegisterPayload(form))
    closeDialog()
    clearFilters()
    await load()
    feedback.value = `${created?.nombre ?? 'El estudiante'} ${created?.apellido ?? ''} se agregó como estudiante activo.`.replace(/\s+\./, '.')
  } catch (failure) {
    operationError.value = failure.message
  } finally { busy.value = false }
}
async function confirmDeactivate() {
  operationError.value = ''
  const reactivating = dialogMode.value === 'reactivate'
  const user = selectedUser.value
  busy.value = true
  try {
    await admin.setUserStatus(selectedId.value, reactivating ? { estado: 'Activo' } : { estado: 'Inactivo', ...(reason.value.trim() && { motivo: reason.value.trim() }) })
    closeDialog()
    await load()
    feedback.value = `${user.nombre} ${user.apellido} pasó a ${reactivating ? 'Activo' : 'Inactivo'}. Sus datos se conservaron.`
  } catch (failure) {
    operationError.value = failure.message
  } finally { busy.value = false }
}
async function confirmGrant() {
  operationError.value = ''
  const amount = grantAmount.value.trim(), why = grantReason.value.trim(), user = selectedUser.value
  if (!/^\d+$/.test(amount) || Number(amount) < 1) { operationError.value = 'Escribe una cantidad entera de créditos (1 crédito = 15 minutos).'; return }
  if (!why || why.length > 500) { operationError.value = 'Escribe el motivo de la carga (hasta 500 caracteres).'; return }
  busy.value = true
  try {
    await admin.grantCredits({ userId: selectedId.value, amount, reason: why }, grantKey)
    closeDialog()
    feedback.value = `Se cargaron ${amount} créditos a ${user.nombre} ${user.apellido}.`
  } catch (failure) {
    operationError.value = failure.message
  } finally { busy.value = false }
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

      <p v-if="feedback" class="admin-feedback" role="status">{{ feedback }}</p>
      <div v-if="!isAdmin" class="admin-load-error" role="alert"><p>Solo los administradores pueden gestionar usuarios. Inicia sesión con una cuenta de administrador.</p></div>
      <div v-else-if="loadError" class="admin-load-error" role="alert"><p>{{ loadError }}</p><button class="button button-outline" type="button" @click="load">Volver a intentar</button></div>
      <p v-else-if="!ready" class="admin-loading" role="status">Cargando usuarios…</p>

      <div v-else class="admin-directory">
        <div class="admin-toolbar">
          <div class="admin-status-filters" role="group" aria-label="Filtrar usuarios por estado">
            <button v-for="tab in tabs" :key="tab.value" type="button" :class="{ 'is-selected': status === tab.value }" :aria-pressed="status === tab.value" @click="status = tab.value">{{ tab.label }}</button>
          </div>
          <label class="admin-search"><Search :size="18" aria-hidden="true" /><input v-model="query" type="search" placeholder="Nombre, correo o carrera" aria-label="Buscar usuarios por nombre, correo o carrera" /><button v-if="query" type="button" aria-label="Limpiar búsqueda de usuarios" @click="query = ''"><X :size="16" /></button></label>
        </div>
        <p class="admin-results" role="status" aria-live="polite">{{ total }} {{ total === 1 ? 'usuario encontrado' : 'usuarios encontrados' }}</p>

        <div v-if="total" class="admin-table-wrap">
          <table class="admin-users-table">
            <caption class="sr-only">Usuarios de Nexo U. Consulta su estado y utiliza Dar de baja para desactivarlos.</caption>
            <colgroup><col class="admin-col-user" /><col class="admin-col-academic" /><col class="admin-col-status" /><col class="admin-col-date" /><col class="admin-col-action" /></colgroup>
            <thead><tr><th scope="col">Usuario</th><th scope="col">Información académica</th><th scope="col">Estado</th><th scope="col">Registro</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              <tr v-for="user in pageUsers" :key="user.id">
                <th scope="row" class="admin-user-cell"><div class="admin-user-identity"><span class="avatar admin-user-avatar" :class="{ 'admin-avatar-inactive': user.estado === 'Inactivo' }" aria-hidden="true">{{ initials(user) }}</span><span><strong>{{ user.nombre }} {{ user.apellido }}</strong><span class="admin-user-email">{{ user.correo }}</span><small v-if="user.rol === 'Administrador'" class="admin-role-label">Administrador</small></span></div></th>
                <td class="admin-academic-cell"><template v-if="user.rol === 'Estudiante'"><span>{{ careerName(user) }}</span><small>{{ user.semestre }}.º semestre</small><small v-if="user.estado === 'Inactivo' && user.motivoBaja" class="admin-deactivation-reason">Motivo de baja: {{ user.motivoBaja }}</small></template><span v-else>Administración de la plataforma</span></td>
                <td class="admin-status-cell"><span class="admin-user-state" :class="user.estado === 'Activo' ? 'is-active' : 'is-inactive'"><i aria-hidden="true"></i>{{ user.estado }}</span><small v-if="user.estado === 'Inactivo' && user.fechaBaja">Baja: {{ formatDate(user.fechaBaja) }}</small></td>
                <td class="admin-date-cell"><span class="admin-mobile-label">Registro</span><time :datetime="user.fechaRegistro">{{ formatDate(user.fechaRegistro) }}</time></td>
                <td class="admin-action-cell"><button v-if="user.rol === 'Estudiante' && user.estado === 'Activo'" class="admin-reactivate-button" type="button" :aria-label="`Cargar créditos a ${user.nombre} ${user.apellido}`" @click="openGrant(user)"><Coins :size="16" aria-hidden="true" />Cargar créditos</button><button v-if="user.estado === 'Activo' && user.rol !== 'Administrador'" class="admin-deactivate-button" type="button" :aria-label="`Dar de baja a ${user.nombre} ${user.apellido}`" @click="openDeactivate(user)"><UserMinus :size="16" aria-hidden="true" />Dar de baja</button><button v-else-if="user.estado === 'Inactivo'" class="admin-reactivate-button" type="button" :aria-label="`Reactivar a ${user.nombre} ${user.apellido}`" @click="openDeactivate(user, 'reactivate')"><UserCheck :size="16" aria-hidden="true" />Reactivar</button><span v-else class="admin-action-note">{{ user.rol === 'Administrador' ? 'Cuenta protegida' : 'Requiere revisión' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="admin-empty-state"><UsersRound :size="32" aria-hidden="true" /><h2>No encontramos usuarios</h2><p>Prueba con otro nombre, correo o estado.</p><button class="button button-outline" type="button" @click="clearFilters">Limpiar filtros</button></div>
        <footer v-if="total" class="admin-pagination"><p>Mostrando {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, total) }} de {{ total }}</p><nav aria-label="Páginas de usuarios"><button class="icon-button" type="button" :disabled="page === 1" aria-label="Página anterior de usuarios" @click="page--"><ChevronLeft :size="18" /></button><span aria-live="polite">{{ page }} de {{ pageCount }}</span><button class="icon-button" type="button" :disabled="page === pageCount" aria-label="Página siguiente de usuarios" @click="page++"><ChevronRight :size="18" /></button></nav></footer>
      </div>
      <p class="admin-preservation-note"><UserMinus :size="16" aria-hidden="true" />La baja cambia el estado a Inactivo y conserva el registro del usuario.</p>
    </section>

    <AdminDialog :open="dialogMode !== null" labelledby="admin-dialog-title" describedby="admin-dialog-description" @close="closeDialog">
      <template v-if="dialogMode === 'create'">
        <div class="admin-dialog-symbol"><UserPlus :size="24" aria-hidden="true" /></div>
        <h2 id="admin-dialog-title">Agregar usuario</h2>
        <p id="admin-dialog-description" class="admin-dialog-description">Registra un estudiante. Todos los campos son obligatorios.</p>
        <form ref="createForm" class="admin-user-form" novalidate @submit.prevent="submitCreate">
          <AccountFields :form="form" :errors="errors" :careers="store.careers" :catalog-state="store.catalogState" prefix="admin-create" confirmation @retry="store.reloadDemoCareers" />
          <p v-if="Object.keys(errors).length" class="admin-field-error" role="alert">Revisa los campos indicados antes de guardar.</p>
          <p v-if="operationError" class="admin-operation-error" role="alert">{{ operationError }}</p>
          <footer class="admin-dialog-actions"><button class="button button-outline" type="button" @click="closeDialog">Cancelar</button><button class="button button-primary" type="submit" :disabled="busy || store.catalogState !== 'ready' || !store.careers.length">{{ busy ? 'Guardando…' : 'Agregar usuario' }}</button></footer>
        </form>
      </template>
      <template v-else-if="(dialogMode === 'deactivate' || dialogMode === 'reactivate') && selectedUser">
        <div class="admin-dialog-symbol admin-dialog-symbol-danger"><UserMinus :size="24" aria-hidden="true" /></div>
        <h2 id="admin-dialog-title">{{ dialogMode === 'reactivate' ? 'Reactivar usuario' : 'Dar de baja a este usuario' }}</h2>
        <p id="admin-dialog-description" class="admin-dialog-description">{{ dialogMode === 'reactivate' ? 'El usuario volverá al estado Activo.' : 'Pasará al estado Inactivo y seguirá apareciendo en el listado. Sus datos se conservarán.' }}</p>
        <div class="admin-selected-user"><span class="avatar" aria-hidden="true">{{ initials(selectedUser) }}</span><div><strong>{{ selectedUser.nombre }} {{ selectedUser.apellido }}</strong><span>{{ selectedUser.correo }}</span></div></div>
        <form class="admin-user-form" @submit.prevent="confirmDeactivate">
          <div v-if="dialogMode === 'deactivate'" class="admin-form-field"><label for="admin-deactivation-reason">Motivo <span class="admin-optional">(opcional)</span></label><textarea id="admin-deactivation-reason" v-model="reason" name="motivo" rows="3" maxlength="255" aria-describedby="admin-reason-hint"></textarea><small id="admin-reason-hint" class="admin-field-hint">Hasta 255 caracteres. Se conservará junto a la baja.</small></div>
          <p v-if="operationError" class="admin-operation-error" role="alert">{{ operationError }}</p>
          <footer class="admin-dialog-actions"><button class="button button-outline" type="button" data-autofocus @click="closeDialog">Cancelar</button><button class="button" :class="dialogMode === 'reactivate' ? 'button-primary' : 'admin-button-danger'" type="submit" :disabled="busy">{{ dialogMode === 'reactivate' ? 'Confirmar reactivación' : 'Confirmar baja' }}</button></footer>
        </form>
      </template>
      <template v-else-if="dialogMode === 'grant' && selectedUser">
        <div class="admin-dialog-symbol"><Coins :size="24" aria-hidden="true" /></div>
        <h2 id="admin-dialog-title">Cargar créditos</h2>
        <p id="admin-dialog-description" class="admin-dialog-description">Suma créditos de tiempo a la cuenta del estudiante. 1 crédito equivale a 15 minutos.</p>
        <div class="admin-selected-user"><span class="avatar" aria-hidden="true">{{ initials(selectedUser) }}</span><div><strong>{{ selectedUser.nombre }} {{ selectedUser.apellido }}</strong><span>{{ selectedUser.correo }}</span></div></div>
        <form class="admin-user-form" @submit.prevent="confirmGrant">
          <div class="admin-form-field"><label for="admin-grant-amount">Créditos</label><input id="admin-grant-amount" v-model="grantAmount" name="amount" inputmode="numeric" maxlength="16" required data-autofocus /></div>
          <div class="admin-form-field"><label for="admin-grant-reason">Motivo</label><textarea id="admin-grant-reason" v-model="grantReason" name="reason" rows="3" maxlength="500" required></textarea></div>
          <p v-if="operationError" class="admin-operation-error" role="alert">{{ operationError }}</p>
          <footer class="admin-dialog-actions"><button class="button button-outline" type="button" @click="closeDialog">Cancelar</button><button class="button button-primary" type="submit" :disabled="busy">{{ busy ? 'Cargando…' : 'Cargar créditos' }}</button></footer>
        </form>
      </template>
    </AdminDialog>
  </div>
</template>
