<template>
  <span v-if="badgeClass !== 'hidden' && badgeLabel" :class="['app-status-badge', `app-status-badge--${badgeClass}`]">
    {{ badgeLabel }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  status: string
  kind?: 'moderation' | 'verification' | 'copyright' | 'allowedUse' | 'fullTextStatus' | 'generic'
  isUploadedPdf?: boolean
  sourceType?: 'uploaded_pdf' | 'doi' | 'isbn' | 'web_url' | 'unspecified'
  fullTextSourceType?: string
}>(), {
  kind: 'generic',
  isUploadedPdf: false,
  sourceType: 'unspecified',
  fullTextSourceType: ''
})

const badgeClass = computed(() => {
  const s = (props.status || '').toLowerCase().trim()
  const resolvedType = props.sourceType && props.sourceType !== 'unspecified' 
    ? props.sourceType 
    : (props.isUploadedPdf ? 'uploaded_pdf' : 'unspecified')

  if (resolvedType === 'uploaded_pdf') {
    if (props.kind === 'allowedUse') {
      if (s === 'open_access_fulltext') return 'completed'
      if (s === 'metadata_only') return 'private'
    }
    if (props.kind === 'copyright') {
      return 'hidden' // hide copyright badge to avoid "paywalled" contradiction
    }
    if (props.kind === 'verification') {
      if (s === 'manual') return 'completed'
    }
    if (props.kind === 'fullTextStatus') {
      if (s === 'available' || s === 'imported') return 'completed'
      return 'private'
    }
  }

  if (resolvedType === 'isbn') {
    if (props.kind === 'verification') return 'private'
    if (props.kind === 'fullTextStatus') return 'pending'
    if (props.kind === 'allowedUse') return 'failed'
    if (props.kind === 'copyright') return 'hidden'
  }

  if (resolvedType === 'web_url') {
    if (props.kind === 'verification') return 'public'
    if (props.kind === 'allowedUse') {
      if (s === 'open_access_fulltext') return 'completed'
      return 'private'
    }
    if (props.kind === 'fullTextStatus') {
      if (s === 'available' || s === 'imported') return 'completed'
      return 'private'
    }
    if (props.kind === 'copyright') return 'hidden'
  }

  if (props.kind === 'moderation') {
    if (s === 'pending') return 'pending'
    if (s === 'approved') return 'completed'
    if (s === 'rejected') return 'failed'
  }
  if (props.kind === 'verification') {
    if (s === 'verified_doi') return 'completed'
    if (s === 'unverified') return 'failed'
    if (s === 'manual') return 'private'
  }
  if (props.kind === 'copyright') {
    if (s === 'public_domain') return 'completed'
    if (s === 'copyrighted_with_open_access') return 'public'
    if (s === 'paywalled') return 'failed'
  }
  if (props.kind === 'allowedUse') {
    if (s === 'metadata_only') return 'private'
    if (s === 'abstract_only') return 'pending'
    if (s === 'open_access_fulltext') return 'completed'
  }
  if (props.kind === 'fullTextStatus') {
    if (s === 'available' || s === 'imported') return 'completed'
    if (s === 'none' || s === 'blocked') return 'private'
    if (s === 'failed') return 'failed'
  }

  // generic fallback
  if (['pending', 'completed', 'failed', 'private', 'public'].includes(s)) {
    return s
  }
  if (s === 'approved') return 'completed'
  if (s === 'rejected') return 'failed'
  return 'unknown'
})

