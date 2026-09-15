import Vue from "vue";

export type SupportedLocale = "zh-CN" | "en-US";

interface QueueItem {
  account: string;
  owner: string;
  priority: string;
  status: string;
}

const messages = {
  "zh-CN": {
    eyebrow: "遗留业务协同",
    subtitle: "Vue 2 与 Element UI 运行在独立 iframe Realm 中，界面渲染在应用自己的 ShadowRoot。",
    notice: "旧系统可以渐进接入，并与新栈应用共享宿主能力和语言设置。",
    queue: "升级处理队列",
    account: "客户",
    owner: "负责人",
    priority: "优先级",
    status: "状态",
    high: "高",
    medium: "中",
    reviewing: "审核中",
    ready: "待执行",
    completion: "本周迁移完成度",
    coverage: "自动化覆盖率",
    review: "开始批量审核",
    reviews: "已执行 {count} 次",
    runtime: "Vue 2.7 · Element UI 2",
    openDialog: "查看迁移弹窗",
    tooltip: "批量审核只处理当前工作区中已完成自动检查的记录。",
    tooltipLabel: "说明批量审核范围",
    menuLabel: "更多迁移操作",
    menuInspect: "检查迁移依赖",
    menuExport: "导出审计记录",
    menuInspectResult: "迁移依赖检查已完成。",
    menuExportResult: "审计记录已导出。",
    dialogTitle: "旧系统批量迁移确认",
    dialogBody: "确认后会将当前升级队列提交给迁移负责人，并保留原系统的审计记录。",
    dialogScope: "本次范围",
    dialogScopeValue: "3 个客户 · 北美工作区",
    dialogTarget: "Element UI append-to-body · 默认覆盖全局视口",
    cancel: "取消",
    confirm: "确认迁移",
  },
  "en-US": {
    eyebrow: "LEGACY OPERATIONS",
    subtitle: "Vue 2 and Element UI run in an isolated iframe Realm and render into the application's own ShadowRoot.",
    notice: "Legacy systems can migrate incrementally while sharing host capabilities and locale preferences with newer stacks.",
    queue: "Upgrade review queue",
    account: "Account",
    owner: "Owner",
    priority: "Priority",
    status: "Status",
    high: "High",
    medium: "Medium",
    reviewing: "Reviewing",
    ready: "Ready",
    completion: "Weekly migration progress",
    coverage: "Automation coverage",
    review: "Start batch review",
    reviews: "{count} reviews completed",
    runtime: "Vue 2.7 · Element UI 2",
    openDialog: "Open migration dialog",
    tooltip: "Batch review only includes records that passed automated checks in this workspace.",
    tooltipLabel: "Explain batch review scope",
    menuLabel: "More migration actions",
    menuInspect: "Inspect migration dependencies",
    menuExport: "Export audit records",
    menuInspectResult: "Migration dependency inspection completed.",
    menuExportResult: "Audit records exported.",
    dialogTitle: "Confirm legacy batch migration",
    dialogBody: "Confirming submits the current upgrade queue to the migration owner while preserving the legacy audit trail.",
    dialogScope: "Scope",
    dialogScopeValue: "3 accounts · North America workspace",
    dialogTarget: "Element UI append-to-body · global viewport by default",
    cancel: "Cancel",
    confirm: "Confirm migration",
  },
} as const;

type ViewCopy = (typeof messages)[SupportedLocale];

interface RenderContext {
  activeLocale: SupportedLocale;
  title: string;
  copy: ViewCopy;
  marketLabel: string;
  queueItems: QueueItem[];
  reviewSummary: string;
  dialogVisible: boolean;
  menuFeedback: string;
  setLocale(locale: SupportedLocale): void;
  startReview(): void;
  openDialog(): void;
  setDialogVisible(visible: boolean): void;
  confirmDialog(): void;
  handleMenu(command: string): void;
}

function normalizeLocale(locale: string | undefined): SupportedLocale {
  return locale === "en-US" ? "en-US" : "zh-CN";
}

