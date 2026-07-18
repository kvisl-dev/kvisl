import {
  Diagram,
  Line,
  Node,
  Port,
  Row,
  Scope,
  Subtitle,
  Text,
  Title,
} from "@kvisl/core";

function Pipeline({ id, orientation }: { id: string; orientation: 0 | 90 | 180 | 270 }) {
  return (
    <Scope id={id} label={`${orientation}° layout orientation`}>
      <Row id="flow" gap="large" align="center" orientation={orientation}>
        {[
          ["parse", "parse"],
          ["validate", "validate"],
          ["store", "store"],
        ].map(([nodeId, label]) => (
          <Node key={nodeId} id={nodeId}>
            <Text>{label}</Text>
            <Port id="in" side="left" />
            <Port id="out" side="right" />
          </Node>
        ))}
      </Row>
      <Line from="flow/parse.out" to="flow/validate.in" />
      <Line from="flow/validate.out" to="flow/store.in" />
    </Scope>
  );
}

export default (
  <Diagram id="orientation" theme="excalidraw-handdrawn">
    <Title>Direction is local to every container</Title>
    <Subtitle>The same wide boxes flow horizontally or vertically; their geometry stays upright.</Subtitle>
    <Row id="instances" gap="xlarge" align="start">
      <Pipeline id="horizontal" orientation={0} />
      <Pipeline id="vertical" orientation={90} />
    </Row>
  </Diagram>
);
