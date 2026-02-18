<template>
  <ion-page>
    <!-- Header -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/submit-pto-step1" text="Back" class="back-button" />
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="!pageReady" class="loading-block">
        <ion-spinner name="crescent" />
      </div>

      <div v-else>
        <!-- Intro -->
        <div class="intro-text">
          Please enter hours and any comments for the selected dates.
        </div>

        <!-- Cards -->
        <div v-if="cards.length" class="cards-wrap">
          <div
            v-for="(c, idx) in cards"
            :key="c.date"
            class="day-card"
            :ref="(el) => setCardRef(el, idx)"
          >
            <!-- Card title -->
            <div class="card-title">
              {{ formatCardTitle(c.date) }}
            </div>

            <!-- Start Time (CLOCK ENTRY only) -->
            <div v-if="timeCaptureMode === 'CLOCK ENTRY'" class="field-block">
              <div class="field-label">Start Time</div>

              <div
                class="field-input clickable"
                @click="openTimePicker(idx)"
              >
                <span class="start-time-text">{{ formatTime(c.startTime) }}</span>
              </div>
            </div>

            <!-- Hours -->
            <div class="field-block">
              <div class="field-label">Hours</div>

              <ion-item class="field-input hours-input" lines="none">
                <input
                  type="number"
                  step="0.1"
                  min="0.1" max="24"
                  v-model.number="c.hours"
                  class="native-input"
                  @input="onHoursInput($event, idx)"
                />
              </ion-item>

              <ion-text v-if="c.errors.hours" color="danger">
                <p class="error-text">{{ c.errors.hours }}</p>
              </ion-text>
            </div>

            <!-- Comments -->
            <div class="field-block">
              <div class="field-label">
                Comments
                <span v-if="timeCaptureMode === 'HOUR ENTRY' && Number(c.hours) !== 8" class="required-hint">
                  (required if hours ≠ 8)
                </span>
              </div>

              <ion-item class="field-input ion-no-padding" lines="none">
                <ion-textarea
                  :value="c.comments"
                  auto-grow
                  @ionInput="onCommentsInput($event, idx)"
                />
              </ion-item>

              <ion-text v-if="c.errors.comments" color="danger">
                <p class="error-text">{{ c.errors.comments }}</p>
              </ion-text>
            </div>
          </div>
        </div>

        <!-- Empty guard -->
        <div v-else class="empty-state">
          No dates were selected. Please go back and select at least one date.
        </div>

        <!-- Actions -->
        <div class="page-actions">
          <ion-button
            expand="block"
            class="go-bottom-btn"
            :disabled="submitting || cards.length === 0"
            @click="submitPto"
          >
            <ion-spinner v-if="submitting" name="crescent" class="btn-spinner" />
            Submit PTO
          </ion-button>

          <ion-button
            expand="block"
            class="go-bottom-btn-outline"
            :disabled="submitting"
            @click="goPtoHome"
          >
            PTO Home
          </ion-button>
        </div>

        <!-- Time picker popover (shared) -->
        <ion-popover
          :is-open="showTimePicker"
          @didDismiss="showTimePicker = false"
          class="time-picker-popover"
        >
          <ion-datetime
            presentation="time"
            hour-cycle="h12"
            mode="ios"
            v-model="activeTimeProxy"
          />
        </ion-popover>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { onIonViewWillEnter } from "@ionic/vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonItem,
  IonInput,
  IonTextarea,
  IonText,
  IonButton,
  IonSpinner,
  IonPopover,
  IonDatetime,
} from "@ionic/vue";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";

type TimeCaptureMode = "HOUR ENTRY" | "CLOCK ENTRY";
const pageReady = ref(false);

type CardErrors = {
  hours?: string;
  comments?: string;
};

type PtoCard = {
  date: string;        // yyyy-mm-dd
  startTime: string;   // HH:mm
  hours: number | null;
  comments: string;
  errors: CardErrors;
};

const route = useRoute();
const router = useRouter();

const submitting = ref(false);

const assignments = ref<any[]>([]);
const selectedAssignmentId = ref<number | null>(null);
const selectedAssignment = computed(() =>
  assignments.value.find((a: any) => a.assignment_id === selectedAssignmentId.value)
);

const timeCaptureMode = ref<TimeCaptureMode>("HOUR ENTRY");

const cards = ref<PtoCard[]>([]);

/** card refs for scroll to error */
const cardRefs = ref<HTMLElement[]>([]);
const setCardRef = (el: any, idx: number) => {
  if (!el) return;
  cardRefs.value[idx] = el as HTMLElement;
};

/** shared time picker */
const showTimePicker = ref(false);
const activeCardIndex = ref<number | null>(null);

