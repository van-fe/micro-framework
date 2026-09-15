import { afterEach, expect, it } from 'vitest';
import { domApplication, domCleanups } from './upstream-batch02-dom-fixture';

afterEach(()=>{for(const cleanup of domCleanups.splice(0).reverse())cleanup();});
it('W1044 exposes the effective resource base without changing native document location or sibling bases and restores it on destroy',async()=>{
  const hostBase=document.baseURI;
  const app=await domApplication(document.body,'https://assets.example.test/app/assets/');
  const sibling=await domApplication(document.body,'https://other.example.test/sibling/');
  const nativeURL=app.frame.document.URL;
  expect(app.frame.document.baseURI).toBe('https://assets.example.test/app/assets/');
  expect(new app.frame.URL('image.png',app.frame.document.baseURI).href).toBe('https://assets.example.test/app/assets/image.png');
  expect(sibling.frame.document.baseURI).toBe('https://other.example.test/sibling/');
  expect(document.baseURI).toBe(hostBase);
  expect(app.frame.document.URL).toBe(nativeURL);
  expect(app.frame.document.location).toBe(app.frame.location);
  app.bridge.destroy();
  expect(Object.getOwnPropertyDescriptor(app.frame.document,'baseURI')).toBeUndefined();
  expect(app.frame.document.baseURI).toBe(hostBase);
});

it('W1044 preserves an application replacement of the baseURI property during bridge destruction',async()=>{
  const app=await domApplication();
  Object.defineProperty(app.frame.document,'baseURI',{configurable:true,value:'https://app.example/custom/'});
  app.bridge.destroy();
  expect(app.frame.document.baseURI).toBe('https://app.example/custom/');
});
