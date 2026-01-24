<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/login"></ion-back-button>
        </ion-buttons>
        <ion-title>Verify Identity</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="auth-header">
        <h2>Tell us about you</h2>
        <p>Please enter your profile information to continue.</p>
      </div>

      <!-- First Name -->
      <ion-item>
        <ion-label position="stacked">First Name</ion-label>
        <ion-input
            v-model="firstName"
            placeholder="John"
            ref="firstInput"
        />
      </ion-item>

      <!-- Last Name -->
      <ion-item>
        <ion-label position="stacked">Last Name</ion-label>
        <ion-input v-model="lastName" placeholder="Doe" />
      </ion-item>

      <!-- Zip Code -->
      <ion-item>
        <ion-label position="stacked">ZIP Code</ion-label>
        <ion-input
          v-model="zipCode"
          type="text"
          placeholder="ZIP / Postal Code"
        />
      </ion-item>

      <ion-text color="danger" v-if="errorMessage">
        <p class="error-text">{{ errorMessage }}</p>
      </ion-text>

      <ion-button
        expand="block"
        class="go-bottom-btn"
        :disabled="isSubmitting"
        @click="onContinue"
      >
        <ion-spinner
          v-if="isSubmitting"
          name="crescent"
          style="margin-right:6px"
        />
        {{ isSubmitting ? 'Please wait...' : 'Continue' }}
      </ion-button>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonButtons,
  IonBackButton,
  IonSpinner
} from '@ionic/vue';

import { useRouter, useRoute } from 'vue-router';
import type { AxiosError } from "axios";
import api from "@/services/api";
import { onIonViewWillEnter } from '@ionic/vue';

const router = useRouter();
const route = useRoute();

// Identity from Step 1
const identityType = ref<'email' | 'phone'>('email');
const identityValue = ref('');

const firstName = ref('');
const lastName = ref('');
const zipCode = ref('');
const errorMessage = ref('');
const firstInput = ref<any | null>(null);
const isSubmitting = ref(false);

onIonViewWillEnter(() => {
  identityType.value = route.query.type as 'email' | 'phone';
  identityValue.value = route.query.value as string;

  firstName.value = '';
  lastName.value = '';
  zipCode.value = '';
  errorMessage.value = '';
  isSubmitting.value = false;
});

onMounted(() => {
  setTimeout(() => {
    const input = firstInput.value as any;

    // Trường hợp 1: Vue wrapper có $el.setFocus()
    if (input?.$el?.setFocus) {
      input.$el.setFocus();
      return;
    }

    // Trường hợp 2: setFocus nằm trực tiếp trên instance
    if (input?.setFocus) {
      input.setFocus();
    }
  }, 300);
});

const forceBlurAllInputs = () => {
  const el = document.activeElement as HTMLElement | null;
  el?.blur();
};

const onContinue = async () => {
  if (isSubmitting.value) return;   // ✅ prevent double tap

  forceBlurAllInputs();
  await new Promise(r => setTimeout(r, 50)); // ⭐️ for Android commit input

  errorMessage.value = '';

  if (!firstName.value.trim()) {
    errorMessage.value = 'First name is required.';
    return;
  }

  if (!lastName.value.trim()) {
    errorMessage.value = 'Last name is required.';
    return;
  }

  if (!zipCode.value.trim()) {
    errorMessage.value = 'ZIP / Postal Code is required.';
    return;
  }

  isSubmitting.value = true;   // ✅ disable button now

  try {
    const payload = {
      identity_type: identityType.value,
      identity_value: identityValue.value,
      first_name: firstName.value,
      last_name: lastName.value,
      zip: zipCode.value,
    };

    const res = await api.post(
      "request-code",
      payload,
      {
        headers: {
          Accept: "application/json",
        }
      }
    );

    if (!res.data.success) {
      errorMessage.value = res.data.message || "Request failed.";
      isSubmitting.value = false;   // ✅ unlock button
      return;
    }

    console.log("STEP 2 OK — API sent code successfully");

    // ✅ Navigate — no need re-enable button
    router.push({
      path: '/verify-code',
      query: {
        type: identityType.value,
        value: identityValue.value,
        first: firstName.value,
        last: lastName.value,
        zip: zipCode.value,
      },
    });

  } catch (e) {
    const err = e as AxiosError<any>;

    if (err.response) {
      errorMessage.value =
        (err.response.data as any)?.message ?? "Server error.";
    } else {
      errorMessage.value = "Unable to connect to server.";
    }

    isSubmitting.value = false;   // ✅ unlock button on exception
  }
};

</script>

<style scoped>
.auth-header {
  margin-bottom: 24px;
}

.auth-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.auth-header p {
  margin: 4px 0 0;
  color: var(--ion-color-medium);
  font-size: 14px;
}

.error-text {
  margin-top: 8px;
}
</style>
