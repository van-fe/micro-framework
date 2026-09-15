import { expect, it } from 'vitest';
import { createRealmLoadingPlan } from './realm-loading-plan';

it('explicit shared requirements override authored bindings while retaining other application mappings and nonce', () => {
  const plan=createRealmLoadingPlan({type:'html',url:'https://apps.example/index.html',baseURL:'https://apps.example/',template:'',scripts:[],styles:[],modulePreloads:[],importMap:{imports:{lib:'https://apps.example/local.js',local:null},scopes:{'https://apps.example/feature/':{lib:'https://apps.example/local.js',local:'https://apps.example/feature.js'}},nonce:'authorized'}}, {imports:{lib:'^1.0.0'},scopes:{'./feature/':{lib:'^1.0.0'}}},{lib:[{version:'1.0.0',url:'https://cdn.example/lib.js'}]});
  expect(plan.importMap).toEqual({imports:{lib:'https://cdn.example/lib.js',local:null},scopes:{'https://apps.example/feature/':{lib:'https://cdn.example/lib.js',local:'https://apps.example/feature.js'}},nonce:'authorized'});
});
