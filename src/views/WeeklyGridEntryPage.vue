<template>
  <ion-page>
    <!-- Header -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-menu-button /></ion-buttons>
        <ion-title>Weekly Grid Entry</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-loading
      :is-open="loading"
      message="Loading..."
      spinner="crescent"
    />

    <ion-content class="ion-padding" v-if="pageReady">
      <!-- Pull to Refresh -->
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Top card -->
      <div class="top-card">
        <h2 class="emp-name">{{ userFirstName }}'s Weekly Hours</h2>

        <div class="job-line" v-if="activeAssignment">
          Order <strong>#{{ activeAssignment.order_number }}</strong>
          <span v-if="activeAssignment.type_location">
            - {{ activeAssignment.type_location }}
          </span>
        </div>

        <div class="job-line">
          Timesheet Status:
          <strong class="status-text">{{ timesheetStatus }}</strong>
        </div>

        <div class="week-ending" v-if="weekendDisplay">
          Weekend: <strong>{{ weekendDisplay }}</strong>
        </div>

        <ion-button
          v-if="hasMultipleAssignments"
          class="change-order-btn"
          @click="openAssignmentModal"
        >
          Change Order
        </ion-button>
      </div>

      <!-- Shortcuts -->
      <div class="shortcut-row">
        <ion-button class="shortcut-btn" size="small" fill="outline" @click="copyLastWeek">
          Copy Last Week
        </ion-button>

        <ion-button class="shortcut-btn" size="small" fill="outline" @click="fillMonFri">
          Fill Mon–Fri = 8.00
        </ion-button>

        <ion-button class="shortcut-btn danger" size="small" fill="outline" @click="clearWeek">
          Clear Week
        </ion-button>
      </div>

      <!-- Weekly Grid -->
      <ion-list class="grid-list">
        <ion-item
          v-for="d in weekDays"
          :key="d.date"
          class="grid-item"
          :class="{
            today: d.isToday,
            weekend: d.isWeekend
          }"
        >
            <ion-label class="day-label">
            <div class="day-title">{{ d.display }}</div>

            <div
                v-if="d.previousHours > 0"
                class="day-sub"
            >
                [
                {{ d.previousHours.toFixed(2) }}
                {{ d.previousHours === 1 ? "Hr" : "Hrs" }}
                ]
            </div>
            </ion-label>

            <div class="input-col">
            <div class="input-row">
                <ion-input
                v-model="d.hoursInput"
                type="number"
                inputmode="decimal"
                placeholder="0.00"
                class="hours-input"
                @ionBlur="onHoursBlur(d)"
                /><span class="hrs-label">Hrs</span>
                <!-- Comment icon -->
                <ion-icon
                    :icon="chatbubbleOutline"
                    class="comment-icon"
                    :class="{ active: !!d.comment }"
                    @click.stop="openCommentModal(d)"
                />
            </div>

            <div v-if="d.error" class="inline-error">
                {{ d.error }}
            </div>
            </div>

        </ion-item>
      </ion-list>

      <!-- Footer total + save -->
      <div class="bottom-summary">
        <div class="big-total">
          Week Total: {{ weekTotal.toFixed(2) }} hrs
        </div>

        <ion-button
          expand="block"
          class="go-bottom-btn"
          :disabled="!isDirty || !canSave"
          @click="saveWeek"
        >
          Save Week
        </ion-button>
        <ion-note
          v-if="!isDirty"
          class="save-hint"
        >
          No changes to save
        </ion-note>        

        <ion-button
          expand="block"
          class="go-bottom-btn"
          :disabled="!canReviewTimesheet"
          @click="goToReviewTimesheet"
        >
          Review Timesheet
        </ion-button>

        <ion-note
          v-if="isDirty"
          class="review-hint"
        >
          Please save your changes before reviewing timesheet
        </ion-note>

      </div>
    </ion-content>

    <ion-alert
      :is-open="showUnsavedAlert"
      header="Unsaved Changes"
      message="You have unsaved changes. Changing order will discard them. Continue?"
      :buttons="unsavedAlertButtons"
      @didDismiss="showUnsavedAlert = false"
    />

    <!-- Comments Modal-->
    <ion-modal
    :is-open="showCommentModal"
    @didDismiss="closeCommentModal"
    class="comment-modal"
    >
    <ion-content class="ion-padding">
        <div class="comment-modal-title">
            Comments for {{ selectedDayForComment?.display }}
        </div>

        <div class="comment-modal-subtitle">
          Order <strong>#{{ activeAssignment?.order_number }}</strong>
          <span v-if="activeAssignment?.type_location">
            - {{ activeAssignment.type_location }}
          </span>
        </div>

        <ion-item class="comments-input-item">
            <ion-textarea
            v-model="commentDraft"
            auto-grow
            placeholder="Enter comments"
            />
        </ion-item>

        <div class="modal-actions">
        <ion-button fill="clear" @click="closeCommentModal">
            Cancel
        </ion-button>
        <ion-button @click="saveComment">
            Save
        </ion-button>
        </div>
    </ion-content>
    </ion-modal>

    <!-- Assignment Modal (REQUIRED when assignment invalid) -->
    <ion-modal
      :is-open="showAssignmentModal"
      @didDismiss="onAssignmentDismiss"
      class="assignment-modal"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>Choose the Order Number</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <ion-list>
          <ion-item
            v-for="asg in assignments"
            :key="asg.assignment_id"
            button
            @click="selectAssignment(asg)"
          >
            <ion-label>
              Order #<strong>{{ asg.order_number }}</strong>
              <span v-if="asg.type_location"> - {{ asg.type_location }}</span>
              <div class="asg-dates">
                {{ asg.start_date }} → {{ asg.end_date ?? "open" }}
              </div>
            </ion-label>

            <ion-icon
              v-if="tempAssignment?.assignment_id === asg.assignment_id"
              :icon="checkmarkOutline"
              slot="end"
              color="primary"
            />
          </ion-item>
        </ion-list>
      </ion-content>

      <ion-footer>
        <div class="modal-actions">
          <ion-button fill="clear" @click="closeAssignmentModal">
            Cancel
          </ion-button>
          <ion-button @click="confirmAssignment">
            OK
          </ion-button>
        </div>
      </ion-footer>
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
  IonLoading,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonModal,
  IonAlert,
  IonFooter,
  IonIcon,
  IonNote,
  IonTextarea
} from "@ionic/vue";
import { onIonViewWillEnter } from "@ionic/vue";
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";
import { chatbubbleOutline, checkmarkOutline } from "ionicons/icons";

