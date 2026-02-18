<template>
  <ion-page>
    <!-- Header -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/my-pto" text="Back" class="back-button"></ion-back-button>
        </ion-buttons>
        <ion-title>Submit PTO</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- Intro -->
      <div class="intro-text">
        <div>{{ introLine1 }}</div>
        <div class="intro-sub">You’ll add details in the next step</div>
      </div>

      <!-- Order row (custom) -->
      <div class="order-row" @click="openOrderModal">
        <div class="order-label">Order Number</div>

        <div class="order-value">
          {{ selectedAssignment?.order_number || "" }}
          <span v-if="selectedAssignment?.type_location">
            - {{ selectedAssignment.type_location }}
          </span>
          <ion-icon
            v-if="assignments.length > 1"
            :icon="chevronDownOutline"
          />
        </div>
      </div>

    <!-- Calendar -->
      <div class="calendar-card">

        <!-- Month header -->
        <div class="calendar-header">
            <ion-button fill="clear" size="small" @click="prevMonth">‹</ion-button>
            <div class="month-label">{{ monthLabel }}</div>
            <ion-button fill="clear" size="small" @click="nextMonth">›</ion-button>
        </div>

        <!-- Weekday labels -->
        <div class="weekdays">
            <div
            v-for="d in weekdayLabels"
            :key="d"
            class="weekday"
            >
            {{ d }}
            </div>
        </div>

        <!-- Days grid -->
        <div class="days-grid">
            <div
            v-for="cell in calendarCells"
            :key="cell.key"
            class="day-cell"
            :class="{
                empty: !cell.date,
                selected: isSelected(cell.date),
                weekend: cell.date && isWeekend(cell.date),
                today: cell.date && isToday(cell.date)
            }"
            @click="cell.date && toggleDate(cell.date)"
            >
            {{ cell.label }}
            </div>
        </div>

      </div>

      <div class="selected-dates-label">{{ selectedDateText }}</div>
      <div v-if="selectedDates.length" class="selected-dates">
        <div
          v-for="d in selectedDates"
          :key="d"
          class="selected-date-row"
        >
          <span class="selected-date-text">
            {{ formatDate(d) }}
          </span>

          <ion-icon
            :icon="trashOutline"
            class="remove-date-icon"
            @click.stop="removeDate(d)"
          />
        </div>
      </div>

      <!-- Next -->
      <ion-button
        expand="block"
        class="go-bottom-btn next-btn"
        :disabled="selectedDates.length === 0 || !selectedAssignmentId"
        @click="goNext"
      >
        Next
      </ion-button>

      <!-- Order Modal -->
      <ion-modal
        :is-open="showOrderModal"
        @didDismiss="showOrderModal = false"
        class="order-modal"
      >
        <ion-content class="ion-padding">
          <div class="modal-title">Select Order Number</div>

          <ion-list class="order-list">
            <ion-item
              button
              v-for="a in assignments"
              :key="a.assignment_id"
              @click="selectOrder(a.assignment_id)"
              class="order-item"
            >
              <ion-label>
                {{ a.order_number }}
                <span v-if="a.type_location">
                  - {{ a.type_location }}
                </span>
              </ion-label>

              <ion-icon
                v-if="a.assignment_id === selectedAssignmentId"
                :icon="checkmarkOutline"
                class="check-icon"
              />
            </ion-item>
          </ion-list>

          <div class="modal-actions">
            <ion-button fill="clear" @click="showOrderModal = false">
              Close
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonButton,
  IonIcon,
  IonModal,
  IonList,
  IonItem,
  IonLabel
} from "@ionic/vue";
import { chevronDownOutline, checkmarkOutline, trashOutline } from "ionicons/icons";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";
import { useRouter } from "vue-router";
import { onIonViewWillEnter } from "@ionic/vue";


const router = useRouter();

const assignments = ref<any[]>([]);
const selectedAssignmentId = ref<number | null>(null);
const weekEndingDay = ref<number>(6); // default Saturday

const showOrderModal = ref(false);

const selectedDates = ref<string[]>([]);

const now = new Date();
const currentYear = ref(now.getFullYear());
const currentMonth = ref(now.getMonth());

const introLine1 = computed(() => {
  return assignments.value.length > 1
    ? "Please select an Order Number and PTO dates."
    : "Please select PTO dates.";
});

const selectedDateText = computed(() => {
  return selectedDates.value.length > 0
        ? "Selected Dates:"
        : ""; 
});


onIonViewWillEnter(async () => {
  const token = await Preferences.get({ key: "authToken" });
  const site = await Preferences.get({ key: "siteName" });
  const userId = await Preferences.get({ key: "userId" });
  const defaultAssignmentId = await Preferences.get({ key: "defaultAssignmentId" });

  if (!token.value) return;

  selectedDates.value = [];

  const res = await api.post(
    "/session-user-info",
    { site_name: site.value, user_id: Number(userId.value) },
    { headers: { Authorization: `Bearer ${token.value}` } }
  );

  assignments.value = res.data.assignments || [];
  weekEndingDay.value = res.data.userinfo?.iu_weekendingday ?? 6;

  const active =
    assignments.value.find(
      (a: any) => String(a.assignment_id) === defaultAssignmentId.value
    ) || assignments.value[0];

  selectedAssignmentId.value = active?.assignment_id ?? null;
});

