<script setup lang="ts">
// Two citrus slices on a rising diagonal, a pale and a bright orange, with the
// overlap cut in a deeper third shade, and two leaves where they meet
// Unique per instance, since the mark can be on screen twice
const clip = `logo-overlap-${useId()}`

/** Each leaf: its turn from the stem, and its half-length and length */
const leaves = [
  { turn: -155, r: 5.23, length: 7.26 },
  { turn: -105, r: 6.65, length: 9.24 }
]
</script>

<template>
  <svg
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="clip">
        <circle
          cx="12"
          cy="20"
          r="8.5"
        />
      </clipPath>
    </defs>
    <circle
      cx="12"
      cy="20"
      r="8.5"
      fill="#FDBA74"
    />
    <circle
      cx="20"
      cy="12"
      r="8.5"
      fill="#F97316"
    />
    <circle
      cx="20"
      cy="12"
      r="8.5"
      fill="#C2410C"
      :clip-path="`url(#${clip})`"
    />
    <g
      v-for="leaf in leaves"
      :key="leaf.turn"
      :transform="`translate(11.7 11.7) rotate(${leaf.turn})`"
    >
      <!-- A pale outline, so the leaf stands off the orange -->
      <path
        :d="`M0 0A${leaf.r} ${leaf.r} 0 0 1 ${leaf.length} 0A${leaf.r} ${leaf.r} 0 0 1 0 0Z`"
        fill="#FFF8EE"
        stroke="#FFF8EE"
        stroke-width="0.8"
        stroke-linejoin="round"
      />
      <path
        :d="`M0 0A${leaf.r} ${leaf.r} 0 0 1 ${leaf.length} 0Z`"
        fill="#2FB866"
      />
      <path
        :d="`M0 0A${leaf.r} ${leaf.r} 0 0 0 ${leaf.length} 0Z`"
        fill="#178A45"
      />
    </g>
  </svg>
</template>
