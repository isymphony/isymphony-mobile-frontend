<template>
  <ion-page>
    <!-- Header -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/home" />
        </ion-buttons>
        <ion-title>Select Assignment</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- Loading -->
      <div v-if="loading" class="center">
        <ion-spinner name="crescent" />
        <p>Checking assignment...</p>
      </div>

        <!-- Assignment list -->
        <div v-else class="assignment-list">
            <ion-text color="medium">
            <p>Please select an Order Number to continue.</p>
            </ion-text>

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
  IonBackButton,
  IonSpinner,
  IonText
} from "@ionic/vue";

import { ref } from "vue";
import { onIonViewWillEnter } from "@ionic/vue";
import { useRouter, useRoute } from "vue-router";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";

const router = useRouter();
const route  = useRoute();

const loading = ref(true);
const assignments = ref<any[]>([]);

const nextTarget = route.query.next as string || 'home';

const nextPageMap: Record<string, string> = {
  clockEntry: '/clock-entry',
  hourEntry:  '/hour-entry'
};

// ---------------------------
// Main entry
// ---------------------------
onIonViewWillEnter(async () => {
  await checkAssignment();
});

// ---------------------------
// Check assignment logic
// ---------------------------
const checkAssignment = async () => {
  loading.value = true;

  const token  = await Preferences.get({ key: "authToken" });
  const site   = await Preferences.get({ key: "siteName" });
  const userId = await Preferences.get({ key: "userId" });
  const defAsg = await Preferences.get({ key: "defaultAssignmentId" });

  if (!token.value || !site.value || !userId.value) {
    router.replace('/login');
    return;
  }

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

    assignments.value = res.data.assignments || [];
        
    //console.log("Available assignments:", assignments.value);
    //console.log("Default assignment:", defAsg.value);

    // 1️⃣ If defaultAssignmentId exists and still valid → go ahead
    if (defAsg.value) {
        const found = assignments.value.find(
            a => String(a.assignment_id) === defAsg.value
        );

        if (found) {
            redirectNext();
            return;
        }
    }

    // 2️⃣ No valid default → if only ONE assignment, auto-assign it
    if (assignments.value.length === 1) {
        const onlyAssignment = assignments.value[0];

        await Preferences.set({
            key: "defaultAssignmentId",
            value: String(onlyAssignment.assignment_id),
        });

        redirectNext();
        return;
    }

    // Otherwise, force selection
    loading.value = false;

  } catch (err) {
    console.error("AssignmentGate error", err);
    loading.value = false;
  }
};

// ---------------------------
// User selects assignment
// ---------------------------
const selectAssignment = async (a: any) => {
  await Preferences.set({
    key: "defaultAssignmentId",
    value: String(a.assignment_id)
  });

  redirectNext();
};

// ---------------------------
// Redirect helper
// ---------------------------
const redirectNext = () => {
  router.replace(nextPageMap[nextTarget] || '/home');
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
</script>

<style scoped>
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40%;
}

.title {
  font-weight: 600;
}

.sub {
  font-size: 13px;
  color: var(--ion-color-medium);
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
