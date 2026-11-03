<script setup lang="ts">
// The AI line above the editor: say what the reply should say (or nothing),
// watch it being written, then nudge it with one tap
const { writing, written, instruction, lastChange, write, tweak, stop } = useAiReply()
const { providerLabel } = useAi()
</script>

<template>
  <div
    class="relative border-b border-default bg-(--lb-ai-bg) overflow-hidden"
    :aria-busy="writing"
  >
    <div
      v-if="writing"
      class="lb-ai-progress absolute inset-x-0 top-0 h-0.5"
      aria-hidden="true"
    />

    <form
      v-if="!written || writing"
      class="flex items-center gap-2 px-5 min-h-12"
      @submit.prevent="write"
    >
      <UIcon
        name="i-lucide-sparkles"
        class="size-4 shrink-0 text-(--lb-ai)"
        :class="writing && 'animate-pulse'"
      />
      <p
        v-if="writing"
        class="flex-1 text-sm text-toned"
        role="status"
      >
        {{ lastChange ? 'Rewriting' : 'Writing your reply' }}<span class="lb-ai-dots" />
      </p>
      <UInput
        v-else
        v-model="instruction"
        variant="none"
        placeholder="What should the reply say? Leave empty and AI decides"
        aria-label="What the reply should say"
        class="flex-1"
        :ui="{ base: 'px-0 text-sm' }"
      />
      <UButton
        v-if="writing"
        label="Stop"
        icon="i-lucide-square"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="stop"
      />
      <UButton
        v-else
        type="submit"
        label="Write reply"
        icon="i-lucide-sparkles"
        size="sm"
        color="neutral"
        variant="subtle"
      />
    </form>

    <div
      v-else
      class="flex items-center gap-1.5 px-5 py-2 overflow-x-auto"
    >
      <UIcon
        name="i-lucide-sparkles"
        class="size-4 shrink-0 text-(--lb-ai) me-1"
      />
      <UButton
        v-for="edit in QUICK_EDITS"
        :key="edit.label"
        :label="edit.label"
        :icon="edit.icon"
        color="neutral"
        variant="outline"
        size="xs"
        class="rounded-full shrink-0 bg-default"
        @click="tweak(edit.change)"
      />
      <UTooltip :text="`Write it again${providerLabel ? ` with ${providerLabel}` : ''}`">
        <UButton
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Write it again"
          class="ms-auto shrink-0"
          @click="written = false"
        />
      </UTooltip>
    </div>
  </div>
</template>
