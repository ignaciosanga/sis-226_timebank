<script setup>
import { Award, BookOpenCheck, BriefcaseBusiness, Camera, GraduationCap, MapPin, Pencil, Star, UsersRound } from '@lucide/vue'
import { useAppStore } from '../stores/app'
import UcbLogo from '../components/ui/UcbLogo.vue'

const store = useAppStore()
</script>

<template>
  <div class="profile-layout">
    <section class="profile-main">
      <article class="panel profile-hero">
        <div class="profile-banner"><div class="banner-pattern"></div><button type="button" aria-label="Cambiar portada"><Camera :size="18" /></button></div>
        <div class="profile-identity">
          <span class="avatar avatar-xl">{{ store.user.initials }}</span>
          <button class="edit-profile" type="button" aria-label="Editar perfil" @click="store.showToast('Edición de perfil disponible en la próxima integración.', 'info')"><Pencil :size="19" /></button>
          <div class="identity-copy">
            <div>
              <h1>{{ store.user.name }}</h1>
              <p>{{ store.user.career }} · {{ store.user.semester }}</p>
              <small><MapPin :size="15" />{{ store.user.campus }}</small>
            </div>
            <UcbLogo />
          </div>
          <p class="profile-bio">{{ store.user.bio }}</p>
          <div class="profile-actions"><button class="button button-primary" type="button" @click="store.showToast('Tu perfil público está listo para compartir.', 'info')">Compartir perfil</button><button class="button button-outline" type="button" @click="store.showToast('Formulario para ofrecer un curso abierto.', 'info')">Ofrecer un curso</button></div>
        </div>
      </article>

      <article class="panel profile-section">
        <div class="panel-title-row"><div><p class="panel-label">SOBRE MÍ</p><h2>Intereses y habilidades</h2></div><button class="round-action" type="button" aria-label="Editar intereses"><Pencil :size="17" /></button></div>
        <div class="interest-list"><span v-for="interest in store.user.interests" :key="interest">{{ interest }}</span></div>
      </article>

      <article class="panel profile-section">
        <div class="panel-title-row"><div><p class="panel-label">EXPERIENCIA COMO TUTORA</p><h2>Cursos impartidos</h2></div><span class="section-count">{{ store.taughtCourses.length }}</span></div>
        <div v-for="course in store.taughtCourses" :key="course.id" class="taught-row">
          <span class="taught-icon"><BookOpenCheck :size="20" /></span>
          <div><strong>{{ course.title }}</strong><small>{{ course.students }} estudiantes · {{ course.status }}</small></div>
          <span class="rating"><Star :size="15" fill="currentColor" />{{ course.rating }}</span>
        </div>
      </article>
    </section>

    <aside class="profile-side">
      <section class="panel reputation-card">
        <p class="panel-label">REPUTACIÓN</p>
        <div class="rating-large"><strong>{{ store.user.rating }}</strong><span><span>★★★★★</span><small>24 valoraciones</small></span></div>
        <div class="reputation-line"><span style="width: 92%"></span></div>
        <p>El 96% volvería a tomar una clase contigo.</p>
      </section>

      <section class="profile-stat-grid">
        <div class="panel"><span class="stat-icon blue"><Award :size="20" /></span><strong>{{ store.user.points }}</strong><small>Puntos disponibles</small></div>
        <div class="panel"><span class="stat-icon cyan"><GraduationCap :size="20" /></span><strong>{{ store.user.completed }}</strong><small>Cursos tomados</small></div>
        <div class="panel"><span class="stat-icon yellow"><BriefcaseBusiness :size="20" /></span><strong>{{ store.user.taught }}</strong><small>Cursos dados</small></div>
        <div class="panel"><span class="stat-icon green"><UsersRound :size="20" /></span><strong>19</strong><small>Conexiones</small></div>
      </section>

      <section class="panel achievement-card">
        <div class="achievement-mark"><Award :size="25" /></div>
        <div><p class="panel-label">LOGRO RECIENTE</p><h2>Tutora destacada</h2><p>Top 10% de tutores mejor valorados en octubre.</p></div>
      </section>
    </aside>
  </div>
</template>
