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

function SharingCase({ id, mode }: { id: string; mode: "merge" | "bundle" | "separate" }) {
  return (
    <Scope id={id} label={mode} layout={{ kind: "column", gap: "medium" }}>
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

      {["a", "b", "c"].map((source) => (
        <Line key={source} from={`flow/sources/${source}.out`} to="flow/sink.events" />
      ))}
    </Scope>
  );
}

export default (
  <Diagram id="port-sharing" theme="excalidraw-handdrawn">
    <Title>One named port, three sharing policies</Title>
    <Subtitle>Identity creates the join; policy decides the adjacent geometry.</Subtitle>
    <Grid id="modes" columns={3} gap="large">
      <SharingCase id="merge" mode="merge" />
      <SharingCase id="bundle" mode="bundle" />
      <SharingCase id="separate" mode="separate" />
    </Grid>
  </Diagram>
);
