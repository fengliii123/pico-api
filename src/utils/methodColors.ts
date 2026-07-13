// Shared HTTP-method → color map used by MethodDropdown, collection tree,
// and history badges so method colors stay consistent across the UI.
export const METHOD_COLORS: Record<string, string> = {
  GET: '#52c41a',     // green
  POST: '#fa8c16',    // orange
  PUT: '#1890ff',     // blue
  PATCH: '#722ed1',   // purple
  DELETE: '#f5222d',  // red
  HEAD: '#8c8c8c',
  OPTIONS: '#8c8c8c'
}

export function methodColor(m: string | undefined): string {
  return (m && METHOD_COLORS[m.toUpperCase()]) ?? '#8c8c8c'
}
