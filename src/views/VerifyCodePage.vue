<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/profile-verify"></ion-back-button>
        </ion-buttons>
        <ion-title>Verify Code</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="auth-header">
        <h2>Enter verification code</h2>
        <p>
          We have sent a 6-digit code to
          <strong>{{ displayIdentity }}</strong>.
        </p>
      </div>

      <div class="otp-block">
        <ion-label class="otp-label">Verification Code</ion-label>

        <OtpInput
          ref="otpRef"
          v-model="code"
          @complete="onVerify"
        />
      </div>      

      <ion-text color="danger" v-if="errorMessage">
        <p class="error-text">{{ errorMessage }}</p>
      </ion-text>

      <ion-text color="success" v-if="successMessage">
        <p class="success-text">{{ successMessage }}</p>
      </ion-text>

      <ion-button
        expand="block"
        class="go-bottom-btn"
        @click="onVerify"
        :disabled="loading"
      >
        {{ loading ? 'Please wait...' : 'Verify & Continue' }}
      </ion-button>

      <div class="resend-wrapper">
        <button
          class="link-button"
          :disabled="timer > 0 || resendLoading"
          @click="onResend"
        >
          <template v-if="resendLoading">Sending...</template>
          <template v-else-if="timer > 0">
            Resend code in {{ timer }}s
          </template>
          <template v-else>
            Resend code
          </template>
        </button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
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
} from '@ionic/vue';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';
import { Preferences } from '@capacitor/preferences';
import api from "@/services/api";
import OtpInput from "@/components/OtpInput.vue";
const otpRef = ref<InstanceType<typeof OtpInput> | null>(null);

// Router
const router = useRouter();
const route = useRoute();

// Query params from previous steps
const identityType = (route.query.type as 'email' | 'phone') || 'email';
const identityValue = (route.query.value as string) || '';
const firstName = (route.query.first as string) || '';
const lastName = (route.query.last as string) || '';
const zipCode = (route.query.zip as string) || '';

// State
const code = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const loading = ref(false);
const resendLoading = ref(false);

// Countdown timer for resend
const timer = ref(30);
let timerInterval: any = null;

// Start countdown on mount
onMounted(() => {
  timer.value = 30;
  timerInterval = setInterval(() => {
    if (timer.value > 0) {
      timer.value--;
    }
  }, 1000);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
});

// Mask identity for display
const displayIdentity = computed(() => {
  if (!identityValue) return '';

  if (identityType === 'email') {
    const [user, domain] = identityValue.split('@');
    if (!domain) return identityValue;
    if (user.length <= 2) return identityValue;
    const maskedUser = user[0] + '***' + user[user.length - 1];
    return `${maskedUser}@${domain}`;
  } else {
    const digits = identityValue.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(***) ***-${digits.slice(-4)}`;
    }
    return identityValue;
  }
});

// ✅ VERIFY CODE
const onVerify = async () => {
  errorMessage.value = '';
  successMessage.value = '';

  if (!code.value || code.value.length !== 6) {
    errorMessage.value = 'Verification code must be 6 digits.';
    return;
  }

  loading.value = true;

  try {

    const response = await api.post(
      "verify-code",
      {
      identity_type: identityType,
      identity_value: identityValue,
      first_name: firstName,
      last_name: lastName,
      zip: zipCode,
      code: code.value,
      },
      {
        headers: {
          Accept: "application/json",
        }
      }
    );

    if (!response.data.success) {
      errorMessage.value = response.data.message || 'Verification failed.';
      loading.value = false;
      return;
    }

    const token = response.data.token;
    const isymphonyuser = response.data.isymphonyuser;

    // Save auth token for route guard
    await Preferences.set({
      key: 'authToken',
      value: token,
    });

    // Save some basic info for header/menu
    await Preferences.set({
      key: 'userFirstName',
      value: isymphonyuser.iu_firstname,
    });
    await Preferences.set({
      key: "weekendingDay",
      value: isymphonyuser.iu_weekendingday,
    });

    await Preferences.set({
      key: 'identityValue',
      value: identityValue,
    });

    // ⭐ Save Site Name (VERY IMPORTANT)
    await Preferences.set({
      key: "siteName",
      value: isymphonyuser.iu_sitename,
    });

    // ⭐ Save UserID (VERY IMPORTANT)
    await Preferences.set({
      key: "userId",
      value: isymphonyuser.iu_isymphonyuserid.toString(),
    });

    // ⭐ Save ClientID (VERY IMPORTANT)
    await Preferences.set({
      key: "clientId",
      value: isymphonyuser.iu_clientid.toString(),
    });

    // Navigate to Home and reload app so everything picks up new token
    /*
    router.push('/home').then(() => {
      window.location.reload();
    });
    */

    // --------------------------------------------
    // Load session-user-info to get assignments
    // --------------------------------------------
    const sessionRes = await api.post(
      "/session-user-info",
      {
        site_name: isymphonyuser.iu_sitename,
        user_id: Number(isymphonyuser.iu_isymphonyuserid),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        }
      }
    );

    const assignments = sessionRes.data.assignments || [];

    // ----------------------------
    // Routing decision
    // ----------------------------
    if (assignments.length === 1) {

      await Preferences.set({
        key: "defaultAssignmentId",
        value: assignments[0].assignment_id.toString(),
      });

      window.dispatchEvent(new Event("auth-ready")); //to make sure menu loaded
      router.replace("/home");
    } else {
      router.replace("/initial");
    }    

  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      errorMessage.value =
        error.response?.data?.message || 'Invalid or expired code.';
    } else {
      errorMessage.value = 'Unable to connect to server.';
    }
  } finally {
    loading.value = false;
  }
};

// ✅ RESEND CODE
const onResend = async () => {
  if (timer.value > 0 || resendLoading.value) return;

  errorMessage.value = '';
  successMessage.value = '';
  resendLoading.value = true;

  try {
    const response = await api.post(
      "/request-code",
      {
        identity_type: identityType,
        identity_value: identityValue,
        first_name: firstName,
        last_name: lastName,
        zip: zipCode,
      },
      {
        headers: {
          Accept: "application/json",
        }
      }
    );

    if (!response.data.success) {
      errorMessage.value = response.data.message || 'Unable to resend code.';
    } else {
      successMessage.value = 'A new verification code has been sent.';
      // Reset countdown
      timer.value = 30;
      
      // ⭐ CLEAR OTP + focus lại
      code.value = "";
      otpRef.value?.clear();
    }
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      errorMessage.value =
        error.response?.data?.message || 'Unable to resend code.';
    } else {
      errorMessage.value = 'Network error — please try again.';
    }
  } finally {
    resendLoading.value = false;
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

.success-text {
  margin-top: 8px;
}

.resend-wrapper {
  margin-top: 16px;
  text-align: center;
}

.link-button {
  background: none;
  border: none;
  padding: 0;
  color: var(--ion-color-primary);
  font-size: 14px;
  text-decoration: underline;
}

.link-button:disabled {
  color: var(--ion-color-medium);
  text-decoration: none;
}

.otp-block {
  margin-top: 12px;
}

.otp-label {
  display: block;
  margin-bottom: 10px;
  font-size: 14px;
  color: var(--ion-color-medium);
}
</style>
