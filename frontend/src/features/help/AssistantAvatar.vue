<script setup>
import { computed } from 'vue'

const props = defineProps({
  estilo: { type: String, default: 'orbe' },
  color: { type: String, default: 'azul' },
  state: { type: String, default: 'idle' },
  size: { type: Number, default: 44 },
})
const STYLES = ['orbe', 'gota', 'burbuja', 'chispa']
const COLORS = ['azul', 'amarillo', 'verde', 'coral']
const classes = computed(() => [
  'nexo-avatar',
  `is-${STYLES.includes(props.estilo) ? props.estilo : 'orbe'}`,
  `tone-${COLORS.includes(props.color) ? props.color : 'azul'}`,
  `state-${props.state}`,
])
</script>

<template>
  <span :class="classes" :style="{ '--avatar-size': `${size}px` }" aria-hidden="true">
    <span class="nexo-avatar-body">
      <span class="nexo-avatar-face">
        <span class="nexo-avatar-eye"></span>
        <span class="nexo-avatar-eye"></span>
        <span class="nexo-avatar-cheek"></span>
        <span class="nexo-avatar-mouth"></span>
        <span class="nexo-avatar-cheek"></span>
      </span>
    </span>
    <span v-if="state === 'thinking'" class="nexo-avatar-dots"><i></i><i></i><i></i></span>
    <span v-if="state === 'sleeping'" class="nexo-avatar-z">z</span>
  </span>
</template>

