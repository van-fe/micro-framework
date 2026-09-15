<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMicroRuntime } from "@micro-framework/adapter-vue";
import {
  ElAlert,
  ElButton,
  ElButtonGroup,
  ElConfigProvider,
  ElDialog,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElProgress,
  ElTag,
  ElTooltip,
} from "element-plus";
import elementEn from "element-plus/es/locale/lang/en";
import elementZhCn from "element-plus/es/locale/lang/zh-cn";
import "element-plus/dist/index.css";
import { customers, type RiskLevel } from "./customer-data";
import { marketNames, messages, type SupportedLocale } from "./i18n";

const props = withDefaults(defineProps<{
  title: string;
  market?: string;
  locale?: SupportedLocale;
}>(), {
  market: "North America",
  locale: "zh-CN",
});

const runtime = useMicroRuntime();
const selectedId = ref("orchid");
const activeLocale = ref<SupportedLocale>(props.locale);
const actionFeedback = ref("");
const reviewDialogOpen = ref(false);
const detailDrawerOpen = ref(false);

watch(() => props.locale, (locale) => {
  activeLocale.value = locale;
  actionFeedback.value = "";
});

const copy = computed(() => messages[activeLocale.value]);
const elementLocale = computed(() => activeLocale.value === "zh-CN" ? elementZhCn : elementEn);
const localizedMarket = computed(() => marketNames[activeLocale.value][props.market] ?? props.market);
const selected = computed(() => customers.find((customer) => customer.id === selectedId.value) ?? customers[0]!);
const activeOverlayCount = computed(() => Number(reviewDialogOpen.value) + Number(detailDrawerOpen.value));
const tagType: Record<RiskLevel, "danger" | "warning" | "success"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

function setLocale(locale: SupportedLocale): void {
  activeLocale.value = locale;
  actionFeedback.value = "";
}

function handleMenu(command: unknown): void {
  if (command !== "note" && command !== "review" && command !== "export") return;
  actionFeedback.value = copy.value.menuResult[command];
}

function createTask(): void {
  actionFeedback.value = copy.value.taskCreated;
  reviewDialogOpen.value = false;
}
</script>

