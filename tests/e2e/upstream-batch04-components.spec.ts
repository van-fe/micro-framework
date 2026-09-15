import { expect, isolateBrowserProcess, test } from './browser-process-fixture';
import { assertRealmOwnership, destroyComponent, mountComponent } from './upstream-components-fixture';
import { destroyBatch02, mountBatch02 } from './upstream-batch02-components-fixture';

isolateBrowserProcess(import.meta.url);
let errors: string[];
test.beforeEach(({page}) => { errors=[];page.on('pageerror',e=>errors.push(e.message)); });
test.afterEach(async ({page}) => { await page.evaluate(async () => { await Reflect.get(window, '__batch04PopupRuntime')?.destroy(); });await destroyComponent(page);await destroyBatch02(page);expect(errors).toEqual([]); });

test('W1012 renders real bpmn-js SVG transforms and flow geometry in the application Realm', async ({page}) => {
  await mountComponent(page,'bpmn');
  const root=page.locator('.upstream-bpmn');
  await expect(root).toHaveAttribute('data-bpmn-elements','5');
  const task=root.locator('[data-element-id="Task_1"] .djs-visual rect');
  await expect(task).toBeVisible();
  await expect(root.locator('[data-element-id="Task_1"]')).toContainText('Review request');
  const transforms=await root.locator('[data-element-id="Task_1"]').evaluate(node => {
    const group=node as SVGGElement;
    return {count:group.transform.baseVal.numberOfItems,matrix:group.transform.baseVal.getItem(0).matrix.e};
  });
  expect(transforms.count).toBeGreaterThan(0);expect(transforms.matrix).toBe(240);
  expect(await root.locator('[data-element-id="Flow_1"] .djs-visual path').evaluate((node:SVGPathElement)=>node.getTotalLength())).toBe(104);
  await assertRealmOwnership(page,'.upstream-bpmn-canvas svg');
});

for(const local of [false,true]) test(`W1038 reanchors Element UI Select after viewport enlargement with local=${local}`, async ({page}) => {
  await page.setViewportSize({width:900,height:720});
  await mountBatch02(page,'drawer',{local});
  await page.getByRole('button',{name:'Open select drawer'}).click();
  const input=page.getByRole('dialog',{name:'Select within drawer'}).getByPlaceholder('Drawer selection');
  await input.click();
  const menu=page.locator('.el-select-dropdown:visible');
  await expect(menu).toBeVisible();
  await page.setViewportSize({width:1500,height:950});
  await expect.poll(async()=>{
    const a=await input.boundingBox();const b=await menu.boundingBox();
    return {trigger:a,menu:b,aligned:Boolean(a&&b&&Math.abs(a.x-b.x)<5&&Math.min(Math.abs(b.y-a.y-a.height),Math.abs(b.y+b.height-a.y))<16)};
  }).toMatchObject({aligned:true});
  if(local) expect(await menu.evaluate(node=>Boolean(node.closest('.el-select')))).toBe(true);
  await menu.getByText('South',{exact:true}).click();
  await expect(page.locator('.batch02-vue2-drawer')).toHaveAttribute('data-selected','South');
});

for (const library of ['react', 'vue3'] as const) test(`W1038 reanchors ${library} menu after visible viewport enlargement`, async ({page}) => {
  await page.setViewportSize({width:900,height:720});
  await page.goto('/benchmark.html');
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  await page.evaluate(async library => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({storage:{persistent:false}});
    Reflect.set(window, '__batch04PopupRuntime', runtime);
    const slot = document.body.appendChild(document.createElement('main'));
    slot.id = 'batch04-popup-slot'; slot.style.cssText = 'margin:40px 0 0 30vw;width:65vw';
    await runtime.mountApp({name:'resize-popup',container:slot,props:{title:'Resize contract',locale:'zh-CN'},entry:{type:'module',url:library==='react'?'http://127.0.0.1:5175/src/lifecycle.tsx':'http://127.0.0.1:5176/src/lifecycle.ts'}});
  }, library);
  const trigger = page.locator(`[data-open-popup="${library}-menu"]`);
  await trigger.click();
  const popup = page.locator(library==='react'?'.ant-dropdown:visible':'.vue-contract-menu:visible');
  await expect(popup).toBeVisible();
  const original = await trigger.boundingBox();
  await page.setViewportSize({width:1500,height:950});
  await expect.poll(async () => {
    const a=await trigger.boundingBox(); const b=await popup.boundingBox();
    return {trigger:a,popup:b,aligned:Boolean(a&&b&&Math.min(Math.abs(a.x-b.x),Math.abs(a.x+a.width-b.x-b.width),Math.abs(a.x+a.width/2-b.x-b.width/2))<8&&Math.min(Math.abs(b.y-a.y-a.height),Math.abs(b.y+b.height-a.y))<18),moved:Boolean(a&&original&&Math.abs(a.x-original.x)>50)};
  }).toMatchObject({aligned:true,moved:true});
  await page.locator(`[data-overlay-kind="${library}-menu-item"]`).first().click();
  await expect(page.locator(library==='react'?'[data-react-popup-feedback]':'.action-feedback')).toContainText(library==='react'?'预测偏差说明已准备':'客户备注已准备');
  await page.evaluate(async () => { await Reflect.get(window,'__batch04PopupRuntime').destroy(); });
  await expect(page.locator('#batch04-popup-slot iframe')).toHaveCount(0);
});
