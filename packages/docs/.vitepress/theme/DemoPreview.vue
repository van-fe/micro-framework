<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";

const { lang } = useData();
const english = computed(() => lang.value.startsWith("en"));
const demoUrl = computed(() => {
  const configured = import.meta.env.VITE_MICRO_FRAME_DEMO_URL
    || (import.meta.env.DEV ? "http://127.0.0.1:5173/" : "");
  if (!configured) return "";
  const url = new URL(configured, "https://docs.example.invalid");
  url.searchParams.set("locale", english.value ? "en-US" : "zh-CN");
  return configured.startsWith("/") ? `${url.pathname}${url.search}${url.hash}` : url.href;
});
</script>

<template>
  <p v-if="!demoUrl">{{ english
    ? "The online demo is not configured. Follow the local setup instructions below."
    : "在线演示尚未配置。可按下方说明在本地运行完整演示。" }}</p>
  <template v-else>
    <div class="demo-toolbar">
      <span><i></i>{{ english ? "Live micro-frontend composition" : "实时微前端组合演示" }}</span>
      <a :href="demoUrl" target="_blank" rel="noreferrer">{{ english ? "Open in a new window ↗" : "在独立窗口打开 ↗" }}</a>
    </div>
    <div class="demo-frame-shell">
      <div class="demo-frame-stage">
        <iframe :key="demoUrl" :src="demoUrl"
          :title="english ? 'Northstar fulfillment command center' : 'Northstar 履约运营台'"
          loading="eager" allow="clipboard-read; clipboard-write"></iframe>
      </div>
    </div>
  </template>
</template>

<style>
.demo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 2;
  width: min(1196px, calc(100vw - 48px));
  margin: 26px 0 0 calc(50% - min(598px, calc(50vw - 24px)));
  padding: 10px 13px;
  border: 1px solid var(--vp-c-divider);
  border-bottom: 0;
  border-radius: 14px 14px 0 0;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
}

.demo-toolbar span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-text-2);
  font-weight: 650;
}

.demo-toolbar i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #72a943;
  box-shadow: 0 0 0 4px rgba(114, 169, 67, .12);
}

.demo-toolbar a {
  color: var(--vp-c-brand-1);
  font-weight: 650;
  text-decoration: none;
}

.demo-frame-shell {
  position: relative;
  z-index: 2;
  width: min(1196px, calc(100vw - 48px));
  margin: 0 0 28px calc(50% - min(598px, calc(50vw - 24px)));
  padding: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0 0 16px 16px;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 22px 70px rgba(22, 33, 27, .09);
  overflow: hidden;
}

.demo-frame-stage {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.demo-frame-stage iframe {
  display: block;
  width: 100%;
  height: min(900px, 80vh);
  min-height: 600px;
  scroll-margin-top: calc(var(--vp-nav-height) + 16px);
  border: 0;
  border-radius: 10px;
  background: #f4f6f2;
}

@media (max-width: 768px) {
  .demo-toolbar,
  .demo-frame-shell {
    width: calc(100vw - 24px);
  }

}
</style>
