<template>
  <div class="isolate relative flex h-svh overflow-hidden bg-(--lb-desk)">
    <AppBackground />
    <AppSidebar />

    <!-- The sheet: everything you read and write sits on one page with a
      hairline edge, set into the desk on desktop and edge to edge on a phone -->
    <main class="isolate relative flex-1 min-w-0 flex overflow-hidden bg-default lg:my-(--lb-sheet-inset) lg:me-(--lb-sheet-inset) lg:rounded-(--lb-sheet-radius) lg:ring lg:ring-(--lb-sheet-border) lg:shadow-(--lb-sheet-shadow)">
      <slot />
    </main>

    <MailComposer />
    <ShortcutsHelp />
    <AppNotifications />
  </div>
</template>
