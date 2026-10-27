<template>
  <div class="dashboard-estudiante-container">
    <div class="dashboard-header">
      <div class="title-section">
        <h2 class="title">Mi Resumen Personal</h2>
        <p class="subtitle">Tu actividad de intercambios, balance de horas y servicios en Nexo U (HU01, HU02 & HU03)</p>
      </div>
      <div class="badge-status">
        <span class="status-dot"></span>
        <span>En vivo (Looker Studio)</span>
      </div>
    </div>

    <!-- Contenedor responsivo del Dashboard embebido -->
    <div class="dashboard-card">
      <iframe 
        :src="embedUrl" 
        class="looker-frame"
        frameborder="0" 
        style="border:0" 
        allowfullscreen 
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox">
      </iframe>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// URL oficial del informe interactivo de Looker Studio — Vista Estudiante
const embedUrl = ref('https://lookerstudio.google.com/embed/reporting/67e3aee0-28d4-4d25-9dc9-dc9b45f74b2a/page/11BCG')
</script>

<style scoped>
.dashboard-estudiante-container {
  width: 100%;
  padding: 1.5rem;
  background-color: #f8fafc;
  min-height: 100vh;
  box-sizing: border-box;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.25rem;
  margin-bottom: 0;
}

.badge-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background-color: #eff6ff;
  color: #1e40af;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid #93c5fd;
}

.status-dot {
  width: 8px;
  height: 8px;
  background-color: #3b82f6;
  border-radius: 50%;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.dashboard-card {
  width: 100%;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  height: 800px;
}

.looker-frame {
  width: 100%;
  height: 100%;
  display: block;
}

@media (max-width: 768px) {
  .dashboard-estudiante-container {
    padding: 1rem;
  }
  .dashboard-card {
    height: 600px;
  }
}
</style>
