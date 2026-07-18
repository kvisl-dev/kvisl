import {
  Diagram,
  Line,
  Node,
  Port,
  Row,
  Text,
  cls,
  role,
  rule,
} from "@kvisl/core";

const styles = [
  rule(role("service"), {
    fill: "near-white",
    stroke: "platform-blue",
  }),
  rule(cls("request"), {
    stroke: "request-purple",
    strokeWidth: 2,
  }),
];

export default (
  <Diagram id="styled-service" theme="excalidraw-handdrawn" styles={styles}>
    <Row id="system" gap="xlarge">
      <Node id="client">
        <Text>Client</Text>
        <Port id="request" side="right" />
      </Node>
      <Node id="service" role="service">
        <Text>Checkout service</Text>
        <Port id="request" side="left" />
      </Node>
    </Row>
    <Line
      id="request"
      className="request"
      from="system/client.request"
      to="system/service.request"
    />
  </Diagram>
);
