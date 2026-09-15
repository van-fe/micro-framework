window.Batch02Native = { mount() {}, unmount() {} };
window.batch02Native = {
  accessors() {
    window.name = 'batch02-private-name';
    let value = 'first';
    const receivers = [];
    Object.defineProperty(window, 'batch02Accessor', {
      configurable: true,
      get() { receivers.push(this === window); return value; },
      set(next) { receivers.push(this === window); value = next; },
    });
    const first = window.batch02Accessor;
    window.batch02Accessor = 'second';
    return { first, second: window.batch02Accessor, name: window.name, receivers };
  },
  sharedFunction() {
    const read = function () { return this.id; };
    const a = { id: 'a', read };
    const b = { id: 'b', read };
    window.batch02Shared = read;
    return [a.read(), b.read(), window.batch02Shared.call(a), window.batch02Shared.call(b), a.read === b.read];
  },
  listeners() {
    let normal = 0;
    let once = 0;
    let capture = 0;
    const receivers = [];
    const add = window.addEventListener;
    const remove = window.removeEventListener;
    const listener = function (event) { normal++; receivers.push(this === window && event.currentTarget === window); };
    const captureListener = () => capture++;
    add.call(window, 'batch02-event', listener);
    add.call(window, 'batch02-event', () => once++, { once: true });
    add.call(window, 'batch02-event', captureListener, true);
    window.dispatchEvent(new Event('batch02-event'));
    remove.call(window, 'batch02-event', listener);
    remove.call(window, 'batch02-event', captureListener, true);
    window.dispatchEvent(new Event('batch02-event'));
    return { normal, once, capture, receivers };
  },
  navigate(url) { window.location = url; },
  resources(origin) {
    const image = document.createElement('img');
    image.src = '/pixel.svg?property';
    const attribute = document.createElement('img');
    attribute.setAttribute('src', '/pixel.svg?attribute');
    const block = document.createElement('div');
    block.style.backgroundImage = 'url(/pixel.svg?style)';
    const property = document.createElement('div');
    property.style.setProperty('background-image', 'url(/pixel.svg?set-property)');
    const text = document.createElement('div');
    text.style.cssText = 'background-image:url(/pixel.svg?css-text)';
    document.body.append(image, attribute, block, property, text);
    return Promise.all([image, attribute].map(image => image.decode())).then(() => ({
      image: image.src, attribute: attribute.src, block: block.style.backgroundImage,
      property: property.style.backgroundImage, text: text.style.backgroundImage,
      loaded: image.naturalWidth === 8 && attribute.naturalWidth === 8,
      expectedOrigin: origin,
    }));
  },
};
