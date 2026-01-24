<template>
  <ion-page>

    <!-- HEADER -->
    <ion-header>
    <ion-toolbar>
        <ion-buttons slot="start">
        <ion-back-button default-href="/pending-clock-timesheet" text="Back" class="back-button" />
        </ion-buttons>
        <ion-title>Timesheet Detail</ion-title>
    </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- ===== TOP INFO ===== -->
      <div v-if="loaded" class="top-summary">
        <div class="top-row">
          Weekend:
          <strong>{{ formatDate(weekend) }}</strong>
        </div>

        <div class="top-row">
          Weekly Total:
          <strong>{{ weeklyTotalFormatted }}</strong>
        </div>
      </div>

      <!-- ===== DAY GROUP LIST ===== -->
      <ion-list v-if="loaded && dayGroups.length">

        <div
          v-for="group in dayGroups"
          :key="group.date"
          class="day-group"
        >

          <!-- DATE HEADER -->
          <div class="day-header">
            {{ formatDate(group.date) }} – {{ formatHours(group.totalHours) }}
          </div>

          <!-- EACH CLOCK RECORD -->
          <ion-item
            v-for="row in group.rows"
            :key="row.id"
            lines="none"
            class="entry-item"
          >

            <div class="entry-row">
            <div class="entry-left">

                <!-- IN -->
                <div class="entry-line">
                <ion-icon :icon="getInIcon(row)" class="entry-icon"/>
                <span class="entry-time">
                    {{ row.timeIn ? formatTime(row.timeIn) : 'Missing Punch' }}
                </span>
                <span class="entry-order">Order #{{ row.orderNumber }}</span>
                </div>

                <!-- OUT -->
                <div class="entry-line">
                <ion-icon :icon="getOutIcon(row)" class="entry-icon"/>
                <span class="entry-time">
                    {{ row.timeOut ? formatTime(row.timeOut) : 'Missing Punch' }}
                </span>
                <span class="entry-order">Order #{{ row.orderNumber }}</span>
                </div>

            </div>

            <!-- ✅ RIGHT fixed column -->
            <div class="entry-hours-col">
                {{ formatHours(row.workedHours) }}
            </div>
            </div>


          </ion-item>

          <ion-item lines="full" class="divider"></ion-item>

        </div>

      </ion-list>

      <!-- NO DATA -->
      <div v-if="loaded && !dayGroups.length" class="loading">
        No records found.
      </div>

      <!-- LOADING -->
      <div v-if="!loaded" class="loading">
        Loading...
      </div>

      <!-- ===== BOTTOM AREA ===== -->
      <div v-if="loaded" class="bottom-actions">

        <!-- WEEK TOTAL CARD -->
        <div class="weekly-card">
          Week Total: {{ weeklyTotalFormatted }}
        </div>

        <!-- GO TO TIMECLOCK BTN -->
        <ion-button
          expand="block"
          class="go-clock-btn"
          @click="goClockEntry"
        >
          Go To Timeclock Entry
        </ion-button>

      </div>

      <!-- ⭐ Custom bottom spacer -->
      <div class="menu-bottom-spacer"></div>

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
  IonIcon,
  IonButton
} from "@ionic/vue";

import { onIonViewWillEnter, IonBackButton } from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import { ref, computed } from "vue";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";

import {
  warningOutline,
  logInOutline,
  logOutOutline,
  restaurantOutline,
  arrowForwardCircleOutline
} from "ionicons/icons";


/* ======================
   STATE
====================== */

const route   = useRoute();
const router  = useRouter();

const weekend    = ref<string>(route.params.weekend as string);
const weeklyTotal= ref<number>(0);
const dayGroups  = ref<any[]>([]);
const loaded     = ref(false);


/* ======================
   LOAD DATA
====================== */

onIonViewWillEnter(() => {
  loadData();
});

