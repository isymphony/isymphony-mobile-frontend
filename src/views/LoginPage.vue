<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Sign In</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <div class="auth-header">
        <h2>Welcome</h2>
        <p>Please enter your email address or phone number to continue.</p>
      </div>

      <!-- Email field (shown if mode is 'none' or 'email') -->
      <ion-item v-if="mode === 'none' || mode === 'email'">
        <ion-label position="stacked">Email Address</ion-label>
        <ion-input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          @ionBlur="onEmailBlur"
        />
      </ion-item>

      <!-- OR separator -->
      <div v-if="mode === 'none'" class="or-separator">
        <div class="line"></div>
        <span>OR</span>
        <div class="line"></div>
      </div>

      <ion-item v-if="mode === 'none' || mode === 'phone'">
        <ion-label position="stacked">Phone Number</ion-label>
        <ion-input
          v-model="phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          @ionBlur="onPhoneBlur"
        />
      </ion-item>

      <ion-text color="danger" v-if="errorMessage">
        <p class="error-text">{{ errorMessage }}</p>
      </ion-text>

      <ion-button
        expand="block"
        class="go-bottom-btn"
        @click="onNext"
      >
        Next Step
      </ion-button>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
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
  IonText
} from '@ionic/vue';
import { useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';

const router = useRouter();
const email = ref('');
const phone = ref('');
const mode = ref<'none' | 'email' | 'phone'>('none'); // which identity user has chosen
const errorMessage = ref('');

onIonViewWillEnter(() => {
  email.value = '';
  phone.value = '';
  mode.value = 'none';
  errorMessage.value = '';
});

// Simple email validation
const isValidEmail = (value: string) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(value);
};


const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10;
};

const onEmailBlur = () => {
  if (email.value && mode.value === 'none') {
    mode.value = 'email';
    phone.value = '';
  }
};

const onPhoneBlur = () => {
  if (phone.value && mode.value === 'none') {
    mode.value = 'phone';
    email.value = '';
  }
};

// ⭐ Reset mode when BOTH fields are cleared
watch([email, phone], ([newEmail, newPhone]) => {
  if (!newEmail && !newPhone) {
    mode.value = 'none';
  }
});

const onNext = () => {
  errorMessage.value = '';

  if (!email.value && !phone.value) {
    errorMessage.value = 'Please enter either email address or phone number.';
    return;
  }

  if (email.value) {
    if (!isValidEmail(email.value)) {
      errorMessage.value = 'Please enter a valid email address.';
      return;
    }
    mode.value = 'email';
  } else if (phone.value) {
    if (!isValidPhone(phone.value)) {
      errorMessage.value = 'Phone number must be in format +1 (xxx) xxx-xxxx.';
      return;
    }
    mode.value = 'phone';
  }

  // For now, just log the identity. Next steps will navigate to the next page.
  console.log('Identity selected:', {
    type: mode.value,
    email: email.value,
    phone: phone.value
  });

  // TODO (next steps): navigate to Profile Verification page
  router.push({
    path: '/profile-verify',
    query: {
      type: mode.value,
      value: mode.value === 'email' ? email.value : phone.value,
    },
  });
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

.or-separator {
  display: flex;
  align-items: center;
  margin: 12px 0;
}

.or-separator .line {
  flex: 1;
  height: 1px;
  background-color: var(--ion-color-medium-tint);
}

.or-separator span {
  margin: 0 8px;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.error-text {
  margin-top: 8px;
}
</style>
