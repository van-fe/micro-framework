import { Component, Input } from "@angular/core";
import { createAngularLifecycle } from "@micro-framework/adapter-angular";

@Component({ selector: "orders-root", standalone: true, template: '<h2>{{title}}</h2><button (click)="count = count + 1">Count: {{count}}</button>' })
class OrdersComponent {
  @Input() title = "Angular orders";
  count = 0;
}
const lifecycle = createAngularLifecycle<OrdersComponent, { title: string }>({ component: OrdersComponent });
export async function mount(props: Parameters<typeof lifecycle.mount>[0]) {
  Reflect.set(window, "__angularRealmProbe", true);
  const { suffix } = await import("./lazy.js");
  await lifecycle.mount({ ...props, title: props.title + suffix });
}
export const update = lifecycle.update;
export const unmount = lifecycle.unmount;
