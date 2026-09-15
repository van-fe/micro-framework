(function () {
  const query = new URL(document.currentScript.src).searchParams;
  window.__remainingProbe.asyncExecutions.push({
    phase: query.get('phase'), owner: query.get('owner'),
    iframe: window !== parent && document.currentScript.ownerDocument.defaultView === window,
  });
  window.__remainingAsyncOwner = query.get('owner');
})();
