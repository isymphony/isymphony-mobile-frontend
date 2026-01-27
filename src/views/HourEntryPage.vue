<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button /></ion-buttons>
        <ion-title>Timesheet Entry</ion-title>
        <ion-button slot="end" fill="clear" size="small" class="go-bottom-btn" @click="goWeeklyGridEntry">Week Entry</ion-button>
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
          Order <strong>#{{ activeAssignment.order_number }}</strong>
          <span v-if="activeAssignment.type_location">
            - {{ activeAssignment.type_location }}
          </span>
        </div>

        <div class="job-line">
          Timesheet Status:
          <strong  class="status-text">{{ timesheetStatus }}</strong>
        </div>

        <div class="week-ending" v-if="weekEndingDisplay">
          Weekend: <strong>{{ weekEndingDisplay }}</strong>
        </div>        

        <ion-button
          v-if="hasMultipleAssignments"
          class="change-order-btn"
          @click="openAssignmentModal"
        >
          Change Order
        </ion-button>

      </div>

      <ion-list class="week-list">
        <ion-item
          v-for="day in weekDays"
          :key="day.date"
          button @click="onDaySelected(day)"
          :class="{
          'today-row': day.isToday,
          'week-ending-row': day.isWeekEnding
          }"
          :detail="false"
        >
          <ion-label>
            <div class="day-date">{{ day.displayDate }}</div>
            <div class="day-hours">Hours: {{ day.hours.toFixed(2) }}</div>
          </ion-label>

          <ion-icon
            slot="end"
            :icon="chevronForwardOutline"
            color="medium"
          />
        </ion-item>
      </ion-list>

      <!-- ⭐ Custom spacer -->
      <div class="custom-spacer"></div>

      <!-- ===== BOTTOM AREA ===== -->
      <div v-if="pageLoaded">

        <!-- GO TO TIMECLOCK BTN -->
        <ion-button
          expand="block"
          class="go-bottom-btn"
          @click="goToReviewTimesheet"
        >
          Review Timesheet
        </ion-button>

      </div>

      <!-- ⭐ Custom spacer -->
      <div class="custom-spacer"></div>

    </ion-content>

    <!-- ⭐ Day Actions Modal (replace ion-action-sheet) -->
    <ion-modal
      :is-open="showDayActionsModal"
      @didDismiss="closeDayActionsModal"
      class="day-actions-modal"
    >
      <ion-content class="ion-padding">
        <div class="all-modal-title">
          Update hours for {{ selectedDay?.displayDate }}
        </div>

        <div class="day-actions-list">
          <button class="day-actions-btn edit" @click="onEditHours">
            Edit Total Hours
          </button>

          <button class="day-actions-btn delete" @click="onDeleteHours">
            Delete Hours
          </button>
        </div>
      </ion-content>
    </ion-modal>

    <ion-modal
      :is-open="showDeleteModal"
      @didDismiss="closeDeleteModal"
      class="delete-hours-entry-modal"
    >
      <ion-content class="ion-padding">
        <div class="all-modal-title">
            Delete hours for {{ selectedDay?.displayDate }}
        </div>

        <div class="hours-modal-subtitle">
          Order <strong>#{{ activeAssignment?.order_number }}</strong>
          <span v-if="activeAssignment?.type_location">
            - {{ activeAssignment.type_location }}
          </span>
          <br>
          Hours: <strong>{{ selectedDay?.hours.toFixed(2) }}</strong>
        </div>

        <ion-item class="comments-input-item">
          <ion-textarea
            v-model="deleteComments"
            placeholder="Comments"
            auto-grow
          />
        </ion-item>

        <div class="modal-actions">
          <ion-button fill="clear" @click="closeDeleteModal">
            Cancel
          </ion-button>
          <ion-button color="danger" @click="confirmDeleteHours" :disabled="savingHours">
            <ion-spinner
              v-if="savingHours"
              name="crescent"
              slot="start"
            />
            OK
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>


    <!-- ⭐ Add / Edit Hours Modal -->
    <ion-modal
      :is-open="showHoursModal"
      @didDismiss="onHoursModalDismiss"
      class="addedit-hours-entry-modal"
    >
      <ion-content class="ion-padding">
        <div class="all-modal-title">
          {{ hoursModalTitle }}
        </div>

        <div class="hours-modal-subtitle">
          Order #{{ activeAssignment?.order_number }}
          <span v-if="activeAssignment?.type_location">
            - {{ activeAssignment.type_location }}
          </span>
        </div>

        <!-- Inputs -->
        <ion-item class="hours-input-item">
          <ion-input
            v-model="modalHours"
            type="number"
            inputmode="decimal"
            placeholder="0.00"
            class="hours-input"
            @ionInput="() => validateHours(modalHours)"
            @ionBlur="formatModalHours"
          />
        </ion-item>
        <!-- Inline error under input -->
        <div v-if="hoursError" class="field-error">
          {{ hoursError }}
        </div>

        <ion-item class="comments-input-item">
          <ion-textarea
            v-model="modalComments"
            placeholder="Comments"
            auto-grow
          />
        </ion-item>

        <!-- Actions -->
        <div class="modal-actions">
          <ion-button fill="clear" @click="closeHoursModal">
            Cancel
          </ion-button>
          <ion-button @click="confirmHours" :disabled="savingHours">
            <ion-spinner
              v-if="savingHours"
              name="crescent"
              slot="start"
            />
            OK
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>

    <!-- ======= ASSIGNMENT MODAL ======= -->
    <ion-modal :is-open="showAssignmentModal" presentation="modal" @didDismiss="closeAssignmentModal" class="assignment-modal">
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
  IonButton,
  IonInput,
  IonTextarea,
  IonSpinner,
} from "@ionic/vue";

