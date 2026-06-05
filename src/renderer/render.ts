import Mustache from "mustache";

// We generate code, paths, and markdown — never HTML. Disable escaping so
// characters like &, <, ", / pass through verbatim.
Mustache.escape = (text: string) => text;

export function render(template: string, view: Record<string, unknown>): string {
  return Mustache.render(template, view);
}
