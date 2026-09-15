<script setup>
import styles from './probe.module.css';
</script>
<template><div>
  <p class="batch03-global">Global</p>
  <p class="batch03-scoped">Scoped</p>
  <p class="batch03-imported">Imported scoped</p>
  <p class="batch03-at-import">At import scoped</p>
  <p :class="styles.asset">CSS module asset</p>
</div></template>
<style scoped>.batch03-scoped { color: rgb(13, 31, 57); width: 83px; }</style>
<style scoped src="./scoped.css"></style>

<style scoped>@import "./scoped-at-import.css";</style>
