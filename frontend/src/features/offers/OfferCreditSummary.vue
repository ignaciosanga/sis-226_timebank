<script setup>
import { computed } from 'vue'
import { Coins } from '@lucide/vue'
import { tutorCreditCost } from './tutoring-model.js'
const props = defineProps({ credits: { type: [Number, String], default: null }, editable: Boolean, error: { type: String, default: '' } })
const emit = defineEmits(['update:credits'])
const amount = computed(() => tutorCreditCost(props.credits))
</script>

<template>
  <section class="tutor-offer-cost" aria-label="Costo de la clase">
    <div class="tutor-cost-label"><Coins :size="20" aria-hidden="true" /><h3>Costo de la clase</h3></div>
    <template v-if="editable">
      <label class="tutor-cost-input-label" for="offer-credit-cost">Costo total en créditos</label>
      <div class="tutor-cost-entry"><input id="offer-credit-cost" :value="credits ?? ''" form="tutor-offer-form" type="number" inputmode="numeric" min="1" step="1" required placeholder="Ej. 7" :aria-invalid="!!error" aria-describedby="offer-credit-hint offer-credit-error" @input="emit('update:credits', $event.target.value)" /><span>créditos</span></div>
      <p id="offer-credit-hint" class="tutor-cost-hint">Tú decides cuánto cuesta la clase completa. El precio es independiente de su duración.</p>
      <p v-if="error" id="offer-credit-error" class="field-error" role="alert">{{ error }}</p>
    </template>
    <template v-else>
      <output class="tutor-cost-total" aria-live="polite" aria-atomic="true"><strong>{{ amount ?? '—' }}</strong><span>{{ amount === 1 ? 'crédito' : 'créditos' }}</span></output>
      <p class="tutor-cost-hint">{{ amount === null ? 'El tutor aún no definió el costo.' : 'Precio total fijado por el tutor para esta clase.' }}</p>
    </template>
  </section>
</template>
