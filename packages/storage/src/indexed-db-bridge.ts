export function createIndexedDbNamespaceBridge(factory: IDBFactory, prefix: string): IDBFactory {
  const physicalName = (name: unknown) => `${prefix}${String(name)}`;
  return new Proxy(factory, {
    get(target, property) {
      if (property === "open") {
        return (...args: [name: string, version?: number]) => args.length > 1
          ? target.open(physicalName(args[0]), args[1])
          : target.open(physicalName(args[0]));
      }
      if (property === "deleteDatabase") {
        return (name: string) => target.deleteDatabase(physicalName(name));
      }
      if (property === "databases" && typeof target.databases === "function") {
        return async () => (await target.databases())
          .filter((database) => database.name?.startsWith(prefix))
          .map((database) => ({
            ...database,
            name: database.name?.slice(prefix.length),
          }));
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
