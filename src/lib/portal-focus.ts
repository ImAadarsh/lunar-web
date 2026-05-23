/** Routes that use fullscreen layout (no sidebar / top workspace chrome). */
export function isFocusDashboardPath(pathname: string) {
  return /^\/manager\/(guards|sites)\/\d+$/.test(pathname);
}

export function focusDashboardBackHref(pathname: string, role: string) {
  if (/^\/manager\/guards\/\d+$/.test(pathname)) {
    return "/manager/training";
  }
  if (/^\/manager\/sites\/\d+$/.test(pathname)) {
    return role === "admin" ? "/admin/sites" : "/manager/training";
  }
  return role === "admin" ? "/admin" : "/manager";
}

/** List pages for focus-dashboard shortcut buttons. */
export function focusDashboardSitesHref(role: string) {
  return role === "admin" ? "/admin/sites" : "/manager/training";
}

export function focusDashboardGuardsHref(role: string) {
  return role === "admin" ? "/admin/users?role=guard" : "/manager/training";
}
