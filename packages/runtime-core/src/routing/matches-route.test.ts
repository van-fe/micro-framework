import { describe, expect, it } from "vitest";
import { matchesRoute, routePath } from "./matches-route";

function location(pathname: string, hash = ""): Location {
  return { pathname, hash } as Location;
}

describe("routing mode matching", () => {
  it("uses pathname in history mode", () => {
    const current = location("/orders/42", "#/profile");
    expect(matchesRoute("/orders", current, "history")).toBe(true);
    expect(matchesRoute("/profile", current, "history")).toBe(false);
  });

  it("normalizes hash and hashbang paths", () => {
    expect(routePath(location("/shell", "#/orders/42?tab=open"), "hash")).toBe("/orders/42");
    expect(routePath(location("/shell", "#!/profile"), "hash")).toBe("/profile");
    expect(routePath(location("/shell", ""), "hash")).toBe("/");
  });

  it("keeps function rules on the real Location contract", () => {
    const current = location("/shell", "#/orders");
    expect(matchesRoute((value) => value.hash === "#/orders", current, "history")).toBe(true);
  });
});
