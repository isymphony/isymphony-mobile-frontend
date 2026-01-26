import { createApp } from 'vue'
import App from './App.vue'
import router from './router';

/* Ionic core + basic CSS */
import '@ionic/vue/css/core.css';

import { IonicVue } from '@ionic/vue';
import { defineCustomElements } from '@ionic/core/loader';
import { StatusBar, Style } from '@capacitor/status-bar';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
import { Capacitor } from "@capacitor/core";

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import './global.css';

const app = createApp(App)
  .use(IonicVue, {
      animated: false
    })
  .use(router);

router.isReady().then(async () => {
  try {
    const isDark = document.documentElement.classList.contains("dark");

    // Detect platform
    const platform = Capacitor.getPlatform();

    if (platform === 'ios') {
      // iPhone → overlay TRUE + transparent
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setBackgroundColor({ color: '#00000000' }); // transparent
      await StatusBar.setStyle({ style: isDark ? Style.Light : Style.Dark });
      
    } else {
      // Android → overlay FALSE (Samsung default)
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: isDark ? Style.Light : Style.Dark });
      // DO NOT set background color → Samsung manages it
    }

  } catch (err) {
    console.log("StatusBar plugin not available", err);
  }

  app.mount('#app');
});

