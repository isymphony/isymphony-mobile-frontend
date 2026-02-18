<template>
  <ion-page>
    <!-- ===== Header ===== -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="backPath" text="Back" class="back-button" />
        </ion-buttons>
        <ion-title>Review Timesheet</ion-title>
      </ion-toolbar>
    </ion-header>

    <!-- Loading -->
    <ion-loading
      :is-open="!pageLoaded"
      message="Loading..."
      spinner="crescent"
    />

    <ion-content class="ion-padding" v-if="pageLoaded">
      <!-- Pull to refresh -->
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- ===== Top Card ===== -->
      <div class="top-card">
        <div class="top-card-content">
          Weekend:
          <strong>{{ weekendDisplay }}</strong>
        </div>
        <div class="top-card-content">
          Week Total:
          <strong>{{ weekTotal.toFixed(2) }} hours</strong>
        </div>
        <div class="top-card-content">
          Timesheet Status:
          <strong class="status-text">{{ timesheetStatus }}</strong>
        </div>
      </div>

        <!-- ===== Days List ===== -->
        <div
        v-for="day in days"
        :key="day.date"
        class="day-block"
        >
        <div class="day-header">
            {{ day.display }}
        </div>

        <div
            v-for="order in day.orders"
            :key="order.order_label"
        >
            <div
            v-for="line in order.lines"
            :key="order.order_label + line.time_code"
            class="time-line"
            >
            <span class="order-col">{{ order.order_label }}</span>
            <span class="code-col">{{ line.time_code }}</span>
            <span class="hours-col">{{ line.hours.toFixed(2) }} hrs</span>
            </div>
        </div>

        <div class="day-total">
            Day Total: {{ day.day_total.toFixed(2) }} hrs
        </div>
        </div>


      <!-- ===== Bottom Summary ===== -->
      <div class="bottom-summary">
        <div class="big-total">
          Week Total: {{ weekTotal.toFixed(2) }} hrs
        </div>

        <ion-button
          v-if="canSubmit"
          expand="block"
          class="go-bottom-btn"
          @click="submitForApproval"
        >
          Submit For Approval
        </ion-button>

        <ion-button
          v-if="canModify"
          expand="block"
          class="go-bottom-btn-outline"
          @click="goModifyTimesheet"
        >
          Modify Timesheet
        </ion-button>

        <ion-button
            v-if="isReadonly"
            expand="block"
            class="timesheet-status-btn"
            disabled
        >
            {{ timesheetStatus }}
        </ion-button>
      </div>
    </ion-content>

    <ion-loading
        :is-open="showSubmitting"
        message="Please wait..."
        spinner="crescent"
    />
    
    <ion-alert
        :is-open="showConfirmSubmit"
        header="Confirm Submit"
        message="Are you sure you want to submit this timesheet for approval?"
        :buttons="confirmSubmitButtons"
        @didDismiss="showConfirmSubmit = false"
    />

    <ion-alert
        :is-open="showSubmitSuccess"
        header="Success!"
        message="Your timesheet was submitted successfully!"
        :buttons="['OK']"
        @didDismiss="showSubmitSuccess = false"
    />

  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonLoading,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonAlert
} from "@ionic/vue";

import { onIonViewWillEnter } from "@ionic/vue";
import { ref, nextTick, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";

interface ReviewLine {
  time_code: string;
  hours: number;
}

interface ReviewOrder {
  order_label: string;
  lines: ReviewLine[];
}

interface ReviewDay {
  date: string;
  display: string;
  day_total: number;
  orders: ReviewOrder[];
}

const route = useRoute();
const router = useRouter();

const pageLoaded = ref(false);
const weekend = ref("");
const weekendDisplay = ref("");
const weekTotal = ref(0);
const timesheetStatus = ref<string>("New Timesheet");
const days = ref<ReviewDay[]>([]);
const showConfirmSubmit = ref(false);
const showSubmitSuccess = ref(false);
const showSubmitting = ref(false);

const canModify = computed(() => {
  return ["New Timesheet", "Open", "On Hold", "Rejected"].includes(timesheetStatus.value);
});

const canSubmit = computed(() => {
  return ["Open", "On Hold", "Rejected"].includes(timesheetStatus.value);
});

const isReadonly = computed(() =>
  ["Approved", "Invoiced", "Submitted", "Re-Submitted"].includes(timesheetStatus.value)
);

// Load page
onIonViewWillEnter(async () => {
  await loadReview();
});

const loadReview = async () => {
  pageLoaded.value = false;

  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });
  const clientIdPref = await Preferences.get({ key: "clientId" });

  weekend.value = String(route.query.weekend);

  //console.log("Loading review timesheet for", weekend.value);

  try {
    const res = await api.post(
      "/review-timesheet",
      {
        site_name: sitePref.value,
        week_ending_date: weekend.value,
        client_id: Number(clientIdPref.value),
        user_id: Number(userIdPref.value)
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    if (res.data.success) {
        const dt = parseLocalYmd(res.data.weekend);

        weekendDisplay.value = dt.toLocaleDateString("en-US", {
            weekday: "long",
            month: "2-digit",
            day: "2-digit",
            year: "numeric"
        });

        weekTotal.value = res.data.week_total;
        timesheetStatus.value = res.data.timesheet_status || "New Timesheet";

        const skeleton = buildWeekSkeleton(res.data.weekend);

        // Map backend days by date
        const apiDaysMap = new Map<string, ReviewDay>(
            res.data.days.map((d: ReviewDay) => [d.date, d])
        );

        days.value = skeleton.map((day) => {
            const apiDay = apiDaysMap.get(day.date);

            if (!apiDay) {
            return day; // 0.00 hrs day
            }

            return {
            ...day,
            orders: apiDay.orders,
            day_total: apiDay.day_total
            };
        });
    }

  } catch (err) {
    console.error("Failed to load review timesheet", err);
  } finally {
    pageLoaded.value = true;
  }
};

const buildWeekSkeleton = (weekend: string) => {
  const end = parseLocalYmd(weekend);
  const days: ReviewDay[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);

    const ymd = d.toISOString().slice(0, 10);

    days.push({
      date: ymd,
      display: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "2-digit",
        day: "2-digit"
      }),
      day_total: 0,
      orders: []
    });
  }

  return days;
};

