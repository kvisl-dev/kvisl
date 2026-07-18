import {
  Diagram,
  Line,
  Node,
  Text,
} from "@kvisl/core";

export default (
  <Diagram id="private-dock" theme="excalidraw-handdrawn" layout="row" gap="xlarge">
    <Node id="client"><Text>Client</Text></Node>
    <Node id="service"><Text>Service</Text></Node>

    <Line from="client" to="service" />
  </Diagram>
);
