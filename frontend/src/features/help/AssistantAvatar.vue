<script setup>
import { computed, useId } from 'vue'
import { AVATAR_ACCESSORIES, AVATAR_COLORS, AVATAR_STYLES, avatarTone, pick } from './avatar-options.js'

const props = defineProps({
  estilo: { type: String, default: 'bolita' },
  color: { type: String, default: 'azul' },
  accesorio: { type: String, default: 'chispa' },
  state: { type: String, default: 'idle' },
  size: { type: Number, default: 44 },
})
const STATES = ['idle', 'thinking', 'talking', 'happy', 'sleeping', 'error']
const clipId = `nexo-avatar-${useId()}`
const shape = computed(() => pick(AVATAR_STYLES, props.estilo))
const accessory = computed(() => pick(AVATAR_ACCESSORIES, props.accesorio, 'chispa'))
const tone = computed(() => avatarTone(pick(AVATAR_COLORS, props.color)))
const mood = computed(() => pick(STATES, props.state))
const top = computed(() => (shape.value === 'gota' ? 22 : 30))
const eyeY = computed(() => ({ gota: 96, burbuja: 84 })[shape.value] ?? 90)
const bodyPath = computed(() => ({
  bolita: 'M10 90a60 60 0 1 0 120 0a60 60 0 1 0-120 0Z',
  cuadradito: 'M52 32h36a40 40 0 0 1 40 40v36a40 40 0 0 1-40 40H52a40 40 0 0 1-40-40V72a40 40 0 0 1 40-40Z',
  burbuja: 'M58 30H82A48 48 0 0 1 130 78V88A48 48 0 0 1 82 136H58A48 48 0 0 1 10 88V78A48 48 0 0 1 58 30ZM20 154L30.2 124H54Z',
  gota: 'M70 24.5L106.8 61.2A52 52 0 1 1 33.2 61.2Z',
})[shape.value])
const classes = computed(() => ['nexo-avatar', `state-${mood.value}`])
</script>

<template>
  <span :class="classes" :style="{ '--avatar-size': `${size}px` }" aria-hidden="true">
    <svg class="nexo-avatar-art" viewBox="-13 -12 166 166" focusable="false">
      <defs><clipPath :id="clipId"><path :d="bodyPath" /></clipPath></defs>
      <g class="nexo-avatar-figure">
        <g v-if="accessory === 'audifonos'" class="nexo-avatar-band"><path :d="`M9.5 ${top + 66}V${top + 50}a60.5 60.5 0 0 1 121 0v${16}`" /></g>
        <path :d="bodyPath" :fill="tone" />
        <path :d="bodyPath" class="nexo-avatar-shade" />
        <path :d="bodyPath" :fill="tone" transform="translate(0 -10)" :clip-path="`url(#${clipId})`" />
        <g v-if="accessory === 'chispa'" class="nexo-avatar-spark">
          <path :d="`M70 4V${top + 2}`" class="nexo-avatar-stroke" stroke-width="4" />
          <polygon points="70,-12 73.84,0.16 86,4 73.84,7.84 70,20 66.16,7.84 54,4 66.16,0.16" fill="#f2b705" class="nexo-avatar-star" />
        </g>
        <g v-else-if="accessory === 'birrete'">
          <path :d="`M44 ${top - 2}h52v6a12 12 0 0 1-12 12H56a12 12 0 0 1-12-12Z`" fill="#1b1f24" />
          <polygon :points="`70,${top - 18} 122,${top - 2} 70,${top + 14} 18,${top - 2}`" fill="#1b1f24" />
          <path :d="`M70.5 ${top - 2.5}H117.5`" stroke="#f2b705" stroke-width="3" stroke-linecap="round" />
          <g class="nexo-avatar-tassel"><path :d="`M117.5 ${top - 2.5}V${top + 24}`" stroke="#f2b705" stroke-width="3" stroke-linecap="round" /><circle cx="117.5" :cy="top + 27.5" r="5.5" fill="#f2b705" /></g>
        </g>
        <g v-else-if="accessory === 'audifonos'" fill="#1b1f24">
          <rect x="0" :y="top + 46" width="20" height="38" rx="10" />
          <rect x="120" :y="top + 46" width="20" height="38" rx="10" />
        </g>
        <g class="nexo-avatar-eyes">
          <template v-if="mood === 'happy'">
            <path v-for="x in [51, 89]" :key="x" :d="`M${x - 10} ${eyeY + 3}a10 10 0 0 1 20 0`" class="nexo-avatar-stroke" stroke-width="6" />
          </template>
          <template v-else-if="mood === 'sleeping'">
            <path v-for="x in [51, 89]" :key="x" :d="`M${x - 9} ${eyeY + 5}a9 9 0 0 0 18 0`" class="nexo-avatar-stroke" stroke-width="5" />
          </template>
          <template v-else-if="mood === 'error'">
            <path :d="`M43 ${eyeY - 8}L58 ${eyeY}L43 ${eyeY + 8}`" class="nexo-avatar-stroke" stroke-width="6" />
            <path :d="`M97 ${eyeY - 8}L82 ${eyeY}L97 ${eyeY + 8}`" class="nexo-avatar-stroke" stroke-width="6" />
          </template>
          <template v-else-if="mood === 'thinking'">
            <ellipse v-for="x in [51, 89]" :key="x" :cx="x + 5" :cy="eyeY - 13" rx="9" ry="13" fill="#1b1f24" />
          </template>
          <template v-else>
            <ellipse v-for="x in [51, 89]" :key="x" :cx="x" :cy="eyeY" rx="10" :ry="mood === 'talking' ? 13 : 16" fill="#1b1f24" class="nexo-avatar-eye" />
          </template>
        </g>
      </g>
    </svg>
    <span v-if="mood === 'thinking'" class="nexo-avatar-dots"><i></i><i></i><i></i></span>
    <span v-if="mood === 'sleeping'" class="nexo-avatar-z">z</span>
  </span>
