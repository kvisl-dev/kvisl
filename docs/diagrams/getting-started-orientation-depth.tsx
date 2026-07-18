import {
  Diagram,
  Node,
  Row,
  Scope,
  Text,
  Title,
} from "@kvisl/core";

function NestedFlow({
  id,
  label,
  orientation,
}: {
  id: string;
  label: string;
  orientation: 90 | { degrees: 90; depth: 2 | "all" };
}) {
  return (
    <Scope id={id} label={label} layout="row" orientation={orientation}>
      <Node id="edge"><Text>edge</Text></Node>
      <Row id="internals" gap="medium">
        <Node id="api"><Text>API</Text></Node>
        <Node id="worker"><Text>worker</Text></Node>
      </Row>
    </Scope>
  );
}

export default (
  <Diagram id="orientation-depth" theme="excalidraw-handdrawn">
    <Title>Orientation stops or cascades at frame boundaries</Title>
    <Row id="cases" gap="xlarge" align="start">
      <NestedFlow id="depth-1" label="depth 1" orientation={90} />
      <NestedFlow id="depth-2" label="depth 2" orientation={{ degrees: 90, depth: 2 }} />
      <NestedFlow id="all" label="all" orientation={{ degrees: 90, depth: "all" }} />
    </Row>
  </Diagram>
);
