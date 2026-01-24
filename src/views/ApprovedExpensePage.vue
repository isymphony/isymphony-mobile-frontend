<template>
  <ion-page>

    <!-- ================= HEADER ================= -->
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Approved Expenses</ion-title>
      </ion-toolbar>
    </ion-header>

    <!-- ================= GLOBAL LOADING ================= -->
    <ion-loading
      :is-open="initialLoading"
      message="Loading..."
      spinner="crescent"
    />

    <!-- ================= CONTENT ================= -->
    <ion-content class="ion-padding" v-if="!initialLoading">

      <!-- Pull to Refresh -->
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Empty State -->
      <div v-if="!loading && rows.length === 0" class="empty-state">
        No approved expenses found.
      </div>

      <!-- Expense List -->
      <ion-list>
        <ion-item
          v-for="row in rows"
          :key="row.id"
          class="expense-row"
        >
          <!-- Approved Icon -->
          <ion-icon
            slot="start"
            :icon="pricetagOutline"
            class="approved-icon"
          />

          <!-- Left Block -->
          <ion-label>
            <div class="weekend-label">Weekend</div>
            <div class="date-label">{{ row.display_date }}</div>
          </ion-label>

          <!-- Action Icons -->
          <div class="action-icons">
            <ion-icon
              :icon="documentOutline"
              class="icon-btn"
              @click="openPdf(row.signed_url)"
            />
            <ion-icon
              :icon="mailOutline"
              class="icon-btn"
              @click="confirmEmail(row.display_date, row.id)"
            />
          </div>
        </ion-item>
      </ion-list>

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
  IonMenuButton,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonLoading,
  alertController,
  onIonViewWillEnter,
  loadingController
} from "@ionic/vue";

import { ref } from "vue";
import { Preferences } from "@capacitor/preferences";
import { Browser } from "@capacitor/browser";
import api from "@/services/api";

import {
  pricetagOutline,
  documentOutline,
  mailOutline
} from "ionicons/icons";

/* ================= STATE ================= */
const initialLoading = ref(true);
const loading = ref(false);
const rows = ref<any[]>([]);
const userEmail = ref("");

/* ================= PAGE INIT ================= */
onIonViewWillEnter(async () => {
  await loadUserProfile();
  await loadApprovedExpenses();
  initialLoading.value = false; // hide global spinner
});

/* ================= API CALLS ================= */
const loadApprovedExpenses = async () => {
  try {
    loading.value = true;

    const token = await Preferences.get({ key: "authToken" });
    const site = await Preferences.get({ key: "siteName" });
    const client = await Preferences.get({ key: "clientId" });
    const userId = await Preferences.get({ key: "userId" });

    if (!token.value) return;

    const res = await api.post(
      "/approved-expenses",
      {
        site_name: site.value,
        client_id: Number(client.value),
        user_id: Number(userId.value),
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    rows.value = res.data.data || [];

  } catch (err) {
    console.error("Failed to load approved expenses", err);
  } finally {
    loading.value = false;
  }
};

const loadUserProfile = async () => {
  try {
    const token = await Preferences.get({ key: "authToken" });
    const siteName = await Preferences.get({ key: "siteName" });
    const userId = await Preferences.get({ key: "userId" });

    if (!token.value) return;

    const res = await api.post(
      "/my-profile",
      {
        site_name: siteName.value,
        user_id: Number(userId.value)
      },
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
          Accept: "application/json"
        }
      }
    );

    userEmail.value = res.data.email || "";
  } catch (err) {
    console.error("Failed to load profile/email", err);
  }
};

/* ================= ACTIONS ================= */
const openPdf = async (url: string) => {
  try {
    await Browser.open({ url });
  } catch (err) {
    console.error("PDF open failed", err);
  }
};

const confirmEmail = async (displayDate: string, expenseId: number) => {
  if (!userEmail.value) {
    await showMessage("Email Missing", "Unable to determine your email address.");
    return;
  }

  const msg =
    `Weekend: ${displayDate}\n\n` +
    `Send the approved expense to:\n${userEmail.value}`;

  const alert = await alertController.create({
    header: "Email Expense",
    message: msg,
    cssClass: "alert-multiline",
    buttons: [
      { text: "Cancel", role: "cancel" },
      {
        text: "Okay",
        handler: async () => {
          try {
            await showEmailLoading();

            const token = await Preferences.get({ key: "authToken" });
            const siteName = await Preferences.get({ key: "siteName" });
            const userId = await Preferences.get({ key: "userId" });

            await api.post(
              "/send-approved-expense",
              {
                expense_id: expenseId,
                site_name: siteName.value,
                user_id: Number(userId.value)
              },
              {
                headers: {
                  Authorization: `Bearer ${token.value}`,
                  Accept: "application/json"
                }
              }
            );

            await hideEmailLoading();

            await showMessage(
              "Email Sent",
              "A copy of your approved expense has been sent."
            );

          } catch (err) {
            console.error("Email send failed", err);
            await hideEmailLoading();
            await showMessage("Email Failed", "Please try again.");
          }
        }
      }
    ]
  });

  await alert.present();
};

const showMessage = async (title: string, message: string) => {
  const alert = await alertController.create({
    header: title,
    message,
    cssClass: "alert-multiline",
    buttons: ["OK"]
  });

  await alert.present();
};

let emailLoader: HTMLIonLoadingElement | null = null;

const showEmailLoading = async () => {
  emailLoader = await loadingController.create({
    message: "Please wait...",
    spinner: "crescent"
  });
  await emailLoader.present();
};

const hideEmailLoading = async () => {
  if (emailLoader) {
    await emailLoader.dismiss();
    emailLoader = null;
  }
};

/* ================= REFRESH ================= */
const doRefresh = async (event: any) => {
  await loadUserProfile();
  await loadApprovedExpenses();
  event.target.complete();
};
</script>

<style scoped>
/* Ensure divider line starts from the left INCLUDING icon */
.expense-row {
  --padding-start: 0 !important;
}

/* Modify native part to shift real divider fully left */
ion-item::part(native) {
  padding-left: 0 !important;
}

.weekend-label {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin-bottom: 3px;
}

.date-label {
  font-size: 17px;
  font-weight: 700;
}

.action-icons {
  display: flex;
  gap: 14px;
}

.icon-btn {
  font-size: 22px;
  color: var(--ion-color-primary);
}

.empty-state {
  text-align: center;
  margin-top: 40px;
  font-size: 14px;
  color: var(--ion-color-medium);
}

/* Force divider line to extend fully under the icon */
.expense-row {
  --padding-start: 0 !important;
  --inner-padding-start: 12px !important;
  --inner-padding-end: 12px !important;

  border-bottom: 1px solid var(--ion-color-medium-shade) !important;
}

.expense-row::part(native) {
  --inner-border-width: 0 !important;
  --border-width: 0 !important;
}

</style>
