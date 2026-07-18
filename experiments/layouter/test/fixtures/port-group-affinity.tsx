import {
  Column,
  Diagram,
  Line,
  Node,
  Port,
  PortGroup,
  Row,
  Scope,
  Text,
} from "@kvisl/core";

type Affinity = "merge" | "bundle" | "free" | "separate";

function AffinityCase({ affinity }: { affinity: Affinity }) {
  return (
    <Scope
      id={affinity}
      label={affinity}
      layout={{ kind: "row", gap: "xlarge", align: "center" }}
    >
      <Node id="hub" style={{ minWidth: 140, minHeight: 190 }}>
        <Text>{`${affinity} ports`}</Text>
        <PortGroup
          id="requests"
          affinity={affinity}
          order="fixed"
          branch={{ preference: "late" }}
        >
          <Port id="request-a" side="right" minSpacing={28} />
          <Port id="request-b" side="right" minSpacing={28} />
          <Port id="request-c" side="right" minSpacing={28} />
        </PortGroup>
      </Node>

      <Column id="sources" gap="xlarge">
        {["a", "b", "c"].map((suffix) => (
          <Node key={suffix} id={`source-${suffix}`} style={{ minWidth: 120 }}>
            <Text>{`source ${suffix}`}</Text>
            <Port id="out" side="left" />
          </Node>
        ))}
      </Column>

      {["a", "b", "c"].map((suffix) => (
        <Line
          key={suffix}
          id={`line-${suffix}`}
          from={`sources/source-${suffix}.out`}
          to={`hub.request-${suffix}`}
        />
      ))}
    </Scope>
  );
}

export default (
  <Diagram id="port-group-affinity" layout={{ kind: "column", gap: "xlarge" }}>
    <Row id="cohesive" gap="xlarge" align="start">
      <AffinityCase affinity="merge" />
      <AffinityCase affinity="bundle" />
    </Row>
    <Row id="independent" gap="xlarge" align="start">
      <AffinityCase affinity="free" />
      <AffinityCase affinity="separate" />
    </Row>
  </Diagram>
);
