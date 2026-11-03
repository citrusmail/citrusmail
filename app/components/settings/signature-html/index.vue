<script setup lang="ts">
// For signatures made in a generator: the HTML as is, with a live preview in
// a sandbox so its styles can't leak into CitrusMail
const html = defineModel<string>({ required: true })

const preview = computed(() => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 16px; font: 14px/1.5 -apple-system, system-ui, sans-serif; color: #1c1917; background: #fff; }
  img { max-width: 100%; }
</style></head><body>${html.value || '<p style="color:#a8a29e">Your signature shows here.</p>'}</body></html>`)
</script>

<template>
  <div class="flex flex-col gap-3">
    <UTextarea
      v-model="html"
      :rows="8"
      autoresize
      :maxrows="18"
      placeholder="<table>…</table>"
      spellcheck="false"
      :ui="{ base: 'text-xs leading-5' }"
    />
    <div class="rounded-lg ring ring-default overflow-hidden bg-white">
      <p class="px-4 py-2 text-xs text-muted border-b border-default bg-elevated/40">
        Preview
      </p>
      <iframe
        :srcdoc="preview"
        sandbox=""
        title="Signature preview"
        class="w-full h-48 block"
      />
    </div>
    <p class="text-xs text-muted">
      Scripts and forms are removed when you save. Images load from wherever they’re hosted.
    </p>
  </div>
</template>
