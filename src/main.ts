import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './station-kit/theme/crt.css'
import { installKioskExit } from './station-kit/kiosk/kioskExit'
import { installKioskSkip } from './station-kit/kiosk/kioskSkip'

installKioskExit() // håll övre vänstra hörnet 4 s → avsluta
installKioskSkip() // håll övre högra hörnet 2 s → nästa steg (ersätter alla synliga hoppa över-knappar)

createApp(App).use(createPinia()).mount('#app')
