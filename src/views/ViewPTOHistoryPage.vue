<template>
  <ion-page>
    <!-- Header -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/my-pto" text="Back" class="back-button"></ion-back-button>
        </ion-buttons>
        <ion-title>PTO History</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- Pull to refresh -->
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Loading -->
      <div v-if="initialLoading" class="loading-block">
        <ion-spinner name="crescent"></ion-spinner>
      </div>

      <!-- Empty state -->
      <div
        v-if="!initialLoading && ptoList.length === 0"
        class="empty-state"
      >
        <div class="empty-title">No PTO history found</div>
        <div class="empty-subtitle">
          You haven’t submitted any PTO requests yet.
        </div>
      </div>

      <!-- PTO List -->
        <div
        v-for="pto in ptoList"
        :key="pto.pto_id"
        class="pto-item"
        >
        <div class="pto-content">

            <div class="row">
            <span class="label">Order:</span>
            <span class="value">{{ pto.pto_ordernumber }}</span>
            </div>

            <div class="row">
            <span class="label">{{ isDateOnly(pto) ? 'Date:' : 'Date/Time:' }}</span>
            <span class="value">
                {{ formatDateTime(pto) }}
            </span>
            </div>

            <div class="row">
            <span class="label">Hours:</span>
            <span
                class="value"
                :class="hoursClass(pto.pto_dayshours)"
            >
                {{ formatHours(pto.pto_dayshours) }}
            </span>
            </div>

            <div class="row">
            <span class="label">Payable Hours:</span>
            <span class="value">
                {{ formatHours(pto.pto_payabledayshours) }}
            </span>
            </div>

            <div class="row">
              <span class="label">Status:</span>
              <div class="status-block">
                <span
                  class="value"
                  :class="statusClass(pto.pto_status)"
                >
                  {{ pto.pto_status }}
                </span>

                <!-- Requested to Withdraw sub-status -->
                <div
                  v-if="pto.pto_status === 'Approved' && pto.pto_cancelrequest === 1"
                  class="status-sub"
                >
                  Requested to Withdraw
                </div>
              </div>
            </div>

            <div class="row">
            <span class="label">Status Date/Time:</span>
            <span class="value">
                {{ formatTimestamp(pto.pto_statustimestamp) }}
            </span>
            </div>

            <!--
            <div class="row">
              <span class="label">Weekend:</span>
              <span class="value">{{ formatDate(pto.pto_weekendingdate) }}</span>
            </div>
            -->

            <!-- Comments -->
            <div
              v-if="hasComments(pto)"
              class="row comments-row"
            >
              <span class="label">Comments:</span>
              <span class="value comments-value">
                {{ displayComment(pto) }}

                <!-- Expand / collapse toggle -->
                <span
                  v-if="isLongComment(pto)"
                  class="comment-toggle"
                  @click.stop="toggleComment(pto.pto_id)"
                >
                  {{ expandedComments[pto.pto_id] ? 'less' : 'more' }}
                </span>
              </span>
            </div>


        </div>

        <!-- ACTION ICONS -->
        <div
          v-if="hasAnyAction"
          class="action-icons"
        >
          
          <!-- Edit -->
          <ion-icon
            v-if="pto.can_edit"
            :icon="pencilOutline"
            class="action-icon edit"
            @click.stop="onEditPto(pto)"
          />

          <!-- Withdraw -->
          <ion-icon
            v-if="pto.can_withdraw"
            :icon="trashOutline"
            class="action-icon withdraw"
            @click.stop="onWithdrawPto(pto)"
          />

          <!-- Request to Withdraw -->
          <ion-icon
            v-if="pto.can_request_withdraw"
            :icon="handLeftOutline"
            class="action-icon request-withdraw"
            @click.stop="onRequestWithdrawPto(pto)"
          />

        </div>
      </div>


    </ion-content>

    <!-- Withdraw Request Modal -->
    <ion-modal :is-open="showWithdrawRequestModal" @didDismiss="showWithdrawRequestModal = false" class="deletewithdraw-modal">

      <ion-content class="ion-padding">

        <div class="all-modal-title">
          {{ actionType === 'REQUESTED'
            ? 'Request to Withdraw PTO'
            : 'Withdraw PTO'
          }}
        </div>

        <div class="modal-row">
          <strong>Order #:</strong> {{ selectedPto?.pto_ordernumber }}
        </div>

        <div class="modal-row">
          <strong>{{ isDateOnly(selectedPto) ? 'Date:' : 'Date/Time:' }}</strong> {{ formatDateTime(selectedPto) }}
        </div>

        <div class="modal-row">
          <strong>Hours:</strong> {{ formatHours(selectedPto?.pto_dayshours) }}
        </div>

        <ion-item class="comments-input-item">
          <ion-textarea
            v-model="withdrawReason"
            placeholder="Enter a reason (optional)"
            auto-grow
          />
        </ion-item>

        <div class="modal-actions">
          <ion-button fill="clear" @click="closeWithdrawModal">
            Cancel
          </ion-button>

          <ion-button
            color="primary"
            :disabled="submittingWithdraw"
            @click="submitWithdraw"
          >
            <ion-spinner
              v-if="submittingWithdraw"
              name="crescent"
              style="margin-right:6px"
            />
            <span>
              {{ actionType === 'REQUESTED'
                ? 'Yes, Request'
                : 'Yes, Withdraw'
              }}
            </span>
          </ion-button>

        </div>

      </ion-content>
    </ion-modal>

    <!-- Edit PTO Modal -->
    <ion-modal :key="editModalKey" :is-open="showEditModal" @didDismiss="showEditModal = false" class="editpto-modal">
      <ion-content class="ion-padding">

        <!-- Title -->
        <div class="all-modal-title">
          Edit PTO
        </div>

        <div class="modal-row">
          <strong>Order #:</strong> {{ selectedPto?.pto_ordernumber }}
        </div>

        <div class="modal-row">
          <strong>{{ isDateOnly(selectedPto) ? 'Date:' : 'Date/Time:' }}</strong> {{ formatDateTime(selectedPto) }}
        </div>

        <!-- Hours -->
        <div class="edit-field">
          <div class="edit-field-label">Hours</div>
          <div class="edit-input hours-input">
            <input
              type="number"
              step="0.1"
              v-model.number="editHours"
              class="native-input"
            />
          </div>
          <ion-text v-if="editHoursError" color="danger">
            <p class="error-text">{{ editHoursError }}</p>
          </ion-text>
        </div>

        <!-- Start Time (CLOCK ENTRY only) -->
        <div
          v-if="timeCaptureMode === 'CLOCK ENTRY'"
          class="edit-field"
        >
          <div class="edit-field-label">Start Time</div>

          <div
            class="edit-input start-time-input"
            @click="showTimePicker = true"
          >
            <span class="start-time-value">
              {{ formatTime(editStartTime) }}
            </span>
          </div>
        </div>

        <!-- Comments -->
        <div class="edit-field">
          <div class="edit-field-label">Comments (required)</div>

          <ion-item class="edit-input">
            <ion-textarea
              v-model="editComments"
              auto-grow
            />
          </ion-item>
          <ion-text v-if="editCommentsError" color="danger">
            <p class="error-text">{{ editCommentsError }}</p>
          </ion-text>
        </div>

        <!-- Actions -->
        <div class="modal-actions">
          <ion-button
            fill="clear"
            :disabled="savingEdit"
            @click="closeEditModal"
          >
            Cancel
          </ion-button>

          <ion-button
            color="primary"
            :disabled="savingEdit"
            @click="submitEditPto"
          >
            <ion-spinner
              v-if="savingEdit"
              name="crescent"
              style="margin-right:6px"
            />
            Save Changes
          </ion-button>
        </div>

      </ion-content>

      <ion-popover
        :is-open="showTimePicker"
        @didDismiss="showTimePicker = false"
        class="time-picker-popover"
      >
        <ion-datetime
          presentation="time"
          hour-cycle="h12"
          mode="ios"
          v-model="editStartTime"
        />
      </ion-popover>

    </ion-modal>

  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { 
  pencilOutline,
  trashOutline,
  handLeftOutline,
} from "ionicons/icons";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonIcon,
  IonItem,
  IonLabel,
  IonButton,
  IonModal,
  IonTextarea,
  IonInput,
  IonDatetime,
  IonText,
  IonPopover
} from "@ionic/vue";
import { Preferences } from "@capacitor/preferences";
import api from "@/services/api";
import { useRouter } from "vue-router";
import { computed } from "vue";
import { modalController, alertController } from "@ionic/vue";