const activeTimeProxy = computed({
  get() {
    const i = activeCardIndex.value;
    if (i === null) return "08:00";
    return cards.value[i]?.startTime || "08:00";
  },
  set(v: string) {
    const i = activeCardIndex.value;
    if (i === null) return;
    cards.value[i].startTime = normalizeTime(v);
  },
});

const pageTitle = computed(() => {
  const a = selectedAssignment.value;
  if (!a) return "Submit PTO";
  const orderText = a.order_number;
  return `Submit PTO - Order #${orderText}`;
});

onIonViewWillEnter (async () => {

  pageReady.value = false;

  // 1) read query
  const qAssignmentId = String(route.query.assignmentId || "");
  const qDates = String(route.query.dates || "");

  //console.log("Query params:", { qAssignmentId, qDates });

  selectedAssignmentId.value = qAssignmentId ? Number(qAssignmentId) : null;

  const dateList = qDates
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // 2) load session info to get assignments + timeCaptureMode
  await loadSessionInfo();

  // 3) init cards
  cards.value = dateList.map((d) => ({
    date: d,
    startTime: "08:00",
    hours: 8,
    comments: "",
    errors: {},
  }));

  // If CLOCK ENTRY, prefill startTime from active assignment if you ever have it

  pageReady.value = true;

});

