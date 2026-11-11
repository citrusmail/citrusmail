<script setup lang="ts">
import type { AvatarProps } from '@nuxt/ui'

const props = defineProps<{
  address?: Address
  size?: AvatarProps['size']
}>()

// Soft, low-chroma tints (--lb-avatar-1…6 in main.css) so a column of initials
// reads as a texture, not a rainbow. Picked from the address so a person keeps
// their colour everywhere
const TINTS = [
  'bg-(--lb-avatar-1) text-(--lb-avatar-1-text)',
  'bg-(--lb-avatar-2) text-(--lb-avatar-2-text)',
  'bg-(--lb-avatar-3) text-(--lb-avatar-3-text)',
  'bg-(--lb-avatar-4) text-(--lb-avatar-4-text)',
  'bg-(--lb-avatar-5) text-(--lb-avatar-5-text)',
  'bg-(--lb-avatar-6) text-(--lb-avatar-6-text)'
]

const name = computed(() => personName(props.address))

const initials = computed(() => {
  const words = name.value.replace(/<.*?>|["']/g, '').split(/[\s._-]+/).filter(word => /^\p{L}/u.test(word))
  if (!words.length) return name.value.charAt(0).toUpperCase()
  return (words.length > 1 ? words[0]![0]! + words[words.length - 1]![0]! : words[0]![0]!).toUpperCase()
})

const tint = computed(() => {
  const key = props.address?.address ?? name.value
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return TINTS[Math.abs(hash) % TINTS.length]
})

const { account } = useShell()
const { settings } = useSettings()

// Your own picture comes straight from Settings, so a change shows at once
const src = computed(() => {
  const email = props.address?.address
  if (!email?.includes('@')) return undefined
  if (settings.value.avatar && email.toLowerCase() === account.value?.email.toLowerCase()) return settings.value.avatar
  // `v` changes when cached answers must be dropped (v3: company logos from BIMI; v2: misses cached while
  // the network guard wrongly refused every picture host)
  return `/api/avatar?email=${encodeURIComponent(email)}&v=3`
})
</script>

<template>
  <UAvatar
    :src="src"
    :alt="name"
    :text="initials"
    :size="size ?? 'md'"
    loading="lazy"
    :ui="{ root: `${tint} shrink-0`, fallback: 'text-current font-semibold', image: 'bg-default' }"
  />
</template>