/* State */
const router = useRouter();
const ptoList = ref<any[]>([]);
const initialLoading = ref(true);
const refreshing = ref(false);
const timeCaptureMode = ref<"HOUR ENTRY" | "CLOCK ENTRY">("HOUR ENTRY");
const COMMENT_PREVIEW_LENGTH = 40;

const selectedPto = ref<any | null>(null);

const showWithdrawRequestModal = ref(false);
const withdrawReason = ref("");
const submittingWithdraw = ref(false);

const editModalKey = ref(0);
const showEditModal = ref(false);
const editHours = ref<number | null>(null);
const editStartTime = ref<string>("");   // HH:mm or ISO
const showTimePicker = ref(false);
const editComments = ref("");
const savingEdit = ref(false);
const editHoursError = ref("");
const editCommentsError = ref("");

type ActionType = "ADDED" | "EDITED" | "DELETED" | "REQUESTED";
const actionType = ref<ActionType>("REQUESTED");

const successMessages: Record<string, string> = {
  REQUESTED: "Your PTO Withdrawal Request was sent!",
  DELETED: "Your PTO was withdrawn successfully.",
  EDITED: "Your PTO was updated successfully.",
  ADDED: "Your PTO was submitted successfully.",
};

/**
 * Track which PTO comments are expanded
 * Key: pto_id
 */
