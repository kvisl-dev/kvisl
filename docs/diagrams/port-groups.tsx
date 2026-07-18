import {
  Column,
  Diagram,
  Grid,
  Line,
  Node,
  Port,
  PortGroup,
  Row,
  Scope,
  Subtitle,
  Text,
  Title,
} from "@kvisl/core";

function AffinityCase({
  id,
  affinity,
}: {
  id: string;
  affinity: "merge" | "bundle" | "free" | "separate";
}) {
  return (
    <Scope id={id} label={`${affinity} affinity`} layout={{ kind: "column", gap: "medium" }}>
      <Row id="flow" gap="xlarge" align="center">
        <Node id="service">
          <Text>service</Text>
          <PortGroup id="operations" affinity={affinity}>
            <Port id="read" side="right" />
            <Port id="write" side="right" />
            <Port id="watch" side="right" />
          </PortGroup>
        </Node>
        <Column id="clients" gap="small">
          {["read", "write", "watch"].map((operation) => (
            <Node key={operation} id={operation}>
              <Text>{operation}</Text>
              <Port id="call" side="left" />
            </Node>
          ))}
        </Column>
      </Row>

      {["read", "write", "watch"].map((operation) => (
        <Line
          key={operation}
          from={`flow/service.${operation}`}
          to={`flow/clients/${operation}.call`}
        />
      ))}
    </Scope>
  );
}

export default (
  <Diagram id="port-groups" theme="excalidraw-handdrawn">
    <Title>PortGroups coordinate distinct attachment identities</Title>
    <Subtitle>The port IDs stay canonical; affinity changes only their route relationship.</Subtitle>
    <Grid id="affinities" columns={2} gap="large">
      <AffinityCase id="merge" affinity="merge" />
      <AffinityCase id="bundle" affinity="bundle" />
      <AffinityCase id="free" affinity="free" />
      <AffinityCase id="separate" affinity="separate" />
    </Grid>
  </Diagram>
);
