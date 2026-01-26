<template>
  <ion-page>

    <!-- Header -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Pending Timesheet</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
       <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content />
       </ion-refresher>

        <!-- Initial loading -->
        <div v-if="initialLoading" class="center-text">
            <ion-spinner name="crescent"></ion-spinner>
            <p>Loading...</p>
        </div>

      <!-- Weekend row -->
      <ion-list>

        <ion-item v-if="weekend" button :router-link="`/timesheet-clock-detail/${weekend}`" :detail="false">

          <ion-label>
            {{ formatWeekend(weekend) }}
          </ion-label>

          <ion-note slot="end">
            {{ totalHoursFormatted }}
          </ion-note>

          <ion-icon
            slot="end"
            :icon="chevronForwardOutline"
            class="arrow-icon"
          />

        </ion-item>

        <!-- No Timesheet fallback -->
        <ion-item v-else>
          <ion-label color="medium">
            No timesheet available
          </ion-label>
        </ion-item>

      </ion-list>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonMenuButton,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent
} from "@ionic/vue";

import { chevronForwardOutline } from "ionicons/icons";
import { ref, computed } from "vue";
import { onIonViewWillEnter } from '@ionic/vue';
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";

// --------------------------
// Reactive state
// --------------------------
const initialLoading = ref(true);   // ⭐ only for first load
const weekend = ref<string|null>(null);
const totalHours = ref<number>(0);

// --------------------------
// Load API data
// --------------------------
onIonViewWillEnter(async () => {
  await loadData();
  initialLoading.value = false;  // hide spinner now
});

const doRefresh = async (event:any) => {
  await loadData();
  event.target.complete();
};

// --------------------------
// Computeds
// --------------------------
const totalHoursFormatted = computed(() => {
  return `${totalHours.value.toFixed(2)} hours`;
});

const formatWeekend = (value: string) => {
  if (!value) return "";

  const [year, month, day] = value.split("-");

  return `${month}/${day}/${year}`;
};

const loadData = async () => {
  try {

    const token  = await Preferences.get({ key: "authToken" });
    const site   = await Preferences.get({ key: "siteName" });
    const userId = await Preferences.get({ key: "userId" });

    if (!token.value) return;

    const res = await api.post(
      "/pending-clock-timesheet",
      {
        site_name: site.value,
        user_id: Number(userId.value),
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    weekend.value    = res.data.weekend;
    totalHours.value = Number(res.data.total_hours || 0);

    console.log("PendingTimesheetClockEntry API response - weekend:", weekend.value, " totalHours:", totalHours.value);

  }
  catch (err) {
    console.error("PendingTimesheetClockEntry API error:", err);
  }
};

</script>

<style scoped>
.arrow-icon {
  opacity: 0.6;
}
</style>
