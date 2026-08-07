<template>
  <Teleport to="body">
    <Transition name="avatar-crop-fade">
      <div
        v-if="modelValue"
        class="avatar-crop-overlay"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @click.self="cancel"
        @keydown="handleKeydown"
      >
        <section ref="dialogRef" class="avatar-crop-modal" tabindex="-1">
          <header class="avatar-crop-modal__header">
            <div>
              <h2 :id="titleId">{{ t('settings.avatarCropTitle') }}</h2>
              <p>{{ t('settings.avatarCropHint') }}</p>
            </div>
            <button
              type="button"
              class="avatar-crop-modal__close"
              :aria-label="t('settings.avatarCropCancel')"
              :disabled="loading"
              @click="cancel"
            >
              ×
            </button>
          </header>

          <div class="avatar-crop-modal__body">
            <div
              ref="cropAreaRef"
              class="avatar-crop-modal__area"
              :class="{ 'avatar-crop-modal__area--dragging': dragging }"
              @pointerdown="startDrag"
              @pointermove="moveImage"
              @pointerup="finishDrag"
              @pointercancel="finishDrag"
              @lostpointercapture="resetPointerDrag"
            >
              <img
                ref="imageRef"
                :src="sourceUrl"
                :alt="t('settings.avatarCropPreviewAlt')"
                :style="imageStyle"
                draggable="false"
                @load="prepareImage"
                @error="emit('error')"
              />
              <div class="avatar-crop-modal__grid" aria-hidden="true">
                <span class="avatar-crop-modal__grid-line avatar-crop-modal__grid-line--v1" />
                <span class="avatar-crop-modal__grid-line avatar-crop-modal__grid-line--v2" />
                <span class="avatar-crop-modal__grid-line avatar-crop-modal__grid-line--h1" />
                <span class="avatar-crop-modal__grid-line avatar-crop-modal__grid-line--h2" />
              </div>
              <div class="avatar-crop-modal__avatar-outline" aria-hidden="true" />
            </div>

            <label class="avatar-crop-modal__zoom">
              <span>{{ t('settings.avatarCropZoom') }}</span>
              <input
                v-model.number="zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                :aria-label="t('settings.avatarCropZoom')"
                :disabled="loading"
                @input="clampOffset"
              />
            </label>
          </div>

          <footer class="avatar-crop-modal__actions">
            <AppButton variant="secondary" :disabled="loading" @click="cancel">
              {{ t('settings.avatarCropCancel') }}
            </AppButton>
            <AppButton :loading="loading" :disabled="!imageReady" @click="confirmCrop">
              {{ t('settings.avatarCropSave') }}
            </AppButton>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/common/AppButton.vue'

const OUTPUT_SIZE = 512

const props = defineProps<{
  modelValue: boolean
  sourceUrl: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [file: File]
  cancel: []
  error: []
}>()

const { t } = useI18n()
const titleId = `avatar-crop-${Math.random().toString(36).slice(2, 8)}`
const dialogRef = ref<HTMLElement | null>(null)
const cropAreaRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const naturalSize = reactive({ width: 0, height: 0 })
const offset = reactive({ x: 0, y: 0 })
const cropSize = ref(320)
const zoom = ref(1)
const dragging = ref(false)
const imageReady = computed(() => naturalSize.width > 0 && naturalSize.height > 0)
let activePointerId: number | null = null
let previousPointerPosition = { x: 0, y: 0 }
let previouslyFocusedElement: HTMLElement | null = null

const imageStyle = computed(() => {
  const scale = renderedScale()
  return {
    width: `${naturalSize.width * scale}px`,
    height: `${naturalSize.height * scale}px`,
    left: `calc(50% + ${offset.x}px)`,
    top: `calc(50% + ${offset.y}px)`,
    opacity: imageReady.value ? '1' : '0',
  }
})

function prepareImage(): void {
  const image = imageRef.value
  if (!image) return
  naturalSize.width = image.naturalWidth
  naturalSize.height = image.naturalHeight
  cropSize.value = cropAreaRef.value?.clientWidth || 320
  zoom.value = 1
  offset.x = 0
  offset.y = 0
}

function renderedScale(): number {
  if (!imageReady.value) return 1
  const coverScale = Math.max(
    cropSize.value / naturalSize.width,
    cropSize.value / naturalSize.height,
  )
  return coverScale * zoom.value
}

function clampOffset(): void {
  const scale = renderedScale()
  const maxX = Math.max(0, (naturalSize.width * scale - cropSize.value) / 2)
  const maxY = Math.max(0, (naturalSize.height * scale - cropSize.value) / 2)
  offset.x = Math.min(maxX, Math.max(-maxX, offset.x))
  offset.y = Math.min(maxY, Math.max(-maxY, offset.y))
}

function startDrag(event: PointerEvent): void {
  if (props.loading || !imageReady.value) return
  activePointerId = event.pointerId
  previousPointerPosition = { x: event.clientX, y: event.clientY }
  dragging.value = true
  cropAreaRef.value?.setPointerCapture(event.pointerId)
}

function moveImage(event: PointerEvent): void {
  if (!dragging.value || activePointerId !== event.pointerId) return
  offset.x += event.clientX - previousPointerPosition.x
  offset.y += event.clientY - previousPointerPosition.y
  previousPointerPosition = { x: event.clientX, y: event.clientY }
  clampOffset()
}

