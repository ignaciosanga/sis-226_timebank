<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, CheckCheck } from '@lucide/vue'
import { useNotificationsStore } from '../../stores/notifications'
import { NOTIFICATION_POLL_MS, badgeLabel, bellLabel, relativeTime, routeFor } from '../../features/notifications/notification-model.js'

const store = useNotificationsStore()
const router = useRouter()
const open = ref(false)
const root = ref(null)
const trigger = ref(null)
const now = ref(Date.now())
let timer = null

async function tick() {
  now.value = Date.now()
  if (document.visibilityState === 'hidden') return
  if (open.value) await store.refresh()
  else await store.refreshUnread()
}
function toggle() {
  open.value = !open.value
  if (open.value) { now.value = Date.now(); store.refresh() }
}
function close(returnFocus = false) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}
function onDocumentClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) close()
}
function onKeydown(event) {
  if (event.key === 'Escape' && open.value) close(true)
}
async function openItem(item) {
  await store.markRead(item.id)
  const target = routeFor(item.type)
  close()
  if (target) router.push(target)
}

onMounted(() => {
  store.refreshUnread()
  timer = window.setInterval(tick, NOTIFICATION_POLL_MS)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('visibilitychange', tick)
})
onBeforeUnmount(() => {
  window.clearInterval(timer)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('visibilitychange', tick)
  store.reset()
})
watch(() => router.currentRoute.value.fullPath, () => close())
</script>

<template>
  <div ref="root" class="notif-wrap" @keydown="onKeydown">
    <button ref="trigger" class="icon-button notif-trigger" type="button" aria-haspopup="dialog" :aria-expanded="open" aria-controls="notif-panel" :aria-label="bellLabel(store.unread)" @click="toggle">
      <Bell :size="18" />
      <span v-if="store.unread" class="notif-badge" aria-hidden="true">{{ badgeLabel(store.unread) }}</span>
    </button>
    <section v-if="open" id="notif-panel" class="notif-panel" role="dialog" aria-label="Notificaciones">
      <header class="notif-head">
        <h2>Notificaciones</h2>
        <button class="notif-readall" type="button" :disabled="!store.unread" @click="store.markAllRead"><CheckCheck :size="16" />Marcar todas como leídas</button>
      </header>
      <p v-if="store.state === 'loading'" class="notif-state" role="status">Cargando…</p>
      <div v-else-if="store.state === 'error'" class="notif-state" role="alert">
        <p>{{ store.error }}</p>
        <button class="notif-retry" type="button" @click="store.refresh">Reintentar</button>
      </div>
      <template v-else>
        <p v-if="store.error" class="notif-inline-error" role="alert">{{ store.error }}</p>
        <p v-if="!store.items.length" class="notif-state">No tienes notificaciones.</p>
        <ul v-else class="notif-list">
          <li v-for="item in store.items" :key="item.id">
            <button class="notif-item" :class="{ 'is-unread': !item.read }" type="button" @click="openItem(item)">
              <span v-if="!item.read" class="notif-dot" aria-hidden="true"></span>
              <span class="notif-body">
                <strong>{{ item.title }}</strong>
                <span>{{ item.message }}</span>
                <small>{{ relativeTime(item.createdAt, now) }}<template v-if="!item.read"> · Sin leer</template></small>
              </span>
            </button>
          </li>
        </ul>
        <button v-if="store.hasMore" class="notif-more" type="button" :disabled="store.loadingMore" @click="store.loadMore">{{ store.loadingMore ? 'Cargando…' : 'Ver más' }}</button>
      </template>
    </section>
  </div>
</template>

<style>
.notif-wrap { position: relative; }
.notif-trigger { position: relative; }
.notif-badge { position: absolute; top: -6px; right: -6px; display: grid; min-width: 19px; height: 19px; padding: 0 4px; place-items: center; border: 2px solid white; border-radius: 20px; background: #cc2438; color: white; font-size: .72rem; font-weight: 700; line-height: 1; }
.notif-panel { position: absolute; top: calc(100% + 10px); right: 0; z-index: 40; width: min(380px, calc(100vw - 24px)); max-height: min(70vh, 520px); overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-lg); }
.notif-head { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--line-soft); background: var(--surface); }
.notif-head h2 { margin: 0; font-size: 1.05rem; color: var(--ink); }
.notif-readall, .notif-retry, .notif-more { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--ucb-blue); font: inherit; font-size: .9rem; font-weight: 600; cursor: pointer; }
.notif-readall:disabled, .notif-more:disabled { color: var(--muted); cursor: default; }
.notif-readall:focus-visible, .notif-retry:focus-visible, .notif-more:focus-visible, .notif-item:focus-visible { outline: 3px solid var(--ucb-cyan); outline-offset: 2px; }
.notif-state { margin: 0; padding: 22px 16px; text-align: center; color: var(--muted); }
.notif-inline-error { margin: 0; padding: 8px 14px; background: #fdecee; color: #9a1b2b; font-size: .9rem; }
.notif-list { margin: 0; padding: 0; list-style: none; }
.notif-item { display: flex; width: 100%; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 0; border-bottom: 1px solid var(--line-soft); background: transparent; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.notif-item:hover { background: #f8fbfd; }
.notif-item.is-unread { background: #eef6fb; }
.notif-dot { flex: none; width: 9px; height: 9px; margin-top: 7px; border-radius: 50%; background: var(--ucb-blue); }
.notif-body { display: grid; gap: 2px; min-width: 0; }
.notif-body strong { font-size: .98rem; }
.notif-body span { color: var(--muted); font-size: .92rem; overflow-wrap: anywhere; }
.notif-body small { color: var(--muted); font-size: .8rem; }
.notif-more { display: block; width: 100%; padding: 12px; justify-content: center; }
</style>
