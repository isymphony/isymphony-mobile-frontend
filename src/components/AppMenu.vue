<template>

  <ion-content>

    <!-- Logo area -->
    <div class="logo-wrapper">
      <img src="/assets/logo.png" alt="Logo" class="menu-logo" />
    </div>

    <!-- USER PROFILE -->
    <div class="profile-container">
      <div class="avatar">{{ firstLetter }}</div>

      <div>
        <div class="name">{{ firstName }}</div>
        <div class="identity">{{ identityValue }}</div>
      </div>
    </div>

    <!-- ⭐️ Gate entire menu -->
    <template v-if="sessionReady">
      <!-- MENU LIST -->
      <ion-list>

        <!-- Always show Home -->
        <ion-menu-toggle :auto-hide="true">
          <ion-item button router-link="/home">
            <ion-icon slot="start" :icon="homeOutline"></ion-icon>
            <ion-label>Home</ion-label>
          </ion-item>
        </ion-menu-toggle>


        <!-- TIMESHEET ONLY or BOTH -->
        <template v-if="mode === 'TIMESHEET_ONLY' || mode === 'BOTH'">

          <!-- Time Entry (switch based on capture mode) -->
          <ion-menu-toggle v-if="captureMode === 'HOUR ENTRY'" :auto-hide="true">
            <ion-item button @click="goEntryByType('hourEntry')">
              <ion-icon slot="start" :icon="timeOutline"></ion-icon>
              <ion-label>Timesheet Entry</ion-label>
            </ion-item>
          </ion-menu-toggle>

          <ion-menu-toggle v-if="captureMode === 'HOUR ENTRY'" :auto-hide="true">
            <ion-item button router-link="/pending-timesheet">
              <ion-icon slot="start" :icon="hourglassOutline"></ion-icon>
              <ion-label>Pending Timesheets</ion-label>
            </ion-item>
          </ion-menu-toggle>

          <ion-menu-toggle v-if="captureMode === 'CLOCK ENTRY'" :auto-hide="true">
            <ion-item button @click="goEntryByType('clockEntry')">
              <ion-icon slot="start" :icon="timeOutline"></ion-icon>
              <ion-label>Timeclock Entry</ion-label>
            </ion-item>
          </ion-menu-toggle>

          <ion-menu-toggle v-if="captureMode === 'CLOCK ENTRY'" :auto-hide="true">
            <ion-item button router-link="/pending-clock-timesheet">
              <ion-icon slot="start" :icon="hourglassOutline"></ion-icon>
              <ion-label>Pending Timesheets</ion-label>
            </ion-item>
          </ion-menu-toggle>

          <ion-menu-toggle :auto-hide="true">
            <ion-item button router-link="/approved-timesheets">
              <ion-icon slot="start" :icon="checkmarkDoneOutline"></ion-icon>
              <ion-label>Approved Timesheets</ion-label>
            </ion-item>
          </ion-menu-toggle>
          

        </template>


        <!-- EXPENSE ONLY or BOTH -->
        <template v-if="mode === 'EXPENSE_ONLY' || mode === 'BOTH'">

          <ion-menu-toggle :auto-hide="true">
            <ion-item button @click="underConstruction">
              <ion-icon slot="start" :icon="cashOutline"></ion-icon>
              <ion-label>Expense Entry</ion-label>
            </ion-item>
          </ion-menu-toggle>

          <ion-menu-toggle :auto-hide="true">
            <ion-item button router-link="/approved-expenses">
              <ion-icon slot="start" :icon="pricetagOutline"></ion-icon>
              <ion-label>Approved Expenses</ion-label>
            </ion-item>
          </ion-menu-toggle>

        </template>

        <!-- PTO (only if iu_ptoflag = 1) -->
        <template v-if="showPTO">
          <ion-menu-toggle :auto-hide="true">
            <ion-item button router-link="/my-pto">
              <ion-icon slot="start" :icon="calendarOutline"></ion-icon>
              <ion-label>My PTO</ion-label>
            </ion-item>
          </ion-menu-toggle>
        </template>

        <!-- My Profile always visible -->
        <ion-menu-toggle :auto-hide="true">
          <ion-item button router-link="/my-profile">
            <ion-icon slot="start" :icon="personCircleOutline"></ion-icon>
            <ion-label>My Profile</ion-label>
          </ion-item>
        </ion-menu-toggle>

        <!-- Logout -->
        <ion-menu-toggle :auto-hide="true">
          <ion-item button @click="logout">
            <ion-icon slot="start" :icon="logOutOutline"></ion-icon>
            <ion-label color="danger">Logout</ion-label>
          </ion-item>
        </ion-menu-toggle>

      </ion-list>

    </template>

    <!-- Dark Mode -->
    <ion-list>
      <ion-item>
        <ion-icon slot="start" :icon="moonOutline"></ion-icon>
        <ion-label>Dark Mode</ion-label>
        <ion-toggle slot="end" :checked="darkMode" @ionChange="toggleDarkMode"></ion-toggle>
      </ion-item>
    </ion-list>


    <!-- SUPPORT INFO -->
    <div class="support-section" v-if="supportEmail">
      <div class="support-title">Support:</div>
      <div class="support-email">
        <a :href="`mailto:${supportEmail}`">{{ supportEmail }}</a>
      </div>
    </div>

    <!-- ⭐ Custom bottom spacer -->
    <div class="menu-bottom-spacer"></div>

  </ion-content>

