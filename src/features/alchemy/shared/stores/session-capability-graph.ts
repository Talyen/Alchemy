import type { GameSession } from "./game-session-types";
import { sessionRuntime } from "./session-runtime";

type CapabilityNode = object;
const capabilityOwners = new WeakMap<CapabilityNode, GameSession>();

function isNode(value: unknown): value is CapabilityNode {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function capabilityProperties(node: CapabilityNode): Array<[PropertyKey, PropertyDescriptor]> {
  const prototype = Object.getPrototypeOf(node) as object | null;
  if (Array.isArray(node) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
    throw new Error("Session capabilities must be plain records, arrays, or methods");
  return Reflect.ownKeys(node).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(node, key)!;
    // Invoking a getter during validation could perform gameplay, or supply a
    // different method at use time. Capability composition accepts data slots only.
    if (!("value" in descriptor)) throw new Error("Session capabilities cannot contain accessor properties");
    return [key, descriptor];
  });
}

/** Validate the entire composition before exposing any bound operation. */
export function assertSessionOwnership(gameSession: GameSession, ...capabilities: object[]): void {
  sessionRuntime(gameSession);
  const visited = new WeakSet<CapabilityNode>();
  const visit = (node: CapabilityNode) => {
    if (visited.has(node)) return;
    visited.add(node);
    const owner = capabilityOwners.get(node);
    if (owner && owner !== gameSession) throw new Error("Cannot compose capabilities from different game sessions");
    // Methods are execution leaves. Their closures are bound by their factory;
    // only record/array properties compose further capability groups.
    if (typeof node === "function") return;
    for (const [, descriptor] of capabilityProperties(node)) {
      const value: unknown = descriptor.value;
      if (isNode(value)) visit(value);
    }
  };
  for (const capability of capabilities) visit(capability);
}

/** Immutable detached groups preserve ownership through nesting and extraction. */
export function bindSessionCapabilities<T extends object>(gameSession: GameSession, capabilities: T): T {
  assertSessionOwnership(gameSession, capabilities);
  const boundNodes = new WeakMap<CapabilityNode, CapabilityNode>();
  const bind = (node: CapabilityNode): CapabilityNode => {
    // Already-bound groups are immutable, and their methods already check lifetime.
    if (capabilityOwners.get(node) === gameSession) return node;
    const cached = boundNodes.get(node);
    if (cached) return cached;
    if (typeof node === "function") {
      const method = node as (...args: unknown[]) => unknown;
      const wrapped = (...args: unknown[]) => {
        sessionRuntime(gameSession);
        return method(...args);
      };
      boundNodes.set(node, wrapped);
      capabilityOwners.set(wrapped, gameSession);
      return Object.freeze(wrapped);
    }
    const bound: object = Array.isArray(node)
      ? new Array(node.length)
      : (Object.create(Object.getPrototypeOf(node) as object | null) as object);
    boundNodes.set(node, bound);
    capabilityOwners.set(bound, gameSession);
    for (const [key, descriptor] of capabilityProperties(node)) {
      if (Array.isArray(node) && key === "length") continue;
      const value: unknown = descriptor.value;
      Object.defineProperty(bound, key, {
        value: isNode(value) ? bind(value) : value,
        enumerable: descriptor.enumerable ?? false,
        configurable: true,
        writable: true,
      });
    }
    return Object.freeze(bound);
  };
  return bind(capabilities) as T;
}
