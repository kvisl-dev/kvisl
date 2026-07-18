import {
  Diagram,
  Line,
  Node,
  Port,
  Row,
  Segment,
  Text,
  gap,
  port,
} from "@kvisl/core";

const clientRequest = port();
const ordersRequest = port();

export default (
  <Diagram id="pinned-route" theme="excalidraw-handdrawn">
    <Row id="system" gap="xlarge">
      <Node id="client">
        <Text>Client</Text>
        <Port id="request" side="right" bind={clientRequest} />
      </Node>
      <Node id="orders">
        <Text>Orders</Text>
        <Port id="request" side="left" bind={ordersRequest} />
      </Node>
    </Row>

    <Line from={clientRequest} to={ordersRequest}>
      <Segment
        through={gap("system/client", "system/orders")}
        label="validated request"
      />
    </Line>
  </Diagram>
);
