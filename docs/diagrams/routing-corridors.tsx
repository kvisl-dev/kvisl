import {
  Corridor,
  Diagram,
  Line,
  Node,
  Port,
  Row,
  Scope,
  Segment,
  Subtitle,
  Text,
  Title,
  cls,
  gap,
  rule,
} from "@kvisl/core";

const styles = [
  rule(cls("placement"), { stroke: "#f97316" }),
  rule(cls("request"), { stroke: "#7c3aed" }),
];

export default (
  <Diagram id="routing-corridors" theme="excalidraw-handdrawn" styles={styles}>
    <Title>Whitespace is the routing plane</Title>
    <Subtitle>Two named buses refine one implicit gap; tracks reserve the room they need.</Subtitle>

    <Scope id="system" label="system" layout={{ kind: "column", gap: "xlarge" }}>
      <Scope id="control-plane" label="control plane" layout={{ kind: "row", gap: "xlarge" }}>
        <Node id="scheduler">
          <Text>scheduler</Text>
          <Port
            id="placement"
            side="bottom"
            cardinality="many"
            sharing={{ mode: "merge", branch: { preference: "late" } }}
          />
        </Node>
        <Node id="gateway">
          <Text>gateway</Text>
          <Port
            id="requests"
            side="bottom"
            cardinality="many"
            sharing={{ mode: "merge", branch: { preference: "late" } }}
          />
        </Node>
      </Scope>

      <Scope id="fleet" label="fleet" layout={{ kind: "row", gap: "large" }}>
        {[
          ["cluster-a", "cluster A"],
          ["cluster-b", "cluster B"],
          ["external", "external endpoint"],
        ].map(([id, label]) => (
          <Node key={id} id={id}>
            <Text>{label}</Text>
            <Port id="placement" side="top" />
            <Port id="request" side="top" />
          </Node>
        ))}
      </Scope>
    </Scope>

    <Corridor id="placement-bus" in={gap("system/control-plane", "system/fleet")} pressure={0.9} />
    <Corridor
      id="request-bus"
      in={gap("system/control-plane", "system/fleet")}
      pressure={0.9}
      divider={{
        label: "ordered corridor refinements",
        labelPlacement: "end",
        style: { stroke: "#64748b", dash: "dashed" },
      }}
    />

    {[
      ["cluster-a", "system/fleet/cluster-a.placement"],
      ["cluster-b", "system/fleet/cluster-b.placement"],
    ].map(([id, target]) => (
      <Line
        key={id}
        id={`placement-${id}`}
        className="placement"
        from="system/control-plane/scheduler.placement"
        to={target}
      >
        <Segment through="placement-bus" label={id === "cluster-a" ? "placement" : undefined} />
      </Line>
    ))}

    {[
      ["cluster-a", "system/fleet/cluster-a.request"],
      ["cluster-b", "system/fleet/cluster-b.request"],
      ["external", "system/fleet/external.request"],
    ].map(([id, target]) => (
      <Line
        key={id}
        id={`request-${id}`}
        className="request"
        from="system/control-plane/gateway.requests"
        to={target}
      >
        <Segment through="request-bus" label={id === "external" ? "request routing" : undefined} />
      </Line>
    ))}
  </Diagram>
);
