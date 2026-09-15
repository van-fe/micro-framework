window.batch02 = {
  borrowedQueries() {
    const parsed = new DOMParser().parseFromString('<section id="parsed-only"><b>fragment</b></section>', 'text/html');
    const expected = parsed.querySelector('#parsed-only');
    return {
      direct: expected?.textContent,
      borrowed: document.querySelector.call(parsed, '#parsed-only') === expected,
      collection: document.getElementsByTagName.call(parsed, 'b')[0] === expected.firstElementChild,
      parsedBody: document.getElementsByTagName.call(parsed, 'body')[0] === parsed.body,
      appLeak: document.querySelector('#parsed-only'),
    };
  },
  writableQuery() {
    'use strict';
    const query = document.querySelector;
    const probe = document.createElement('div');
    probe.id = 'writable-query';
    document.body.append(probe);
    let calls = 0;
    document.querySelector = function (selector) { calls++; return query.call(this, selector); };
    const found = document.querySelector('#writable-query');
    document.querySelector = query;
    return { found: found === probe, calls, restored: document.querySelector === query };
  },
  ids(ids) {
    return ids.map((id) => {
      const node = document.createElement('i'); node.id = id; document.body.append(node);
      return document.getElementById(id) === node;
    });
  },
  scripts() {
    const first = document.createElement('script'); first.type = 'application/json'; first.id = 'data-script';
    first.textContent = '{"valid":true}'; document.head.appendChild(first);
    const staticList = document.querySelectorAll('script');
    const liveList = document.scripts;
    const tags = document.getElementsByTagName('script');
    const query = document.querySelector('#data-script');
    const second = document.createElement('script'); second.type = 'application/json'; second.id = 'later-script';
    document.head.appendChild(second);
    const visited = [];
    staticList.forEach((node,index,list) => visited.push(list === staticList && node === staticList[index]));
    return { first, second, staticList, liveList, tags, query,
      nodeList: staticList instanceof NodeList,
      htmlCollection: tags instanceof HTMLCollection,
      visited,
    };
  },
  addStyles(cssList) {
    let previous;
    return cssList.map((css) => {
      const style = document.createElement('style'); style.textContent = css;
      if (previous) previous.insertAdjacentElement('afterend', style);
      else document.head.appendChild(style);
      previous = style;
      return style;
    });
  },
  theme() {
    const style = document.createElement('style');
    style.textContent = ':root[theme-mode="light"] { color:rgb(10,20,30); --theme-token:rgb(40,50,60) } :root[theme-mode="dark"] { color:rgb(70,80,90); --theme-token:rgb(100,110,120) } :root[theme-mode="dark"] > body .themed { background-color:var(--theme-token) }';
    document.head.appendChild(style);
    document.documentElement.setAttribute('theme-mode', 'dark');
    const node = document.createElement('span'); node.className = 'themed'; node.textContent = 'theme'; document.body.append(node);
    return node;
  },
  rem(size) {
    const style = document.createElement('style');
    style.textContent = ':root {font-size:' + size + 'px} .rem-probe {width:2rem;height:calc(1rem + 2px);padding-left:.5rem}';
    document.head.appendChild(style);
    const node = document.createElement('div'); node.className = 'rem-probe'; node.style.marginLeft = '1rem'; document.body.append(node);
    return node;
  },
  inputListeners() {
    const calls = [];
    const callback = event => calls.push({type:event.type, correctThis: event.currentTarget !== null});
    window.addEventListener('mousemove', callback);
    window.addEventListener('mouseup', callback);
    const abort = new AbortController();
    window.addEventListener('mousemove', () => calls.push({type:'once'}), {once:true});
    window.addEventListener('mousemove', () => calls.push({type:'aborted'}), {signal:abort.signal});
    abort.abort();
    return {calls};
  },
  externalFont(url) {
    const link = document.createElement('link'); link.rel='stylesheet'; link.href=url;
    document.head.appendChild(link);
    const node = document.createElement('span'); node.className='external-font-probe'; node.textContent='\ue6cf'; document.body.append(node);
    return {link,node,loaded:() => document.fonts.load('20px "Batch02ExternalIcons"','\ue6cf')};
  },
  fontStyles(url) {
    const styles = this.addStyles([
      '.font-probe {font-size:20px;display:inline-block}',
      '.font-probe {font-weight:400}',
      '@font-face {font-family:"Batch02Icons";src:url("' + url + '")} .font-probe {font-family:"Batch02Icons"}',
      '.font-probe {font-style:normal}',
      '.font-probe {line-height:1}',
    ]);
    const node = document.createElement('span'); node.className = 'font-probe'; node.textContent = '\ue6cf'; document.body.append(node);
    return { node, styles, loaded: () => document.fonts.load('20px "Batch02Icons"', '\ue6cf') };
  },
  fillAvailable() {
    this.addStyles(['html, body {height:100%;margin:0} .fill-parent {height:calc(100% - 20px);display:flex;flex-direction:column} .fill-child {height:-webkit-fill-available;height:stretch;background:green}']);
    const parent = document.createElement('div'); parent.className = 'fill-parent';
    const child = document.createElement('div'); child.className = 'fill-child'; parent.append(child); document.body.append(parent);
    return {parent,child};
  },
  iframeMessages(url) {
    const frame = document.createElement('iframe'); frame.src = url; document.body.append(frame);
    const events = [];
    const listener = event => { if (event.data?.batch02) events.push({ data: event.data, origin: event.origin, correctSource: event.source === frame.contentWindow }); };
    window.addEventListener('message', listener);
    return { frame, events, stop: () => window.removeEventListener('message', listener) };
  },
  rootShadow() {
    const appStyle=document.createElement('style');appStyle.textContent=':root {font-size:20px}';document.head.appendChild(appStyle);
    const host=document.createElement('div');host.id='owned-root-child';document.documentElement.appendChild(host);
    const root=host.attachShadow({mode:'open'});
    const style=document.createElement('style');
    style.textContent='@font-face{font-family:OwnedNestedFont;src:url("/upstream-batch02-font-normal.ttf")} :host{font-size:2rem} .owned-button{width:2rem;color:rgb(17,34,51);font:20px OwnedNestedFont}';
    root.appendChild(style);
    const button=document.createElement('button');button.className='owned-button';button.textContent='Nested action';root.appendChild(button);
    const script=document.createElement('script');script.textContent='window.__ownedNestedScript={document:document};';root.appendChild(script);
    return {host,root,style,button,script,scriptResult:window.__ownedNestedScript};
  },
};