</template>

<style>
.nexo-avatar { --avatar-size:44px; position:relative; display:inline-grid; place-items:center; width:var(--avatar-size); height:var(--avatar-size); flex-shrink:0; }
.nexo-avatar-art { display:block; width:100%; height:100%; overflow:visible; }
.nexo-avatar-figure { transform-box:fill-box; transform-origin:50% 100%; animation:nexo-avatar-float 3.4s ease-in-out infinite; }
.nexo-avatar-shade { fill:#1b1f24; opacity:.08; }
.nexo-avatar-stroke { fill:none; stroke:#1b1f24; stroke-linecap:round; stroke-linejoin:round; }
.nexo-avatar-band path { fill:none; stroke:#1b1f24; stroke-width:7; }
.nexo-avatar-eye { transform-box:fill-box; transform-origin:center; animation:nexo-avatar-blink 4.2s infinite; }
.nexo-avatar-star { transform-box:fill-box; transform-origin:center; animation:nexo-avatar-twinkle 2.6s ease-in-out infinite; }
.nexo-avatar-tassel { transform-box:fill-box; transform-origin:50% 0; animation:nexo-avatar-swing 3s ease-in-out infinite; }
.state-thinking .nexo-avatar-figure { animation:nexo-avatar-tilt 2.4s ease-in-out infinite; }
.state-talking .nexo-avatar-figure { animation:nexo-avatar-bob .5s ease-in-out infinite alternate; }
.state-talking .nexo-avatar-eye { animation:nexo-avatar-talk .5s ease-in-out infinite alternate; }
.state-happy .nexo-avatar-figure { animation:nexo-avatar-hop 1.2s ease-in-out infinite; }
.state-sleeping .nexo-avatar-figure { animation:nexo-avatar-breathe 3.2s ease-in-out infinite; }
.state-sleeping .nexo-avatar-star { opacity:.35; animation:none; }
.state-error .nexo-avatar-figure { animation:nexo-avatar-shake 1.6s ease-in-out infinite; }
.nexo-avatar-dots { position:absolute; top:-12%; right:-16%; display:flex; gap:calc(var(--avatar-size) * .04); padding:calc(var(--avatar-size) * .05) calc(var(--avatar-size) * .07); border-radius:999px; background:#fff; box-shadow:0 0 0 1px #d6e2ea; }
.nexo-avatar-dots i { width:calc(var(--avatar-size) * .06); height:calc(var(--avatar-size) * .06); border-radius:50%; background:#1b1f24; animation:nexo-avatar-dot 1s ease-in-out infinite; }
.nexo-avatar-dots i:nth-child(2) { animation-delay:.15s; }
.nexo-avatar-dots i:nth-child(3) { animation-delay:.3s; }
.nexo-avatar-z { position:absolute; top:-10%; right:-8%; color:#1b1f24; font:700 calc(var(--avatar-size) * .26) / 1 "Sora", sans-serif; animation:nexo-avatar-z 2.4s ease-in-out infinite; }
@keyframes nexo-avatar-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4%); } }
@keyframes nexo-avatar-blink { 0%,90%,100% { transform:scaleY(1); } 94% { transform:scaleY(.1); } }
@keyframes nexo-avatar-talk { from { transform:scaleY(1); } to { transform:scaleY(.7); } }
@keyframes nexo-avatar-bob { from { transform:translateY(0); } to { transform:translateY(-4%); } }
@keyframes nexo-avatar-hop { 0%,100% { transform:translateY(0); } 30% { transform:translateY(-10%); } 50% { transform:translateY(0); } }
@keyframes nexo-avatar-breathe { 0%,100% { transform:scale(1,1); } 50% { transform:scale(1.03,.97); } }
@keyframes nexo-avatar-tilt { 0%,100% { transform:rotate(0); } 50% { transform:rotate(-7deg); } }
@keyframes nexo-avatar-shake { 0%,60%,100% { transform:translateX(0); } 10%,30%,50% { transform:translateX(-3%); } 20%,40% { transform:translateX(3%); } }
@keyframes nexo-avatar-twinkle { 0%,100% { transform:scale(.85); } 50% { transform:scale(1.08); } }
@keyframes nexo-avatar-swing { 0%,100% { transform:rotate(0); } 50% { transform:rotate(-6deg); } }
@keyframes nexo-avatar-dot { 0%,100% { opacity:.3; translate:0 0; } 50% { opacity:1; translate:0 -2px; } }
@keyframes nexo-avatar-z { 0% { opacity:0; translate:0 4px; } 40% { opacity:1; } 100% { opacity:0; translate:6px -10px; } }
@media (prefers-reduced-motion:reduce) { .nexo-avatar, .nexo-avatar * { animation:none !important; } }
</style>