import { toastController } from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import { onIonViewWillEnter } from "@ionic/vue";
import { ref, computed } from "vue";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";
import {
  checkmarkOutline, chevronForwardOutline, 
} from "ionicons/icons";

const userFirstName = ref("");
const assignments = ref<any[]>([]);
const activeAssignment = ref<any | null>(null);
const tempAssignment   = ref<any | null>(null);   // assignment user selecting on modal
const showAssignmentModal = ref(false);
const hasMultipleAssignments = ref(false);
const weekDays = ref<WeekDayItem[]>([]);
const selectedDay = ref<WeekDayItem | null>(null);
const showDayActionSheet = ref(false); // Action sheet (Edit / Delete)
const showDayActionsModal = ref(false);
const timesheetStatus = ref<string>("New Timesheet");
const savingHours = ref(false);

// Add / Edit modal
const showHoursModal = ref(false);
const modalHours = ref("");
const modalComments = ref("");

const showDeleteModal = ref(false);
const deleteComments = ref("");

const pageLoaded = ref(false);

const weekEndingDate = ref<string>("");        // YYYY-MM-DD
const weekEndingDisplay = ref<string>("");    // Saturday 12/20/2025

const hoursError = ref<string>("");

const route = useRoute();
const router = useRouter();

interface WeekDayItem {
  date: string;        // YYYY-MM-DD
  displayDate: string; // Sat, 12/20
  hours: number;
  comments?: string;
  isToday?: boolean;
  isWeekEnding?: boolean;
}

const resetDayAction = () => {
  showDayActionSheet.value = false;
};

// Convert a YYYY-MM-DD string into a local Date (avoids UTC parsing shift)
const parseLocalYmd = (ymd: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d); // Local time midnight
};

// Format a Date to YYYY-MM-DD using local time
const formatYmdLocal = (dt: Date): string => {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};


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

    const weekEndingDay = sessionRes.data.userinfo.iu_weekendingday;

    // Calculate week ending date
    initWeekEnding(weekEndingDay);

    // build week days list
    buildWeekDays();

    await loadWeekHours();

  } catch (err) {
    console.error("HourEntry load error:", err);
  } finally {
    pageLoaded.value = true;
  }

};