/** ---------- Types ---------- */
interface Assignment {
  assignment_id: number;
  order_number: string;
  type_location?: string | null;
  start_date?: string | null;
  end_date?: string | null; // YYYY-MM-DD
}

interface GridDay {
  date: string;        // YYYY-MM-DD
  display: string;     // Fri, 12/19
  hoursInput: string;  // input string
  hours: number;       // parsed number
  previousHours: number;
  error?: string;
  isToday: boolean;
  isWeekend: boolean;
  comment?: string;
  previousComment?: string;
}

/** ---------- State ---------- */
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const pageReady = ref(false);

const userFirstName = ref("");
const assignments = ref<Assignment[]>([]);
const hasMultipleAssignments = ref(false);

const activeAssignment = ref<Assignment | null>(null);
const tempAssignment = ref<Assignment | null>(null);
const showAssignmentModal = ref(false);
const assignmentForced = ref(false); // true when modal opened because pref assignment invalid

const timesheetStatus = ref<string>("New Timesheet");

const weekEndingDay = ref<string>("Saturday");
const weekend = ref<string>(""); // YYYY-MM-DD
const weekendDisplay = ref<string>("");

const weekDays = ref<GridDay[]>([]);

const showCommentModal = ref(false);
const selectedDayForComment = ref<GridDay | null>(null);
const commentDraft = ref("");

const isDirty = ref(false);
const showUnsavedAlert = ref(false);

const canReviewTimesheet = computed(() => {
  return !isDirty.value;
});

/** ---------- Date helpers (timezone-safe) ---------- */
const parseLocalYmd = (ymd: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight
};

