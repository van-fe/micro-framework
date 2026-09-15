window.batch02ScriptSnapshots = [];
window.batch02CaptureScripts = function (label) {
  const current = document.currentScript;
  window.batch02ScriptSnapshots.push({
    label, current, first: document.querySelector('script'),
    all: [...document.querySelectorAll('script')],
    scripts: [...document.scripts],
    tags: [...document.getElementsByTagName('script')],
    sourceQuery: document.querySelector('script[src="' + current.src + '"]'),
  });
};
window.batch02CaptureScripts('first');
