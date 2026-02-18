<template>
  <ion-page>
    <!-- Header -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>My PTO</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- ⭐ Pull to Refresh -->
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- PTO SUMMARY -->
      <div v-if="loaded" class="pto-summary">

        <!-- PTO Hours Available (Primary) -->
        <div class="pto-card emphasis">
          <div class="label">PTO Hours Available</div>
          <div class="value">
            {{ formatHours(availablePtoHours) }}
            <span class="unit">hrs</span>
          </div>
        </div>

        <!-- Accrual Per Pay Period -->
        <div class="pto-card">
          <div class="label">Accrual Per Pay Period</div>
          <div class="value">
            {{ formatHours(accrualPerPayPeriod) }}
            <span class="unit">hrs</span>
          </div>
        </div>

        <!-- 3-Month Projected Accrual -->
        <div class="pto-card">
          <div class="label">3-Month Projected Accrual</div>
          <div class="value">
            {{ formatHours(projectedAccrual) }}
            <span class="unit">hrs</span>
          </div>
        </div>

      </div>

      <!-- Skeleton / Loading -->
      <div v-else class="pto-loading">
        <ion-spinner name="crescent"></ion-spinner>
      </div>

      <!-- ACTIONS -->
      <div class="pto-actions">
        <ion-button expand="block" class="go-bottom-btn" @click="submitPto">
          Submit PTO
        </ion-button>

        <ion-button expand="block" class="go-bottom-btn-outline" @click="viewPtoHistory">
          View PTO
        </ion-button>
      </div>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  IonPage,
  IonHeader,
  IonButtons, 
  IonMenuButton,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonSpinner,
  IonRefresher,
  IonRefresherContent
} from "@ionic/vue";
import { alertController } from "@ionic/vue";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";
import { useRouter } from "vue-router";

const router = useRouter();

/* PTO state */
const availablePtoHours = ref(0);
const accrualPerPayPeriod = ref(0);
const projectedAccrual = ref(0);

/* UI state */
const loaded = ref(false);

/* Lifecycle */
onMounted(() => {
  loadPtoData();
});

/**
 * Load PTO data from isymphonyuser
 * Reuse the same pattern as My Profile / Home page
 */
const loadPtoData = async () => {

  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });
  const tokenPref = await Preferences.get({ key: "authToken" });

  if (!sitePref.value || !userIdPref.value) {
    console.error("Missing site name or user id");
    return;
  }

  try {
    const res = await api.post(
      "/session-user-info",
      {
        site_name: sitePref.value,
        user_id: Number(userIdPref.value),
      },
      {
        headers: {
          Authorization: `Bearer ${tokenPref.value}`,
          Accept: "application/json",
        },
      }
    );

    const userinfo = res.data.userinfo;

    availablePtoHours.value = Number(userinfo?.iu_availableptohours || 0);
    accrualPerPayPeriod.value = Number(userinfo?.iu_accrualperpayperiod || 0);
    projectedAccrual.value = Number(userinfo?.iu_projectedaccrual || 0);

  } catch (err) {
    console.error("Failed to load PTO data", err);
  } finally {
    loaded.value = true;
  }
};

// ⭐ Refresh handler
const doRefresh = async (event: any) => {
  await loadPtoData();
  event.target.complete();
};

/**
 * Format PTO hours consistently
 */
const formatHours = (value: number) => {
  return Number(value).toFixed(2);
};

/* Navigation placeholders */
const submitPto = () => {
  //showUnderConstruction();j
  router.push("/submit-pto-step1");

};

const viewPtoHistory = () => {
  router.push("/view-pto-history");
};

/**
 * Show under construction alert
 */
const showUnderConstruction = async () => {
  const alert = await alertController.create({
    header: "Coming Soon",
    message: "This feature is under construction.",
    buttons: ["OK"],
  });

  await alert.present();
};
</script>

<style scoped>
/* Summary section */
.pto-summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}

/* Card */
.pto-card {
  padding: 15px;
  margin-top: 0;
  margin-bottom: 10px;
  border-radius: 16px;
  text-align: center;

  /* LIGHT MODE */
  background: #ffffff;          /* <- Light mode card background */
  border: 1px solid rgba(0, 0, 0, 0.18);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

/* DARK MODE */
html.dark .pto-card {
  background: #1e1e1e;          /* <- dark card background */
  border: 1px solid rgba(255,255,255,0.15);
  box-shadow: 0 4px 12px rgba(255,255,255,0.05);
}

.pto-card .label {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}

.pto-card .value {
  font-size: 32px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.pto-card.emphasis .value {
  color: rgb(146, 18, 163);
}

/* Light mode card */
:host-context(.ios) .pto-card,
:host-context(.md) .pto-card {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

/* Dark mode card */
:host-context(.dark) .pto-card {
  background: #1c1c1e; /* iOS dark surface */
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
}

/* Unit */
.unit {
  font-size: 16px;
  margin-left: 4px;
  color: var(--ion-color-medium);
}

/* Actions */
.pto-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Loading */
.pto-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}
</style>