// Convert a YYYY-MM-DD string into a local Date (avoids UTC parsing shift)
const parseLocalYmd = (ymd: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d); // Local time midnight
};

const doRefresh = async (event: any) => {
  await loadReview();
  event.target.complete();
};

const backPath = computed(() => {
  const from = route.query.from;

  if (from === "weekly-grid") {
    return "/weekly-grid-entry";
  }

  // default
  return "/hour-entry";
});

// Navigate back to modify timesheet
const goModifyTimesheet = () => {
  const from = route.query.from;
  if (from === "hour-entry") {
    router.push({
      path: "/hour-entry",
      query: { weekend: weekend.value }
    });
  } else {
    router.push({
      path: "/weekly-grid-entry",
      query: { weekend: weekend.value }
    });
  }
};

const submitForApproval = async () => {
  showConfirmSubmit.value = false;

  await nextTick(); // 👈 important

  showConfirmSubmit.value = true;
};

const confirmSubmitButtons = [
  {
    text: "Cancel",
    role: "cancel"
  },
  {
    text: "OK",
    handler: async () => {
      showSubmitting.value = true;
      await submitTimesheet();
    }
  }
];

const submitTimesheet = async () => {
  try {
    const token = await Preferences.get({ key: "authToken" });
    const sitePref = await Preferences.get({ key: "siteName" });
    const userIdPref = await Preferences.get({ key: "userId" });
    const clientIdPref = await Preferences.get({ key: "clientId" });

    const res = await api.post(
      "/submit-timesheet",
      {
        site_name: sitePref.value,
        week_ending_date: weekend.value,
        client_id: Number(clientIdPref.value),
        user_id: Number(userIdPref.value)
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    if (res.data.success) {
      timesheetStatus.value = res.data.timesheet_status;
      showSubmitSuccess.value = true;
    }

  } catch (err) {
    console.error("Submit timesheet failed", err);
  } finally {
    showSubmitting.value = false; // ✅ ALWAYS hide spinner
  }
};
</script>

<style scoped>
.top-card {
  padding: 15px;
  margin-top: 0;
  margin-bottom: 10px;
  border-radius: 16px;

  /* LIGHT MODE */
  background: #ffffff;          /* <- Light mode card background */
  border: 1px solid rgba(0, 0, 0, 0.18);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

/* DARK MODE */
html.dark .top-card {
  background: #1e1e1e;          /* <- dark card background */
  border: 1px solid rgba(255,255,255,0.15);
  box-shadow: 0 4px 12px rgba(255,255,255,0.05);
}
.top-card-content {
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--ion-color-medium);
}

.day-block {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

/* Dark mode */
html.dark .day-block {
  border-bottom: 1px solid rgba(255, 255, 255, 0.18);
}

.day-header {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 8px;
  color: rgb(100, 11, 112); /* purple */
}

.time-line {
  display: grid;
  grid-template-columns: 1fr 40px 80px;
  align-items: center;
  font-size: 13px;
  padding: 2px 0;
  margin-left: 20px;
}

.order-col {
  font-weight: 500;
}

.code-col {
  text-align: center;
  color: var(--ion-color-medium);
}

.hours-col {
  text-align: right;
}

.day-total {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #2a8ca7; /* teal */
}

.bottom-summary {
  padding: 16px;
  gap: 12px;
  display: flex;
  flex-direction: column;
}

.big-total {
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 12px;
}

.back-button {
  text-transform: none !important;
}

.timesheet-status-btn {
  --background: #bebebe;
  --color: #3d3d3d;
  --border-radius: 10px;
  --box-shadow: none;
  --opacity: 1; /* override Ionic default */
  text-transform: none;
  font-weight: 600;
  cursor: default;
}

/* Dark mode */
html.dark .timesheet-status-btn {
  --background: #333333;
  --color: #cfcfcf;
}

.status-text {
  color: rgb(146, 18, 163);
  font-weight: 600;
}
</style>
