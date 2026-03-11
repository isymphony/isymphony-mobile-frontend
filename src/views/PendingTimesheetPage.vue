<template>
  <ion-page>
    <!-- ===== Header ===== -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Pending Timesheet</ion-title>
      </ion-toolbar>
    </ion-header>

    <!-- Loading -->
    <ion-loading
      :is-open="!pageLoaded"
      message="Loading..."
      spinner="crescent"
    />

    <ion-content class="ion-padding">
      <!-- Pull to refresh -->
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- ===== Week List ===== -->
      <ion-list v-if="weeks.length > 0" class="week-list">
        <ion-item
          v-for="w in weeks"
          :key="w.weekend"
          button
          @click="openTimesheet(w.weekend)"
          :detail="false"
        >
          <ion-label>
            <div class="weekend-line">
              {{ w.display }}
            </div>

            <div
              v-if="w.ts_status"
              class="status-line"
            >
              {{ w.ts_status }}
            </div>
          </ion-label>

          <div class="hours-col">
            {{ (w.total_hours ?? 0).toFixed(2) }} hrs
          </div>

          <ion-icon
            slot="end"
            :icon="chevronForwardOutline"
            color="medium"
          />
        </ion-item>
      </ion-list>

      <!-- Empty -->
      <div v-if="pageLoaded && weeks.length === 0" class="empty">
        No pending timesheets
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonLoading,
  IonRefresher,
  IonRefresherContent
} from "@ionic/vue";

import { onIonViewWillEnter } from "@ionic/vue";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";
import { chevronForwardOutline } from "ionicons/icons";

interface PendingWeek {
  weekend: string;
  display: string;
  total_hours: number;
  ts_status: string | null;
  has_timesheet: boolean;
}

const router = useRouter();

const pageLoaded = ref(false);
const weeks = ref<PendingWeek[]>([]);

onIonViewWillEnter(async () => {
  await loadPending();
});

const loadPending = async () => {
  pageLoaded.value = false;

  const [
    token,
    sitePref,
    userIdPref,
    clientIdPref,
    weekEndingDayPref
  ] = await Promise.all([
    Preferences.get({ key: "authToken" }),
    Preferences.get({ key: "siteName" }),
    Preferences.get({ key: "userId" }),
    Preferences.get({ key: "clientId" }),
    Preferences.get({ key: "weekEndingDay" })
  ]);

  /*
  console.log("Loading pending timesheets with", {
    site: sitePref.value,
    userId: userIdPref.value,
    clientId: clientIdPref.value,
    weekEndingDay: weekEndingDayPref.value
  });
  */

  try {
    const res = await api.post(
      "/pending-timesheets",
      {
        site_name: sitePref.value,
        client_id: Number(clientIdPref.value),
        user_id: Number(userIdPref.value),
        week_ending_day: weekEndingDayPref.value || "Saturday"
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    if (res.data.success) {
      weeks.value = res.data.weeks ?? [];
    }
  } catch (err) {
    console.error("Failed to load pending timesheets", err);
  } finally {
    pageLoaded.value = true;
  }
};

const doRefresh = async (event: any) => {
  await loadPending();
  event.target.complete();
};

const openTimesheet = (weekend: string) => {
  router.push({
    path: "/hour-entry",
    query: { weekend }
  });
};
</script>

<style scoped>
.week-list ion-item {
  --padding-start: 12px;
  --padding-end: 12px;
}

/* Divider clarity */
.week-list {
  --border-color: var(--ion-color-step-200);
}

.weekend-line {
  font-size: 15px;
  font-weight: 600;
}

.status-line {
  font-size: 13px;
  color: var(--ion-color-medium);
}

.hours-col {
  font-size: 14px;
  margin-right: 8px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.empty {
  text-align: center;
  margin-top: 40px;
  color: var(--ion-color-medium);
}
</style>
