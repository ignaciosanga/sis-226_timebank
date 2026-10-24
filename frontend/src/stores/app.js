import { defineStore } from 'pinia'
import { courses, initialEnrollmentIds, monthlyActivity, student, taughtCourses } from '../data/mockData'

export const useAppStore = defineStore('app', {
  state: () => ({
    authenticated: false,
    user: { ...student },
    courses,
    enrollmentIds: [...initialEnrollmentIds],
    monthlyActivity,
    taughtCourses,
    loginOpen: false,
    pendingCourseId: null,
    toast: null,
  }),
  getters: {
    enrolledCourses: (state) => state.courses.filter((course) => state.enrollmentIds.includes(course.id)),
    enrolledDates() {
      return this.enrolledCourses.map((course) => course.date)
    },
    analytics(state) {
      return {
        enrolled: state.enrollmentIds.length + state.user.completed,
        completed: state.user.completed,
        success: 94,
        hours: state.user.hours + state.enrollmentIds.length,
      }
    },
  },
  actions: {
    requestEnrollment(courseId) {
      if (!this.authenticated) {
        this.pendingCourseId = courseId
        this.loginOpen = true
        return
      }
      this.enroll(courseId)
    },
    requestLogin() {
      this.pendingCourseId = null
      this.loginOpen = true
    },
    completeLogin() {
      this.authenticated = true
      const pending = this.pendingCourseId
      this.loginOpen = false
      this.pendingCourseId = null
      if (pending) this.enroll(pending)
      else this.showToast('Sesión iniciada. Bienvenida a Nexo U.')
    },
    closeLogin() {
      this.loginOpen = false
      this.pendingCourseId = null
    },
    enroll(courseId) {
      const course = this.courses.find((item) => item.id === courseId)
      if (!course) return
      if (this.enrollmentIds.includes(courseId)) {
        this.showToast('Este curso ya está en tu agenda.', 'info')
        return
      }
      this.enrollmentIds.push(courseId)
      this.showToast(`Te inscribiste en “${course.title}”.`)
    },
    showToast(message, type = 'success') {
      this.toast = { id: Date.now(), message, type }
      window.setTimeout(() => {
        this.toast = null
      }, 3600)
    },
  },
})
