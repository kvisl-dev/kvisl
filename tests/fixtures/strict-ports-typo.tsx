// Negative fixture: inside a strictPorts container, an endpoint naming an
// undeclared port must be a diagnostic instead of a silent implicit port.

import { Diagram, Line, Node, Port, Scope } from "@kvisl/core";

export default (
  <Diagram id="strict-ports-typo">
    <Scope id="service" strictPorts layout={{ kind: "row" }}>
      <Node id="api" label="API">
        <Port id="request" side="left" />
      </Node>
      <Node id="db" label="DB">
        <Port id="query" side="left" />
      </Node>
      <Line from="api.reqest" to="db.query" />
    </Scope>
  </Diagram>
);