const formatYmdLocal = (dt: Date): string => {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const isSameYmdAsToday = (ymd: string): boolean => {
  const t = new Date();
  return ymd === formatYmdLocal(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
};

const isWeekendDay = (ymd: string): boolean => {
  const d = parseLocalYmd(ymd);
  const dow = d.getDay(); // 0 Sun .. 6 Sat
  return dow === 0 || dow === 6;
};

/** ---------- Assignment validation ---------- */
const isAssignmentValid = (asg: Assignment | null): boolean => {
  if (!asg) return false;
  if (!asg.end_date) return true;

  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(asg.end_date + "T00:00:00");

  return end >= todayLocal;
};

const resolveInitialAssignment = async (): Promise<boolean> => {
  const pref = await Preferences.get({ key: "defaultAssignmentId" });
  const prefId = pref.value ? String(pref.value) : "";

  const found = assignments.value.find(a => String(a.assignment_id) === prefId) || null;

  if (!found || !isAssignmentValid(found)) {
    activeAssignment.value = null;
    tempAssignment.value = null;
    assignmentForced.value = true;
    showAssignmentModal.value = true;
    return false;
  }

  activeAssignment.value = found;
  return true;
};

/** ---------- Weekend init ---------- */
const calculateWeekendFromToday = (weekEndingDayName: string) => {
  const today = new Date();
  const names = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const todayIdx = today.getDay();
  const targetIdx = names.indexOf(weekEndingDayName);

  let diff = targetIdx - todayIdx;
  if (diff < 0) diff += 7;

  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  end.setDate(end.getDate() + diff);

  weekend.value = formatYmdLocal(end);
};

const setWeekendDisplay = () => {
  const dt = parseLocalYmd(weekend.value);
  weekendDisplay.value = dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const initWeekend = () => {
  // from route: ?weekend=YYYY-MM-DD
  if (route.query.weekend) {
    weekend.value = String(route.query.weekend);
    setWeekendDisplay();
    return;
  }

  calculateWeekendFromToday(weekEndingDay.value);
  setWeekendDisplay();
};

/** ---------- Build grid ---------- */
const buildGrid = () => {
  const end = parseLocalYmd(weekend.value);
  const days: GridDay[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);

    const ymd = formatYmdLocal(d);

    days.push({
      date: ymd,
      display: d.toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit" }),
      hoursInput: "0.00",
      hours: 0,
      previousHours: 0,
      error: "",
      isToday: isSameYmdAsToday(ymd),
      isWeekend: isWeekendDay(ymd),
    });
  }

  // show descending (weekend -> previous)
  weekDays.value = days;
};

/** ---------- Load week hours (from your existing API) ---------- */
const loadWeekHours = async () => {
  if (!activeAssignment.value) return;

  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });
  const clientIdPref = await Preferences.get({ key: "clientId" });

  const res = await api.post(
    "/week-hours",
    {
      site_name: sitePref.value,
      week_ending_date: weekend.value,
      client_id: Number(clientIdPref.value),
      user_id: Number(userIdPref.value),
      assignment_id: Number(activeAssignment.value.assignment_id),
    },
    {
      headers: { Authorization: `Bearer ${token.value}`, Accept: "application/json" },
    }
  );

  if (!res.data?.success) return;

  timesheetStatus.value = res.data.status_by_assignment || "New Timesheet";

  const hoursMap = new Map<string, number>();
  const commentMap = new Map<string, string>();
  (res.data.timesheet_data || []).forEach((r: any) => {
     const date = String(r.ts_timesheetbilldate);
    hoursMap.set(date, Number(r.total_hours));
    if (r.ts_comments) {
      commentMap.set(date, r.ts_comments);
    }
  });

  weekDays.value = weekDays.value.map((d) => {
    const h = hoursMap.get(d.date) ?? 0;
    const c = commentMap.get(d.date) ?? "";
    return {
      ...d,
      hours: h,
      previousHours: h,   // ⭐ remember original
      hoursInput: Number(h).toFixed(2),
      comment: c,
      previousComment: c, // ⭐ remember original
      error: "",
    };
  });

  isDirty.value = false;
};

/** ---------- Input handling ---------- */
const normalizeHours = (raw: string): { ok: boolean; value: number; error?: string } => {
  const v = Number(raw);
  if (Number.isNaN(v)) return { ok: false, value: 0, error: "Invalid number" };
  if (v < 0 || v > 24) return { ok: false, value: v, error: "Hours must be between 0.00 and 24.00" };
  return { ok: true, value: v };
};

const onHoursBlur = (day: GridDay) => {
  const r = normalizeHours(day.hoursInput);

  if (!r.ok) {
    day.error = r.error || "Invalid";
    return;
  }

  if (day.hours !== r.value) {
    markDirty(); // ⭐ only when changed
  }

  day.error = "";
  day.hours = r.value;
  day.hoursInput = r.value.toFixed(2);
};

