import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import webpack from 'webpack';
import { build } from 'vite';
import { compileWebpackFixture } from '../../support/webpack-compiler';

export async function buildEntryFixtures() {
  const root = fileURLToPath(new URL('../fixtures/upstream-batch03-entry-src/', import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), 'batch03-entry-'));
  const disposals: Array<() => Promise<void>> = [() => rm(directory, {recursive:true,force:true})];
  const assets = new Map<string, Buffer>();
  for (const [name, publicPath] of [['auto','auto'], ['relative','public/']] as const) {
    const bundle = await compileWebpackFixture({entry:join(root,'webpack.cjs'),output:{filename:'main.js',chunkFilename:'lazy-[id].js',publicPath,library:{name:'Batch03Webpack',type:'window'}}});
    disposals.push(bundle.dispose);
    for(const [file,bytes] of bundle.assets) assets.set(`/${name}/public/${file}`,bytes);
  }
  const dll = await compileWebpackFixture({context:root,entry:{vendors:[join(root,'vendor.cjs')]},output:{filename:'dll.js',library:{name:'_dll_vendors',type:'var'}},plugins:[new webpack.DllPlugin({name:'_dll_vendors',path:join(directory,'manifest.json')})]});
  disposals.push(dll.dispose);
  const consumer = await compileWebpackFixture({context:root,entry:join(root,'dll-app.cjs'),output:{filename:'app.js',library:{name:'Batch03Dll',type:'window'}},plugins:[new webpack.DllReferencePlugin({context:root,manifest:JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'))})]});
  disposals.push(consumer.dispose);
  for(const bundle of [dll,consumer]) for(const [file,bytes] of bundle.assets) assets.set(`/dll/${file}`,bytes);
  const federation = await compileWebpackFixture({context:root,entry:{},output:{publicPath:'auto',uniqueName:'batch03remote'},plugins:[new webpack.container.ModuleFederationPlugin({name:'Batch03Remote',filename:'remoteEntry.js',exposes:{'./owner':join(root,'federated.cjs')}})]});
  disposals.push(federation.dispose);
  for(const [file,bytes] of federation.assets) assets.set(`/federation/${file}`,bytes);
  const viteDirectory=join(directory,'vite');
  const vueRequire=createRequire(new URL('../../../examples/vue-app/package.json',import.meta.url));
  await build({resolve:{alias:[{find:'vue',replacement:vueRequire.resolve('vue/dist/vue.runtime.esm-bundler.js')},{find:'vue-router',replacement:vueRequire.resolve('vue-router/dist/vue-router.mjs')}]},configFile:false,root,base:'./',logLevel:'error',build:{outDir:viteDirectory,emptyOutDir:true,minify:false,rolldownOptions:{output:{codeSplitting:{groups:[{name:'vendor',test:/node_modules/}]}}}}});
  for(const file of await readdir(viteDirectory,{recursive:true,withFileTypes:true})) if(file.isFile()) {
    const path=join(file.parentPath,file.name); assets.set('/vite/'+path.slice(viteDirectory.length+1),await readFile(path));
  }
  return {assets,dispose:async()=>{for(const dispose of disposals.reverse())await dispose();}};
}