export default Vue.extend({
  name: "Vue2OperationsPanel",
  props: {
    title: {
      type: String,
      required: true,
    },
    locale: {
      type: String,
      default: "zh-CN",
    },
    market: {
      type: String,
      default: "Global",
    },
  },
  data() {
    return {
      activeLocale: normalizeLocale(this.locale),
      reviewCount: 0,
      dialogVisible: false,
      menuFeedback: "",
    };
  },
  computed: {
    copy() {
      return messages[this.activeLocale];
    },
    queueItems(): QueueItem[] {
      const copy = messages[this.activeLocale];
      return [
        {
          account: "Northwind Traders",
          owner: "Ava Chen",
          priority: copy.high,
          status: copy.reviewing,
        },
        {
          account: "Alpine Logistics",
          owner: "Noah Kim",
          priority: copy.medium,
          status: copy.ready,
        },
        {
          account: "Summit Retail",
          owner: "Mia Evans",
          priority: copy.high,
          status: copy.ready,
        },
      ];
    },
    reviewSummary(): string {
      return messages[this.activeLocale].reviews.replace("{count}", String(this.reviewCount));
    },
    marketLabel(): string {
      const markets = this.activeLocale === "zh-CN"
        ? {
            "North America": "北美",
            Europe: "欧洲",
            "Asia Pacific": "亚太",
          }
        : {
            "North America": "North America",
            Europe: "Europe",
            "Asia Pacific": "Asia Pacific",
          };
      return markets[this.market as keyof typeof markets] ?? this.market;
    },
  },
  watch: {
    locale(nextLocale: string) {
      this.activeLocale = normalizeLocale(nextLocale);
    },
  },
  methods: {
    setLocale(locale: SupportedLocale) {
      this.activeLocale = locale;
    },
    startReview() {
      this.reviewCount += 1;
    },
    openDialog() {
      this.dialogVisible = true;
    },
    setDialogVisible(visible: boolean) {
      this.dialogVisible = visible;
    },
    confirmDialog() {
      this.reviewCount += 1;
      this.dialogVisible = false;
    },
    handleMenu(command: string) {
      const copy = messages[this.activeLocale as SupportedLocale];
      this.menuFeedback = command === "inspect" ? copy.menuInspectResult : copy.menuExportResult;
    },
  },
  render(createElement) {
    const view = this as unknown as RenderContext;
    const copy = view.copy;
    return createElement(
      "section",
      {
        attrs: {
          id: "vue2-root",
          "data-locale": view.activeLocale,
          "data-title": view.title,
        },
      },
      [
        createElement("header", { class: "vue2-hero" }, [
          createElement("div", { class: "vue2-heading" }, [
            createElement("div", { class: "vue2-eyebrow" }, [
              createElement("span", [copy.eyebrow]),
              createElement("el-tag", { props: { size: "small", type: "warning" } }, [
                copy.runtime,
              ]),
            ]),
            createElement("h2", [view.title]),
            createElement("p", [copy.subtitle]),
          ]),
          createElement(
            "el-radio-group",
            {
              props: { value: view.activeLocale, size: "small" },
              on: { input: view.setLocale },
            },
            [
              createElement("el-radio-button", { props: { label: "zh-CN" } }, ["中文"]),
              createElement("el-radio-button", { props: { label: "en-US" } }, ["English"]),
            ],
          ),
        ]),
        createElement("el-alert", {
          class: "vue2-alert",
          props: {
            title: copy.notice,
            type: "info",
            closable: false,
            showIcon: true,
          },
        }),
        createElement("div", { class: "vue2-metrics" }, [
          createElement("el-card", { props: { shadow: "never" } }, [
            createElement("div", { class: "metric-label" }, [copy.completion]),
            createElement("strong", { class: "metric-value" }, ["74%"]),
            createElement("el-progress", {
              props: { percentage: 74, showText: false, strokeWidth: 9 },
            }),
          ]),
          createElement("el-card", { props: { shadow: "never" } }, [
            createElement("div", { class: "metric-label" }, [copy.coverage]),
            createElement("strong", { class: "metric-value" }, ["91.6%"]),
            createElement("el-progress", {
              props: {
                percentage: 92,
                showText: false,
                strokeWidth: 9,
                status: "success",
              },
            }),
          ]),
        ]),
        createElement("el-card", { class: "vue2-queue", props: { shadow: "never" } }, [
          createElement("div", { class: "queue-header", slot: "header" }, [
            createElement("div", [
              createElement("span", { class: "queue-title" }, [copy.queue]),
              createElement("small", [view.marketLabel]),
            ]),
            createElement("el-button-group", [
              createElement(
                "el-tooltip",
                {
                  props: {
                    appendToBody: true,
                    content: copy.tooltip,
                    placement: "bottom",
                    popperClass: "vue2-contract-tooltip",
                  },
                },
                [
                  createElement(
                    "el-button",
                    {
                      attrs: {
                        "aria-label": copy.tooltipLabel,
                        "data-open-popup": "vue2-tooltip",
                      },
                      props: { circle: true, size: "small" },
                    },
                    ["?"],
                  ),
                ],
              ),
              createElement(
                "el-dropdown",
                {
                  props: { placement: "bottom-end", trigger: "click" },
                  on: { command: view.handleMenu },
                },
                [
                  createElement(
                    "el-button",
                    {
                      attrs: {
                        "aria-label": copy.menuLabel,
                        "data-open-popup": "vue2-menu",
                      },
                      props: { circle: true, size: "small" },
                    },
                    ["•••"],
                  ),
                  createElement(
                    "el-dropdown-menu",
                    { class: "vue2-contract-menu", slot: "dropdown" },
                    [
                      createElement(
                        "el-dropdown-item",
                        { props: { command: "inspect" } },
                        [
                          createElement("span", { attrs: { "data-overlay-kind": "vue2-menu-item" } }, [
                            copy.menuInspect,
                          ]),
                        ],
                      ),
                      createElement("el-dropdown-item", { props: { command: "export" } }, [copy.menuExport]),
                    ],
                  ),
                ],
              ),
              createElement(
                "el-button",
                {
                  props: { type: "primary", size: "small" },
                  on: { click: view.startReview },
                },
                [copy.review],
              ),
              createElement(
                "el-button",
                {
                  attrs: { "data-open-overlay": "vue2" },
                  props: { size: "small" },
                  on: { click: view.openDialog },
                },
                [copy.openDialog],
              ),
            ]),
          ]),
          createElement(
            "el-table",
            {
              props: { data: view.queueItems, size: "small", stripe: true },
            },
            [
              createElement("el-table-column", {
                props: { prop: "account", label: copy.account, minWidth: 180 },
              }),
              createElement("el-table-column", {
                props: { prop: "owner", label: copy.owner, minWidth: 120 },
              }),
              createElement("el-table-column", {
                props: { prop: "priority", label: copy.priority, minWidth: 95 },
              }),
              createElement("el-table-column", {
                props: { prop: "status", label: copy.status, minWidth: 110 },
              }),
            ],
          ),
          createElement("div", { class: "review-summary" }, [view.reviewSummary]),
          createElement(
            "div",
            { attrs: { "data-vue2-popup-feedback": "", role: "status" }, class: "popup-feedback" },
            [view.menuFeedback],
          ),
        ]),
        createElement(
          "el-dialog",
          {
            props: {
              appendToBody: true,
              closeOnClickModal: false,
              customClass: "vue2-review-dialog",
              title: copy.dialogTitle,
              visible: view.dialogVisible,
              width: "520px",
            },
            on: {
              close: () => view.setDialogVisible(false),
              "update:visible": view.setDialogVisible,
            },
          },
          [
            createElement("div", { class: "vue2-dialog-copy", attrs: { "data-overlay-kind": "vue2" } }, [
              createElement("p", [copy.dialogBody]),
              createElement("div", { class: "vue2-dialog-scope" }, [
                createElement("small", [copy.dialogScope]),
                createElement("strong", [copy.dialogScopeValue]),
              ]),
              createElement("code", [copy.dialogTarget]),
            ]),
            createElement("div", { slot: "footer", class: "dialog-footer" }, [
              createElement("el-button", { on: { click: () => view.setDialogVisible(false) } }, [copy.cancel]),
              createElement("el-button", { props: { type: "primary" }, on: { click: view.confirmDialog } }, [copy.confirm]),
            ]),
          ],
        ),
      ],
    );
  },
});
