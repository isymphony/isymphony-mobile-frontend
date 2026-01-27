<template>
  <ion-page>
    <!-- Header -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Timeclock Entry</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-loading
      :is-open="!pageLoaded"
      message="Loading..."
      spinner="crescent"
    />

    <ion-content class="ion-padding" v-if="pageLoaded">

      <!-- ⭐ Pull to Refresh -->
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- ⭐ Employee Name + Job List -->
      <div class="top-card">
        <h2 class="emp-name">{{ userFirstName }}'s Job Order</h2>


        <div class="job-line" v-if="activeAssignment">
          <strong>Order #{{ activeAssignment.order_number }}</strong>
          <span v-if="activeAssignment.type_location">
            - {{ activeAssignment.type_location }}
          </span>
        </div>

        <ion-button
          v-if="hasMultipleAssignments"
          class="change-order-btn"
          @click="openAssignmentModal"
        >
          Change Order
        </ion-button>

      </div>

      <!-- ⭐ Main Buttons -->
      <div class="button-grid">

        <!-- CLOCK IN -->
        <div
          class="btn clock-blue"
          :class="{ disabled: !canPunch('IN') }"
          @click="showConfirm('IN')"
        >
          <ion-icon :icon="logInOutline" class="btn-icon"></ion-icon>
          <div class="btn-text">Clock In</div>
        </div>

        <!-- CLOCK OUT -->
        <div
          class="btn clock-blue"
          :class="{ disabled: !canPunch('OUT') }"
          @click="showConfirm('OUT')"
        >
          <ion-icon :icon="logOutOutline" class="btn-icon"></ion-icon>
          <div class="btn-text">Clock Out</div>
        </div>

        <!-- LUNCH START (optional) -->
        <div
          v-if="showLunch"
          class="btn clock-purple"
          :class="{ disabled: !canPunch('LUNCH_START') }"
          @click="showConfirm('LUNCH_START')"
        >
          <ion-icon :icon="restaurantOutline" class="btn-icon"></ion-icon>
          <div class="btn-text">Clock Out/<br />Lunch Start</div>
        </div>

        <!-- LUNCH END (optional) -->
        <div
          v-if="showLunch"
          class="btn clock-purple"
          :class="{ disabled: !canPunch('LUNCH_END') }"
          @click="showConfirm('LUNCH_END')"
        >
          <ion-icon :icon="arrowForwardCircleOutline" class="btn-icon"></ion-icon>
          <div class="btn-text">Clock In/<br />Lunch End</div>
        </div>

      </div>

      <!-- ⭐ Today's Punches -->
      <h3 class="section-title">Today's Punches</h3>

      <ion-list class="punch-list">
        <ion-item
          v-for="(p, index) in punches"
          :key="index"
          :class="getPunchRowClass(p)"
        >
          <ion-icon
            slot="start"
            :icon="getPunchIcon(p.type)"
            class="punch-icon"
          />

          <ion-label class="punch-text">
            <span v-if="p.type === 'MISSING'">
              Missing Punch
            </span>
            <span v-else>
              {{ formatPunchDateTime(p.punchTime) }}
            </span>
          </ion-label>
        </ion-item>
      </ion-list>

    </ion-content>

    <!-- ======= ASSIGNMENT MODAL ======= -->
    <ion-modal :is-open="showAssignmentModal" @didDismiss="closeAssignmentModal" class="assignment-modal">
      <ion-content class="ion-padding">
        <div class="all-modal-title">
          Choose the Order Number
        </div>
        <ion-list>
          <ion-item
            v-for="asg in assignments"
            :key="asg.assignment_id"
            button
            @click="selectAssignment(asg)"
            :detail="false"
          >
            <ion-label>
              Order #<strong>{{ asg.order_number }}</strong>
              <span v-if="asg.type_location">
                - {{ asg.type_location }}
              </span>
            </ion-label>

            <ion-icon
              v-if="tempAssignment?.assignment_id === asg.assignment_id"
              :icon="checkmarkOutline"
              slot="end"
              color="primary"
            />
          </ion-item>
        </ion-list>

        <div class="modal-actions">
          <ion-button fill="clear" @click="closeAssignmentModal">
            Cancel
          </ion-button>
          <ion-button @click="confirmAssignment">
            OK
          </ion-button>
        </div>

      </ion-content>

    </ion-modal>

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
  IonIcon,
  IonRefresher,
  IonRefresherContent, 
  IonLoading,
  IonModal,      
  IonFooter,     
  IonButton
} from "@ionic/vue";

