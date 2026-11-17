// Skärm-entry för intro-3D (bara dev, ingår inte i bygget).
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import SkarmDemo from './SkarmDemo.vue'
import '../station-kit/theme/crt.css'

createApp(SkarmDemo).use(createPinia()).mount('#app')
