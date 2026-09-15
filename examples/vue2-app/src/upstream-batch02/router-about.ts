import Vue from "vue";

export default Vue.extend({
  name: "ColdAboutRoute",
  data: () => ({ count: 0 }),
  render(h) {
    return h("button", { on: { click: () => { this.count++; } } }, `Lazy about clicks: ${this.count}`);
  },
});
