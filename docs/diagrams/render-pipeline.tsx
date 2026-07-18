import {
  Column,
  Diagram,
  Line,
  Node,
  Port,
  Row,
  Scope,
  Subtitle,
  Text,
  Title,
  cls,
  rule,
} from "@kvisl/core";

const styles = [
  rule(cls("source"), { fill: "#ede9fe", stroke: "#7c3aed" }),
  rule(cls("ir"), { fill: "#e0f2fe", stroke: "#0284c7" }),
  rule(cls("output"), { fill: "#dcfce7", stroke: "#16a34a" }),
];

function Stage({ id, label, className }: { id: string; label: string; className: string }) {
  return (
    <Node id={id} className={className}>
      <Text>{label}</Text>
      <Port id="in" side="left" />
      <Port id="out" side="right" />
    </Node>
  );
}

export default (
  <Diagram id="render-pipeline" theme="excalidraw-handdrawn" styles={styles}>
    <Title>One evaluated model, renderer-neutral stages</Title>
    <Subtitle>Semantic identity survives selection, solving, and every painter.</Subtitle>

    <Row id="pipeline" gap="large" align="center">
      <Stage id="tsx" label="TSX + components" className="source" />
      <Stage id="logical" label="Logical IR" className="ir" />
      <Stage id="projection" label="Projection IR" className="ir" />
      <Stage id="solved" label="Solved IR" className="ir" />
      <Scope id="painters" label="painters" layout={{ kind: "column", gap: "small" }}>
        <Column id="outputs" gap="small">
          {[
            ["excalidraw", "Excalidraw"],
            ["svg", "SVG"],
            ["canvas", "Canvas"],
          ].map(([id, label]) => (
            <Node key={id} id={id} className="output">
              <Text>{label}</Text>
              <Port id="in" side="left" />
            </Node>
          ))}
        </Column>
      </Scope>
    </Row>

    <Line from="pipeline/tsx.out" to="pipeline/logical.in" label="normalize" />
    <Line from="pipeline/logical.out" to="pipeline/projection.in" label="materialize" />
    <Line from="pipeline/projection.out" to="pipeline/solved.in" label="layout + route" />
    <Line from="pipeline/solved.out" to="pipeline/painters/outputs/excalidraw.in" />
    <Line from="pipeline/solved.out" to="pipeline/painters/outputs/svg.in" />
    <Line from="pipeline/solved.out" to="pipeline/painters/outputs/canvas.in" />
  </Diagram>
);