</template>



<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { onIonViewWillEnter } from "@ionic/vue";
import { loadingController } from "@ionic/vue";
import {
  IonContent, IonList, IonItem, IonLabel, IonToggle,
  IonIcon, IonMenuToggle
} from "@ionic/vue";

import api from "@/services/api";
import { Preferences } from "@capacitor/preferences";
import { menuController, alertController } from "@ionic/vue";
import { useRouter } from "vue-router";

import {
  homeOutline,
  timeOutline,
  hourglassOutline,
  checkmarkDoneOutline,
  cashOutline,
  personCircleOutline,
  pricetagOutline,
  logOutOutline,
  calendarOutline,
  moonOutline
} from "ionicons/icons";

const router = useRouter();

// UI state 
const firstName = ref("");
const identityValue = ref("");
const darkMode = ref(false);
const supportEmail = ref("");

// TE flag mode
const mode = ref<'TIMESHEET_ONLY' | 'EXPENSE_ONLY' | 'BOTH'>('TIMESHEET_ONLY');
const showPTO = ref(false);
const captureMode = ref(""); // HOUR ENTRY | CLOCK ENTRY

const sessionReady = ref(false);

const onAssignmentSelected = async () => {
  await loadMenuData();
};

onMounted(() => {
  loadMenuData();

  window.addEventListener("auth-ready", loadMenuData);
  window.addEventListener("assignment-selected", onAssignmentSelected);
});

onUnmounted(() => {
  window.removeEventListener("auth-ready", loadMenuData);
  window.removeEventListener("assignment-selected", onAssignmentSelected);
});

