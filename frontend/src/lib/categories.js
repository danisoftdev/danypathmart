export function flattenCategories(nodes = [], depth = 0) {
  return nodes.flatMap((n) => [
    { ...n, depth },
    ...flattenCategories(n.children || [], depth + 1),
  ]);
}
