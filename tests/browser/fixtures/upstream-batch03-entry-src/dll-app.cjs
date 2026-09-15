const vendor = require('./vendor.cjs');
exports.mount = ({container}) => { container.textContent = vendor.value; window.batch03DllOwner = vendor.owner(); };
exports.unmount = ({container}) => container.replaceChildren();
