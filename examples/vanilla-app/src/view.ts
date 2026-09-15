export interface VanillaView {
  update(title: string, market?: string, locale?: Locale): void;
  destroy(): void;
}

export type Locale = "zh-CN" | "en-US";

const copy = {
  "zh-CN": {
    queue: "8 个订单需要关注",
    all: "全部 8",
    risk: "风险 3",
    review: "复核 2",
    filterLabel: "筛选订单队列",
    order: "订单 / 客户",
    lane: "运输线路",
    value: "金额",
    deadline: "截止时间",
    priority: "优先空运",
    breach: "后触发 SLA",
    prompt: "选择订单以查看问题处理流程。",
    open: "打开处理流程",
    selected: "已选择",
    escalation: "承运商升级流程已就绪。",
    dialogTitle: "订单异常处理",
    dialogBody: "确认后将创建承运商升级任务，并把当前订单交给履约值班负责人。",
    dialogRoute: "处理路径",
    dialogRouteValue: "履约团队 → 承运商升级",
    dialogTarget: "默认容器 document.body · 全局视口",
    cancel: "取消",
    confirm: "确认升级",
    confirmed: "升级任务已创建。",
    markets: {
      "North America": "北美",
      Europe: "欧洲",
      "Asia Pacific": "亚太",
    },
  },
  "en-US": {
    queue: "8 orders need attention",
    all: "All 8",
    risk: "At risk 3",
    review: "Review 2",
    filterLabel: "Filter order queue",
    order: "Order / customer",
    lane: "Shipping lane",
    value: "Value",
    deadline: "Deadline",
    priority: "Priority air",
    breach: "to SLA breach",
    prompt: "Select an order to inspect the resolution workflow.",
    open: "Open resolution",
    selected: "Selected",
    escalation: "carrier escalation is ready.",
    dialogTitle: "Order exception resolution",
    dialogBody: "Confirming creates a carrier escalation task and assigns the order to the fulfillment operator on duty.",
    dialogRoute: "Resolution path",
    dialogRouteValue: "Fulfillment → carrier escalation",
    dialogTarget: "Default container document.body · global viewport",
    cancel: "Cancel",
    confirm: "Confirm escalation",
    confirmed: "Escalation task created.",
    markets: {
      "North America": "North America",
      Europe: "Europe",
      "Asia Pacific": "Asia Pacific",
    },
  },
} as const;

const orders = [
  { id: "#NS-10482", customer: "Orchid Supply", lane: "SFO → SEA", value: "$8,420", sla: "42 min", state: "risk" },
  { id: "#NS-10476", customer: "Aster & Co.", lane: "LAX → DEN", value: "$3,190", sla: "1h 12m", state: "review" },
  { id: "#NS-10461", customer: "Fieldwork Labs", lane: "NYC → BOS", value: "$12,840", sla: "2h 08m", state: "risk" },
  { id: "#NS-10455", customer: "Goodmorrow", lane: "AUS → MIA", value: "$2,760", sla: "3h 24m", state: "clear" },
];

function orderRows(locale: Locale): string {
  const text = copy[locale];
  return orders.map((order) => `
    <button class="order-row" type="button" data-order-state="${order.state}" data-order-id="${order.id}">
      <span class="order-identity">
        <i class="state-marker state-marker--${order.state}"></i>
        <span><strong>${order.id}</strong><small>${order.customer}</small></span>
      </span>
      <span class="lane"><strong>${order.lane}</strong><small>${text.priority}</small></span>
      <strong class="order-value">${order.value}</strong>
      <span class="sla"><strong>${order.sla}</strong><small>${text.breach}</small></span>
      <span class="row-arrow" aria-hidden="true">›</span>
    </button>
  `).join("");
}

