<script setup>
import { computed } from 'vue'
import { formatAnswer } from './answer-format.js'

const props = defineProps({ text: { type: String, default: '' } })
const blocks = computed(() => formatAnswer(props.text))
</script>

<template>
  <div class="nexo-answer">
    <template v-for="(block, index) in blocks" :key="index">
      <p v-if="block.type === 'p'"><template v-for="(part, i) in block.parts" :key="i"><strong v-if="part.bold">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></p>
      <component :is="block.type" v-else><li v-for="(item, j) in block.items" :key="j"><template v-for="(part, i) in item" :key="i"><strong v-if="part.bold">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></li></component>
    </template>
  </div>
</template>