const loadMenuData = async () => {
  sessionReady.value = false;

  // Load user info
  const token = await Preferences.get({ key: "authToken" });
  //console.log("🔥 Token =", token.value) ;

  // 🔴 IMPORTANT: not logged in → do nothing
  if (!token.value) {
    return;
  }

  const assignmentIdPref = await Preferences.get({ key: "defaultAssignmentId" });

  // 🚫 LOGIN OK but has not selected default assignment (in case the user has multiple assignments)
  if (!assignmentIdPref.value) {
    return;
  }

  const first = await Preferences.get({ key: "userFirstName" });
  const identity = await Preferences.get({ key: "identityValue" });
  const themePref = await Preferences.get({ key: "theme" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userId = await Preferences.get({ key: "userId" });
  //console.log("🔥 User Info =", first.value, identity.value, dark.value, sitePref.value, userId.value);

  firstName.value = first.value || "";
  identityValue.value = identity.value || "";
    darkMode.value = themePref.value === "dark";

  document.documentElement.classList.toggle("dark", darkMode.value);

  // Load Support Email
  if (sitePref.value) {
    try {
      const res = await api.post("/support-info", { site_name: sitePref.value });
      supportEmail.value = res.data.email || "";
    } catch (err) {
      console.error("Support email fetch failed", err);
    }
  }

  // Load all modes
  if (sitePref.value && userId.value) {
    try {
      const res = await api.post(
        "/teflag-mode",
        {
          site_name: sitePref.value,
          user_id: Number(userId.value)
        },
        {
          headers: {
            Authorization: `Bearer ${token.value}`,
            Accept: "application/json"
          }
        }
      );

      if (res.data.success && res.data.mode) {
        mode.value = res.data.mode;
        //console.log("🔥 TE Flag MENU MODE =", res.data.mode);
      }
    } catch (err) {
      console.error("Error loading TE flag mode", err);
    }

    // Load PTO flag
    try {
      const res = await api.post(
        "/pto-mode",
        {
          site_name: sitePref.value,
          user_id: Number(userId.value),
        },
        {
          headers: {
            Authorization: `Bearer ${token.value}`,
            Accept: "application/json",
          }
        }
      );

      showPTO.value = res.data.pto === 1;
      //console.log("My PTO Flag =", showPTO.value);

    } catch (err) {
      console.error("Failed to fetch PTO flag", err);
    }

    // Time capture mode
    try {
      const modeRes = await api.post(
        "/timecapture-mode",
        {
          site_name: sitePref.value,
          user_id: Number(userId.value),
        },
        {
          headers: {
            Authorization: `Bearer ${token.value}`,
            Accept: "application/json"
          }
        }
      );
      captureMode.value = modeRes.data.timecapture;
      //console.log("Time Capture Method =", captureMode.value);

    } catch (err) {
      console.error("Failed to fetch PTO flag", err);
    }
  }

  // ✅ only render menu AFTER everything is ready
  sessionReady.value = true;
};

const firstLetter = computed(() => {
  return firstName.value ? firstName.value.charAt(0).toUpperCase() : "?";
});

// Dark Mode toggle
const toggleDarkMode = async () => {
  const newValue = !darkMode.value;
  darkMode.value = newValue;

  await Preferences.set({
    key: "theme",
    value: newValue ? "dark" : "light"
  });

  document.documentElement.classList.toggle("dark", newValue);  
};

// Placeholder under-construction popup
const underConstruction = async () => {
  const alert = await alertController.create({
    header: "Coming Soon",
    message: "This feature is under construction.",
    buttons: ["OK"]
  });
  await alert.present();
};

type EntryType = 'clockEntry' | 'hourEntry';
const goEntryByType = (entryType: EntryType) => {
  router.push({
    path: '/assignment-gate',
    query: {
      next: entryType
    }
  });
};

// Logout
const logout = async () => {
  // 🔥 FORCE dismiss ALL loading overlays
  await loadingController.dismiss().catch(() => {});
  
  await menuController.close();
  await Preferences.clear();

  // Reset menu state
  sessionReady.value = false;

  firstName.value = "";
  identityValue.value = "";
  mode.value = "TIMESHEET_ONLY";
  captureMode.value = "";
  showPTO.value = false;

  window.dispatchEvent(new Event("logout"));

  router.replace("/login");
};
</script>

<style scoped>

.logo-wrapper {
  padding: 16px;
  display: flex;
  justify-content: center;
  background: var(--ion-background-color); /* auto light/dark */
  border-bottom: 1px solid var(--ion-color-step-150);
}

.menu-logo {
  width: 160px;
  height: auto;
  object-fit: contain;
}

.profile-container {
  display: flex;
  align-items: center;
  padding: 20px 16px;
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background-color: var(--avatar-bg);
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 22px;
  font-weight: bold;
  margin-right: 16px;
}

.name {
  font-size: 18px;
  font-weight: 600;
}

.identity {
  font-size: 14px;
  color: var(--ion-color-medium);
}

.support-section {
  padding: 20px 16px;
  margin-top: 20px;
}

.support-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}

.support-email {
  font-size: 16px;
  font-weight: 500;
  word-break: break-all;
}

.support-email a {
  color: var(--ion-color-primary);
  text-decoration: none;
}

.menu-bottom-spacer {
  height: 50px;
}
</style>
