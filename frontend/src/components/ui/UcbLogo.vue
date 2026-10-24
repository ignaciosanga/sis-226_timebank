<script setup>
const logoUrl = `${import.meta.env.BASE_URL}brand/ucb-logo.png`
</script>

<template>
  <!-- Frame the complete visible artwork; the PNG has wide transparent margins. -->
  <svg class="ucb-logo" viewBox="145 377 1633 721" width="1633" height="721" role="img" aria-label="Universidad Católica Boliviana" xmlns="http://www.w3.org/2000/svg">
    <image :href="logoUrl" x="0" y="0" width="1890" height="1418" />
  </svg>
</template>