const expandedComments = ref<Record<number, boolean>>({});

onMounted(async () => {
  initialLoading.value = true;
  await loadAll();
  initialLoading.value = false;
});

/**
 * Load PTO history and time capture mode
 */
const loadAll = async () => {
  await loadTimeCaptureMode();
  await loadPtoHistory();
};

/**
 * Pull to refresh handler
 */
const doRefresh = async (event: any) => {
  refreshing.value = true;

  await loadAll();

  refreshing.value = false;
  event.target.complete();
};

/**
 * Load time capture mode
 */
const loadTimeCaptureMode = async () => {
  const site = await Preferences.get({ key: "siteName" });
  const userId = await Preferences.get({ key: "userId" });
  const token = await Preferences.get({ key: "authToken" });

  try {
    const res = await api.post(
      "/timecapture-mode",
      {
        site_name: site.value,
        user_id: Number(userId.value),
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      }
    );

    timeCaptureMode.value = res.data.timecapture;
  } catch (err) {
    console.error("Failed to load time capture mode", err);
  }
};

/**
 * Load PTO history (latest 30 records)
 */
const loadPtoHistory = async () => {
  const site = await Preferences.get({ key: "siteName" });
  const clientId = await Preferences.get({ key: "clientId" });
  const userId = await Preferences.get({ key: "userId" });
  const token = await Preferences.get({ key: "authToken" });

  //console.log("Loading PTO history for user:", userId.value);

  try {
    const res = await api.post(
      "/pto-history",
      {
        site_name: site.value,
        client_id: Number(clientId.value),
        user_id: Number(userId.value),
        limit: 30,
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      }
    );

    ptoList.value = res.data.records || [];
  } catch (err) {
    console.error("Failed to load PTO history", err);
  }
};

const parseLocalDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map((v) => Number(v));
  return new Date(y, m - 1, d);
};

/**
 * Format PTO hours
 */
const formatHours = (value: number) => {
  return Number(value).toFixed(2);
};

/**
 * Format date/time based on capture mode
 */
