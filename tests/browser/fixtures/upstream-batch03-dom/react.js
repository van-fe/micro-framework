import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
function App() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = './comp.js';
    document.body.appendChild(script);
    return () => script.remove();
  }, []);
  return React.createElement('div', null, React.createElement('batch03-button', null, '按钮组件'));
}
let root;
window.Batch03App = {
  mount() { root = createRoot(document.querySelector('#app')); root.render(React.createElement(App)); },
  unmount() { root.unmount(); },
};
