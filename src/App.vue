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
</script>

<style>
/* NO custom height or layout CSS here */
</style>
