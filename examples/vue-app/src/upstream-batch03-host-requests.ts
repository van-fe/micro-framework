import axios from "axios";
import { createMemoryHistory, createRouter } from "vue-router";

export function createRequests(origin: string) {
  const client = axios.create({ baseURL: origin + "/host-api/" });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/:pathMatch(.*)*", component: { render: () => null } }] });
  let result: unknown;
  router.beforeEach(async () => { result = (await client.get("api/data")).data; });
  return { async navigate(path: string) { await router.push(path); return result; } };
}
