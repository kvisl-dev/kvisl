import {
  Column,
  Diagram,
  Grid,
  Line,
  Node,
  Port,
  Row,
  Scope,
  Subtitle,
  Text,
  Title,
} from "@kvisl/core";

function SharingCase({
  id,
  mode,
  label = mode,
  mixedStyles = false,
}: {
  id: string;
  mode: "merge" | "bundle" | "separate" | "auto";
  label?: string;
  mixedStyles?: boolean;
}) {
  return (
    <Scope id={id} label={label} layout={{ kind: "column", gap: "medium" }}>
      <Row id="flow" gap="xlarge" align="center">
        <Column id="sources" gap="medium">
          {["A", "B", "C"].map((label) => (
            <Node key={label} id={label.toLowerCase()}>
              <Text>{label}</Text>
              <Port id="out" side="right" />
            </Node>
          ))}
        </Column>
        <Node id="sink">
          <Text>sink</Text>
          <Port
            id="events"
            side="left"
            cardinality="many"
            sharing={{ mode, branch: { preference: "late" } }}
          />
        </Node>
      </Row>

      {["a", "b", "c"].map((source, index) => (
        <Line
          key={source}
          from={`flow/sources/${source}.out`}
          to="flow/sink.events"
          style={mixedStyles
            ? index < 2
              ? { stroke: "#2563eb" }
              : { stroke: "#e8590c", dash: "dashed" }
            : undefined}
        />
      ))}
    </Scope>
  );
}

export default (
  <Diagram id="port-sharing" theme="excalidraw-handdrawn">
    <Title>One named port: policies and style cohorts</Title>
    <Subtitle>Identity creates the join; policy and resolved paint decide its visible lanes.</Subtitle>
    <Grid id="modes" columns={2} gap="large">
      <SharingCase id="merge" mode="merge" />
      <SharingCase id="bundle" mode="bundle" />
      <SharingCase id="separate" mode="separate" />
      <SharingCase id="style-cohorts" mode="auto" label="auto · two style cohorts" mixedStyles />
    </Grid>
  </Diagram>
);
