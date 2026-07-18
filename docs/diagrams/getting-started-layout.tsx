import {
  Diagram,
  Grid,
  Node,
  Port,
  Row,
  Scope,
  Text,
  port,
} from "@kvisl/core";

function Service({ id, request }: { id: string; request: ReturnType<typeof port> }) {
  return (
    <Scope id={id} role="service">
      <Node id="api">
        <Text>{id}</Text>
        <Port id="request" side="top" bind={request} />
      </Node>
    </Scope>
  );
}

const catalogRequest = port();
const ordersRequest = port();
const paymentsRequest = port();

export default (
  <Diagram id="nested-layout" theme="excalidraw-handdrawn">
    <Scope id="platform" label="platform" layout={{ kind: "column", gap: "large" }}>
      <Row id="edge" gap="medium" align="center">
        <Node id="gateway">Gateway</Node>
        <Node id="auth">Auth</Node>
      </Row>

      <Grid id="services" columns={3} gap="large" order="prefer-source">
        <Service id="catalog" request={catalogRequest} />
        <Service id="orders" request={ordersRequest} />
        <Service id="payments" request={paymentsRequest} />
      </Grid>
    </Scope>
  </Diagram>
);
