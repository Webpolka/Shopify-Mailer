import { Liquid } from "liquidjs";
import { FLOW_VARIABLES } from "./variables";

export { FLOW_VARIABLES };

const liquid = new Liquid({
  strict: false,
  strictFilters: false,
  ownPropertyOnly: false,
});

export async function renderLiquid(
  template: string,
  variables: Record<string, unknown>
): Promise<string> {
  try {
    return await liquid.parseAndRender(template, variables);
  } catch (err) {
    const error = err as Error;
    console.error("Liquid render error:", error.message);
    return template;
  }
}