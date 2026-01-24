<template>
  <div class="otp-container">
    <input
      v-for="(_, i) in length"
      :key="i"
      ref="inputs"
      class="otp-box"
      type="tel"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="1"
      :value="digits[i]"
      @input="onInput($event, i)"
      @keydown="onKeydown($event, i)"
      @paste="onPaste($event, i)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";

/* -----------------------
   Props & Emits
----------------------- */
const props = defineProps<{
  modelValue: string;
  length?: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "complete", value: string): void;
}>();

const length = props.length ?? 6;

/* -----------------------
   State
----------------------- */
const digits = ref<string[]>(Array(length).fill(""));
const inputs = ref<HTMLInputElement[]>([]);

/* -----------------------
   Helpers
----------------------- */
const focus = async (index: number) => {
  await nextTick();
  inputs.value[index]?.focus();
};

/* -----------------------
   Paste handler (reliable)
----------------------- */
const onPaste = async (e: ClipboardEvent, index: number) => {
  e.preventDefault();

  const text = e.clipboardData?.getData("text") ?? "";
  const chars = text.replace(/\D/g, "").slice(0, length).split("");

  if (chars.length === 0) return;

  chars.forEach((c, i) => {
    digits.value[i] = c;
  });

  emit("update:modelValue", digits.value.join(""));

  // Move focus to the last filled box
  await focus(Math.min(chars.length, length) - 1);

  if (chars.length === length) {
    emit("complete", digits.value.join(""));
  }
};

/* -----------------------
   Input handler
----------------------- */
const onInput = async (e: Event, index: number) => {
  const input = e.target as HTMLInputElement;

  // Keep only digits
  const value = (input.value ?? "").replace(/\D/g, "");

  // If user typed more than one char (some keyboards do this), keep the last digit
  const digit = value ? value[value.length - 1] : "";

  digits.value[index] = digit;
  input.value = digit;

  emit("update:modelValue", digits.value.join(""));

  // Auto move forward
  if (digit && index < length - 1) {
    await focus(index + 1);
  }

  if (digits.value.join("").length === length) {
    emit("complete", digits.value.join(""));
  }
};

/* -----------------------
   Backspace handler
----------------------- */
const onKeydown = async (e: KeyboardEvent, index: number) => {
  if (e.key !== "Backspace") return;

  // If current has digit, clear it
  if (digits.value[index]) {
    digits.value[index] = "";
    emit("update:modelValue", digits.value.join(""));
    return;
  }

  // Otherwise move back and clear previous
  if (index > 0) {
    digits.value[index - 1] = "";
    emit("update:modelValue", digits.value.join(""));
    await focus(index - 1);
  }
};

/* -----------------------
   Public API for parent
----------------------- */
const clear = async () => {
  digits.value = Array(length).fill("");
  emit("update:modelValue", "");
  await focus(0);
};

defineExpose({ clear });

/* -----------------------
   Sync from parent v-model
----------------------- */
watch(
  () => props.modelValue,
  (val) => {
    if (!val) clear();
  }
);
</script>

<style scoped>
.otp-container {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
  margin-bottom: 24px;
}

/*
  Ionic globally strips borders from inputs inside ion-content.
  We must hard-reset the input and re-apply box styles.
*/

.otp-box {
  /* Reset only what Ionic usually overrides */
  appearance: none;
  -webkit-appearance: none;
  background: var(--ion-background-color, #ffffff);

  box-sizing: border-box;
  width: 40px;
  height: 48px;

  border: 2px solid #c4c4c4;
  border-radius: 10px;

  text-align: center;
  font-size: 22px;
  font-weight: 600;

  outline: none;
  box-shadow: none;

  /* 🔥 Text visibility (Android safe) */
  color: #ffffff; /* fallback */
  color: var(--ion-text-color);
  caret-color: var(--ion-color-primary);
}

.otp-box:focus {
  border-color: rgb(146, 18, 163);;
}

</style>
