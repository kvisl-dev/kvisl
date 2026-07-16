// Pre-implementation UML component library. It demonstrates how UML notation
// composes from the Excalmermaid core; it is not a runtime implementation.

import {
  Line,
  Node,
  Port,
  Scope,
  Text,
} from "@excalmermaid/core";

type Child = unknown;
type Endpoint = string;
type Visibility = "+" | "-" | "#" | "~";
type Marker =
  | "none"
  | "circle"
  | "square"
  | "diamond"
  | { kind: "extension"; namespace: string; name: string };

export type UmlFeature = {
  visibility?: Visibility;
  text: string;
};

export type UmlSlot = {
  name: string;
  value: string;
};

type RelationKind =
  | "association"
  | "directed-association"
  | "aggregation"
  | "composition"
  | "generalization"
  | "realization"
  | "dependency"
  | "include"
  | "extend"
  | "transition"
  | "message"
  | "reply";

type RelationLabel = {
  text: string;
  placement: "start" | "center" | "end";
  role?: "name" | "role" | "multiplicity" | "guard" | "sequence";
};

const hollowTriangle = { kind: "extension", namespace: "uml", name: "hollow-triangle" } as const;
const hollowDiamond = { kind: "extension", namespace: "uml", name: "hollow-diamond" } as const;
const filledDiamond = { kind: "extension", namespace: "uml", name: "filled-diamond" } as const;

function featureText(feature: UmlFeature) {
  return `${feature.visibility ?? ""}${feature.visibility ? " " : ""}${feature.text}`;
}

export function UmlClass({
  id,
  name,
  stereotype,
  attributes = [],
  operations = [],
  abstract = false,
  ports = [],
}: {
  id: string;
  name: string;
  stereotype?: string;
  attributes?: readonly UmlFeature[];
  operations?: readonly UmlFeature[];
  abstract?: boolean;
  ports?: readonly { id: string; side?: "top" | "right" | "bottom" | "left" }[];
}) {
  return (
    <Node
      id={id}
      role="uml-class"
      shape="rectangle"
      className={abstract ? "abstract" : undefined}
    >
      {stereotype ? <Text role="uml-stereotype">{`«${stereotype}»`}</Text> : null}
      <Text role="uml-class-name">{name}</Text>
      <Text role="uml-compartment-divider" />
      {attributes.map((attribute) => (
        <Text key={attribute.text} role="uml-attribute">{featureText(attribute)}</Text>
      ))}
      <Text role="uml-compartment-divider" />
      {operations.map((operation) => (
        <Text key={operation.text} role="uml-operation">{featureText(operation)}</Text>
      ))}
      {ports.map((port) => <Port key={port.id} id={port.id} side={port.side ?? "right"} />)}
    </Node>
  );
}

export function UmlObject({
  id,
  name,
  classifier,
  slots = [],
}: {
  id: string;
  name: string;
  classifier: string;
  slots?: readonly UmlSlot[];
}) {
  return (
    <Node id={id} role="uml-object" shape="rectangle">
      <Text role="uml-instance-name">{`${name}: ${classifier}`}</Text>
      <Text role="uml-compartment-divider" />
      {slots.map((slot) => (
        <Text key={slot.name} role="uml-slot">{`${slot.name} = ${slot.value}`}</Text>
      ))}
    </Node>
  );
}

export function UmlComponent({
  id,
  name,
  stereotype,
  ports = [],
}: {
  id: string;
  name: string;
  stereotype?: string;
  ports?: readonly {
    id: string;
    side: "top" | "right" | "bottom" | "left";
    marker?: Marker;
  }[];
}) {
  return (
    <Node id={id} role="uml-component" shape="uml:component">
      {stereotype ? <Text role="uml-stereotype">{`«${stereotype}»`}</Text> : null}
      <Text>{name}</Text>
      {ports.map((port) => <Port key={port.id} id={port.id} side={port.side} marker={port.marker ?? "square"} />)}
    </Node>
  );
}

export function UmlArtifact({ id, name }: { id: string; name: string }) {
  return (
    <Node id={id} role="uml-artifact" shape="uml:artifact">
      <Text role="uml-stereotype">«artifact»</Text>
      <Text>{name}</Text>
    </Node>
  );
}

export function UmlPackage({
  id,
  name,
  children,
}: {
  id: string;
  name: string;
  children?: Child;
}) {
  return (
    <Scope id={id} role="uml-package" label={name} shape="uml:package">
      {children}
    </Scope>
  );
}

export function UmlDeploymentNode({
  id,
  name,
  stereotype = "node",
  children,
}: {
  id: string;
  name: string;
  stereotype?: "device" | "executionEnvironment" | "node";
  children?: Child;
}) {
  return (
    <Scope id={id} role="uml-deployment-node" label={`«${stereotype}» ${name}`} shape="uml:node-3d">
      {children}
    </Scope>
  );
}

