import {
  Diagram,
  Line,
  Node,
  Port,
  Row,
  Text,
  port,
} from "@kvisl/core";

const clientRequest = port();
const ordersRequest = port();

export default (
  <Diagram id="automatic-route" theme="excalidraw-handdrawn">
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

    <Line from={clientRequest} to={ordersRequest} />
  </Diagram>
);
