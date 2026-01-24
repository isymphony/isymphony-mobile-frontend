<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>My Profile</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- ⭐ Pull to Refresh -->
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Initial loading (ONLY on first load) -->
      <div v-if="initialLoading" class="center-text">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Loading profile...</p>
      </div>

      <!-- Error -->
      <div v-else-if="errorMessage" class="center-text error-text">
        <p>{{ errorMessage }}</p>
      </div>

      <!-- Profile content -->
      <div v-else>
        <!-- Basic Info -->
        <ion-list>
          <ion-item lines="full">
            <ion-label>
              <h2 class="section-title">Basic Info</h2>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label>
              <p class="field-label">Site</p>
              <h3 class="field-value">{{ siteName }}</h3>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label>
              <p class="field-label">First Name</p>
              <h3 class="field-value">{{ firstName }}</h3>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label>
              <p class="field-label">Last Name</p>
              <h3 class="field-value">{{ lastName }}</h3>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label>
              <p class="field-label">Phone</p>
              <h3 class="field-value">{{ phone || '-' }}</h3>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label>
              <p class="field-label">Email</p>
              <h3 class="field-value">{{ email || '-' }}</h3>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label>
              <p class="field-label">ZIP</p>
              <h3 class="field-value">{{ zip || '-' }}</h3>
            </ion-label>
          </ion-item>
        </ion-list>

        <!-- Work Location -->
        <ion-list class="ion-margin-top">
          <ion-item lines="full">
            <ion-label>
              <h2 class="section-title">Work Location</h2>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label>
              <p class="field-label">Address</p>
              <h3 class="field-value">
                <span v-if="workAddress">{{ workAddress }}</span>
                <span v-else>-</span>
              </h3>

              <p v-if="workCity || workState || workZip" class="field-value">
                {{ workCity }}
                <span v-if="workCity && workState">, </span>
                {{ workState }}
                <span v-if="workZip"> {{ workZip }}</span>
              </p>
            </ion-label>
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
  IonButtons,
  IonMenuButton,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonRefresher,
  IonRefresherContent
} from "@ionic/vue";

import { ref } from "vue";
import { onIonViewWillEnter } from '@ionic/vue';
import { Preferences } from "@capacitor/preferences";
import { useRouter } from "vue-router";
import api from "@/services/api";

const router = useRouter();

// ⭐ States
const initialLoading = ref(true);   // only for first time
const errorMessage = ref("");

// Profile fields
const siteName = ref("");
const firstName = ref("");
const lastName = ref("");
const phone = ref("");
const email = ref("");
const zip = ref("");

const workAddress = ref("");
const workCity = ref("");
const workState = ref("");
const workZip = ref("");

const loadProfile = async () => {
  errorMessage.value = "";

  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });

  if (!token.value || !sitePref.value || !userIdPref.value) {
    errorMessage.value = "Session expired. Please login again.";
    setTimeout(() => router.push("/login"), 1200);
    return;
  }

  try {
    const res = await api.post(
      "/my-profile",
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

    const data = res.data;

    if (!data.success) {
      errorMessage.value = data.message || "Unable to load profile.";
    } else {
      siteName.value = data.site_name;
      firstName.value = data.first_name;
      lastName.value = data.last_name;
      phone.value = data.phone;
      email.value = data.email;
      zip.value = data.zip;

      if (data.work_location) {
        workAddress.value = data.work_location.address || "";
        workCity.value = data.work_location.city || "";
        workState.value = data.work_location.state || "";
        workZip.value = data.work_location.zip || "";
      }
    }

  } catch (err: any) {
    console.error("Profile API error:", err);
    errorMessage.value = "Failed to load profile.";
  }
};

// ⭐ Refresh handler
const doRefresh = async (event: any) => {
  await loadProfile();
  event.target.complete();
};

// ⭐ Initial load
onIonViewWillEnter(async () => {
  await loadProfile();
  initialLoading.value = false;
});
</script>

<style scoped>
.center-text {
  text-align: center;
  margin-top: 40px;
}

.error-text {
  color: var(--ion-color-danger);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
}

.field-label {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin-bottom: 2px;
}

.field-value {
  font-size: 16px;
}
</style>
