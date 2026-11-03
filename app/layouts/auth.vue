<template>
  <div class="min-h-svh bg-default">
    <!-- In the Mac app the window has no title bar, so this strip is what
      you drag it by, and it keeps the window buttons clear of the logo -->
    <div class="hidden in-[.desktop]:block fixed inset-x-0 top-0 h-10 z-10 [-webkit-app-region:drag]" />
    <slot />
  </div>
</template>