function finishDrag(event: PointerEvent): void {
  if (activePointerId !== event.pointerId) return
  if (cropAreaRef.value?.hasPointerCapture(event.pointerId)) {
    cropAreaRef.value.releasePointerCapture(event.pointerId)
  }
  activePointerId = null
  dragging.value = false
}

function resetPointerDrag(): void {
  activePointerId = null
  dragging.value = false
}

async function confirmCrop(): Promise<void> {
  const image = imageRef.value
  if (!image || !imageReady.value || props.loading) return

  const scale = renderedScale()
  const sourceSize = cropSize.value / scale
  const sourceX = naturalSize.width / 2 - offset.x / scale - sourceSize / 2
  const sourceY = naturalSize.height / 2 - offset.y / scale - sourceSize / 2
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) {
    emit('error')
    return
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )

  const blob = await canvasToBlob(canvas)
  if (!blob) {
    emit('error')
    return
  }
  emit('confirm', new File([blob], 'avatar.webp', { type: blob.type }))
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const webp = await createCanvasBlob(canvas, 'image/webp', 0.92)
  return webp ?? createCanvasBlob(canvas, 'image/png')
}

function createCanvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

function cancel(): void {
  if (props.loading) return
  emit('cancel')
  emit('update:modelValue', false)
}

function enabledControls(): HTMLElement[] {
  if (!dialogRef.value) return []
  return Array.from(dialogRef.value.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
  ))
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }
  if (event.key !== 'Tab') return
  const controls = enabledControls()
  if (!controls.length) return
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

watch(
  () => props.modelValue,
  async (open, wasOpen) => {
    if (open) {
      previouslyFocusedElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      naturalSize.width = 0
      naturalSize.height = 0
      offset.x = 0
      offset.y = 0
      zoom.value = 1
      await nextTick()
      cropSize.value = cropAreaRef.value?.clientWidth || 320
      dialogRef.value?.focus()
      return
    }
    if (wasOpen) {
      await nextTick()
      previouslyFocusedElement?.focus()
      previouslyFocusedElement = null
    }
  },
)

onBeforeUnmount(() => {
  if (
    cropAreaRef.value
    && activePointerId !== null
    && cropAreaRef.value.hasPointerCapture(activePointerId)
  ) {
    cropAreaRef.value.releasePointerCapture(activePointerId)
  }
  activePointerId = null
  dragging.value = false
  if (props.modelValue) previouslyFocusedElement?.focus()
})
</script>

<style scoped>
.avatar-crop-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 500);
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgb(0 0 0 / 80%);
}

.avatar-crop-modal {
  width: min(440px, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-xl);
  box-shadow: none;
}

.avatar-crop-modal:focus { outline: none; }

.avatar-crop-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  border-bottom: 1px solid #262626;
}

.avatar-crop-modal__header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
}

.avatar-crop-modal__header p {
  margin: var(--space-2) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.avatar-crop-modal__close {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  cursor: pointer;
}

.avatar-crop-modal__close:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.avatar-crop-modal__body {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
}

.avatar-crop-modal__area {
  position: relative;
  width: min(360px, calc(100vw - 4.5rem));
  aspect-ratio: 1;
  margin: 0 auto;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  user-select: none;
  background: #0f0f0f;
  border: 1px solid #343434;
}

.avatar-crop-modal__area--dragging { cursor: grabbing; }

.avatar-crop-modal__area img {
  position: absolute;
  max-width: none;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: opacity 120ms ease;
}

.avatar-crop-modal__grid,
.avatar-crop-modal__avatar-outline {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.avatar-crop-modal__grid-line {
  position: absolute;
  background: rgb(255 255 255 / 42%);
}

.avatar-crop-modal__grid-line--v1,
.avatar-crop-modal__grid-line--v2 {
  top: 0;
  bottom: 0;
  width: 1px;
}

.avatar-crop-modal__grid-line--v1 { left: 33.333%; }
.avatar-crop-modal__grid-line--v2 { left: 66.666%; }

.avatar-crop-modal__grid-line--h1,
.avatar-crop-modal__grid-line--h2 {
  right: 0;
  left: 0;
  height: 1px;
}

.avatar-crop-modal__grid-line--h1 { top: 33.333%; }
.avatar-crop-modal__grid-line--h2 { top: 66.666%; }

.avatar-crop-modal__avatar-outline {
  border: 1px solid rgb(255 255 255 / 68%);
  border-radius: 50%;
  box-shadow: 0 0 0 100vmax rgb(0 0 0 / 30%);
}

.avatar-crop-modal__zoom {
  display: grid;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.avatar-crop-modal__zoom input {
  width: 100%;
  accent-color: var(--color-text-primary);
}

.avatar-crop-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid #262626;
}

.avatar-crop-fade-enter-active,
.avatar-crop-fade-leave-active { transition: opacity 150ms ease; }
.avatar-crop-fade-enter-from,
.avatar-crop-fade-leave-to { opacity: 0; }

@media (max-width: 480px) {
  .avatar-crop-overlay { padding: 0; }
  .avatar-crop-modal {
    width: 100%;
    max-height: 100vh;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }
  .avatar-crop-modal__header,
  .avatar-crop-modal__body {
    padding: var(--space-4);
  }
  .avatar-crop-modal__area {
    width: min(360px, calc(100vw - 2rem));
  }
  .avatar-crop-modal__actions {
    padding: var(--space-4);
  }
}
</style>
