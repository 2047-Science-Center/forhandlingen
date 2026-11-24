import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './station-kit/theme/crt.css'
import { installKioskExit } from './station-kit/kiosk/kioskExit'

installKioskExit() // håll övre vänstra hörnet 4 s → avsluta

createApp(App).use(createPinia()).mount('#app')
