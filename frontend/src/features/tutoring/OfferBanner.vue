<script setup>
import { computed, ref, watch } from 'vue'
import { BookOpen } from '@lucide/vue'
import { safeBannerUrl } from '../offers/tutoring-model'
const props = defineProps({ image: { type: String, default: '' }, title: { type: String, required: true }, subject: { type: String, default: '' }, compact: Boolean })
const failed = ref(false)
const source = computed(() => safeBannerUrl(props.image))
watch(() => props.image, () => { failed.value = false })
</script>
<template>
  <div class="tutor-offer-banner" :class="{ 'tutor-offer-banner-compact': compact, 'tutor-offer-banner-image': source && !failed }">
    <img v-if="source && !failed" :src="source" :alt="`Banner de la tutoría de ${subject || title}`" @error="failed = true" />
    <template v-else><BookOpen :size="compact ? 23 : 29" aria-hidden="true" /><div><small v-if="!compact">Tutoría personalizada</small><strong>{{ title }}</strong><span v-if="subject && subject !== title">{{ subject }}</span></div></template>
  </div>
</template>
