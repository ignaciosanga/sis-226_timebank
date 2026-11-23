import { defineStore } from 'pinia'
export const useWelcomeStore = defineStore('welcome', {
  state: () => ({ request: 0 }),
  actions: { open() { this.request++ } },
})
