<script setup>
const logoUrl = `${import.meta.env.BASE_URL}brand/ucb-logo.png`
</script>

<template>
  <span class="ucb-logo-crop" role="img" aria-label="Universidad Católica Boliviana">
    <img :src="logoUrl" alt="" />
  </span>
</template>
