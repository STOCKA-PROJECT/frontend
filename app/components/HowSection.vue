<script setup lang="ts">
const { t } = useI18n()

const stepKeys = ['create', 'invite', 'maintain'] as const
</script>

<template>
  <section id="how" class="section border-y border-line bg-bg-card">
    <div class="wrap">
      <div class="section-head reveal">
        <EyebrowBadge class="mb-4">
          {{ t('how.eyebrow') }}
        </EyebrowBadge>
        <h2 class="h-display mb-3.5">
          {{ t('how.title') }}
        </h2>
        <p class="text-base leading-relaxed text-ink-soft">
          {{ t('how.sub') }}
        </p>
      </div>

      <ol class="steps grid grid-cols-3 gap-7 max-md:grid-cols-1 max-md:gap-9">
        <li
          v-for="(key, i) in stepKeys"
          :key="key"
          class="step reveal relative pt-3.5"
          :class="`d${i + 1}`"
        >
          <h3 class="mb-2 text-[19px] font-semibold tracking-tightish">
            {{ t(`how.steps.${key}.title`) }}
          </h3>
          <p class="text-[14.5px] leading-relaxed text-ink-soft">
            {{ t(`how.steps.${key}.body`) }}
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.steps { counter-reset: step; }
.step { counter-increment: step; }

.step::before {
  content: counter(step, decimal-leading-zero);
  position: absolute;
  top: -12px;
  left: 0;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-accent-ink);
  letter-spacing: 0.05em;
}

.step::after {
  content: "";
  display: block;
  width: 36px;
  height: 1px;
  margin: 16px 0 18px;
  background: var(--c-line-strong);
  transform-origin: left;
  transform: scaleX(0);
  transition: transform .8s cubic-bezier(.2, .7, .2, 1);
}

.in-view.step::after,
.in-view .step::after { transform: scaleX(1); }
.in-view .step:nth-child(2)::after { transition-delay: .15s; }
.in-view .step:nth-child(3)::after { transition-delay: .3s; }
</style>