/** ---------- Shortcuts ---------- */
const fillMonFri = () => {
  // set Mon-Fri = 8.00 (based on each day's actual DOW)
  weekDays.value.forEach((d) => {
    const dt = parseLocalYmd(d.date);
    const dow = dt.getDay(); // 1..5 Mon-Fri
    if (dow >= 1 && dow <= 5) {
      d.hours = 8;
      d.hoursInput = "8.00";
      d.error = "";
    }
  });

  markDirty();
};

const clearWeek = () => {
  weekDays.value.forEach((d) => {
    d.hours = 0;
    d.hoursInput = "0.00";
    d.comment = "";
    d.error = "";
  });

  markDirty();
};

const copyLastWeek = async () => {
  // load last week's hours via /week-hours, then copy into current grid.

  if (!activeAssignment.value) return;

  loading.value = true;

  try {
    const lastWeekend = (() => {
      const end = parseLocalYmd(weekend.value);
      const prev = new Date(end);
      prev.setDate(end.getDate() - 7);
      return formatYmdLocal(prev);
    })();

    const token = await Preferences.get({ key: "authToken" });
    const sitePref = await Preferences.get({ key: "siteName" });
    const userIdPref = await Preferences.get({ key: "userId" });
    const clientIdPref = await Preferences.get({ key: "clientId" });

    const res = await api.post(
      "/week-hours",
      {
        site_name: sitePref.value,
        week_ending_date: lastWeekend,
        client_id: Number(clientIdPref.value),
        user_id: Number(userIdPref.value),
        assignment_id: Number(activeAssignment.value.assignment_id),
      },
      { headers: { Authorization: `Bearer ${token.value}`, Accept: "application/json" } }
    );

    if (!res.data?.success) return;

    const preHoursMap = new Map<string, number>();
    const prevCommentMap = new Map<string, string>();
    (res.data.timesheet_data || []).forEach((r: any) => {
      const date = String(r.ts_timesheetbilldate);
      preHoursMap.set(date, Number(r.total_hours));
      if (r.ts_comments) {
        prevCommentMap.set(date, r.ts_comments);
      }
    });

    // copy by weekday position: (weekend->weekend-6)
    // easiest: compute each day last week date = current date - 7
    weekDays.value.forEach((d) => {
      const cur = parseLocalYmd(d.date);
      const prev = new Date(cur);
      prev.setDate(cur.getDate() - 7);
      const prevYmd = formatYmdLocal(prev);

      const h = preHoursMap.get(prevYmd) ?? 0;
      const c = prevCommentMap.get(prevYmd) ?? "";
      d.hours = h;
      d.hoursInput = Number(h).toFixed(2);
      d.comment = c;
      d.error = "";
    });

    markDirty();

  } finally {
    loading.value = false;
  }
};

/** ---------- Save Week ---------- */
const canSave = computed(() => {
  if (!activeAssignment.value) return false;
  // if any error exists -> cannot save
  return weekDays.value.every(d => !d.error);
});

const saveWeek = async () => {
  if (!activeAssignment.value) return;

  // force blur formatting/validation for all
  weekDays.value.forEach(onHoursBlur);
  if (!canSave.value) return;

  loading.value = true;

  console.log("Saving week for weekend:", weekend.value);

  try {
    const token = await Preferences.get({ key: "authToken" });
    const sitePref = await Preferences.get({ key: "siteName" });
    const userIdPref = await Preferences.get({ key: "userId" });
    const clientIdPref = await Preferences.get({ key: "clientId" });
    const assignmentIdPref = await Preferences.get({ key: "defaultAssignmentId" });

    // Save per day (reuse your existing add/edit/delete flow: workedhours + previous)
    // IMPORTANT: You need to change "/save-hours" to your real endpoint.
    for (const d of weekDays.value) {
      
      if (!isDayChanged(d)) {
        continue; // ⭐ SKIP
      }

      await api.post(
        "/save-day-hours",
        {
          site_name: sitePref.value,
          client_id: Number(clientIdPref.value),
          user_id: Number(userIdPref.value),
          assignment_id: Number(assignmentIdPref.value),
          order_number: activeAssignment.value.order_number,
          timesheet_bill_date: d.date,
          week_ending_date: weekend.value,
          worked_hours: Number(d.hours.toFixed(2)),
          previous_worked_hours: Number(d.previousHours.toFixed(2)),
          comments: d.comment
        },
        { headers: { Authorization: `Bearer ${token.value}`, Accept: "application/json" } }
      );
    }

    // reload week hours from backend (source of truth)
    await loadWeekHours();

    isDirty.value = false;
  } catch (e) {
    console.error("Save week failed", e);
  } finally {
    loading.value = false;
  }
};

