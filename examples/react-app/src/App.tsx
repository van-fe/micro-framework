import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, ConfigProvider, Dropdown, Modal, Progress, Statistic, Tag, Tooltip } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";

export interface DemoAppProps {
  title: string;
  instanceId: string;
  locale?: "zh-CN" | "en-US";
  market?: string;
  period?: string;
}

const series = {
  live: [28, 34, 31, 46, 43, 55, 61, 58, 72, 67, 78, 82],
  "7d": [42, 38, 51, 47, 63, 58, 74, 69, 81, 76, 86, 92],
  "30d": [36, 41, 39, 52, 49, 61, 57, 68, 72, 70, 83, 88],
} as const;

const messages = {
  "en-US": {
    pulse: "Net revenue pulse",
    updated: "Updated seconds ago",
    analyticsPeriod: "Analytics period",
    netRevenue: "Net revenue",
    versusBaseline: "vs. operating baseline",
    trend: "Revenue is trending upward",
    now: "Now",
    channelMix: "Channel mix",
    netSales: "Net sales",
    direct: "Direct",
    marketplace: "Marketplace",
    retailPartners: "Retail partners",
    dayEndForecast: "Day-end forecast",
    confidence: "96% confidence",
    sourcesHealthy: "14 data sources healthy",
    automation: "Revenue automation",
    stable: "Stable",
    portal: "React portal stays inside this ShadowRoot",
    openDialog: "Inspect forecast",
    explainVariance: "Explain variance",
    exportSnapshot: "Export snapshot",
    actions: "More analytics actions",
    tooltip: "Forecast confidence uses the latest 14 revenue sources.",
    tooltipLabel: "Explain forecast confidence",
    varianceReady: "Variance explanation is ready.",
    snapshotReady: "Revenue snapshot is ready.",
    dialogTitle: "Revenue forecast review",
    dialogBody: "Review the projected close, channel mix, and confidence signal before sharing the forecast with operations.",
    dialogMetric: "Projected close",
    dialogOwner: "Owner",
    dialogOwnerValue: "Commerce intelligence",
    cancel: "Cancel",
    confirm: "Approve forecast",
  },
  "zh-CN": {
    pulse: "净营收实时脉搏",
    updated: "数秒前更新",
    analyticsPeriod: "分析周期",
    netRevenue: "净营收",
    versusBaseline: "较经营基线",
    trend: "营收趋势持续上升",
    now: "当前",
    channelMix: "渠道构成",
    netSales: "净销售额",
    direct: "直营渠道",
    marketplace: "电商平台",
    retailPartners: "零售合作伙伴",
    dayEndForecast: "今日收盘预测",
    confidence: "置信度 96%",
    sourcesHealthy: "14 个数据源运行正常",
    automation: "营收自动化",
    stable: "稳定",
    portal: "React portal stays inside this ShadowRoot · Portal 保持在当前 ShadowRoot 内",
    openDialog: "查看预测弹窗",
    explainVariance: "解释预测偏差",
    exportSnapshot: "导出收入快照",
    actions: "更多分析操作",
    tooltip: "预测置信度来自最新的 14 个收入数据源。",
    tooltipLabel: "说明预测置信度",
    varianceReady: "预测偏差说明已准备。",
    snapshotReady: "收入快照已准备。",
    dialogTitle: "营收预测复核",
    dialogBody: "在向运营团队同步预测前，复核今日收盘金额、渠道构成与置信度信号。",
    dialogMetric: "预计收盘",
    dialogOwner: "负责人",
    dialogOwnerValue: "商业智能团队",
    cancel: "取消",
    confirm: "确认预测",
  },
} as const;

const marketLabels: Record<"zh-CN" | "en-US", Record<string, string>> = {
  "en-US": {
    "North America": "North America",
    Europe: "Europe",
    "Asia Pacific": "Asia Pacific",
  },
  "zh-CN": {
    "North America": "北美",
    Europe: "欧洲",
    "Asia Pacific": "亚太地区",
  },
};

