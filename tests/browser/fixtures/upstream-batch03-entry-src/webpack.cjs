exports.mount = async ({ container }) => {
  const lazy = await import('./lazy.cjs');
  const output = document.createElement('output'); output.textContent = lazy.value;
  container.appendChild(output); window.batch03WebpackWindow = window;
};
exports.unmount = ({container}) => container.replaceChildren();