<style>
.nexo-avatar { --avatar-size:44px; --tone:#7fb8e6; --tone-dark:#3d86c2; position:relative; display:inline-grid; place-items:center; width:var(--avatar-size); height:var(--avatar-size); flex-shrink:0; }
.nexo-avatar.tone-amarillo { --tone:#ffd659; --tone-dark:#e0a800; }
.nexo-avatar.tone-verde { --tone:#8fdcb8; --tone-dark:#3fae7f; }
.nexo-avatar.tone-coral { --tone:#ffab9e; --tone-dark:#e76f5f; }
.nexo-avatar-body { position:relative; display:grid; place-items:center; width:84%; height:84%; background:var(--tone); border:calc(var(--avatar-size) * .045) solid #fff; box-shadow:0 0 0 calc(var(--avatar-size) * .025) var(--tone-dark); animation:nexo-avatar-bob 3.4s ease-in-out infinite; }
.is-orbe .nexo-avatar-body { border-radius:50%; }
.is-burbuja .nexo-avatar-body { width:88%; height:74%; margin-bottom:10%; border-radius:40%; }
.is-burbuja::after { content:""; position:absolute; left:20%; bottom:3%; width:18%; height:18%; background:var(--tone); border-left:calc(var(--avatar-size) * .045) solid #fff; border-bottom:calc(var(--avatar-size) * .045) solid #fff; border-radius:0 0 0 100%; animation:nexo-avatar-bob 3.4s ease-in-out infinite; }
.is-gota .nexo-avatar-body { width:74%; height:74%; margin-top:10%; border-radius:0 50% 50% 50%; rotate:45deg; }
.is-gota .nexo-avatar-face { rotate:-45deg; }
.is-chispa .nexo-avatar-body { border-radius:46% 54% 52% 48% / 52% 46% 54% 48%; }
.is-chispa::before, .is-chispa::after { content:""; position:absolute; background:var(--tone-dark); clip-path:polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); animation:nexo-avatar-twinkle 2.4s ease-in-out infinite; }
.is-chispa::before { top:-4%; right:-2%; width:28%; height:28%; }
.is-chispa::after { bottom:2%; left:-4%; width:18%; height:18%; animation-delay:1.2s; }
.nexo-avatar-face { display:grid; grid-template-columns:repeat(3,auto); grid-template-rows:auto auto; align-items:center; justify-items:center; column-gap:calc(var(--avatar-size) * .05); row-gap:calc(var(--avatar-size) * .03); margin-top:calc(var(--avatar-size) * .05); transition:transform .25s ease; }
.nexo-avatar-eye { width:calc(var(--avatar-size) * .1); height:calc(var(--avatar-size) * .12); border-radius:50%; background:#1b1f24; animation:nexo-avatar-blink 4.2s infinite; }
.nexo-avatar-eye:nth-child(1) { grid-area:1 / 1; }
.nexo-avatar-eye:nth-child(2) { grid-area:1 / 3; }
.nexo-avatar-cheek:nth-child(3) { grid-area:2 / 1; }
.nexo-avatar-mouth { grid-area:2 / 2; }
.nexo-avatar-cheek:nth-child(5) { grid-area:2 / 3; }
.nexo-avatar-cheek { width:calc(var(--avatar-size) * .09); height:calc(var(--avatar-size) * .05); border-radius:50%; background:#ff8fa3; opacity:.55; }
.nexo-avatar-mouth { width:calc(var(--avatar-size) * .14); height:calc(var(--avatar-size) * .07); border:calc(var(--avatar-size) * .028) solid #1b1f24; border-top:0; border-radius:0 0 999px 999px; }
.state-thinking .nexo-avatar-face { transform:translate(calc(var(--avatar-size) * .04), calc(var(--avatar-size) * -.04)); }
.state-thinking .nexo-avatar-mouth { width:calc(var(--avatar-size) * .07); height:calc(var(--avatar-size) * .07); border-top:calc(var(--avatar-size) * .028) solid #1b1f24; border-radius:50%; }
.state-talking .nexo-avatar-mouth { animation:nexo-avatar-talk .3s ease-in-out infinite alternate; }
.state-sleeping .nexo-avatar-body { animation:nexo-avatar-breathe 4s ease-in-out infinite; }
.state-sleeping .nexo-avatar-eye { height:calc(var(--avatar-size) * .05); border-radius:0 0 999px 999px; background:transparent; border:calc(var(--avatar-size) * .025) solid #1b1f24; border-top:0; animation:none; }
.nexo-avatar-dots { position:absolute; top:-12%; right:-14%; display:flex; gap:calc(var(--avatar-size) * .04); padding:calc(var(--avatar-size) * .05) calc(var(--avatar-size) * .07); border-radius:999px; background:#fff; box-shadow:0 0 0 1px #d6e2ea; }
.nexo-avatar-dots i { width:calc(var(--avatar-size) * .06); height:calc(var(--avatar-size) * .06); border-radius:50%; background:#1b1f24; animation:nexo-avatar-dot 1s ease-in-out infinite; }
.nexo-avatar-dots i:nth-child(2) { animation-delay:.15s; }
.nexo-avatar-dots i:nth-child(3) { animation-delay:.3s; }
.nexo-avatar-z { position:absolute; top:-8%; right:-4%; color:#1b1f24; font:700 calc(var(--avatar-size) * .26) / 1 "Sora", sans-serif; animation:nexo-avatar-z 2.4s ease-in-out infinite; }
@keyframes nexo-avatar-bob { 0%,100% { translate:0 0; } 50% { translate:0 calc(var(--avatar-size) * -.035); } }
@keyframes nexo-avatar-blink { 0%,92%,100% { transform:scaleY(1); } 95% { transform:scaleY(.15); } }
@keyframes nexo-avatar-talk { from { height:calc(var(--avatar-size) * .05); } to { height:calc(var(--avatar-size) * .1); } }
@keyframes nexo-avatar-breathe { 0%,100% { scale:1; } 50% { scale:.96; } }
@keyframes nexo-avatar-dot { 0%,100% { opacity:.3; translate:0 0; } 50% { opacity:1; translate:0 -2px; } }
@keyframes nexo-avatar-twinkle { 0%,100% { opacity:.4; scale:.75; } 50% { opacity:1; scale:1.05; } }
@keyframes nexo-avatar-z { 0% { opacity:0; translate:0 4px; } 40% { opacity:1; } 100% { opacity:0; translate:6px -10px; } }
@media (prefers-reduced-motion:reduce) { .nexo-avatar, .nexo-avatar *, .nexo-avatar::before, .nexo-avatar::after { animation:none !important; } }
</style>
