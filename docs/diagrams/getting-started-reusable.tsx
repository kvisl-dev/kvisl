import {
  Diagram,
  Line,
  Node,
  Port,
  Row,
  Scope,
  Text,
  port,
  type PortHandle,
} from "@kvisl/core";

type Request = { path: string };

type ServiceProps = {
  id: string;
  request: PortHandle<Request>;
};

function Service({ id, request }: ServiceProps) {
  return (
    <Scope id={id} role="service">
      <Node id="api">
        <Text>Checkout service</Text>
        <Port id="request" side="left" bind={request} />
      </Node>
    </Scope>
  );
}

const checkoutRequest = port<Request>();

export default (
  <Diagram id="checkout" theme="excalidraw-handdrawn">
    <Row id="system" gap="large">
      <Node id="client">
        <Text>Client</Text>
        <Port id="request" side="right" />
      </Node>

      <Service id="checkout-service" request={checkoutRequest} />
    </Row>

    <Line
      from="system/client.request"
      to={checkoutRequest}
      label="POST /checkout"
    />
  </Diagram>
);
