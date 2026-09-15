export function replaceRealmProperty(
  target: object,
  key: PropertyKey,
  value: unknown,
): () => void {
  const targetDescriptor = Object.getOwnPropertyDescriptor(target, key);
  let owner: object | null = target;
  while (owner && !Object.prototype.hasOwnProperty.call(owner, key)) {
    owner = Object.getPrototypeOf(owner) as object | null;
  }
  const inheritedDescriptor = owner ? Object.getOwnPropertyDescriptor(owner, key) : undefined;

  try {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: targetDescriptor?.enumerable ?? inheritedDescriptor?.enumerable ?? true,
      value,
      writable: true,
    });
    return () => {
      if (targetDescriptor) Object.defineProperty(target, key, targetDescriptor);
      else Reflect.deleteProperty(target, key);
    };
  } catch {
    if (!owner || !inheritedDescriptor?.configurable) {
      throw new TypeError(`Browser resource ${String(key)} cannot be replaced in this Realm.`);
    }
    Object.defineProperty(owner, key, {
      configurable: true,
      enumerable: inheritedDescriptor.enumerable,
      value,
      writable: true,
    });
    return () => Object.defineProperty(owner!, key, inheritedDescriptor);
  }
}
