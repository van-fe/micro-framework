const config = JSON.parse(document.getElementById('app-config').textContent);
exports.mount = async function ({ container }) {
  const lazy = await import('./lazy.mjs');
  const second = await import('./lazy.mjs');
  const output = document.createElement('output');
  output.dataset.batch02Webpack = '';
  output.textContent = JSON.stringify({ config, lazy: lazy.default, sameModule: lazy === second, evaluations: window.batch02LazyEvaluations });
  container.appendChild(output);
};
exports.unmount = function ({ container }) { container.replaceChildren(); };
