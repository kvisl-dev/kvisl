import {
  Diagram,
  Line,
  Node,
  Port,
  Row,
  Text,
  Title,
} from "@kvisl/core";

export default (
  <Diagram id="hello-kvisl" theme="excalidraw-handdrawn">
    <Title>Checkout architecture</Title>

    <Row id="system" gap="large">
      <Node id="client">
        <Text>Client</Text>
        <Port id="request" side="right" />
      </Node>

      <Node id="service">
        <Text>Checkout service</Text>
        <Port id="request" side="left" />
      </Node>
    </Row>

    <Line
      id="checkout-request"
      from="system/client.request"
      to="system/service.request"
      label="POST /checkout"
    />
  </Diagram>
);
