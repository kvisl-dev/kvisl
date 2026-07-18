const STRUCTURAL = new Set([
  "diagram",
  "scope",
  "node",
  "row",
  "column",
  "grid",
  "note",
  "title",
  "subtitle",
  "legend",
  "legend-item",
  "image",
]);

const LAYOUT_KIND = {
  diagram: "column",
  scope: "column",
  row: "row",
  column: "column",
  grid: "grid",
  legend: "column",
};

const DEFAULT_COLORS = {
  ink: "#172033",
  "muted-gray": "#7d8794",
  "status-gray": "#7d8794",
  "structural-gray": "#7d8794",
  "kernel-gray": "#4b5563",
  "decision-orange": "#ea7600",
  "reconcile-orange": "#f97316",
  "runtime-orange": "#f97316",
  "scheduler-orange": "#ea580c",
  "resource-yellow": "#e5a000",
  "composition-yellow": "#e5a000",
  "voice-blue": "#1674c8",
  "platform-blue": "#1683df",
  "kubernetes-blue": "#1683df",
  "state-blue": "#1674c8",
  "road-green": "#21a044",
  "request-green": "#079a72",
  "running-green": "#2a9d45",
  "ml-green": "#28b44b",
  "agent-purple": "#7048e8",
  "snapshot-purple": "#7048e8",
  "request-purple": "#7048e8",
  "join-purple": "#7048e8",
  "external-pink": "#ec4c86",
  "locality-cyan": "#0ea5b7",
  "sandbox-red": "#dc2626",
  "pale-blue": "#e5f2ff",
  "light-blue": "#cae5fb",
  "pale-green": "#e3f8e7",
  "pale-yellow": "#fff4c7",
  "pale-orange": "#fff0df",
  "warm-white": "#fff8ee",
  "pale-purple": "#f0eaff",
  "light-purple": "#e2d7ff",
  "near-white": "#f8fafc",
  white: "#ffffff",
};

function list(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value) {
  if (value == null || value === false || value === true) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join("");
  if (value.core === "text") return value.children.map(textOf).join("");
  return "";
}

function refText(value) {
  if (typeof value === "string") return value;
  if (value?.$$ref) return value.$$ref;
  return value == null ? "" : String(value);
}

function conditionValue(term, context) {
  if (term?.kind === "context") return context[term.key];
  if (term?.kind === "literal") return term.value;
  return term;
}

function conditionMatches(condition, context) {
  if (condition == null) return true;
  if (condition.kind === "literal") return Boolean(condition.value);
  if (condition.kind === "all") return condition.operands.every((item) => conditionMatches(item, context));
  if (condition.kind === "any") return condition.operands.some((item) => conditionMatches(item, context));
  if (condition.kind === "not") return !conditionMatches(condition.operand, context);
  if (condition.kind !== "compare") return false;
  const left = conditionValue(condition.left, context);
  const right = conditionValue(condition.right, context);
  switch (condition.operator) {
    case "eq": return left === right;
    case "ne": return left !== right;
    case "lt": return left < right;
    case "lte": return left <= right;
    case "gt": return left > right;
    case "gte": return left >= right;
    case "in": return Array.isArray(right) && right.includes(left);
    default: return false;
  }
}

function parsePlacement(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  const inside = value.startsWith("inside-");
  const raw = inside ? value.slice(7) : value;
  const pieces = raw.split("-");
  const side = pieces.find((part) => ["top", "right", "bottom", "left", "above", "below"].includes(part));
  const explicitAlign = pieces.find((part) => ["start", "center", "end"].includes(part));
  const normalizedSide = side === "above" ? "top" : side === "below" ? "bottom" : side;
  const crossPiece = pieces.find((part) => ["left", "right", "top", "bottom"].includes(part) && part !== normalizedSide);
  const align = explicitAlign ?? (crossPiece === "left" || crossPiece === "top" ? "start" : crossPiece === "right" || crossPiece === "bottom" ? "end" : "center");
  return { area: inside ? "inside" : "outside", side: normalizedSide ?? "auto", align };
}