export function createVanillaView(
  container: ParentNode,
  title: string,
  instanceId: string,
  initialMarket = "North America",
  initialLocale: Locale = "zh-CN",
): VanillaView {
  const style = document.createElement("style");
  style.textContent = `
    #host-title { color: rgb(220, 38, 38) !important; }
    * { box-sizing: border-box; }
    button { font: inherit; }
    .orders-app {
      color: #263129;
      background: #fff;
      font-family: Inter, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
      font-size: 14px;
    }
    .orders-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 13px 18px;
      border-bottom: 1px solid #edf0eb;
    }
    .app-contract-title {
      display: block;
      margin-bottom: 3px;
      color: #9aa29c;
      font: 700 12px/1.3 ui-monospace, monospace;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .queue-summary {
      display: flex;
      align-items: baseline;
      gap: 7px;
    }
    .queue-summary strong { font-size: 18px; }
    .queue-summary span { color: #8d9690; font-size: 13px; }
    .filter-group {
      display: flex;
      gap: 4px;
      padding: 3px;
      border: 1px solid #e1e6df;
      border-radius: 8px;
      background: #f7f9f6;
    }
    .filter-group button {
      padding: 5px 8px;
      border: 0;
      border-radius: 6px;
      color: #8b948e;
      background: transparent;
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
    }
    .filter-group button.is-active {
      color: #273129;
      background: #fff;
      box-shadow: 0 1px 3px rgba(31, 45, 35, .08);
    }
    .order-table-head,
    .order-row {
      display: grid;
      grid-template-columns: minmax(170px, 1.25fr) minmax(115px, .9fr) 72px 90px 14px;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 0 18px;
      text-align: left;
    }
    .order-table-head {
      min-height: 38px;
      color: #a3aaa5;
      background: #fafbfa;
      font-size: 12px;
      font-weight: 760;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .order-row {
      min-height: 62px;
      border: 0;
      border-top: 1px solid #eff2ee;
      color: #354139;
      background: #fff;
      cursor: pointer;
      transition: 140ms ease;
    }
    .order-row:hover,
    .order-row.is-selected {
      background: #f7faf4;
    }
    .order-row[hidden] { display: none; }
    .order-identity,
    .lane,
    .sla {
      display: flex;
    }
    .order-identity {
      align-items: center;
      gap: 9px;
    }
    .lane,
    .sla {
      align-items: flex-start;
      flex-direction: column;
      gap: 3px;
    }
    .order-identity > span {
      display: flex;
      min-width: 0;
      align-items: baseline;
      gap: 3px;
    }
    .order-identity > span strong { flex: none; }
    .order-identity > span small {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .order-row strong { font-size: 14px; }
    .order-row small { color: #99a19b; font-size: 12px; }
    .state-marker {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #84ae62;
      box-shadow: 0 0 0 4px #eef5e9;
    }
    .state-marker--risk { background: #df7c55; box-shadow: 0 0 0 4px #fbefea; }
    .state-marker--review { background: #d5a647; box-shadow: 0 0 0 4px #fbf5e7; }
    .order-value { color: #27322a; }
    .row-arrow { color: #abb2ad; font-size: 20px; text-align: right; }
    .order-detail {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 50px;
      padding: 0 18px;
      border-top: 1px solid #edf0eb;
      color: #89928c;
      background: #fbfcfa;
      font-size: 12px;
    }
    .order-detail strong { color: #526057; }
    .detail-action {
      padding: 6px 9px;
      border: 1px solid #dce3da;
      border-radius: 7px;
      color: #37443b;
      background: #fff;
      font-size: 12px;
      font-weight: 750;
      cursor: pointer;
    }
    .detail-action:disabled { cursor: default; opacity: .45; }
    .instance-note {
      color: #acb3ae;
      font: 600 11px/1.4 ui-monospace, monospace;
    }
    .resolution-dialog {
      width: min(500px, calc(100% - 36px));
      padding: 0;
      overflow: hidden;
      border: 1px solid #dbe3da;
      border-radius: 16px;
      color: #27322a;
      background: #fff;
      box-shadow: 0 24px 70px rgba(18, 30, 22, .24);
    }
    .resolution-dialog::backdrop { background: rgba(15, 27, 19, .52); }
    .resolution-dialog header,
    .resolution-dialog footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 16px 18px;
    }
    .resolution-dialog header { border-bottom: 1px solid #e6ebe5; }
    .resolution-dialog header strong { font-size: 18px; }
    .resolution-dialog__body { padding: 18px; }
    .resolution-dialog__body p { margin: 0 0 14px; color: #69756d; line-height: 1.65; }
    .resolution-route {
      display: grid;
      gap: 5px;
      padding: 13px;
      border-radius: 10px;
      background: #f2f6ef;
    }
    .resolution-route small { color: #748078; font-size: 12px; }
    .resolution-route strong { font-size: 14px; }
    .resolution-target {
      display: block;
      margin-top: 14px;
      color: #748078;
      font: 650 12px/1.5 ui-monospace, monospace;
    }
    .resolution-dialog footer { border-top: 1px solid #e6ebe5; background: #fafcfa; }
    .dialog-button {
      padding: 8px 12px;
      border: 1px solid #d7dfd6;
      border-radius: 8px;
      color: #344139;
      background: #fff;
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
      white-space: nowrap;
    }
    .dialog-button--primary { border-color: #24372a; color: #fff; background: #24372a; }
  `;
  document.head.append(style);

  const root = document.createElement("article");
  root.id = "vanilla-root";
  root.className = "orders-app";
  let currentTitle = title;
  let currentMarket = initialMarket;
  let currentLocale = initialLocale;

  const render = () => {
    const text = copy[currentLocale];
    const marketLabel = text.markets[currentMarket as keyof typeof text.markets] ?? currentMarket;
    root.innerHTML = `
      <div class="orders-toolbar">
        <div>
          <strong class="app-contract-title">${currentTitle}</strong>
          <div class="queue-summary"><strong>${text.queue}</strong><span>· ${marketLabel}</span></div>
        </div>
        <div class="filter-group" aria-label="${text.filterLabel}">
          <button type="button" data-filter="all" class="is-active">${text.all}</button>
          <button type="button" data-filter="risk">${text.risk}</button>
          <button type="button" data-filter="review">${text.review}</button>
        </div>
      </div>
      <div class="order-table-head" aria-hidden="true">
        <span>${text.order}</span><span>${text.lane}</span><span>${text.value}</span><span>${text.deadline}</span><span></span>
      </div>
      <div class="order-table">${orderRows(currentLocale)}</div>
      <div class="order-detail">
        <span data-selection>${text.prompt}</span>
        <button class="detail-action" type="button" data-resolve disabled>${text.open}</button>
        <code class="instance-note">${instanceId}</code>
      </div>
      <dialog class="resolution-dialog" data-overlay-kind="vanilla">
        <header><strong>${text.dialogTitle}</strong><code class="instance-note">${instanceId}</code></header>
        <div class="resolution-dialog__body">
          <p>${text.dialogBody}</p>
          <span class="resolution-route"><small>${text.dialogRoute}</small><strong>${text.dialogRouteValue}</strong></span>
          <code class="resolution-target">${text.dialogTarget}</code>
        </div>
        <footer>
          <button class="dialog-button" type="button" data-dialog-close>${text.cancel}</button>
          <button class="dialog-button dialog-button--primary" type="button" data-dialog-confirm>${text.confirm}</button>
        </footer>
      </dialog>
    `;
  };
  container.append(root);
  render();

  const onClick = (event: Event) => {
    const target = event.target as Element;
    const dialog = root.querySelector<HTMLDialogElement>("[data-overlay-kind='vanilla']")!;
    if (target.closest("[data-dialog-close]")) {
      dialog.close();
      return;
    }
    if (target.closest("[data-dialog-confirm]")) {
      dialog.close();
      root.querySelector<HTMLElement>("[data-selection]")!.textContent = copy[currentLocale].confirmed;
      return;
    }
    const resolve = target.closest<HTMLButtonElement>("[data-resolve]");
    if (resolve && !resolve.disabled) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.show();
      return;
    }
    const filter = target.closest<HTMLButtonElement>("[data-filter]");
    if (filter) {
      for (const button of root.querySelectorAll("[data-filter]")) button.classList.remove("is-active");
      filter.classList.add("is-active");
      const selectedFilter = filter.dataset.filter;
      for (const row of root.querySelectorAll<HTMLElement>("[data-order-state]")) {
        row.hidden = selectedFilter !== "all" && row.dataset.orderState !== selectedFilter;
      }
      return;
    }

    const row = target.closest<HTMLButtonElement>("[data-order-id]");
    if (row) {
      for (const peer of root.querySelectorAll(".order-row")) peer.classList.remove("is-selected");
      row.classList.add("is-selected");
      const text = copy[currentLocale];
      root.querySelector<HTMLElement>("[data-selection]")!.innerHTML =
        `${text.selected} <strong>${row.dataset.orderId}</strong> · ${text.escalation}`;
      root.querySelector<HTMLButtonElement>("[data-resolve]")!.disabled = false;
    }
  };
  root.addEventListener("click", onClick);

  const update = (nextTitle: string, nextMarket?: string, nextLocale?: Locale) => {
    currentTitle = nextTitle;
    currentMarket = nextMarket ?? currentMarket;
    currentLocale = nextLocale ?? currentLocale;
    render();
  };

  return {
    update,
    destroy() {
      root.removeEventListener("click", onClick);
      root.remove();
      style.remove();
    },
  };
}