/** ---------- Assignment modal handlers ---------- */
const openAssignmentModal = () => {

  if (isDirty.value) {
    showUnsavedWarning();
    return;
  }

  tempAssignment.value = activeAssignment.value;
  assignmentForced.value = false;
  showAssignmentModal.value = true;
};

const closeAssignmentModal = () => {
  showAssignmentModal.value = false;
};

const unsavedAlertButtons = [
  {
    text: "Cancel",
    role: "cancel"
  },
  {
    text: "Discard Changes",
    handler: () => {
      isDirty.value = false;
      openAssignmentModal(); // retry
    }
  }
];

const showUnsavedWarning = () => {
  showUnsavedAlert.value = true;
};


const onAssignmentDismiss = () => {
  showAssignmentModal.value = false;

  // if modal was forced (because pref assignment invalid) and user dismisses without selecting,
  // keep page not-ready (so they must choose)
  if (assignmentForced.value && !activeAssignment.value) {
    // keep it forced - user must pick
    showAssignmentModal.value = true;
  }
};

const selectAssignment = (asg: Assignment) => {
  tempAssignment.value = asg;
};

const confirmAssignment = async () => {
  if (!tempAssignment.value) return;

  if (!isAssignmentValid(tempAssignment.value)) {
    return; // could show inline message, but simplest: ignore invalid selection
  }

  // apply assignment
  activeAssignment.value = tempAssignment.value;

  await Preferences.set({
    key: "defaultAssignmentId",
    value: String(activeAssignment.value.assignment_id),
  });

  showAssignmentModal.value = false;
  tempAssignment.value = null;
  assignmentForced.value = false;

  // 🔁 reload whole page to fetch week hours for the new assignment
  await loadPageData();
};

/** ---------- Page load ---------- */
const loadPageData = async () => {
  loading.value = true;
  pageReady.value = false;

  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });
  if (!token.value) {
    loading.value = false;
    pageReady.value = true;
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
          Accept: "application/json",
        },
      }
    );

    userFirstName.value = sessionRes.data.userinfo.iu_firstname;
    weekEndingDay.value = sessionRes.data.userinfo.iu_weekendingday;

    assignments.value = (sessionRes.data.assignments || []) as Assignment[];
    hasMultipleAssignments.value = assignments.value.length > 1;

    // init weekend
    initWeekend();
    buildGrid();

    // resolve assignment (NO fallback)
    const ok = await resolveInitialAssignment();
    if (!ok) {
      // stop here, wait for user choice
      pageReady.value = true;
      return;
    }

    // load week hours for current assignment
    await loadWeekHours();

    pageReady.value = true;
  } catch (err) {
    console.error("WeeklyGridEntry load error:", err);
    pageReady.value = true;
  } finally {
    loading.value = false;
  }
};

onIonViewWillEnter(async () => {
  await loadPageData();
});

const doRefresh = async (event: any) => {
  await loadPageData();
  event.target.complete();
};

/** ---------- Computed totals ---------- */
const weekTotal = computed(() => {
  return weekDays.value.reduce((sum, d) => sum + (Number(d.hours) || 0), 0);
});

const openCommentModal = (day: GridDay) => {
  selectedDayForComment.value = day;
  commentDraft.value = day.comment || "";
  showCommentModal.value = true;
};

const closeCommentModal = () => {
  showCommentModal.value = false;
  selectedDayForComment.value = null;
  commentDraft.value = "";
};

const saveComment = () => {
  if (!selectedDayForComment.value) return;

  const trimmed = commentDraft.value.trim();
  const original = selectedDayForComment.value.comment || "";

  if (trimmed !== original) {
    selectedDayForComment.value.comment = trimmed;
    markDirty(); // ⭐ ADD
  }

  closeCommentModal();
};

const markDirty = () => {
  if (!isDirty.value) {
    isDirty.value = true;
  }
};

const isDayChanged = (d: GridDay): boolean => {
  const hoursChanged =
    Number(d.hours.toFixed(2)) !== Number(d.previousHours.toFixed(2));

  const commentChanged =
    (d.comment || "").trim() !== (d.previousComment || "").trim();

  return hoursChanged || commentChanged;
};

