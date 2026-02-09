/**
 * Small collection helpers: groupBy (items → Map<key, T[]>) and pushToMapList (append to map-of-arrays).
 */
export function groupBy<T, K extends string | number | symbol>(
  items: Iterable<T>,
  keyFn: (item: T) => K
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    pushToMapList(map, keyFn(item), item);
  }
  return map;
}

/**
 * Append value to the array for key in map; create [value] if key is new.
 */
export function pushToMapList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
