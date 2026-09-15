# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch04-components.spec.ts >> W1038 reanchors Element UI Select after viewport enlargement with local=true
- Location: tests/e2e/upstream-batch04-components.spec.ts:26:34

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main
  - main
```

# Test source

```ts
  1  | import { expect, isolateBrowserProcess, test } from './browser-process-fixture';
  2  | import { assertRealmOwnership, destroyComponent, mountComponent } from './upstream-components-fixture';
  3  | import { destroyBatch02, mountBatch02 } from './upstream-batch02-components-fixture';
  4  | 
  5  | isolateBrowserProcess(import.meta.url);
  6  | let errors: string[];
  7  | test.beforeEach(({page}) => { errors=[];page.on('pageerror',e=>errors.push(e.message)); });
  8  | test.afterEach(async ({page}) => { await destroyComponent(page);await destroyBatch02(page);expect(errors).toEqual([]); });
  9  | 
  10 | test('W1012 renders real bpmn-js SVG transforms and flow geometry in the application Realm', async ({page}) => {
  11 |   await mountComponent(page,'bpmn');
  12 |   const root=page.locator('.upstream-bpmn');
  13 |   await expect(root).toHaveAttribute('data-bpmn-elements','5');
  14 |   const task=root.locator('[data-element-id="Task_1"] .djs-visual rect');
  15 |   await expect(task).toBeVisible();
  16 |   await expect(root.locator('[data-element-id="Task_1"]')).toContainText('Review request');
  17 |   const transforms=await root.locator('[data-element-id="Task_1"]').evaluate(node => {
  18 |     const group=node as SVGGElement;
  19 |     return {count:group.transform.baseVal.numberOfItems,matrix:group.transform.baseVal.getItem(0).matrix.e};
  20 |   });
  21 |   expect(transforms.count).toBeGreaterThan(0);expect(transforms.matrix).toBe(240);
  22 |   expect(await root.locator('[data-element-id="Flow_1"] .djs-visual path').evaluate((node:SVGPathElement)=>node.getTotalLength())).toBe(104);
  23 |   await assertRealmOwnership(page,'.upstream-bpmn-canvas svg');
  24 | });
  25 | 
  26 | for(const local of [false,true]) test(`W1038 reanchors Element UI Select after viewport enlargement with local=${local}`, async ({page}) => {
  27 |   await page.setViewportSize({width:900,height:720});
  28 |   await mountBatch02(page,'drawer',{local});
  29 |   await page.getByRole('button',{name:'Open select drawer'}).click();
  30 |   const input=page.getByRole('dialog',{name:'Select within drawer'}).getByPlaceholder('Drawer selection');
  31 |   await input.click();
  32 |   const menu=page.locator('.el-select-dropdown:visible');
  33 |   await expect(menu).toBeVisible();
  34 |   await page.setViewportSize({width:1500,height:950});
  35 |   await expect.poll(async()=>{
  36 |     const a=await input.boundingBox();const b=await menu.boundingBox();
  37 |     return Boolean(a&&b&&Math.abs(a.x-b.x)<5&&Math.min(Math.abs(b.y-a.y-a.height),Math.abs(b.y+b.height-a.y))<16);
> 38 |   }).toBe(true);
     |      ^ Error: expect(received).toBe(expected) // Object.is equality
  39 |   if(local) expect(await menu.evaluate(node=>Boolean(node.closest('.el-select')))).toBe(true);
  40 |   await menu.getByText('South',{exact:true}).click();
  41 |   await expect(page.locator('.batch02-vue2-drawer')).toHaveAttribute('data-selected','South');
  42 | });
  43 | 
```