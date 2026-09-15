import Vue from "vue";
import ElementUI from "element-ui";
import "element-ui/lib/theme-chalk/index.css";
import App from "./App";
import "./app.css";

Vue.use(ElementUI);

new Vue({
  render: (createElement) =>
    createElement(App, {
      props: {
        title: "Vue 2 legacy operations",
        locale: "zh-CN",
        market: "Asia Pacific",
      },
    }),
}).$mount("#app");