// Calculate the week ending date based on today and user's week ending day
const calculateWeekEndingDate = (weekEndingDay: string) => {
  const today = new Date();
  const daysOfWeek = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const todayIndex = today.getDay();
  const targetIndex = daysOfWeek.indexOf(weekEndingDay);

  let diff = targetIndex - todayIndex;
  if (diff < 0) diff += 7;

  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + diff);

  weekEndingDate.value = formatYmdLocal(weekEnd);
  setWeekEndingDisplay();
};

const initWeekEnding = (weekEndingDay: string) => {
  // 1. From route (Pending / History)
  if (route.query.weekend) {
    weekEndingDate.value = String(route.query.weekend);
    setWeekEndingDisplay();
    return;
  }

  // 2. Default behavior (Today)
  calculateWeekEndingDate(weekEndingDay);
};

const setWeekEndingDisplay = () => {
  const displayDate = parseLocalYmd(weekEndingDate.value);
  weekEndingDisplay.value = displayDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
};

// Build a 7-day list ending on weekEndingDate (descending order)
const buildWeekDays = () => {
  if (!weekEndingDate.value) return;

  const endDate = parseLocalYmd(weekEndingDate.value);
  const todayYmd = formatYmdLocal(new Date());

  const days: WeekDayItem[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);

    const ymd = formatYmdLocal(d);
    const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat

    days.push({
      date: ymd,
      displayDate: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "2-digit",
        day: "2-digit"
      }),
      hours: 0,
      isToday: ymd === todayYmd,
      isWeekEnding: dayOfWeek === 0 || dayOfWeek === 6
    });
  }

  weekDays.value = days;
};

// Load approved hours for the selected week and assignment
const loadWeekHours = async () => {
  if (!weekEndingDate.value || !activeAssignment.value) return;

  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });
  const clientIdPref = await Preferences.get({ key: "clientId" });
  const assignmentIdPref = await Preferences.get({ key: "defaultAssignmentId" });

  try {
    const res = await api.post(
      "/week-hours",
      {
        site_name: sitePref.value,
        week_ending_date: weekEndingDate.value,
        client_id: Number(clientIdPref.value),
        user_id: Number(userIdPref.value),
        assignment_id: Number(assignmentIdPref.value)
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    if (res.data.success) {
      timesheetStatus.value = res.data.status_by_assignment || "New Timesheet";
      mergeWeekHours(res.data.timesheet_data);
    }
  } catch (err) {
    console.error("Failed to load week hours", err);
  }
};

const saveDayHours = async (workedHours: number) => {
  if (!selectedDay.value) return;

  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });
  const clientIdPref = await Preferences.get({ key: "clientId" });
  const assignmentIdPref = await Preferences.get({ key: "defaultAssignmentId" });

  await api.post(
    "/save-day-hours",
    {
      site_name: sitePref.value,
      client_id: Number(clientIdPref.value),
      user_id: Number(userIdPref.value),
      assignment_id: Number(assignmentIdPref.value),
      order_number: activeAssignment.value.order_number,
      timesheet_bill_date: selectedDay.value.date,
      week_ending_date: weekEndingDate.value,
      worked_hours: workedHours,
      previous_worked_hours: selectedDay.value.hours,
      comments: selectedDay.value.comments
    },
    { headers: { Authorization: `Bearer ${token.value}` } }
  );

  showDayActionSheet.value = false;
  showHoursModal.value = false;

  await loadWeekHours();
};


// Merge backend hours into the generated 7-day list
const mergeWeekHours = (rows: any[]) => {
  // Build a map: YYYY-MM-DD -> total_hours
  const hoursMap = new Map<string, number>();

  rows.forEach((r) => {
    hoursMap.set(r.ts_timesheetbilldate, Number(r.total_hours));
  });

  weekDays.value = weekDays.value.map((day) => ({
    ...day,
    hours: hoursMap.get(day.date) ?? 0
  }));
};