<template>
  <ElConfigProvider :locale="elementLocale">
    <article id="vue-root" class="customer-app" :lang="activeLocale">
      <header class="customer-context">
        <div class="context-copy">
          <span class="app-contract-title">{{ props.title }}</span>
          <span class="product-label">{{ copy.appName }}</span>
          <strong>{{ copy.heading }}</strong>
          <small>{{ localizedMarket }} · {{ copy.accountCount }}</small>
        </div>

        <div class="context-actions">
          <ElButtonGroup aria-label="Language switcher">
            <ElButton size="small" :type="activeLocale === 'zh-CN' ? 'primary' : 'default'" @click="setLocale('zh-CN')">中文</ElButton>
            <ElButton size="small" :type="activeLocale === 'en-US' ? 'primary' : 'default'" @click="setLocale('en-US')">EN</ElButton>
          </ElButtonGroup>
          <ElTooltip
            :content="copy.tooltip"
            placement="bottom"
            popper-class="vue-contract-tooltip"
            :teleported="true"
          >
            <ElButton
              circle
              data-open-popup="vue3-tooltip"
              size="small"
              :aria-label="copy.tooltipLabel"
            >?</ElButton>
          </ElTooltip>
          <ElDropdown popper-class="vue-contract-menu" trigger="click" @command="handleMenu">
            <ElButton circle data-open-popup="vue3-menu" size="small" :aria-label="copy.options">•••</ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem command="note"><span data-overlay-kind="vue3-menu-item">{{ copy.menu.note }}</span></ElDropdownItem>
                <ElDropdownItem command="review">{{ copy.menu.review }}</ElDropdownItem>
                <ElDropdownItem command="export">{{ copy.menu.export }}</ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </header>

      <div class="customer-list" :aria-label="copy.accountList">
        <button
          v-for="customer in customers"
          :key="customer.id"
          type="button"
          :class="{ 'is-active': selectedId === customer.id }"
          @click="selectedId = customer.id; actionFeedback = ''"
        >
          <span class="customer-avatar" :style="{ background: customer.color }">{{ customer.initials }}</span>
          <span class="customer-name">
            <strong>{{ customer.name }}</strong>
            <small>{{ copy.tier[customer.tier] }}</small>
          </span>
          <ElTag :type="tagType[customer.risk]" effect="light" round>{{ copy.risk[customer.risk] }}</ElTag>
        </button>
      </div>

      <section class="account-detail" :aria-label="copy.selectedAccount">
        <header>
          <div>
            <span>{{ copy.selectedAccount }}</span>
            <strong>{{ selected.name }}</strong>
          </div>
          <div class="account-header-actions">
            <ElTag effect="plain" round :title="copy.annualRevenue">{{ selected.revenue }} ARR</ElTag>
            <button class="vue-overlay-trigger vue-overlay-trigger--plain" data-open-overlay="vue3-drawer" type="button" @click="detailDrawerOpen = true">
              {{ copy.viewDrawer }}
            </button>
          </div>
        </header>

        <div class="health-score">
          <ElProgress
            type="dashboard"
            :percentage="selected.score"
            :width="88"
            :stroke-width="8"
            color="#d97757"
          >
            <template #default="{ percentage }">
              <span class="score-value">{{ percentage }}</span>
              <small>{{ copy.riskScore }}</small>
            </template>
          </ElProgress>
          <div class="score-copy">
            <strong>{{ copy.riskHeadline[selected.risk] }}</strong>
            <span>{{ copy.riskDescription }}</span>
          </div>
        </div>

        <div class="account-signals">
          <div><span>{{ copy.openCases }}</span><strong>2</strong><small>{{ copy.escalated }}</small></div>
          <div><span>{{ copy.lateOrders }}</span><strong>3</strong><small>{{ copy.lastThirtyDays }}</small></div>
          <div><span>{{ copy.nps }}</span><strong>32</strong><small>{{ copy.pointsDown }}</small></div>
        </div>

        <div class="next-action">
          <span class="action-icon">↗</span>
          <span><strong>{{ copy.nextAction }}</strong><small>{{ copy.nextActionDetail }}</small></span>
          <button class="vue-overlay-trigger vue-overlay-trigger--primary" data-open-overlay="vue3-dialog" type="button" @click="reviewDialogOpen = true">
            {{ copy.reviewDialog }}
          </button>
        </div>

        <ElAlert
          v-if="actionFeedback"
          class="action-feedback"
          :title="actionFeedback"
          type="success"
          show-icon
          closable
          @close="actionFeedback = ''"
        />
      </section>

      <footer>
        <span><i></i> {{ copy.synchronized }}</span>
        <code>{{ runtime.instanceId }}</code>
      </footer>
    </article>

    <ElDialog
      v-model="reviewDialogOpen"
      modal-class="vue-scoped-overlay"
      :teleported="true"
      :title="copy.reviewTitle"
      width="calc(100% - 28px)"
    >
      <div class="vue-review-dialog-content" data-overlay-kind="vue3-dialog">
        <p>{{ copy.reviewBody }}</p>
        <div class="review-owner"><small>{{ copy.reviewOwner }}</small><strong>{{ copy.reviewOwnerValue }}</strong></div>
        <code>{{ copy.teleportTarget }} · {{ runtime.instanceId }}</code>
      </div>
      <template #footer>
        <ElButton @click="reviewDialogOpen = false">{{ copy.cancel }}</ElButton>
        <ElButton type="primary" @click="createTask">{{ copy.confirm }}</ElButton>
      </template>
    </ElDialog>

    <ElDrawer
      v-model="detailDrawerOpen"
      modal-class="vue-scoped-overlay"
      :teleported="true"
      :title="copy.drawerTitle"
      size="86%"
    >
      <div class="vue-risk-drawer" data-overlay-kind="vue3-drawer">
        <span class="customer-avatar" :style="{ background: selected.color }">{{ selected.initials }}</span>
        <div><strong>{{ selected.name }}</strong><small>{{ copy.riskHeadline[selected.risk] }}</small></div>
        <p>{{ copy.drawerSummary }}</p>
        <div class="drawer-signals">
          <span><small>{{ copy.openCases }}</small><strong>2</strong></span>
          <span><small>{{ copy.lateOrders }}</small><strong>3</strong></span>
          <span><small>{{ copy.nps }}</small><strong>32</strong></span>
        </div>
        <code>{{ copy.teleportTarget }} · {{ runtime.instanceId }}</code>
      </div>
    </ElDrawer>
  </ElConfigProvider>

  <Teleport to="body">
    <div id="vue-teleport" role="status">
      <i></i> Vue Teleport stays inside this ShadowRoot · {{ copy.overlaysActive }} {{ activeOverlayCount }}
    </div>
  </Teleport>
</template>

<style src="./app.css"></style>
