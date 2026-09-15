import { MicroRuntime } from '@micro-framework/runtime-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

const cleanups: Array<()=>void|Promise<void>>=[];
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup();});
async function origin() {return (await (await fetch('/__batch03-entry')).json() as {origin:string}).origin;}
async function mount(path:string, shared=false) {
  const endpoint=await origin();
  const runtime=new MicroRuntime({bootstrapUrl:new URL('/realm-bootstrap.js',location.href).href,...(shared?{sharedDependencies:{'batch03-lib':[{version:'1.0.0',url:endpoint+'/map/lib.js'}]}}:{})});
  const container=document.createElement('main');document.body.append(container);
  cleanups.push(async()=>{await runtime.destroy();container.remove();});
  const handle=await runtime.mountApp({name:'batch03-entry',container,entry:{type:'html',url:endpoint+path},...(shared?{sharedDependencies:{imports:{'batch03-lib':'^1.0.0'}}}:{})});
  const frame=container.querySelector('iframe')!.contentWindow!;
  const root=container.querySelector('micro-app-host')!.shadowRoot!;
  return {endpoint,runtime,container,handle,frame,root};
}

describe('batch03 native entry execution',()=>{
  it('Q3059 resolves real webpack automatic publicPath on cold and repeated application loads',async()=>{
    for(let pass=0;pass<2;pass++){
      const app=await mount('/auto/index.html');
      expect(app.root.querySelector('output')?.textContent).toBe('webpack lazy chunk');
      expect(Reflect.get(app.frame,'batch03WebpackWindow')).toBe(app.frame);
      const requests=await(await fetch(app.endpoint+'/requests')).json() as string[];
      expect(requests.some(path=>/^\/auto\/public\/lazy-.*\.js$/.test(path))).toBe(true);
      await app.runtime.destroy();expect(app.container.querySelector('iframe')).toBeNull();
    }
    expect(Reflect.has(window,'Batch03Webpack')).toBe(false);
  });
  it('Q3053 preserves explicit relative publicPath for real webpack lazy chunks on the application origin',async()=>{
    const app=await mount('/relative/index.html');
    expect(app.root.querySelector('output')?.textContent).toBe('webpack lazy chunk');
    const requests=await(await fetch(app.endpoint+'/requests')).json() as string[];
    expect(requests.some(path=>/^\/relative\/public\/lazy-.*\.js$/.test(path))).toBe(true);
    expect(requests.some(path=>/^\/relative\/lazy-/.test(path))).toBe(false);
  });
  it('W1015 links real webpack DLL globals in their owning iframe without host or sibling leakage',async()=>{
    const one=await mount('/dll/index.html'),two=await mount('/dll/index.html');
    for(const app of [one,two]){
      expect(app.root.textContent).toContain('real DLL vendor');
      expect(Reflect.get(app.frame,'batch03DllOwner')).toBe(app.frame);
      expect(typeof Reflect.get(app.frame,'_dll_vendors')).toBe('function');
    }
    expect(Reflect.get(one.frame,'_dll_vendors')).not.toBe(Reflect.get(two.frame,'_dll_vendors'));
    expect(Reflect.has(window,'_dll_vendors')).toBe(false);
  });
  it('Q2993 evaluates real Module Federation remote factories independently for sibling iframe consumers',async()=>{
    const one=await mount('/federation/index.html'),two=await mount('/federation/index.html');
    for(const app of [one,two]){
      expect(app.root.textContent).toContain('remote count 1');
      expect(Reflect.get(app.frame,'batch03FederationOwner')).toBe(app.frame);
    }
    expect(Reflect.has(window,'Batch03Remote')).toBe(false);
    expect(Reflect.has(window,'batch03FederatedCount')).toBe(false);
  });
  it('Q3125 Q2971 isolates real Vite production lifecycle and absolute URL dynamic imports in sibling Realms',async()=>{
    const one=await mount('/vite/index.html'),two=await mount('/vite/index.html');
    for(const app of [one,two]){
      expect(app.root.querySelector('output')?.textContent).toBe('Home route');
      expect(Reflect.get(app.frame,'batch03Owner')).toBe(app.frame);
      expect((Reflect.get(app.frame,'batch03Remote') as {owner:Window}).owner).toBe(app.frame);
      expect(Reflect.get(app.frame,'batch03RemoteEvaluations')).toBe(1);
      expect(app.handle.getStatus()).toBe('mounted');
      await app.runtime.destroy();expect(app.container.querySelector('micro-app-host')).toBeNull();
    }
    expect(Reflect.has(window,'batch03Owner')).toBe(false);
    expect(Reflect.has(window,'batch03RemoteEvaluations')).toBe(false);
  });
  it('W1049 requests each real Vite modulepreload and Vue Router lazy chunk once during route changes',async()=>{
    const endpoint=await origin();
    const before=await(await fetch(endpoint+'/requests')).json() as string[];
    // Browser projects share this HTTP fixture; scope transport counts to this mount.
    const requestPrefix='/vite-count-'+crypto.randomUUID();
    const app=await mount(requestPrefix+'/index.html');
    const buttons=app.root.querySelectorAll('button');
    buttons[0]!.click();await vi.waitFor(()=>expect(app.root.querySelector('output')?.textContent).toBe('About route'));
    buttons[1]!.click();await vi.waitFor(()=>expect(app.root.querySelector('output')?.textContent).toBe('Home route'));
    const requests=(await(await fetch(endpoint+'/requests')).json() as string[]).slice(before.length);
    const scripts=requests.filter(path=>path.startsWith(requestPrefix+'/assets/')&&path.endsWith('.js'));
    expect(scripts.some(path=>path.includes('vendor')),JSON.stringify(scripts)).toBe(true);
    expect(scripts.some(path=>path.includes('home')),JSON.stringify(scripts)).toBe(true);
    expect(scripts.some(path=>path.includes('about')),JSON.stringify(scripts)).toBe(true);
    for(const path of new Set(scripts))expect(scripts.filter(item=>item===path),path).toHaveLength(1);
    expect(Reflect.get(app.frame,'batch03HomeEvaluations')).toBe(1);
    expect(Reflect.get(app.frame,'batch03AboutEvaluations')).toBe(1);
  });
  it('W1025 matches native parser microtask checkpoints between adjacent inline classic scripts',async()=>{
    const endpoint=await origin();
    const native=document.createElement('iframe');
    const order=new Promise<number[]>(resolve=>{
      const listener=(event:MessageEvent)=>{if(event.source===native.contentWindow&&event.origin===endpoint&&event.data?.batch03Order){window.removeEventListener('message',listener);resolve(event.data.batch03Order);}};
      window.addEventListener('message',listener);cleanups.push(()=>window.removeEventListener('message',listener));
    });
    native.src=endpoint+'/native-order.html';document.body.append(native);cleanups.push(()=>native.remove());
    const expected=await order;
    const app=await mount('/order.html');
    expect([...expected].sort()).toEqual([1,2]);
    expect(Reflect.get(app.frame,'batch03Order')).toEqual(expected);
  });
  it('W970 installs authored HTML import maps before native iframe module imports',async()=>{
    const app=await mount('/map/index.html');
    expect(app.root.textContent).toContain('authored import map');
    expect(Reflect.get(app.frame,'batch03MapOwner')).toBe(app.frame);
    expect(Reflect.has(window,'batch03MapOwner')).toBe(false);
  });
  it('W970 resolves host-configured shared dependency URLs inside each consuming iframe',async()=>{
    const one=await mount('/shared/index.html',true),two=await mount('/shared/index.html',true);
    for(const app of [one,two]){
      expect(app.root.textContent).toContain('authored import map');
      expect(Reflect.get(app.frame,'batch03MapOwner')).toBe(app.frame);
    }
    expect(Reflect.has(window,'batch03MapOwner')).toBe(false);
  });

  it('W970 resolves authored import-map scopes and prefixes against the HTML base URL',async()=>{
    const app=await mount('/map/scopes.html');
    expect(app.root.textContent).toContain('scoped dependency:prefix dependency');
  });

});
