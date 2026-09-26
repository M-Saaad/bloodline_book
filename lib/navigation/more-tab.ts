type NestedRoute = {
  name: string;
  state?: {
    index?: number;
    routes?: readonly { name: string }[];
  };
};

/** Index of the nested stack for a tab, or 0 when that tab has not opened a deeper screen. */
export function nestedStackIndex(routes: readonly NestedRoute[], name: string): number {
  const route = routes.find((item) => item.name === name);
  const index = route?.state?.index;
  return typeof index === 'number' ? index : 0;
}

/** Screen name currently shown inside a tab stack. */
export function currentNestedRouteName(
  routes: readonly NestedRoute[],
  name: string,
): string | undefined {
  const route = routes.find((item) => item.name === name);
  const nested = route?.state;
  if (!nested?.routes || nested.routes.length === 0) {
    return undefined;
  }
  return nested.routes[nested.index ?? 0]?.name;
}

/** A More tab press should return to the More menu when a deeper More screen is open. */
export function tabPressShouldOpenRoot(routeName: string | undefined): boolean {
  return routeName != null && routeName !== 'index';
}
