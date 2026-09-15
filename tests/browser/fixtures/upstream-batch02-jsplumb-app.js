let instance;
window.Batch02JsPlumb = {
  mount(props) {
    const graph = document.createElement('div');
    graph.dataset.batch02Graph = '';
    graph.style.cssText = 'position:relative;width:600px;height:260px;border:1px solid black';
    const source = document.createElement('div');
    source.id = 'window2'; source.textContent = 'Source node';
    source.style.cssText = 'position:absolute;left:20px;top:20px;width:100px;height:40px;background:lightblue';
    const target = document.createElement('div');
    target.id = 'window3'; target.textContent = 'Target node';
    target.style.cssText = 'position:absolute;left:340px;top:160px;width:100px;height:40px;background:lightgreen';
    graph.append(source, target);
    props.container.appendChild(graph);
    const getInstance = jsPlumb.getInstance;
    instance = jsPlumb.getInstance({
      Container: graph, Anchor: 'AutoDefault', Endpoint: 'Blank',
      Connector: ['Flowchart', { cornerRadius: 5 }],
      PaintStyle: { strokeWidth: 2, stroke: '#345678' },
      ConnectionOverlays: [['Arrow', { location: 1, width: 10, length: 10 }]],
    });
    return new Promise(resolve => instance.ready(() => {
      const connect = () => {
        instance.connect({ source: 'window2', target: 'window3' });
        graph.dataset.connections = String(instance.getAllConnections().length);
      };
      connect();
      instance.draggable(source);
      graph.dataset.functionIdentity = String(getInstance === jsPlumb.getInstance);
      const reset = document.createElement('button');
      reset.textContent = 'Reconnect graph';
      reset.onclick = () => { instance.deleteEveryConnection(); connect(); };
      props.container.appendChild(reset);
      resolve();
    }));
  },
  unmount(props) { instance.reset(); instance = undefined; props.container.replaceChildren(); },
};
