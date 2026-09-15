import { describe, expect, it } from 'vitest';
import { normalizeHtmlImportMaps } from './html-import-map';

const base = 'https://apps.example/team/sub/';
const map = (content: unknown, nonce?: string) => ({content:JSON.stringify(content), nonce});
describe('HTML import map normalization', () => {
  it('resolves scoped URLs, relative specifier keys and prefix addresses at the application base', () => {
    expect(normalizeHtmlImportMaps([map({imports:{'./dep.js':'../dep.js','prefix/':'./pkg/'},scopes:{'./feature/':{'lib':'/lib-v2.js'}}})],base)).toEqual({
      imports:{'https://apps.example/team/sub/dep.js':'https://apps.example/team/dep.js','prefix/':'https://apps.example/team/sub/pkg/'},
      scopes:{'https://apps.example/team/sub/feature/':{lib:'https://apps.example/lib-v2.js'}},nonce:undefined,
    });
  });
  it('preserves blocked null addresses and normalizes invalid targets to blocked entries', () => {
    const result=normalizeHtmlImportMaps([map({imports:{blocked:null,bare:'not-a-url','broken/':'./file.js',numeric:3}})],base);
    expect(result?.imports).toEqual({blocked:null,bare:null,'broken/':null,numeric:null});
  });
  it('retains first-map bindings and nonce while adding new imports and scoped bindings', () => {
    const result=normalizeHtmlImportMaps([
      map({imports:{lib:'./one.js',blocked:null},scopes:{'./feature/':{lib:'./one.js'}}},'allowed-nonce'),
      map({imports:{lib:'./two.js',blocked:'./two.js',other:'./two.js'},scopes:{'./feature/':{lib:'./two.js',other:'./two.js'}}},'allowed-nonce'),
    ],base);
    expect(result?.imports).toEqual({lib:base+'one.js',blocked:null,other:base+'two.js'});
    expect(result?.scopes[base+'feature/']).toEqual({lib:base+'one.js',other:base+'two.js'});
    expect(result?.nonce).toBe('allowed-nonce');
  });
  it('rejects merging maps with distinct CSP authorization instead of borrowing the first nonce', () => {
    expect(()=>normalizeHtmlImportMaps([map({imports:{a:'./a.js'}},'authorized'),map({imports:{b:'./b.js'}})],base)).toThrow('different CSP nonces');
  });
  it('rejects malformed JSON and non-object root or mapping sections before entry execution', () => {
    expect(()=>normalizeHtmlImportMaps([{content:'{broken'}],base)).toThrow(SyntaxError);
    for(const value of [null,[],{imports:[]},{imports:null},{scopes:[]},{scopes:{'./feature/':null}}]) {
      expect(()=>normalizeHtmlImportMaps([map(value)],base)).toThrow(TypeError);
    }
  });
});
