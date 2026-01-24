<template>
  <ion-app>

    <!-- MENU CONTAINER -->
    <ion-menu content-id="main-content" type="overlay">
      <!-- Wrap AppMenu inside ion-content -->
      <ion-content>
        <AppMenu />
      </ion-content>
    </ion-menu>

    <!-- MAIN CONTENT AREA -->
    <ion-router-outlet id="main-content"></ion-router-outlet>

  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonMenu, IonRouterOutlet, IonHeader, IonToolbar, IonTitle, IonContent } from "@ionic/vue";
import AppMenu from "@/components/AppMenu.vue";
import { Preferences } from "@capacitor/preferences";

const initTheme = async () => {
  const theme = await Preferences.get({ key: "theme" });

  if (theme.value === "dark") {
    document.documentElement.classList.add("dark");
  }
};

initTheme();
</script>

<style>
/* NO custom height or layout CSS here */
</style>