/** Load session user info */
const loadSessionInfo = async () => {
  const token = await Preferences.get({ key: "authToken" });
  const sitePref = await Preferences.get({ key: "siteName" });
  const userIdPref = await Preferences.get({ key: "userId" });

  if (!token.value) return;

  const res = await api.post(
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

  assignments.value = res.data.assignments || [];

  const tc = res.data.userinfo.iu_timecapturemethod.toUpperCase();
  console.log("Time capture method from session info:", tc);

  if (tc === "CLOCK ENTRY" || tc === "HOUR ENTRY") {
    timeCaptureMode.value = tc;
  } else {
    // fallback: HOUR ENTRY as default since it's more common and simpler
    timeCaptureMode.value = "HOUR ENTRY";
  }
  console.log("Loaded session info:", { assignments: assignments.value, timeCaptureMode: timeCaptureMode.value }); 

  // if selectedAssignmentId is null => pick first
  if (!selectedAssignmentId.value && assignments.value.length) {
    selectedAssignmentId.value = assignments.value[0].assignment_id;
  }
};

/** UI handlers */
const onHoursInput = (ev: any, idx: number) => {
  const raw =
    ev?.detail?.value ??               // ion-input
    (ev?.target as HTMLInputElement)?.value; // native input

  const n =
    raw === "" || raw === null || raw === undefined
      ? null
      : Number(raw);

  cards.value[idx].hours = isNaN(Number(n)) ? null : Number(n);
  // clear errors when typing
  cards.value[idx].errors.hours = undefined;

  // if hours back to 8, clear comments error
  if (timeCaptureMode.value === "HOUR ENTRY" && Number(cards.value[idx].hours) === 8) {
    cards.value[idx].errors.comments = undefined;
  }
};

const onCommentsInput = (ev: any, idx: number) => {
  cards.value[idx].comments = ev?.detail?.value ?? "";
  cards.value[idx].errors.comments = undefined;
};

const openTimePicker = (idx: number) => {
  activeCardIndex.value = idx;
  showTimePicker.value = true;
};

/** Validation */
const validateAll = async (): Promise<boolean> => {
  let firstBadIndex: number | null = null;

  for (let i = 0; i < cards.value.length; i++) {
    const c = cards.value[i];
    c.errors = {};

    // Hours required
    if (c.hours === null || c.hours === undefined || String(c.hours).trim() === "") {
      c.errors.hours = "Hours are required.";
      if (firstBadIndex === null) firstBadIndex = i;
      continue;
    }

    const h = Number(c.hours);

    if (isNaN(h)) {
      c.errors.hours = "Hours are required.";
      if (firstBadIndex === null) firstBadIndex = i;
      continue;
    }

    if (h <= 0) {
      c.errors.hours = "Hours must be greater than 0.";
      if (firstBadIndex === null) firstBadIndex = i;
    } else if (h > 24) {
      c.errors.hours = "Hours cannot exceed 24.";
      if (firstBadIndex === null) firstBadIndex = i;
    }

    // Conditional comments
    if (timeCaptureMode.value === "HOUR ENTRY" && h !== 8) {
      if (!c.comments || !c.comments.trim()) {
        c.errors.comments = "Comments are required when hours are not 8.";
        if (firstBadIndex === null) firstBadIndex = i;
      }
    }
  }

  if (firstBadIndex !== null) {
    await nextTick();
    cardRefs.value[firstBadIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
    return false;
  }

  return true;
};

/** Submit */
const submitPto = async () => {
  if (submitting.value) return;
  if (!selectedAssignment.value || !selectedAssignmentId.value) return;

  const ok = await validateAll();
  if (!ok) return;

  submitting.value = true;

  try {
    const token = await Preferences.get({ key: "authToken" });
    const site = await Preferences.get({ key: "siteName" });
    const clientId = await Preferences.get({ key: "clientId" });
    const userId = await Preferences.get({ key: "userId" });

    if (!token.value) return;

    // submit sequentially (dễ debug + tránh spam server)
    for (const c of cards.value) {
      await api.post(
        "/pto-action",
        {
          site_name: site.value,
          client_id: Number(clientId.value),
          user_id: Number(userId.value),

          action_type: "ADDED",

          pto_id: 0,
          assignment_id: selectedAssignmentId.value,
          order_number: selectedAssignment.value.order_number,
          date_from: c.date,
          time_from: timeCaptureMode.value === "CLOCK ENTRY" ? c.startTime : null,
          hours: Number(c.hours),
          comments: c.comments,
        },
        {
          headers: {
            Authorization: `Bearer ${token.value}`,
          },
        }
      );
    }

    // Done => go PTO home (hoặc show success rồi về)
    router.push("/my-pto");
  } catch (err: any) {
    console.error("Submit PTO failed", err);
    if (err?.response) {
      console.error("STATUS:", err.response.status);
      console.error("DATA:", err.response.data);
    }
  } finally {
    submitting.value = false;
  }
};

const goPtoHome = () => router.push("/my-pto");

/** Helpers */
const formatCardTitle = (ymd: string) => {
  const d = safeLocalDate(ymd);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const safeLocalDate = (ymd: string) => {
  // avoid timezone shift
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  return new Date(y, (m || 1) - 1, d || 1);
};

const normalizeTime = (v: string) => {
  // ion-datetime might return "2026-02-01T08:00:00" on some platforms
  if (!v) return "08:00";
  if (v.includes("T")) {
    const t = v.split("T")[1] || "";
    return t.slice(0, 5) || "08:00";
  }
  // already "HH:mm"
  return v.slice(0, 5);
};

const formatTime = (time: string) => {
  const hhmm = normalizeTime(time);
  const [hh, mm] = hhmm.split(":").map((n) => Number(n));
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
</script>

<style scoped>
.loading-block {
  padding: 15px;
  text-align: center;
}

.back-button {
  text-transform: none !important;
}

.intro-text {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 14px;
}

.cards-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.day-card {
  padding: 14px;
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

/* Light mode */
html:not(.dark) .day-card {
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.14);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

/* Dark mode */
html.dark .day-card {
  background: #1f1f1f;
  border: 1px solid rgba(255,255,255,0.18);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.day-card.active {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 1px rgba(56,128,255,0.5);
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--ion-text-color);
}

.field-block {
  margin-top: 12px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}

.required-hint {
  font-weight: 500;
  opacity: 0.9;
}

.field-input {
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,0.15);
  background: #ffffff;
  padding: 10px 12px;
  min-height: 44px;
  display: flex;
  align-items: center;
}

.field-input::part(native) {
  min-height: 0px;
  padding: 10;
  align-items: center;
}

html.dark .field-input {
  background: #1f1f1f;
  border: 1px solid rgba(255,255,255,0.25);
}

.field-input.clickable {
  cursor: pointer;
}

.start-time-text {
  font-size: 15px;
  font-weight: 550;
  color: var(--ion-text-color);
}

/* remove ion-item paddings */
ion-item.field-input {
  --inner-padding-end: 0;
  --padding-start: 0;
  --padding-end: 0;
  --min-height: 44px;
}
ion-item.field-input ion-input,
ion-item.field-input ion-textarea {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

/* textarea extra line (web) */
ion-textarea {
  --padding-top: 2px;
  --padding-bottom: 2px;
}

.hours-input {
  min-height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;

  background: var(--ion-item-background, #f4f5f8);
  border: 1px solid rgba(0,0,0,.15);
  border-radius: 12px;
}

html.dark .hours-input {
  background: #1f1f1f;
  border: 1px solid rgba(255,255,255,.25);
}

.native-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;

  font-size: 15px;
  color: var(--ion-text-color);
  line-height: 1.4;
}

.error-text {
  margin: 6px 0 0 2px;
  font-size: 13px;
}

.page-actions {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* popover sizing */
.time-picker-popover {
  --width: 190px;
  --border-radius: 14px;
}

/* Dark mode time picker popover */
html.dark ion-popover.time-picker-popover::part(content) {
  background: #1f1f1f;
  color: #ffffff;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
}

/* ===== Light mode: time picker popover ===== */
html:not(.dark) ion-popover.time-picker-popover::part(content) {
  background: #ffffff;
  color: #000000;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
}

.time-picker-popover ion-datetime {
  --wheel-font-size: 15px;
  --wheel-item-height: 34px;
}

html.dark ion-popover.time-picker-popover ion-datetime {
  background: transparent;
  color: var(--ion-text-color);
}
</style>