const selectedAssignment = computed(() => {
  return assignments.value.find(
    (a: any) => a.assignment_id === selectedAssignmentId.value
  );
});

const openOrderModal = () => {
  if (assignments.value.length <= 1) return;
  showOrderModal.value = true;
};

const selectOrder = (id: number) => {
  selectedAssignmentId.value = id;
  showOrderModal.value = false;
};

/* Calendar */
const weekStartDay = computed(() => (weekEndingDay.value + 1) % 7);

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthLabel = computed(() => {
  return new Date(currentYear.value, currentMonth.value, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
});

const calendarCells = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const firstDayOfWeek = firstOfMonth.getDay(); // 0=Sun, 6=Sat

  const cells: {
    key: string;
    date: string | null;
    label: string;
  }[] = [];

  // leading empty cells
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({
      key: `empty-${i}`,
      date: null,
      label: ""
    });
  }

  // actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    cells.push({
      key: ymd,
      date: ymd,
      label: String(d)
    });
  }

  return cells;
});

const toggleDate = (ymd: string) => {
  const idx = selectedDates.value.indexOf(ymd);
  if (idx >= 0) selectedDates.value.splice(idx, 1);
  else {
    selectedDates.value.push(ymd);
    selectedDates.value.sort();
  }
};

const isSelected = (ymd: string | null) => !!ymd && selectedDates.value.includes(ymd);

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else currentMonth.value--;
};

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else currentMonth.value++;
};

const parseLocalYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight
};

const formatDate = (ymd: string) => {
  return parseLocalYmd(ymd).toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const isToday = (ymd: string) => {
  const t = new Date();
  const todayYmd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return ymd === todayYmd;
};

const isWeekend = (ymd: string) => {
  const day = parseLocalYmd(ymd).getDay(); // 0 Sun, 6 Sat
  return day === 0 || day === 6;
};

const removeDate = (ymd: string) => {
  const idx = selectedDates.value.indexOf(ymd);
  if (idx >= 0) {
    selectedDates.value.splice(idx, 1);
  }
};

const goNext = () => {
  
  //console.log("STEP 1:", {assignmentId: selectedAssignmentId.value, dates: selectedDates.value});

  router.push({
    name: "SubmitPtoStep2",
    query: {
      assignmentId: String(selectedAssignmentId.value),
      dates: selectedDates.value.join(","),
    },
  });

};

</script>

<style scoped>
.back-button {
  text-transform: none !important;
}

.intro-text {
  font-size: 14px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}
.intro-text .intro-sub {
  margin-top: 4px;
}

/* Order row */
.order-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  cursor: pointer;
}

.order-label {
  font-size: 14px;
  color: var(--ion-color-medium);
}

.order-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 550;
}

/* Calendar */
.calendar-card {
  margin-top: 16px;
  padding: 12px;
  border-radius: 14px;
  background: var(--ion-item-background, #f4f5f8);
}

html.dark .calendar-card {
  background: #1f1f1f;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.month-label {
  font-size: 16px;
  font-weight: 600;
}

.weekdays,
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 0;
  color: var(--ion-color-medium);
}

.day-cell {
  height: 42px;
  margin: 2px;
  border-radius: 10px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.day-cell.empty {
  pointer-events: none;
}

.day-cell.weekend {
  background: #f4d03f33;
}

.day-cell.today {
  background: #8bc34a33;
  font-weight: 600;
}

.day-cell.selected {
  background: #b888c5;
  color: #fff;
  font-weight: 600;
}

/* Hover effects */
.day-cell.weekend:hover,
.day-cell.today:hover {
  filter: brightness(0.95);
}

.selected-dates-label {
  font-size: 14px;
  color: var(--ion-color-medium);
  font-weight: 600;
  margin-top: 16px;
  margin-bottom: 0px;
}

/* Selected dates */
.selected-dates {
  margin-top: 5px;
}

.selected-date-row {
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 8px 0;
  font-size: 14px;

  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

html.dark .selected-date-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.selected-date-text {
  flex: 1;
}

/* Remove icon */
.remove-date-icon {
  font-size: 15px;
  color: var(--ion-color-danger);
  cursor: pointer;
}

.remove-date-icon:hover {
  opacity: 0.8;
}

.next-btn {
  margin-top: 24px;
}

/* Order modal */
.order-modal {
  --width: 380px;
  --max-width: 92%;
  --border-radius: 16px;
  --height: 320px;
}

.modal-title {
  font-size: 16px;
  font-weight: 650;
  margin-bottom: 12px;
}

.order-list {
  max-height: 50vh;
  overflow-y: auto;
}

.order-item {
  --background: transparent;
}

.check-icon {
  font-size: 18px;
  color: var(--ion-color-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}


</style>
