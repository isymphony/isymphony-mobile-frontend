<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>

        <ion-title>Home</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- ⭐ Pull to Refresh -->
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
      <!-- END refresher -->


      <!-- ⭐⭐ TOP LOGO -->
      <div class="home-logo-wrapper">
        <img src="/assets/itime_logo_transparent.png" alt="Logo" class="home-logo" />
      </div>


      <!-- Initial loading -->
      <div v-if="initialLoading" class="center-text">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Loading...</p>
      </div>

      <!-- Main content -->
      <div v-else>
        <h2>
          Welcome <strong>{{ userFirstName }}</strong>!
        </h2>

        <p>You have <strong>{{ assignments.length }}</strong> 
            <span v-if="assignments.length === 1">
              job order:
            </span>
            <span v-else>
              job orders:
            </span>
        </p>

        <ion-list>
          <ion-item v-for="job in assignments" :key="job.assignment_id">
            <ion-label>
              <h3>Order <strong>#{{ job.order_number }}</strong></h3>
              <p>{{ job.type_location }}</p>
              <p>{{ formatDate(job.start_date) }} → {{ formatDate(job.end_date) }}</p>
            </ion-label>

            <!-- ⭐ Show check ONLY for default assignment -->
            <ion-icon
              v-if="job.assignment_id === defaultAssignmentId"
              :icon="checkmarkOutline"
              slot="end"
              color="primary"
            />
          </ion-item>
        </ion-list>
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
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonButtons,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
} from "@ionic/vue";

import { ref } from "vue";
import { onIonViewWillEnter } from '@ionic/vue';
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";
import { checkmarkOutline } from "ionicons/icons";

// STATES
const initialLoading = ref(true);   // ⭐ only for first load
const userFirstName = ref("");
const assignments = ref<any[]>([]);
const defaultAssignmentId = ref<number | null>(null);

// Format date
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

// ⭐ Load data function (used by initial load + refresher)
const loadData = async () => {
  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });
  
  const defaultAsgPref = await Preferences.get({ key: "defaultAssignmentId" });
  defaultAssignmentId.value = defaultAsgPref.value ? Number(defaultAsgPref.value) : null;

  if (!token.value) return;

  try {
    const res = await api.post(
      "/home-data",
      {
        site_name: sitePref.value,
        user_id: Number(userIdPref.value),
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    userFirstName.value = res.data.first_name;
    assignments.value = res.data.assignments;

    // ⭐ Update First Name for global use such as Menu
    await Preferences.set({key: 'userFirstName',value: res.data.first_name});

    //console.log("Default Assignment ID:", await Preferences.get({ key: "defaultAssignmentId" }));

  } catch (err: any) {
    console.error("Error loading home data:", err);
  }
};

// ⭐ Handle pull-to-refresh
const doRefresh = async (event: any) => {
  await loadData();
  event.target.complete();   // refresh animation stop
};

// Initial Load
onIonViewWillEnter(async () => {
  await loadData();
  initialLoading.value = false;  // hide spinner now
});
</script>

<style>
.center-text {
  text-align: center;
  margin-top: 40px;
}

/* ⭐ Centered top logo */
.home-logo-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 10px;
  margin-bottom: 15px;
}

.home-logo {
  width: 150px;     /* adjust size as needed */
  height: auto;
  object-fit: contain;
}
</style>