export function UmlActor({ id, name }: { id: string; name: string }) {
  return (
    <Node id={id} role="uml-actor" shape="uml:actor">
      <Text>{name}</Text>
    </Node>
  );
}

export function UmlUseCase({ id, name }: { id: string; name: string }) {
  return (
    <Node id={id} role="uml-use-case" shape="ellipse">
      <Text>{name}</Text>
    </Node>
  );
}

export function UmlState({
  id,
  name,
  entry,
  doActivity,
  exit,
  children,
}: {
  id: string;
  name: string;
  entry?: string;
  doActivity?: string;
  exit?: string;
  children?: Child;
}) {
  return (
    <Scope id={id} role="uml-state" label={name} shape="rounded-rectangle">
      {entry ? <Text role="uml-state-behavior">{`entry / ${entry}`}</Text> : null}
      {doActivity ? <Text role="uml-state-behavior">{`do / ${doActivity}`}</Text> : null}
      {exit ? <Text role="uml-state-behavior">{`exit / ${exit}`}</Text> : null}
      {children}
    </Scope>
  );
}

export function UmlPseudostate({
  id,
  kind,
}: {
  id: string;
  kind: "initial" | "final" | "choice" | "junction" | "history" | "deep-history" | "fork" | "join";
}) {
  return <Node id={id} role={`uml-${kind}`} shape={`uml:${kind}`} />;
}

export function UmlAction({ id, name }: { id: string; name: string }) {
  return (
    <Node id={id} role="uml-action" shape="rounded-rectangle">
      <Text>{name}</Text>
    </Node>
  );
}

export function UmlActivityPartition({
  id,
  name,
  children,
}: {
  id: string;
  name: string;
  children?: Child;
}) {
  return (
    <Scope id={id} role="uml-activity-partition" label={name} layout={{ kind: "column" }}>
      {children}
    </Scope>
  );
}

export function UmlLifeline({
  id,
  name,
  events,
  activations = [],
}: {
  id: string;
  name: string;
  events: readonly string[];
  activations?: readonly { id: string; from: string; to: string }[];
}) {
  return (
    <Scope id={id} role="uml-lifeline" layout={{ kind: "column", order: "fixed" }}>
      <Node id="head" role="uml-lifeline-head" shape="rectangle">
        <Text role="uml-instance-name">{name}</Text>
      </Node>
      {events.map((event) => (
        <Node key={event} id={event} role="uml-occurrence" shape="uml:occurrence">
          <Port id="message" side="auto" />
        </Node>
      ))}
      <Node id="end" role="uml-lifeline-end" shape="uml:occurrence" />
      <Line
        id="lifeline"
        from="head"
        to="end"
        heads="none"
        space="overlay"
        style={{ dash: "dashed" }}
      />
      {activations.map((activation) => (
        <Line
          key={activation.id}
          id={activation.id}
          role="uml-activation"
          from={`${activation.from}.message`}
          to={`${activation.to}.message`}
          heads="none"
          space="overlay"
          style={{ width: 8 }}
        />
      ))}
    </Scope>
  );
}

export function UmlRelation({
  id,
  kind,
  from,
  to,
  name,
  fromRole,
  toRole,
  fromMultiplicity,
  toMultiplicity,
  guard,
  sequence,
}: {
  id: string;
  kind: RelationKind;
  from: Endpoint;
  to: Endpoint;
  name?: string;
  fromRole?: string;
  toRole?: string;
  fromMultiplicity?: string;
  toMultiplicity?: string;
  guard?: string;
  sequence?: string;
}) {
  const heads = (() => {
    switch (kind) {
      case "aggregation": return [hollowDiamond, "none"] as const;
      case "composition": return [filledDiamond, "none"] as const;
      case "generalization": return ["none", hollowTriangle] as const;
      case "realization": return ["none", hollowTriangle] as const;
      case "dependency":
      case "include":
      case "extend":
      case "transition":
      case "message":
      case "reply":
      case "directed-association": return ["none", "open-arrow"] as const;
      default: return ["none", "none"] as const;
    }
  })();

  const labels: RelationLabel[] = [];
  if (fromRole) labels.push({ text: fromRole, placement: "start", role: "role" });
  if (fromMultiplicity) labels.push({ text: fromMultiplicity, placement: "start", role: "multiplicity" });
  if (name) labels.push({ text: name, placement: "center", role: "name" });
  if (guard) labels.push({ text: `[${guard}]`, placement: "center", role: "guard" });
  if (sequence) labels.push({ text: sequence, placement: "start", role: "sequence" });
  if (toRole) labels.push({ text: toRole, placement: "end", role: "role" });
  if (toMultiplicity) labels.push({ text: toMultiplicity, placement: "end", role: "multiplicity" });

  return (
    <Line
      id={id}
      role={`uml-${kind}`}
      from={from}
      to={to}
      heads={heads}
      labels={labels}
      style={{ dash: ["dependency", "realization", "include", "extend", "reply"].includes(kind) ? "dashed" : "solid" }}
    />
  );
}
