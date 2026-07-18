import {
  Column,
  Diagram,
  Line,
  Node,
  Port,
  Row,
  Scope,
  Text,
} from "@kvisl/core";

type SharingMode = "merge" | "bundle" | "auto";

type SharingCaseProps = {
  id: string;
  mode: SharingMode;
  mixedStyles?: boolean;
  styleCohorts?: boolean;
};

function SharingCase({ id, mode, mixedStyles = false, styleCohorts = false }: SharingCaseProps) {
  const lineStyles = styleCohorts
    ? [
        { stroke: "#1971c2", strokeWidth: 2, dash: "solid" as const },
        { stroke: "#1971c2", strokeWidth: 2, dash: "solid" as const },
        { stroke: "#e8590c", strokeWidth: 3, dash: "dashed" as const },
      ]
    : mixedStyles
    ? [
        { stroke: "#e03131", strokeWidth: 3, dash: "solid" as const },
        { stroke: "#1971c2", strokeWidth: 2, dash: "dashed" as const },
        { stroke: "#2f9e44", strokeWidth: 4, dash: "dotted" as const },
      ]
    : [{ stroke: "#5f3dc4" }, { stroke: "#5f3dc4" }, { stroke: "#5f3dc4" }];

  return (
    <Scope id={id} label={id} layout={{ kind: "row", gap: "xlarge", align: "center" }}>
      <Node id="hub" style={{ minWidth: 120, minHeight: 160 }}>
        <Text>shared named port</Text>
        <Port
          id="shared"
          side="right"
          cardinality="many"
          minSpacing={20}
          sharing={{ mode, branch: { preference: "late" } }}
        />
      </Node>

      <Column id="targets" gap="xlarge">
        {lineStyles.map((_, index) => (
          <Node key={index} id={`target-${index + 1}`} style={{ minWidth: 120 }}>
            <Text>{`target ${index + 1}`}</Text>
            <Port id="in" side="left" />
          </Node>
        ))}
      </Column>

      {lineStyles.map((style, index) => (
        <Line
          key={index}
          id={`line-${index + 1}`}
          from="hub.shared"
          to={`targets/target-${index + 1}.in`}
          heads="both"
          style={style}
        />
      ))}
    </Scope>
  );
}

export default (
  <Diagram id="named-port-sharing" layout={{ kind: "column", gap: "xlarge" }}>
    <Row id="compatible-cases" gap="xlarge" align="start">
      <SharingCase id="merge-compatible" mode="merge" />
      <SharingCase id="bundle-compatible" mode="bundle" />
    </Row>
    <Row id="mixed-style-cases" gap="xlarge" align="start">
      <SharingCase id="auto-mixed" mode="auto" mixedStyles />
      <SharingCase id="merge-mixed" mode="merge" mixedStyles />
    </Row>
    <Row id="style-cohort-cases" gap="xlarge" align="start">
      <SharingCase id="auto-cohorts" mode="auto" styleCohorts />
    </Row>
  </Diagram>
);
