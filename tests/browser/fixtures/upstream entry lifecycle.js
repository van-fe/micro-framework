window.UpstreamLifecycle = {
  mount: function () { document.querySelector('[data-upstream-entry]').textContent = 'mounted'; },
  unmount: function () { document.querySelector('[data-upstream-entry]').textContent = 'unmounted'; },
};
window.console = window.console;
window.unrelatedFinalGlobal = { value: 'not a lifecycle' };