const badgeLabel = computed(() => {
  const s = (props.status || '').trim().toLowerCase()
  const resolvedType = props.sourceType && props.sourceType !== 'unspecified' 
    ? props.sourceType 
    : (props.isUploadedPdf ? 'uploaded_pdf' : 'unspecified')

  if (resolvedType === 'uploaded_pdf') {
    if (props.kind === 'allowedUse') {
      if (s === 'open_access_fulltext') return 'Có bản đọc được duyệt'
      if (s === 'metadata_only') return 'Chỉ Metadata'
    }
    if (props.kind === 'copyright') {
      return '' // hidden
    }
    if (props.kind === 'verification') {
      if (s === 'manual') return 'Đã duyệt thủ công'
    }
    if (props.kind === 'fullTextStatus') {
      if (s === 'available' || s === 'imported') return 'PDF đã được moderator duyệt'
      return 'Chưa có bản đọc'
    }
  }

  if (resolvedType === 'isbn') {
    if (props.kind === 'verification') return 'Metadata sách'
    if (props.kind === 'fullTextStatus') return 'Chưa có toàn văn'
    if (props.kind === 'allowedUse') return 'Không có tài liệu gốc'
    if (props.kind === 'copyright') return ''
  }

  if (resolvedType === 'web_url') {
    if (props.kind === 'verification') return 'Nguồn web'
    if (props.kind === 'allowedUse' || props.kind === 'fullTextStatus') {
      if (props.fullTextSourceType === 'pdf' || s === 'pdf') return 'Bản đọc PDF'
      if (props.fullTextSourceType === 'html' || s === 'html') return 'Bài viết web / HTML'
      if (s === 'available' || s === 'imported') {
        return props.fullTextSourceType === 'pdf' ? 'Bản đọc PDF' : 'Bài viết web'
      }
      return 'Chỉ có trích dẫn'
    }
    if (props.kind === 'copyright') return ''
  }

  if (props.kind === 'moderation') {
    const map: Record<string, string> = {
      pending: 'Chờ duyệt',
      approved: 'Đã duyệt',
      rejected: 'Từ chối',
    }
    return map[s] ?? props.status
  }
  if (props.kind === 'verification') {
    const map: Record<string, string> = {
      verified_doi: 'DOI Đã xác thực',
      unverified: 'Chưa xác thực',
      manual: 'Xác thực thủ công',
    }
    return map[s] ?? props.status
  }
  if (props.kind === 'copyright') {
    const map: Record<string, string> = {
      public_domain: 'Public Domain',
      copyrighted_with_open_access: 'Open Access',
      paywalled: 'Paywalled',
    }
    return map[s] ?? props.status
  }
  if (props.kind === 'allowedUse') {
    const map: Record<string, string> = {
      metadata_only: 'Chỉ Metadata',
      abstract_only: 'Chỉ Tóm tắt',
      open_access_fulltext: 'Toàn văn mở',
    }
    return map[s] ?? props.status
  }
  if (props.kind === 'fullTextStatus') {
    const map: Record<string, string> = {
      available: 'Có bản đọc hợp pháp',
      imported: 'Đã nhập bản đọc',
      none: 'Chỉ có trích dẫn',
      blocked: 'Chỉ có trích dẫn',
      failed: 'Lỗi tải bản đọc',
    }
    return map[s] ?? props.status
  }

  const genericMap: Record<string, string> = {
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    private: 'Private',
    public: 'Public',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
  }
  return genericMap[s] ?? props.status
})
</script>

<style scoped>
.app-status-badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--font-size-xs, 0.75rem);
  font-weight: var(--font-weight-semibold, 600);
  padding: 2px 8px;
  border-radius: var(--radius-full, 9999px);
  border: 1px solid transparent;
  white-space: nowrap;
  line-height: var(--line-height-normal, 1.5);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide, 0.05em);
}

.app-status-badge--pending {
  background: #2a1e08;
  color: #f59e0b;
  border-color: #3d2d10;
}

.app-status-badge--completed {
  background: #0e2a1c;
  color: #4ade80;
  border-color: #1a3d2e;
}

.app-status-badge--failed {
  background: #2d1010;
  color: #ed4956;
  border-color: #3d1515;
}

.app-status-badge--private {
  background: var(--color-bg-elevated, #1c1c1e);
  color: var(--color-text-muted, #8e8e93);
  border-color: var(--color-border, #2c2c2e);
}

.app-status-badge--public {
  background: var(--color-bg-elevated, #1c1c1e);
  color: var(--color-text-secondary, #aeaeb2);
  border-color: var(--color-border, #2c2c2e);
}

.app-status-badge--unknown {
  background: var(--color-bg-elevated, #1c1c1e);
  color: var(--color-text-muted, #8e8e93);
  border-color: var(--color-border, #2c2c2e);
}
</style>