// Handle tap on a day row
const onDaySelected = (day: WeekDayItem) => {
  selectedDay.value = day;

  if (day.hours === 0) {
    openHoursModal("add");
  } else {
    openDayActionsModal(); // ✅ replace action-sheet
  }
};

const openDayActionsModal = () => {
  showDayActionsModal.value = true;
};

const closeDayActionsModal = () => {
  showDayActionsModal.value = false;
};

const onEditHours = () => {
  closeDayActionsModal();
  openHoursModal("edit");
};

const onDeleteHours = () => {
  closeDayActionsModal();
  openDeleteModal();
};

const hoursModalTitle = computed(() => {
  if (!selectedDay.value) return "";
  return selectedDay.value.hours === 0
    ? `Enter hours for ${selectedDay.value.displayDate}`
    : `Update hours for ${selectedDay.value.displayDate}`;
});

// Open modal for add or edit
const openHoursModal = (mode: "add" | "edit") => {
  console.log("OPEN MODAL", mode);
  if (!selectedDay.value) return;

  modalHours.value =
    mode === "edit"
      ? selectedDay.value.hours.toFixed(2)
      : "";

  //modalComments.value = selectedDay.value.comments || ""; // ✅ don't pre-fill comments, user should enter them

  showDayActionSheet.value = false;
  showHoursModal.value = true;
};

const closeHoursModal = () => {
  showHoursModal.value = false;
};

const onHoursModalDismiss = () => {
  showHoursModal.value = false;

  modalHours.value = "";
  modalComments.value = "";
};

const validateHours = (raw: string): boolean => {
  // Clear previous error
  hoursError.value = "";

  const val = Number(raw);

  // Empty is not valid for add/edit
  if (raw === "" || Number.isNaN(val)) {
    hoursError.value = "Please enter hours between 0.00 and 24.00";
    return false;
  }

  // Range check
  if (val < 0 || val > 24) {
    hoursError.value = "Hours must be between 0.00 and 24.00";
    return false;
  }

  return true;
};

// Confirm add / edit (local only)
const confirmHours = async () => {
  if (!selectedDay.value) return;

  const hours = Number(modalHours.value);

  // Validate before submit
  if (!validateHours(modalHours.value)) {
    return;
  }

  selectedDay.value.comments = modalComments.value;
  
  savingHours.value = true;

  try {
    await saveDayHours(hours);   // API + reload week
    closeHoursModal();           // and close the modal
  } catch (err) {
    presentToast("Failed to update hours. Please try again.");
  } finally {
    savingHours.value = false;
  }
};

const presentToast = async (message: string) => {
  const toast = await toastController.create({
    message,
    duration: 2000,
    position: "top",
    color: "danger" // or "warning"
  });

  await toast.present();
};

const formatModalHours = () => {
  if (modalHours.value === "") return;

  modalHours.value = Number(modalHours.value).toFixed(2);
};

const openDeleteModal = () => {
  if (!selectedDay.value) return;

  deleteComments.value = "";
  showDayActionSheet.value = false;
  showDeleteModal.value = true;
};

const confirmDeleteHours = async () => {
  if (!selectedDay.value) return;

  savingHours.value = true;

  try {
    selectedDay.value.comments = deleteComments.value;
    await saveDayHours(0);
    closeDeleteModal();
  } catch (err) {
    presentToast("Failed to delete hours.");
  } finally {
    savingHours.value = false;
  }
};

const closeDeleteModal = () => {
  showDeleteModal.value = false;
  deleteComments.value = "";
};

const doRefresh = async (event: any) => {
  await loadPageData();
  event.target.complete();   // Stop spinner animation
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

  await loadPageData(); // reload since changed assignment
};

