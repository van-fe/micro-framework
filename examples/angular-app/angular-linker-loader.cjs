module.exports = function (source, map) {
  const callback = this.async();
  if (!source.includes('ɵɵngDeclare')) { callback(null, source, map); return; }
  Promise.all([import('@babel/core'), import('@angular/compiler-cli/linker/babel')]).then(async ([babel, linker]) => {
    const result = await babel.transformAsync(source, { filename: this.resourcePath, plugins: [linker.default], configFile: false, babelrc: false, sourceMaps: true, inputSourceMap: map || undefined });
    callback(null, result.code, result.map);
  }).catch(callback);
};
