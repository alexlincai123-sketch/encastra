/**
 * Turns a real component manifest into the shape `GraphNode`/`GraphFlow` render.
 *
 * Several pages build a diagram out of the actual component set (`components.data.ts`) rather
 * than describing one in prose. This is the one place that conversion happens, so every diagram
 * on the site agrees about what a given component's ports and permission look like.
 */

import type { GraphNodeSpec, GraphPort } from '@/components/graph/Graph';
import { COMPONENTS } from '@/lib/components.data';
import type { ComponentRecord, PortRecord } from '@/lib/components.types';

/** Throws rather than returning `undefined` — a page that names a wrong id is a bug to catch. */
export function findComponent(id: string): ComponentRecord {
  const found = COMPONENTS.find((c) => c.id === id);
  if (found === undefined) {
    throw new Error(`no component manifest for "${id}"`);
  }
  return found;
}

export function toGraphPort(port: PortRecord): GraphPort {
  return {
    label: port.label,
    type: port.type,
    ...(port.required !== undefined ? { required: port.required } : {}),
  };
}

/**
 * Only the first declared capability is shown as the node's permission chip. Every first-party
 * component in this build declares at most one ([SECURITY](../../../../docs/SECURITY.md) §7),
 * so this is not a simplification today — it is a place to revisit if that ever changes.
 */
export function toNodeSpec(component: ComponentRecord): GraphNodeSpec {
  const permission = component.capabilities[0]?.kind;
  return {
    id: component.id,
    name: component.name,
    note: component.description,
    inputs: component.inputs.map(toGraphPort),
    outputs: component.outputs.map(toGraphPort),
    ...(permission !== undefined ? { permission } : {}),
  };
}

export function componentNode(id: string): GraphNodeSpec {
  return toNodeSpec(findComponent(id));
}