function selectorMatches(selector, entity) {
  const step = selector?.steps?.at(-1);
  if (!step) return false;
  if (step.kind && step.kind !== entity.kind) return false;
  if (step.shape && step.shape !== entity.shape) return false;
  if (step.id && step.id !== entity.id) return false;
  if (step.roles?.some((role) => !entity.roles.includes(role))) return false;
  if (step.classes?.some((name) => !entity.classes.includes(name))) return false;
  return true;
}

function createPort(owner, props, origin = "explicit") {
  const side = props.side ?? "auto";
  return {
    id: props.id,
    owner,
    origin,
    side,
    allowedSides: side === "auto" ? ["top", "right", "bottom", "left"] : Array.isArray(side) ? side : [side],
    cardinality: props.cardinality ?? "many",
    sharing: props.sharing ?? { mode: "auto" },
    marker: props.marker ?? props.style?.marker ?? "none",
    style: props.style ?? {},
    group: null,
    anchorRef: null,
    anchor: null,
  };
}

function makePath(parent, id) {
  return parent?.path ? `${parent.path}/${id}` : id;
}

export function project(expanded, options = {}) {
  const context = {
    medium: options.medium ?? "screen",
    "allocation.inlineSize": options.inlineSize ?? 240,
    "allocation.blockSize": options.blockSize ?? 180,
  };
  const diagnostics = [];
  const objects = [];
  const lines = [];
  const corridors = [];
  const constraints = [];
  const refinements = [];
  const rules = [];
  const tokens = { ...DEFAULT_COLORS };
  let generatedId = 0;

  if (expanded?.core !== "diagram") {
    return {
      root: null,
      objects,
      lines,
      corridors,
      constraints,
      diagnostics: [{ severity: "error", code: "root", message: "expected one Diagram root" }],
    };
  }

  for (const item of list(expanded.props.styles)) {
    if (item?.$$tokens) Object.assign(tokens, item.$$tokens);
    if (item?.$$rule) rules.push(item);
  }

  function addPort(owner, props, origin = "explicit") {
    if (!props.id) return null;
    const previous = owner.ports.get(props.id);
    if (previous) {
      Object.assign(previous, Object.fromEntries(Object.entries(props).filter(([, value]) => value != null)));
      if (props.side != null) previous.allowedSides = props.side === "auto" ? ["top", "right", "bottom", "left"] : Array.isArray(props.side) ? props.side : [props.side];
      previous.origin = previous.origin === "implicit" ? "refined" : previous.origin;
      return previous;
    }
    const port = createPort(owner, props, origin);
    port.orderIndex = owner.portOrder.length;
    owner.ports.set(port.id, port);
    owner.portOrder.push(port.id);
    return port;
  }

  function selectedViewChildren(node, owner) {
    const views = node.children.filter((child) => child?.core === "view");
    if (!views.length) return node.children;
    let selected = null;
    for (const view of views) {
      const footprint = view.props.footprint ?? {};
      const fits = (footprint.minWidth ?? 0) <= context["allocation.inlineSize"]
        && (footprint.minHeight ?? 0) <= context["allocation.blockSize"];
      if (fits && conditionMatches(view.props.requires, context)) {
        selected = view;
        break;
      }
    }
    selected ??= views.at(-1);
    owner.selectedView = selected?.props.id ?? null;
    const ordinary = node.children.filter((child) => child?.core !== "view");
    const materialized = [];
    for (const child of selected?.children ?? []) {
      if (child?.core === "when") {
        if (conditionMatches(child.props.test, context)) materialized.push(...child.children);
      } else {
        materialized.push(child);
      }
    }
    return [...ordinary, ...materialized];
  }

  function parseContent(node, owner) {
    if (node.core === "text") {
      owner.content.push({ text: node.children.map(textOf).join(""), role: node.props.role ?? null });
      return;
    }
    if (node.core === "compartment") {
      owner.content.push({
        group: true,
        role: node.props.role ?? null,
        items: node.children.filter((child) => child?.core === "text").map((child) => textOf(child)),
      });
    }
  }

  function parseLine(node, scope) {
    const endNodes = node.children.filter((child) => child?.core === "end");
    let from = node.props.from;
    let to = node.props.to;
    let endLabels = [[], []];
    let heads = node.props.heads;
    if (endNodes.length) {
      if (endNodes.length !== 2) {
        diagnostics.push({ severity: "error", code: "line-ends", message: `line '${node.props.id ?? "?"}' needs two End children` });
        return;
      }
      from = endNodes[0].props.ref;
      to = endNodes[1].props.ref;
      endLabels = [list(endNodes[0].props.labels), list(endNodes[1].props.labels)];
      heads = [endNodes[0].props.head ?? "none", endNodes[1].props.head ?? "none"];
    }
    if (from == null || to == null) {
      diagnostics.push({ severity: "error", code: "line-endpoint", message: `line '${node.props.id ?? "?"}' has no endpoints` });
      return;
    }
    const segments = node.children
      .filter((child) => child?.core === "segment")
      .map((segment) => ({ ...segment.props }));
    lines.push({
      id: node.props.id ?? `$line-${lines.length + 1}`,
      order: lines.length,
      scope,
      fromRef: refText(from),
      toRef: refText(to),
      from: null,
      to: null,
      heads: heads ?? "forward",
      labels: list(node.props.labels),
      label: node.props.label,
      endLabels,
      segments,
      style: node.props.style ?? {},
      roles: list(node.props.role),
      classes: list(node.props.className),
      share: node.props.share ?? null,
      space: node.props.space ?? "reserve",
      avoid: list(node.props.avoid),
      route: [],
      routeLabels: [],
    });
  }

  function parseObject(node, parent) {
    const id = node.props.id ?? `$${node.core}-${++generatedId}`;
    const object = {
      id,
      path: makePath(parent, id),
      kind: node.core,
      parent,
      children: [],
      childById: new Map(),
      content: [],
      label: node.props.label ?? null,
      roles: list(node.props.role),
      classes: list(node.props.className),
      theme: node.props.theme ?? parent?.theme ?? null,
      orientation: node.props.orientation ?? 0,
      shape: node.props.shape ?? (node.core === "node" ? "rounded-rectangle" : null),
      source: node.props.source ?? null,
      alt: node.props.alt ?? null,
      aspectRatio: node.props.aspectRatio ?? null,
      layout: typeof node.props.layout === "object"
        ? { ...node.props.layout }
        : { kind: node.props.layout ?? LAYOUT_KIND[node.core] ?? (node.core === "scope" ? "column" : null) },
      order: node.props.order ?? node.props.layout?.order ?? "prefer-source",
      align: node.props.align ?? node.props.layout?.align ?? (node.core === "diagram" ? "start" : "center"),
      distribute: node.props.distribute ?? node.props.layout?.distribute ?? "start",
      columns: node.props.columns ?? node.props.layout?.columns ?? 1,
      inlineStyle: {
        ...(node.props.style ?? {}),
        ...(node.props.gap != null ? { gap: node.props.gap } : {}),
        ...(node.props.padding != null ? { padding: node.props.padding } : {}),
        ...(node.props.margin != null ? { margin: node.props.margin } : {}),
      },
      style: {},
      ports: new Map(),
      portOrder: [],
      portGroups: [],
      portPlacements: [],
      selectedView: null,
      anchorRef: node.props.anchor ?? null,
      anchor: null,
      placement: parsePlacement(node.props.placement),
      box: { x: 0, y: 0, width: 0, height: 0 },
      measured: { width: 0, height: 0 },
      reserved: { gaps: [], padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      visible: !["diagram", "row", "column", "grid"].includes(node.core),
    };
    objects.push(object);
    if (parent) {
      object.siblingIndex = parent.children.length;
      parent.children.push(object);
      parent.childById.set(object.id, object);
    }

    const children = selectedViewChildren(node, object);
    const textAsMembers = ["diagram", "row", "column", "grid"].includes(node.core);
    for (const child of children) {
      if (typeof child === "string" || typeof child === "number") {
        const value = String(child).trim();
        if (value) object.content.push({ text: value, role: null });
        continue;
      }
      if (!child?.core) continue;
      if (child.core === "text" || child.core === "compartment") {
        if (child.core === "text" && textAsMembers) {
          parseObject({ core: "node", props: { id: `$text-${++generatedId}`, role: child.props.role, style: { fill: "transparent", stroke: "transparent", color: "ink" } }, children: [child] }, object);
        } else {
          parseContent(child, object);
        }
        continue;
      }
      if (STRUCTURAL.has(child.core)) {
        parseObject(child, object);
        continue;
      }
      if (child.core === "port") {
        if (child.props.ref) refinements.push({ scope: object, props: child.props });
        else addPort(object, child.props);
        continue;
      }
      if (child.core === "port-group") {
        const group = {
          id: child.props.id ?? `$port-group-${object.portGroups.length + 1}`,
          affinity: child.props.affinity ?? "free",
          order: child.props.order ?? "prefer-source",
          members: [],
        };
        for (const member of child.children.filter((item) => item?.core === "port")) {
          const port = addPort(object, member.props);
          if (port) {
            port.group = group;
            group.members.push(port);
          }
        }
        object.portGroups.push(group);
        continue;
      }
      if (child.core === "port-placement") {
        object.portPlacements.push({ port: child.props.port, on: refText(child.props.on), side: child.props.side ?? "auto" });
        continue;
      }
      if (child.core === "line") {
        parseLine(child, object);
        continue;
      }
      if (child.core === "corridor") {
        corridors.push({ id: child.props.id, scope: object, region: child.props.in, ...child.props });
        continue;
      }
      if (child.core === "constraint") {
        constraints.push({ scope: object, ...child.props });
      }
    }
    return object;
  }

  const root = parseObject(expanded, null);
  root.path = "";
  for (const child of root.children) rebasePath(child, "");

  function rebasePath(object, parentPath) {
    object.path = parentPath ? `${parentPath}/${object.id}` : object.id;
    for (const child of object.children) rebasePath(child, object.path);
  }

  const objectByPath = new Map(objects.map((object) => [object.path, object]));

  function resolveObject(scope, reference) {
    const raw = refText(reference);
    if (raw === "diagram" || raw === "" || raw === "/") return root;
    const objectPart = raw.includes(".") ? raw.slice(0, raw.lastIndexOf(".")) : raw;
    const pieces = objectPart.split("/").filter(Boolean);
    let current = raw.startsWith("/") ? root : scope;
    for (const piece of pieces) {
      if (piece === ".") continue;
      if (piece === "..") {
        current = current?.parent;
      } else {
        current = current?.childById.get(piece);
      }
      if (!current) break;
    }
    if (!current && objectByPath.has(objectPart)) current = objectByPath.get(objectPart);
    return current ?? null;
  }

  function splitEndpoint(reference) {
    const raw = refText(reference);
    const slash = raw.lastIndexOf("/");
    const dot = raw.indexOf(".", slash + 1);
    if (dot < 0) return { objectRef: raw, portId: null };
    return { objectRef: `${raw.slice(0, dot)}`, portId: raw.slice(dot + 1) };
  }

  function resolveEndpoint(scope, reference, line, end) {
    const { objectRef, portId } = splitEndpoint(reference);
    const object = resolveObject(scope, objectRef);
    if (!object) {
      diagnostics.push({ severity: "error", code: "unresolved-endpoint", message: `cannot resolve '${reference}' for line '${line.id}'` });
      return null;
    }
    let port = null;
    if (portId) port = addPort(object, { id: portId }, "implicit");
    return { object, port, end, reference };
  }

  for (const refinement of refinements) {
    const { objectRef, portId } = splitEndpoint(refinement.props.ref);
    const owner = resolveObject(refinement.scope, objectRef);
    if (!owner || !portId) {
      diagnostics.push({ severity: "error", code: "unresolved-port-refinement", message: `cannot refine '${refText(refinement.props.ref)}'` });
      continue;
    }
    addPort(owner, { ...refinement.props, id: portId }, "refined");
  }

  for (const owner of objects) {
    for (const placement of owner.portPlacements) {
      const port = addPort(owner, { id: placement.port }, "implicit");
      port.anchorRef = placement.on;
      port.anchor = resolveObject(owner, placement.on);
      port.side = placement.side;
      port.allowedSides = placement.side === "auto" ? ["top", "right", "bottom", "left"] : [placement.side];
      if (!port.anchor) {
        diagnostics.push({ severity: "warning", code: "unresolved-port-placement", message: `cannot place '${owner.path}.${port.id}' on '${placement.on}'` });
      }
    }
  }

  for (const object of objects) {
    if (object.anchorRef != null) {
      object.anchor = resolveObject(object.parent ?? root, object.anchorRef);
      if (!object.anchor) diagnostics.push({ severity: "warning", code: "unresolved-anchor", message: `cannot resolve anchor '${object.anchorRef}'` });
    } else if (object.kind === "note" && object.placement) {
      object.anchor = object.parent;
    }
  }

  for (const corridor of corridors) {
    if (corridor.region?.$$region === "gap") {
      corridor.between = corridor.region.between.map((reference) => resolveObject(corridor.scope, reference));
    } else if (corridor.region?.$$region === "padding") {
      corridor.container = corridor.region.container?.$$self
        ? corridor.scope
        : resolveObject(corridor.scope, corridor.region.container);
      corridor.side = corridor.region.side;
    }
  }
  const corridorById = new Map(corridors.map((corridor) => [corridor.id, corridor]));

  for (const line of lines) {
    line.from = resolveEndpoint(line.scope, line.fromRef, line, 0);
    line.to = resolveEndpoint(line.scope, line.toRef, line, 1);
    for (const segment of line.segments) {
      if (segment.via != null) segment.waypoint = resolveObject(line.scope, segment.via);
      if (typeof segment.through === "string") {
        segment.corridor = corridorById.get(segment.through) ?? null;
      } else if (segment.through?.$$region === "gap") {
        segment.region = {
          kind: "gap",
          between: segment.through.between.map((reference) => resolveObject(line.scope, reference)),
        };
      } else if (segment.through?.$$region === "padding") {
        segment.region = {
          kind: "padding",
          container: segment.through.container?.$$self
            ? line.scope
            : resolveObject(line.scope, segment.through.container),
          side: segment.through.side,
        };
      }
    }
  }

  for (const constraint of constraints) {
    const one = (value) => value == null ? null : resolveObject(constraint.scope, value);
    constraint.itemObject = one(constraint.item);
    constraint.referenceObject = one(constraint.reference);
    constraint.containerObject = one(constraint.container);
    constraint.fromObject = one(constraint.from);
    constraint.toObject = one(constraint.to);
    constraint.memberObjects = list(constraint.members).map(one).filter(Boolean);
    if (constraint.kind === "inside" && constraint.containerObject) constraint.containerObject.frame = true;
  }

  for (const object of objects) {
    let style = {};
    for (const rule of rules) {
      if (selectorMatches(rule.selector, object) && conditionMatches(rule.condition, context)) style = { ...style, ...rule.declarations };
    }
    object.style = { ...style, ...object.inlineStyle };
  }
  for (const line of lines) {
    let style = {};
    for (const rule of rules) {
      if (selectorMatches(rule.selector, line) && conditionMatches(rule.condition, context)) style = { ...style, ...rule.declarations };
    }
    line.style = { ...style, ...line.style };
  }

  return {
    root,
    theme: root.theme,
    objects,
    objectByPath,
    lines,
    corridors,
    corridorById,
    constraints,
    tokens,
    context,
    diagnostics,
  };
}