const goToReviewTimesheet = () => {

  if (isDirty.value) return;

  router.push({
    path: "/review-timesheet",
    query: {
      weekend: weekend.value,
      from: "weekly-grid"
    }
  });
};

</script>

<style scoped>
/* Top card (match your style system) */
.top-card {
  padding: 15px;
  margin-top: 0;
  margin-bottom: 10px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.18);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
html.dark .top-card {
  background: #1e1e1e;
  border: 1px solid rgba(255,255,255,0.15);
  box-shadow: 0 4px 12px rgba(255,255,255,0.05);
}

.emp-name {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 10px 0;
  color: var(--ion-text-color);
}
.job-line,
.week-ending {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}

.change-order-btn {
  --background: #e0f2f5;
  --color: #2a8ca7;
  --border-radius: 7px;
  min-height: 24px;
  height: 24px;
  font-size: 12px;
  font-weight: 500;
  text-transform: none;
  margin-top: 6px;
}
html.dark .change-order-btn {
  --background: #1f3f46;
  --color: #8bd0e0;
}

/* Shortcuts */
.shortcut-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 5px;
  margin: 10px 0 10px 0;
}
.shortcut-btn {
  text-transform: none;
  font-size: 12px;
  --border-color: rgba(0,0,0,0.2);
  --color: var(--ion-color-medium);
}

html.dark .shortcut-btn {
  --border-color: rgba(255,255,255,0.25);
}

.shortcut-btn.danger {
  --color: #9c2828;
}

/* Grid list */
.grid-list {
  --ion-item-border-color: rgba(0,0,0,0.12);
}
html.dark .grid-list {
  --ion-item-border-color: rgba(255,255,255,0.18);
}

.grid-item {
  --padding-start: 12px;
  --padding-end: 12px;}
.grid-item.today {

  border-left: 3px solid #8bc34a;
}
.grid-item.weekend {
  border-left: 3px solid #f4d03f;
}

.day-label .day-title {
  font-size: 15px;
  font-weight: 700;
}
.day-label .day-sub {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.input-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.hrs-label {
  margin-left: 0px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
}

.input-col {
  width: 220px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.hours-input {
  text-align: right;
  font-size: 16px;
  font-weight: 600;
}
.inline-error {
  margin-top: 4px;
  font-size: 12px;
  color: #e53935;
  text-align: right;
}

/* Bottom */
.bottom-summary {
  padding: 16px 8px;
}
.big-total {
  font-size: 16px;
  font-weight: 800;
  text-align: center;
  margin: 12px 0;
}
.hint {
  display: block;
  text-align: center;
  margin-top: 8px;
  color: var(--ion-color-medium);
}

ion-button[disabled] {
  opacity: 0.45;
}

.review-hint {
  display: block;
  text-align: center;
  font-size: 12px;
  margin-top: 6px;
  color: var(--ion-color-medium);
}

.save-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  text-align: center;
  color: var(--ion-color-medium);
}

.status-text {
  color: rgb(146, 18, 163);
  font-weight: 600;
}
</style>

<style>
/* Assignment modal */
.assignment-modal {
  --width: 400px;
  --max-width: 92%;
  --height: 350px;
  --border-radius: 16px;
}

.assignment-modal ion-title {
  font-size: 15px;
  font-weight: 500;
}

.assignment-modal .asg-dates {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.assignment-modal .modal-actions {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px 14px 14px;
}

.comment-icon {
  font-size: 18px;
  margin-left: 10px;
  color: var(--ion-color-medium);
}

.comment-icon.active {
  color: rgb(146, 18, 163);
  transform: scale(1.15);
  filter: drop-shadow(0 0 2px rgba(146,18,163,0.6));
}

.comment-modal-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--ion-text-color);
}

.comment-modal-subtitle {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
}

.comment-modal {
  --width: 380px;
  --max-width: 92%;
  --height: 260px;
  --border-radius: 16px;
}

.comment-modal ion-title {
  font-size: 15px;
  font-weight: 500;
}

.comment-modal ion-textarea {
  font-size: 14px;
  --padding-start: 10px;
  --padding-end: 10px;
}

.comment-modal .modal-actions {
  display: flex;
  justify-content: space-between;
  padding: 12px 14px 14px 14px;
}

.comments-input-item {
  --background: transparent;
  --border-radius: 10px;
}

/* Light mode */
.comments-input-item ion-textarea {
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
</style>