const loadData = async () => {
  loaded.value = false;

  try {

    const token  = await Preferences.get({ key: "authToken" });
    const site   = await Preferences.get({ key: "siteName" });
    const userId = await Preferences.get({ key: "userId" });

    const res = await api.post(
      "/clock-timesheet-detail",
      {
        site_name: site.value,
        user_id: Number(userId.value),
        weekend: weekend.value
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    weeklyTotal.value = Number(res.data.weekly_total || 0);

    const rows = res.data.rows || [];

    const groups: any[] = [];
    let currentGroup:any = null;
    let lastDate:string|null = null;

    rows.forEach((r:any) => {

      const date = r.tsio_timesheetbilldate;

      if (!currentGroup || lastDate !== date) {

        if (currentGroup) groups.push(currentGroup);

        currentGroup = {
          date,
          totalHours: 0,
          rows: []
        };

        lastDate = date;
      }

      currentGroup.rows.push({
        id: r.tsio_id,
        orderNumber: r.tsio_ordernumber,
        timeIn: r.tsio_timein,
        timeOut: r.tsio_timeout,
        workedHours: Number(r.tsio_workedhours || 0),
        clockInType: r.tsio_clockintype,
        clockOutType: r.tsio_clockouttype,
      });

      currentGroup.totalHours += Number(r.tsio_workedhours || 0);

    });

    if (currentGroup) groups.push(currentGroup);

    dayGroups.value = groups;

  } catch (err) {

    console.error("CLOCK DETAIL LOAD ERROR:", err);

  } finally {

    loaded.value = true;

  }
};


/* ======================
   FORMATTERS
====================== */

const weeklyTotalFormatted = computed(() =>
  formatHours(weeklyTotal.value)
);

const formatDate = (value:string) => {
  if (!value) return "";
  const [y,m,d] = value.split('-');
  return `${m}/${d}/${y}`;
};

const formatHours = (num:number) => {
  return `${num.toFixed(2)} hours`;
};

const formatTime = (t:string) => {

  if (!t) return "";

  const [h,m] = t.split(":");

  let hh = parseInt(h,10);
  const ampm = hh >= 12 ? "PM" : "AM";

  hh = hh % 12;
  if (hh === 0) hh = 12;

  return `${hh.toString().padStart(2,"0")}:${m} ${ampm}`;
};


/* ======================
   ICONS
====================== */

const getInIcon = (row:any) => {

  if (!row.timeIn) return warningOutline;

  return row.clockInType === 3
    ? arrowForwardCircleOutline
    : logInOutline;
};

const getOutIcon = (row:any) => {

  if (!row.timeOut) return warningOutline;

  return row.clockOutType === 2
    ? restaurantOutline
    : logOutOutline;
};


/* ======================
   NAV
====================== */

const goClockEntry = () => {
  router.push("/clock-entry");
};

</script>


<style scoped>

/* ----- TOP SUMMARY ----- */

.top-summary {
  margin-bottom: 12px;
}

.top-row {
  font-size: 15px;
  margin-bottom: 4px;
}


/* ----- DAY GROUP ----- */

.day-group {
  margin-bottom: 10px;
}

.day-header {
  display: flex;
  justify-content: space-between;
  color: rebeccapurple;
  font-weight: 600;
  margin: 8px 2px 4px;
}

.day-hours {
  color: teal;
}


/* ----- ENTRY ----- */

.entry-item {
  --inner-padding-top: 6px;
  --inner-padding-bottom: 6px;
}

.entry-line {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
}

.entry-icon {
  font-size: 18px;
  margin-right: 6px;
}

.entry-time {
  font-size: 14px;
  margin-right: 6px;
}

.entry-order {
  font-size: 11px;
  color: var(--ion-color-medium);
}

.entry-hours {
  margin-left: auto;
  align-self: center;
  font-weight: 600;
  color: teal;
}


/* ----- BOTTOM ----- */

.bottom-actions {
  margin-top: 18px;
}

.weekly-card {
  background: #3fa2b2;
  color: white;
  text-align: center;
  padding: 14px;
  border-radius: 10px;
  margin-bottom: 12px;
  font-size: 15px;
}

.go-clock-btn {
  --background: rgb(146, 18, 163);
  text-transform: none !important;
}

.back-button {
  text-transform: none !important;
}

/* ----- MISC ----- */

.loading {
  text-align: center;
  margin-top: 40px;
  color: var(--ion-color-medium);
}

.divider {
  --min-height: 1px;
}

.entry-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.entry-left {
  flex: 1;              /* left side flex grows */
}

.entry-hours-col {
  min-width: 90px;     /* ✅ lock column width */
  text-align: right;  /* ✅ align all numbers right */
  color: teal;
  font-weight: 600;
}

.menu-bottom-spacer {
  height: 50px;
}

</style>