import { alertController, loadingController, onIonViewWillEnter } from "@ionic/vue";
import { Geolocation } from "@capacitor/geolocation";

import { ref } from "vue";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";

import {
  warningOutline,
  logInOutline,
  logOutOutline,
  restaurantOutline,
  arrowForwardCircleOutline,
  checkmarkOutline,
} from "ionicons/icons";

const userFirstName = ref("");
const assignments = ref<any[]>([]);
const activeAssignment = ref<any | null>(null);
const tempAssignment   = ref<any | null>(null);   // assignment user selecting on modal
const showAssignmentModal = ref(false);
const hasMultipleAssignments = ref(false);
const punches = ref<any[]>([]);
const showLunch = ref(false); // <- will be loaded from Backend iu_showlunchstatusfunction
const currentState = ref<'NONE' | 'IN' | 'LUNCH' | 'LUNCH_END'>('NONE');

const pageLoaded = ref(false);

// Load everything
onIonViewWillEnter(async () => {
  await loadPageData();
});

const loadPageData = async () => {

  pageLoaded.value = false;

  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });
  const assignmentIdPref = await Preferences.get({ key: "defaultAssignmentId" });

  if (!token.value) {
    pageLoaded.value = true;
    return;
  }

  try {
    const sessionRes = await api.post(
      "/session-user-info",
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

    userFirstName.value = sessionRes.data.userinfo.iu_firstname;
    assignments.value = sessionRes.data.assignments;
    hasMultipleAssignments.value = assignments.value.length > 1;
    //console.log("User First Name:", userFirstName.value);
    //console.log("assignmentIdPref:", assignmentIdPref.value);
    //console.log("Assignments:", assignments.value);

    // find selected assignment
    activeAssignment.value =
    assignments.value.find(
      a => String(a.assignment_id) === assignmentIdPref.value
    ) || assignments.value[0];


    // Load Clock Entry Info
    const clockRes = await api.post(
      "/clockentry-info",
      {
        site_name: sitePref.value,
        user_id: Number(userIdPref.value),
        assignment_id: Number(assignmentIdPref.value),
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    showLunch.value   = clockRes.data.show_lunch === 1;
    punches.value     = clockRes.data.today_punches;
    currentState.value = clockRes.data.current_state ?? 'NONE';

    //console.log("Current State:", currentState.value);

  } catch (err) {
    console.error("ClockEntry load error:", err);
  } finally {
    pageLoaded.value = true;
  }

};

const canPunch = (action: string) => {

  switch (currentState.value) {

    case 'NONE':
      return action === 'IN';

    case 'IN':
      return action === 'OUT' || action === 'LUNCH_START';

    case 'LUNCH':
      return action === 'LUNCH_END';

    case 'LUNCH_END':
      return action === 'OUT';

    default:
      return false;
  }
};


const formatPunchDateTime = (value: string) => {
  if (!value) return "";

  const d = new Date(value);

  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

const getPunchIcon = (type: string) => {
  switch (type) {
    case "MISSING":
      return warningOutline;

    case "IN":
      return logInOutline;

    case "OUT":
      return logOutOutline;

    case "LUNCH_START":
      return restaurantOutline;

    case "LUNCH_END":
      return arrowForwardCircleOutline;

    default:
      return logInOutline;
  }
};

const showConfirm = async (action: string) => {

  const mapTitle:any = {
    "IN":"Confirm Clock In",
    "OUT":"Confirm Clock Out",
    "LUNCH_START":"Confirm Lunch Start",
    "LUNCH_END":"Confirm Lunch End"
  };

  const mapMessage:any = {
    "IN":"Are you sure you want to clock in?",
    "OUT":"Are you sure you want to clock out?",
    "LUNCH_START":"Are you sure you want to start lunch?",
    "LUNCH_END":"Are you sure you want to end lunch?"
  };

  const alert = await alertController.create({
    header: mapTitle[action],
    message: mapMessage[action],
    cssClass: "one-line-alert",
    buttons: [
      {
        text: "Cancel",
        role: "cancel"
      },
      {
        text: "Okay",
        handler: async ()=>{
          await showSpinner(action);
        }
      }
    ]
  });

  await alert.present();
};

let spinner:HTMLIonLoadingElement|null = null;

const showSpinner = async (action: string)=>{

   spinner = await loadingController.create({
      message: "Checking location..."
   });

   await spinner.present();

   try {

     const gps = await getCurrentLocation();

     await submitPunch(action, gps.latitude, gps.longitude);

   } catch(e:any) {

     console.error("PUNCH_FLOW_ERROR:", e);
     alert("Unable to process location.");

   }

   hideSpinner();
};

const submitPunch = async (
  action:string,
  latitude:number,
  longitude:number
) => {

  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });
  const assignmentIdPref = await Preferences.get({ key: "defaultAssignmentId" });

  if (!token.value) return;

  try {

    const res = await api.post("/clock-punch",
      {
        site_name: sitePref.value,
        user_id: Number(userIdPref.value),
        assignment_id: Number(assignmentIdPref.value),
        action: action,
        current_latitude: latitude,
        current_longitude: longitude
      },
      {
        timeout: 30000, //extended timeout for clock punch
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    // ---------------- HANDLE FAIL ----------------
    if (res.data.success === false) {

      if (res.data.error_type === "OUT_OF_RANGE") {

        const mapErrorTitle:any = {
          "IN":"Cannot Clock In",
          "OUT":"Cannot Clock Out",
          "LUNCH_START":"Cannot Lunch Start",
          "LUNCH_END":"Cannot Lunch End"
        };

        await showMessage(
          mapErrorTitle[action],
          `You’re too far away.\n\n` +
          `Work Location:\n${res.data.work_address}\n\n` +
          `You’re currently ${res.data.distance} miles away.\n\n` +
          `Please try again when you are closer.`
        );

      } else {
        await showMessage(
          "Error",
          res.data.message || "Clock action failed"
        );
      }

      return;
    }

    // ---------------- HANDLE SUCCESS ----------------
    await loadPageData();

  } catch(err:any) {

    console.error("CLOCK API ERROR:", err);
    await showMessage(
      "Network Error",
      "Network error while submitting punch."
    );

  }
};

const showMessage = async (
  title: string,
  message: string
) => {

  const alert = await alertController.create({
    header: title,
    message: message,
    cssClass: "alert-multiline",
    buttons: ["Ok"],
  });

  await alert.present();
};

const hideSpinner = async ()=>{
  spinner && await spinner.dismiss();
  spinner=null;
};

const getCurrentLocation = async () => {

  try {

    const permission = await Geolocation.requestPermissions();

    console.log("GPS permission:", permission);

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    console.log("CURRENT GPS:", lat, lon);

    return {
      latitude: lat,
      longitude: lon
    };

  } catch (err:any) {

    console.error("GPS ERROR:", err);

    throw err;
  }

};


/* =======================
   Row styling rule
======================= */
const getPunchRowClass = (p: any) => {
  if (p.type === "MISSING") return "punch-missing";
  if (p.highlight) return "punch-in";
  return "punch-normal";
};

const doRefresh = async (event: any) => {
  await loadPageData();
  event.target.complete();   // Stop spinner animation
};

// Punch method (temporary)
const clock = (type: string) => {
  console.log("Punch:", type);
};

const openAssignmentModal = () => {
  tempAssignment.value = activeAssignment.value; // ✅ reset every time opening the modal window
  showAssignmentModal.value = true;
};

const closeAssignmentModal = () => {
  showAssignmentModal.value = false;
  tempAssignment.value = null;   //for safety
};

const selectAssignment = (asg: any) => {
  tempAssignment.value = asg;
};

const confirmAssignment = async () => {
  if (!tempAssignment.value || !activeAssignment.value) {
    showAssignmentModal.value = false;
    return;
  }

  // ✅ if assigment not changed → don't reload
  if (
    tempAssignment.value.assignment_id ===
    activeAssignment.value.assignment_id
  ) {
    showAssignmentModal.value = false;
    return;
  }

  // ✅ User changed assignment
  activeAssignment.value = tempAssignment.value;

  await Preferences.set({
    key: "defaultAssignmentId",
    value: String(activeAssignment.value.assignment_id),
  });

  showAssignmentModal.value = false;

  await loadPageData(); // reload vì assignment đổi
};

</script>

<style scoped>
/* TOP CARD */
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

.emp-name {
  font-size: 20px;
  font-weight: 700;
  margin-top: 0;
  margin-bottom: 10px;
  color: var(--ion-text-color);
}

.job-line {
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--ion-color-medium);
}


/* MAIN BUTTON GRID */
.button-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 30px;
  margin-bottom: 30px;
}

/* BUTTON STYLE */
.btn {
  border-radius: 14px;
  padding: 22px 10px;
  text-align: center;
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.clock-blue {
  background: #2a8ca7;
}

.clock-purple {
  background: #8e24aa;
}

.btn-icon {
  font-size: 32px;
  margin-bottom: 6px;
}

.btn-text {
  font-size: 16px;
}

/* SECTION TITLE */
.section-title {
  font-size: 20px;
  font-weight: 700;
  margin-top: 30px;
  margin-bottom: 0;
}

/* ----- Today's Punches styling ----- */

ion-item {
  --min-height: 36px;      /* giảm height mỗi row */
  --padding-start: 10px;
  --padding-end: 10px;
  --inner-padding-end: 6px;
  --border-color: rgba(0,0,0,0.15);
}

html.dark ion-item {
  --border-color: rgba(255,255,255,0.10); /* dark */
}

ion-item ion-icon {
  font-size: 18px;        /* icon nhỏ lại */
  margin-right: 6px;
}

ion-item ion-label {
  font-size: 13px;        /* text nhỏ hơn */
}

.punch-item {
  --inner-padding-top: 6px;
  --inner-padding-bottom: 6px;
  --padding-start: 12px;
  --padding-end: 12px;
}

.punch-icon {
  font-size: 18px;     /* smaller icon */
}

.punch-text {
  font-size: 14px;     /* smaller datetime text */
  line-height: 1.3;
  margin: 0;
}

.punch-missing ion-icon,
.punch-missing ion-label {
  color: var(--ion-color-danger);
}

.punch-in ion-icon,
.punch-in ion-label {
  color: var(--ion-color-success);
}

.punch-normal ion-icon,
.punch-normal ion-label {
  color: var(--ion-text-color);
}

.btn.disabled {
  opacity: 0.35;
}

.change-order-btn {
  --background: #e0f2f5;
  --color: #2a8ca7;
  --border-radius: 7px;

  --padding-top: 2px;
  --padding-bottom: 2px;
  --padding-start: 10px;
  --padding-end: 10px;

  min-height: 24px;
  height: 24px;

  font-size: 12px;
  font-weight: 500;
  text-transform: none;

  margin-top: 6px;
}

/* ===== Dark mode ===== */
html.dark .change-order-btn {
  --background: #1f3f46;   /* dark teal */
  --color: #8bd0e0;        /* light teal text */
}

</style>

<style>
.one-line-alert .alert-message {
  white-space: nowrap !important;
  font-size: 12.5px !important;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert-multiline .alert-message {
  white-space: pre-line !important;
}

.assignment-modal {
  --width: 400px;
  --max-width: 90%;
  --height: 220px;
  --border-radius: 16px;
}

/* ===============================
   iOS – Today's Punches font fix
   =============================== */
/* Target actual rendered text node on iOS */
.ios .punch-text {
  font-size: 13px;
  line-height: 1.3;
  font-weight: 400;
  margin: 0;
}
.ios ion-list.punch-list ion-item {
  --min-height: 36px;
  --inner-padding-top: 6px;
  --inner-padding-bottom: 6px;
}


</style>