export function App({
  title,
  instanceId,
  locale = "en-US",
  market = "North America",
  period = "live",
}: DemoAppProps) {
  const [activePeriod, setActivePeriod] = useState(period);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState("");
  useEffect(() => setActivePeriod(period), [period]);

  const copy = messages[locale];
  const antdLocale = locale === "zh-CN" ? zhCN : enUS;
  const displayMarket = marketLabels[locale][market] ?? market;
  const points = series[activePeriod as keyof typeof series] ?? series.live;
  const path = useMemo(
    () => points.map((value, index) => `${index * 9.09},${100 - value}`).join(" "),
    [points],
  );
  const channels = [
    { label: copy.direct, value: "$742k", share: 72, color: "#84cc16" },
    { label: copy.marketplace, value: "$518k", share: 53, color: "#5b8ff9" },
    { label: copy.retailPartners, value: "$294k", share: 31, color: "#a97ad8" },
  ];

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        token: {
          borderRadius: 10,
          colorPrimary: "#476f2d",
          colorSuccess: "#5b8f35",
          fontFamily: 'Inter, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
        },
      }}
    >
      <>
        <article id="react-root" className="analytics-app" lang={locale}>
          <div className="analytics-context">
            <div>
              <span className="app-contract-title">{title}</span>
              <strong>{copy.pulse}</strong>
              <small>{displayMarket} · {copy.updated}</small>
            </div>
            <div className="analytics-controls">
              <div className="micro-period" aria-label={copy.analyticsPeriod}>
                {([
                  { value: "live", label: "24h" },
                  { value: "7d", label: "7d" },
                  { value: "30d", label: "30d" },
                ] as const).map(({ value, label }) => (
                  <Button
                    className={activePeriod === value ? "is-active" : ""}
                    key={value}
                    onClick={() => setActivePeriod(value)}
                    size="small"
                    type="text"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <Tooltip
                title={<span data-overlay-kind="react-tooltip">{copy.tooltip}</span>}
              >
                <Button
                  aria-label={copy.tooltipLabel}
                  data-open-popup="react-tooltip"
                  shape="circle"
                  size="small"
                >
                  ?
                </Button>
              </Tooltip>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "variance",
                      label: <span data-overlay-kind="react-menu-item">{copy.explainVariance}</span>,
                    },
                    { key: "snapshot", label: copy.exportSnapshot },
                  ],
                  onClick: ({ key }) => setActionFeedback(
                    key === "variance" ? copy.varianceReady : copy.snapshotReady,
                  ),
                }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <Button
                  aria-label={copy.actions}
                  data-open-popup="react-menu"
                  shape="circle"
                  size="small"
                >
                  •••
                </Button>
              </Dropdown>
              <Button
                data-open-overlay="react"
                onClick={() => setModalOpen(true)}
                size="small"
                type="primary"
              >
                {copy.openDialog}
              </Button>
            </div>
          </div>

          <div className="analytics-content">
            <section className="revenue-chart" aria-label={copy.netRevenue}>
              <div className="chart-value">
                <Statistic title={copy.netRevenue} value={1553840} prefix="$" groupSeparator="," />
                <div className="trend-summary">
                  <Tag variant="filled" color="success">+14.8%</Tag>
                  <span>{copy.versusBaseline}</span>
                </div>
              </div>
              <div className="chart-area">
                <div className="chart-grid" aria-hidden="true">
                  <i></i><i></i><i></i><i></i>
                </div>
                <div className="chart-plot">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={copy.trend}>
                    <defs>
                      <linearGradient id={`revenue-fill-${instanceId}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#a3e635" stopOpacity=".34" />
                        <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon points={`0,100 ${path} 100,100`} fill={`url(#revenue-fill-${instanceId})`} />
                    <polyline points={path} fill="none" stroke="#5b8f35" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <span
                    aria-hidden="true"
                    className="chart-endpoint"
                    data-chart-endpoint
                    style={{ top: `${100 - points.at(-1)!}%` }}
                  />
                </div>
                <div className="chart-labels"><span>06:00</span><span>12:00</span><span>18:00</span><span>{copy.now}</span></div>
              </div>
            </section>

            <aside className="channel-mix" aria-label={copy.channelMix}>
              <div className="channel-heading">
                <strong>{copy.channelMix}</strong>
                <Tag variant="filled">{copy.netSales}</Tag>
              </div>
              {channels.map((channel) => (
                <div className="channel-row" key={channel.label}>
                  <div><span>{channel.label}</span><strong>{channel.value}</strong></div>
                  <Progress percent={channel.share} showInfo={false} strokeColor={channel.color} size="small" />
                </div>
              ))}
              <div className="forecast">
                <span>{copy.dayEndForecast}</span>
                <strong>$2.08M <small>{copy.confidence}</small></strong>
              </div>
            </aside>
          </div>

          <footer className="analytics-footer">
            <span data-react-popup-feedback role="status"><i></i> {actionFeedback || copy.sourcesHealthy}</span>
            <span className="automation-status">{copy.automation} <Tag variant="filled" color="success">{copy.stable}</Tag></span>
            <code>{instanceId}</code>
          </footer>
        </article>
        <Modal
          cancelText={copy.cancel}
          centered
          okText={copy.confirm}
          onCancel={() => setModalOpen(false)}
          onOk={() => setModalOpen(false)}
          open={modalOpen}
          rootClassName="react-business-modal"
          title={copy.dialogTitle}
          width={520}
        >
          <p className="react-dialog-copy">{copy.dialogBody}</p>
          <div className="react-dialog-metrics">
            <span><small>{copy.dialogMetric}</small><strong>$2.08M</strong></span>
            <span><small>{copy.confidence}</small><strong>96%</strong></span>
            <span><small>{copy.dialogOwner}</small><strong>{copy.dialogOwnerValue}</strong></span>
          </div>
          <code className="overlay-proof">document.body · global viewport · {instanceId}</code>
        </Modal>
        {createPortal(
          <div id="react-portal" role="status">
            <i></i>
            {copy.portal}
          </div>,
          document.body,
        )}
      </>
    </ConfigProvider>
  );
}
