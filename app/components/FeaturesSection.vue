<script setup lang="ts">
import type { FeatureIconName } from './FeatureIcon.vue'

const { t } = useI18n()

interface Feature {
  key: string
  icon: FeatureIconName
}

const features: Feature[] = [
  { key: 'item', icon: 'item' },
  { key: 'location', icon: 'location' },
  { key: 'owner', icon: 'owner' },
  { key: 'category', icon: 'category' },
  { key: 'label', icon: 'label' },
  { key: 'history', icon: 'history' }
]
</script>

<template>
  <section id="features" class="section">
    <div class="wrap">
      <div class="section-head reveal">
        <EyebrowBadge class="mb-4">
          {{ t('features.eyebrow') }}
        </EyebrowBadge>
        <h2 class="h-display mb-3.5">
          {{ t('features.title') }}
        </h2>
        <p class="text-base leading-relaxed text-ink-soft">
          {{ t('features.sub') }}
        </p>
      </div>

      <ul class="features grid grid-cols-3 gap-[18px] max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-3">
        <li
          v-for="(feat, i) in features"
          :key="feat.key"
          class="feat reveal flex flex-col gap-3.5 rounded-[14px] border border-line bg-bg-card p-5 sm:p-7
                 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
          :class="`d${i + 1}`"
        >
          <div
            class="feat-ico flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink
                   transition-[transform,background-color,color] duration-300 ease-ease"
          >
            <FeatureIcon :name="feat.icon" />
          </div>
          <h3 class="text-[17px] font-semibold tracking-tight">
            {{ t(`features.items.${feat.key}.title`) }}
          </h3>
          <p class="text-sm leading-relaxed text-ink-soft">
            {{ t(`features.items.${feat.key}.body`) }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.feat:hover .feat-ico {
  transform: rotate(-6deg) scale(1.08);
  background: var(--c-accent);
  color: #fff;
}
</style>
