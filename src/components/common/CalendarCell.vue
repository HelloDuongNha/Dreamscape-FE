<template>
  <div
    :id="id"
    :class="[
      'calendar-grid__cell',
      { 'calendar-grid__cell--empty': isEmpty },
      { 'calendar-grid__cell--today': isToday },
      { 'calendar-grid__cell--checked': isCheckedIn },
      { 'calendar-grid__cell--future': isFuture },
    ]"
    :role="isEmpty ? undefined : 'gridcell'"
    :aria-label="isEmpty ? undefined : ariaLabel"
    :aria-hidden="isEmpty ? 'true' : undefined"
  >
    <template v-if="!isEmpty">
      <!-- Check-in indicator: green outline tick in top-right -->
      <span v-if="isCheckedIn" class="calendar-grid__check" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="2 6 5 9 10 3"/>
        </svg>
      </span>
      <span class="calendar-grid__day-num">{{ dayNum }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  id?: string
  dayNum?: number
  isEmpty?: boolean
  isToday?: boolean
  isCheckedIn?: boolean
  isFuture?: boolean
  ariaLabel?: string
}>()
</script>

<style scoped>
.calendar-grid__cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #262626;
  border-radius: 4px;
  background: #181818;
  transition: background 0.12s;
  width: 100%;
  height: clamp(42px, 8vh, 68px);
  box-sizing: border-box;
}

.calendar-grid__cell--empty {
  background: transparent;
  border-color: transparent;
  pointer-events: none;
}

.calendar-grid__cell--future {
  opacity: 0.35;
}

.calendar-grid__cell--today {
  border-color: #3a3a3a;
  background: #202020;
}

.calendar-grid__cell--today .calendar-grid__day-num {
  color: #ffffff;
  font-weight: 700;
}

.calendar-grid__cell--checked {
  background: #101010;
  opacity: 0.85;
  border-color: #1a3a2e;
}

.calendar-grid__day-num {
  font-size: 13px;
  color: #737373;
}

.calendar-grid__check {
  position: absolute;
  top: 3px;
  right: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid #10B981;
  border-radius: 2px;
}
</style>
