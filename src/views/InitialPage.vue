<template>
  <ion-page>

    <!-- ================= HEADER ================= -->
    <ion-header>
      <ion-toolbar>
        <ion-title>Welcome</ion-title>

        <ion-buttons slot="end">
          <!-- Toggle Dark Mode -->
          <ion-button fill="clear" @click="toggleTheme">
            <ion-icon :icon="moonOutline" />
          </ion-button>

          <!-- Logout -->
          <ion-button fill="clear" @click="logout">
            <ion-icon :icon="logOutOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <!-- ================= CONTENT ================= -->
    <ion-content class="ion-padding">

      <!-- Top Logo -->
      <div class="logo-wrapper">
        <img
          src="/assets/itime_logo_transparent.png"
          alt="Logo"
          class="logo"
        />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="center-text">
        <ion-spinner name="crescent" />
        <p>Loading...</p>
      </div>

      <!-- Main content -->
      <div v-else>

        <h2 class="welcome-text">
          Welcome <strong>{{ userFirstName }}</strong>!
        </h2>

        <p class="instruction-text">
          You have multiple orders on your profile.<br>
          Please select one to use when entering time.
        </p>

        <!-- Assignment list -->
        <div class="assignment-list">
          <ion-button
            v-for="job in assignments"
            :key="job.assignment_id"
            expand="block"
            class="assignment-btn"
            @click="selectAssignment(job)"
          >
            <div class="assignment-content">

              <!-- Line 1 -->
              <div class="order-line">
                Order #{{ job.order_number }}
                <span v-if="job.type_location">
                  - {{ job.type_location }}
                </span>
              </div>

              <!-- Line 2 -->
              <div class="date-line">
                {{ formatDate(job.start_date) }}
                →
                {{ formatDate(job.end_date) }}
              </div>

            </div>
          </ion-button>
        </div>

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
  IonButton,
  IonIcon,
  IonSpinner
} from "@ionic/vue";

import { ref } from "vue";
import { onIonViewWillEnter } from "@ionic/vue";
import { useRouter } from "vue-router";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";

import {
  moonOutline,
  logOutOutline
} from "ionicons/icons";

const router = useRouter();

const loading = ref(true);
const userFirstName = ref("");
const assignments = ref<any[]>([]);

/**
 * Load assignments via home-data
 */
const loadData = async () => {

  const token  = await Preferences.get({ key: "authToken" });
  const site   = await Preferences.get({ key: "siteName" });
  const userId = await Preferences.get({ key: "userId" });

  if (!token.value) return;

  try {

    const res = await api.post(
      "/session-user-info",
      {
        site_name: site.value,
        user_id: Number(userId.value),
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json",
        },
      }
    );

    userFirstName.value = res.data.userinfo.iu_firstname;
    assignments.value   = res.data.assignments || [];

    //console.log("InitialPage userFirstName:", userFirstName.value);
    //console.log("InitialPage assignments:", assignments.value);

  } catch (err) {
    console.error("InitialPage load error:", err);
  }
};

/**
 * Select default assignment
 */
const selectAssignment = async (job: any) => {

  await Preferences.set({
    key: "defaultAssignmentId",
    value: job.assignment_id.toString(),
  });

  // 🔥 Notify app-wide listeners (AppMenu)
  window.dispatchEvent(new Event("auth-ready")); //to make sure menu loaded
  window.dispatchEvent(new Event("assignment-selected"));

  router.replace("/home");
};

/**
 * Format date
 */
const formatDate = (value: string) => {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
};

/**
 * Toggle theme
 */
const toggleTheme = async () => {
  const isDark = document.documentElement.classList.toggle("dark");

  await Preferences.set({
    key: "darkMode",
    value: isDark ? "1" : "0",
  });
};

/**
 * Logout
 */
const logout = async () => {
  await Preferences.clear();
  router.replace("/login");
};

onIonViewWillEnter(async () => {
  const assignment = await Preferences.get({ key: "defaultAssignmentId" });
  
  // If already selected, skip this page
  if (assignment.value) {
    router.replace("/home");
    return;
  }

  await loadData();
  loading.value = false;
});

</script>

<style scoped>

.center-text {
  text-align: center;
  margin-top: 40px;
}

/* Logo */
.logo-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  margin-bottom: 20px;
}

.logo {
  width: 150px;
}

/* Text */
.welcome-text {
  text-align: center;
  font-size: 22px;
  margin-bottom: 10px;
}

.instruction-text {
  text-align: center;
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 25px;
}

/* Assignment list */
.assignment-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.assignment-btn {
  --background: #2473e9;
  --background-hover: #7b1fa2;
  --background-activated: #8e24aa;
  --color: #ffffff;
  border-radius: 14px;
  text-transform: none;
  padding: 14px;
}

.assignment-content {
  width: 100%;
  text-align: left;
}

.order-line {
  font-size: 16px;
  font-weight: 600;
}

.date-line {
  font-size: 13px;
  opacity: 0.9;
  margin-top: 4px;
}

</style>
