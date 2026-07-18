import {
  Diagram,
  Grid,
  Line,
  Node,
  Port,
  PortPlacement,
  Row,
  Scope,
  Subtitle,
  Text,
  Title,
  View,
  context,
  gte,
} from "@kvisl/core";

function Service() {
  return (
    <Scope id="service" label="service" layout={{ kind: "column", gap: "medium" }}>
      <Port id="request" side="left" />

      <View
        id="internals"
        detail={2}
        requires={gte(context("allocation.inlineSize"), 120)}
        footprint={{ minWidth: 120, minHeight: 80 }}
      >
        <Grid id="internals" columns={2} gap="medium">
          <Node id="gateway">
            <Text>gateway</Text>
          </Node>
          <Node id="workers">
            <Text>workers</Text>
          </Node>
          <Node id="cache">
            <Text>cache</Text>
          </Node>
          <Node id="database">
            <Text>database</Text>
          </Node>
        </Grid>
        <PortPlacement port="request" on="internals/gateway" side="left" />
      </View>

      <View id="summary" detail={0} footprint={{ minWidth: 40, minHeight: 24 }}>
        <Node id="summary">
          <Text>Service</Text>
        </Node>
        <PortPlacement port="request" on="summary" side="left" />
      </View>
    </Scope>
  );
}

export default (
  <Diagram id="adaptive-service" theme="excalidraw-handdrawn">
    <Title>One component, renderer-selected detail</Title>
    <Subtitle>The component identity and public port survive either materialized view.</Subtitle>
    <Row id="system" gap="xlarge" align="center">
      <Node id="client">
        <Text>client</Text>
        <Port id="request" side="right" />
      </Node>
      <Service />
    </Row>
    <Line from="system/client.request" to="system/service.request" label="request" />
  </Diagram>
);