const formatDateTime = (pto: any) => {

  if (!pto) return "";

  if (isDateOnly(pto)) {
    return formatDate(pto.pto_datefrom);
  }

  const fromDate = formatDate(pto.pto_datefrom);
  const fromTime = formatTime(pto.pto_timefrom);

  const toDate = pto.pto_dateto ? formatDate(pto.pto_dateto) : fromDate;
  const toTime = formatTime(pto.pto_timeto);

  // Show full range when crossing midnight (3rd shift)
  if (pto.pto_dateto && pto.pto_dateto !== pto.pto_datefrom) {
    return `${fromDate} ${fromTime} → ${toDate} ${toTime}`;
  }

  return `${fromDate} (${fromTime} - ${toTime})`;
};

/**
 * Format date
 */
const formatDate = (ymd: string) => {
  if (!ymd) return "";
  return parseLocalDate(ymd).toLocaleDateString();
};

/**
 * Format time
 */
const formatTime = (time: string) => {
  if (!time) return "";
  const [hh, mm] = time.split(":").map((v: string) => Number(v));
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/**
 * Format timestamp
 */
const formatTimestamp = (ts: string) => {
  if (!ts) return "";
  const safe = ts.replace(" ", "T"); // "2026-01-09T11:25:00"
  const d = new Date(safe);
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
};
/**
 * Hours color class
 */
const hoursClass = (value: number) => {
  return value < 0 ? "hours-negative" : "hours-positive";
};

/**
 * Status color class
 */
const statusClass = (status: string) => {
  switch (status) {
    case "Rejected":
      return "status-rejected";
    case "Approved":
    case "Invoiced":
      return "status-approved";
    case "Adjustment":
      return "status-adjustment";
    default:
      return "status-submitted";
  }
};

/**
 * Determine if PTO should display date only
 * Date only applies to:
 * - HOUR ENTRY
 * - Adjustment PTO
 */
const isDateOnly = (pto: any) => {
  if (!pto) return true;

  return (
    timeCaptureMode.value === "HOUR ENTRY" ||
    pto.pto_status === "Adjustment"
  );
};

/**
 * Check if any PTO record has at least one action icon
 */
const hasAnyAction = computed(() => {
  return ptoList.value.some((pto) => {
    return (
      pto.can_edit ||
      pto.can_withdraw ||
      pto.can_request_withdraw
    );
  });
});

/**
 * Edit PTO
 * Navigate to submit PTO page in edit mode
 */
const onEditPto = (pto: any) => {
  console.log("Edit PTO", pto.pto_id);
  //showUnderConstruction();
  
  selectedPto.value = pto;
  editHours.value = Math.abs(Number(pto.pto_dayshours));
  editStartTime.value = pto.pto_timefrom || "08:00";
  editComments.value = pto.pto_enteredcomments || "";
  showTimePicker.value = false;
  actionType.value = "EDITED";

  editHoursError.value = "";
  editCommentsError.value = "";

  editModalKey.value++;              // 🔑 force re-render
  showEditModal.value = true;
};

/**
 * Withdraw PTO (Submitted / Rejected)
 */
const onWithdrawPto = (pto: any) => {
  console.log("Withdraw PTO", pto.pto_id);
  //showUnderConstruction();

  selectedPto.value = pto;
  withdrawReason.value = "";
  actionType.value = "DELETED";
  showWithdrawRequestModal.value = true;
};

/**
 * Request withdraw PTO (Approved)
 */
const onRequestWithdrawPto = (pto: any) => {
  console.log("Request withdraw PTO", pto.pto_id);
  //showUnderConstruction();

  selectedPto.value = pto;
  withdrawReason.value = "";
  actionType.value = "REQUESTED";
  showWithdrawRequestModal.value = true;
};

const closeWithdrawModal = () => {
  showWithdrawRequestModal.value = false;
};

const submitWithdraw = async () => {
  if (!selectedPto.value || submittingWithdraw.value) return;

  submittingWithdraw.value = true;

  try {
    const site = await Preferences.get({ key: "siteName" });
    const clientId = await Preferences.get({ key: "clientId" });
    const userId = await Preferences.get({ key: "userId" });
    const token = await Preferences.get({ key: "authToken" });

    console.log("All PTO info for withdraw:",
      selectedPto.value
    );

    await api.post(
      "/pto-action",
      {
        site_name: site.value,
        client_id: Number(clientId.value),
        user_id: Number(userId.value),

        action_type: actionType.value,

        pto_id: selectedPto.value.pto_id,
        assignment_id: selectedPto.value.pto_assignmentid,
        order_number: selectedPto.value.pto_ordernumber,
        date_from: selectedPto.value.pto_datefrom,
        time_from: selectedPto.value.pto_timefrom,
        hours: selectedPto.value.pto_dayshours,
        comments: withdrawReason.value,
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      }
    );

    showWithdrawRequestModal.value = false;
    await showSuccessAlert(actionType.value);
    await loadAll(); // 🔄 refresh PTO history

  } catch (err: any) {
    console.error("Withdraw failed", err);

    if (err.response) {
      console.error("STATUS:", err.response.status);
      console.error("DATA:", err.response.data);
    }
  } finally {
    submittingWithdraw.value = false;
  }
};

const closeEditModal = () => {
  showEditModal.value = false;
};

const submitEditPto = async () => {
  if (!selectedPto.value || savingEdit.value) return;

    // 🔴 reset errors
  editHoursError.value = "";
  editCommentsError.value = "";

  // ❌ validate Hours
  if (!editHours.value || editHours.value <= 0) {
    editHoursError.value = "Hours must be greater than 0.";
    return;
  }

  // ❌ validate Comments
  if (!editComments.value || !editComments.value.trim()) {
    editCommentsError.value = "Comments are required.";
    return;
  }

  savingEdit.value = true;

  try {
    const site = await Preferences.get({ key: "siteName" });
    const clientId = await Preferences.get({ key: "clientId" });
    const userId = await Preferences.get({ key: "userId" });
    const token = await Preferences.get({ key: "authToken" });

    await api.post(
      "/pto-action",
      {
        site_name: site.value,
        client_id: Number(clientId.value),
        user_id: Number(userId.value),

        action_type: actionType.value,

        pto_id: selectedPto.value.pto_id,
        assignment_id: selectedPto.value.pto_assignmentid,
        order_number: selectedPto.value.pto_ordernumber,
        date_from: selectedPto.value.pto_datefrom,
        time_from: timeCaptureMode.value === "CLOCK ENTRY" ? editStartTime.value : null,
        hours: editHours.value,
        comments: editComments.value,
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      }
    );

    showEditModal.value = false;
    await showSuccessAlert(actionType.value);
    await loadAll(); // 🔄 refresh PTO history

  } catch (err) {
    console.error("Edit PTO failed", err);
  } finally {
    savingEdit.value = false;
  }
};

/**
 * Show success alert for different actions (edit, delete, request)
 */
const showSuccessAlert = async (action: string) => {
  const alert = await alertController.create({
    header: "Success!",
    message: successMessages[action] || "Action completed successfully.",
    buttons: ["OK"],
  });

  await alert.present();
};

/**
 * Show under construction alert
 */
const showUnderConstruction = async () => {
  const alert = await alertController.create({
    header: "Coming Soon",
    message: "This feature is under construction.",
    buttons: ["OK"],
  });

  await alert.present();
};

/**
 * Check if PTO has comments
 */
const hasComments = (pto: any) => {
  return (
    pto.pto_enteredcomments &&
    pto.pto_enteredcomments.trim().length > 0
  );
};

/**
 * Check if comments exceed preview length
 */
const isLongComment = (pto: any) => {
  return pto.pto_enteredcomments.length > COMMENT_PREVIEW_LENGTH;
};

/**
 * Get comment text to display (truncated or full)
 */
const displayComment = (pto: any) => {
  if (!isLongComment(pto)) {
    return pto.pto_enteredcomments;
  }

  if (expandedComments.value[pto.pto_id]) {
    return pto.pto_enteredcomments;
  }

  return (
    pto.pto_enteredcomments.slice(0, COMMENT_PREVIEW_LENGTH) + "..."
  );
};

/**
 * Toggle comment expand / collapse
 */
const toggleComment = (ptoId: number) => {
  expandedComments.value[ptoId] =
    !expandedComments.value[ptoId];
};

</script>

<style scoped>
.back-button {
  text-transform: none !important;
}

.loading-block {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.pto-list {
  padding: 12px;
}

.pto-item {
  display: flex;              /* 🔑 key line */
  align-items: flex-start;    /* icons stick to top */
  padding: 10px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

html.dark .pto-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

.label {
  font-size: 13px;        /* smaller label */
  font-weight: 600;
  color: var(--ion-color-medium);
}

.value {
  font-size: 14px;        /* smaller value */
  text-align: right;
  line-height: 1.3;
}

/* Hours colors */
.hours-negative {
  font-weight: 600;
  color: #b3261e;
}

.hours-positive {
  font-weight: 600;
  color: #00897b;
}

/* Status colors */
.status-rejected {
  font-weight: 600;
  color: #b3261e;
}

.status-approved {
  font-weight: 600;
  color: #2e7d32;
}

.status-adjustment {
  font-weight: 600;
  color: #00897b;
}

.status-submitted {
  color: inherit;
}

.pto-content {
  flex: 1;
}

.chevron-icon {
  font-size: 20px;
  color: var(--ion-color-medium);
  margin-left: 8px;
}

html.dark .chevron-icon {
  color: rgba(255, 255, 255, 0.4);
}

.action-icons {
  width: 36px;                 /* 🔑 reserve space */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-left: 5px;
  flex-shrink: 0;              /* prevent collapsing */
}

.action-icon {
  font-size: 20px;
  padding: 6px;             /* easier to tap */
}

/* Edit */
.action-icon.edit {
  opacity: 0.85;
  color: var(--ion-color-primary);
}

/* Withdraw */
.action-icon.withdraw {
  color: var(--ion-color-danger);
}

/* Request withdraw */
.action-icon.request-withdraw {
  color: #00897b; /* teal */
}

.status-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end; /* align with value column */
}

.status-sub {
  font-size: 11px;
  font-style: italic;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

.empty-state {
  margin-top: 80px;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
}

.empty-subtitle {
  font-size: 14px;
  line-height: 1.4;
}

.comments-row {
  margin-top: 2px;
}

.comments-value {
  font-style: italic;
  line-height: 1.4;
}

/* Expand / collapse link */
.comment-toggle {
  margin-left: 6px;
  color: var(--ion-color-primary);
  cursor: pointer;
  font-style: normal;
  font-size: 13px;
}

.deletewithdraw-modal {
  --width: 380px;
  --max-width: 92%;
  --height: 320px;
  --border-radius: 16px;
}

.modal-row {
  font-size: 16px;
  color: var(--ion-color-medium);
  margin-bottom: 12px;
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

.comments-input-item ion-textarea {
  --padding-start: 6px;
  --padding-end: 6px;
  --padding-top: 6px;
  --padding-bottom: 6px;
  line-height: 1.4;
}

.editpto-modal {
  --width: 400px;
  --max-width: 92%;
  --height: 450px;
  --border-radius: 16px;
}

.time-picker-block {
  margin-top: 14px;
}

.time-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}

.error-text {
  margin: 4px 0 0 4px;
  font-size: 13px;
}

.start-time-block {
  margin-top: 14px;
}

.start-time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 12px 14px;
  border-radius: 12px;

  background: var(--ion-item-background, #f4f5f8);
  border: 1px solid rgba(0, 0, 0, 0.15);
  cursor: pointer;
}

html.dark .start-time-row {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.start-time-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
}

.start-time-value {
  font-size: 15px;
  font-weight: 500;
  color: var(--ion-text-color);
}

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

/* Done button align right */
.time-picker-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

.edit-field {
  margin-top: 14px;
}

.edit-field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}

.edit-input {
  --background: transparent;
  background: var(--ion-item-background, #f4f5f8);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 12px;

  padding: 10px 0px;
  min-height: 44px;

  display: flex;
  align-items: center;
}

.edit-input::part(native) {
  min-height: 0px;
  padding: 10;
  align-items: center;
}

html.dark .edit-input {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

/* Remove default ion-item padding */
.edit-input ion-input,
.edit-input ion-textarea {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.start-time-input {
  cursor: pointer;
}

.start-time-value {
  font-size: 15px;
  font-weight: 500;
  color: var(--ion-text-color);
  padding-left: 10px; 
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

</style>