const goToReviewTimesheet = () => {
  router.push({
    path: "/review-timesheet",
    query: {
      weekend: weekEndingDate.value,   // YYYY-MM-DD
      from: "hour-entry"
    }
  });
};

const goWeeklyGridEntry = () => {
  router.push({
    path: "/weekly-grid-entry",
    query: {
      weekend: weekEndingDate.value
    }
  });
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

.week-ending {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
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



.week-list ion-item {
  --padding-start: 12px;
  --padding-end: 12px;
}

html.dark .week-list {
  --ion-item-border-color: rgba(255, 255, 255, 0.22);
}

.day-date {
  font-size: 15px;
  font-weight: 600;
}

.day-hours {
  font-size: 13px;
  color: var(--ion-color-medium);
}

/* Today highlight */
.week-list ion-item.today-row {
  --background: #e6f4ea; /* light green */
}

html.dark .week-list ion-item.today-row {
  --background: rgba(76, 175, 80, 0.18);
}

/* Week ending highlight */
.week-list ion-item.week-ending-row {
  --background: #fff8e1; /* light yellow */
}

html.dark .week-list ion-item.week-ending-row {
  --background: rgba(255, 235, 59, 0.18);
}


.modal-title {
  font-size: 16px;
}

.modal-subtitle {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin-bottom: 12px;
}

.hours-input {
  text-align: right;
}

.hours-modal-subtitle {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

.hours-input-item {
  --background: transparent;
  --border-radius: 10px;
  margin-bottom: 12px;
}

/* Light mode */
.hours-input-item ion-input {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  padding: 10px;
}

/* Dark mode */
html.dark .hours-input-item ion-input {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Right align hours */
.hours-input {
  text-align: right;
  font-size: 16px;
  font-weight: 500;
}

.field-error {
  margin-top: -8px;
  margin-bottom: 10px;
  padding-right: 15px;
  font-size: 12px;
  font-weight: 500;
  text-align: right;
  color: var(--ion-color-danger);
}

.comments-input-item {
  --background: transparent;
  --border-radius: 10px;
}

/* Light mode */
.comments-input-item ion-textarea {
  --padding-start: 6px;
  --padding-end: 6px;
  --padding-top: 6px;
  --padding-bottom: 6px;
  line-height: 1.4;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  padding: 10px;
}

/* Dark mode */
html.dark .comments-input-item ion-textarea {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

ion-action-sheet .action-sheet-title {
  font-size: 14px;      /* default ~17px */
  font-weight: 600;
}

.custom-spacer {
  height: 10px;
}

.status-text {
  color: rgb(146, 18, 163);
  font-weight: 600;
}
</style>

<style>
.addedit-hours-entry-modal {
  --width: 380px;
  --max-width: 92%;
  --height: 320px;
  --border-radius: 16px;
}

.delete-hours-entry-modal {
  --width: 430px;
  --max-width: 92%;
  --height: 280px;
  --border-radius: 16px;
}

.assignment-modal {
  --width: 200px;
  --max-width: 90%;
  --height: 220px;
  --border-radius: 16px;
}

.day-actions-modal {
  --width: 360px;
  --max-width: 92%;
  --height: 150px;
  --border-radius: 16px;
}

.day-actions-list {
  display: flex;
  flex-direction: column;
  gap: 5px; /* controls spacing between links */
}

.day-actions-btn {
  width: 100%;
  text-align: left;
  padding: 10px 12px;          /* controls compactness */
  border-radius: 10px;
  background: var(--ion-background-color);
  font-size: 14px;              /* link font size */
  font-weight: 500;
}

.day-actions-btn.edit {
  color: rgb(151, 33, 206);               /* purple */
}

.day-actions-btn.delete {
  color: #e53935;               /* red */
}

html.dark .day-actions-btn.edit {
  color: #c27be4;               /* brighter purple */
}

html.dark .day-actions-btn.delete {
  color: #ff6b6b;               /* brighter red */
}

</style>