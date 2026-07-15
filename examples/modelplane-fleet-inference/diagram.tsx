// Pre-implementation grammar fixture. This file specifies the intended
// authoring model and is not expected to compile until the core API exists.

import {
  Column,
  Corridor,
  Diagram,
  Grid,
  Legend,
  LegendItem,
  Line,
  Node,
  Note,
  Port,
  Row,
  Scope,
  Segment,
  Subtitle,
  Text,
  Title,
  gap,
} from "@excalmermaid/core";

const colors = {
  gray: "structural-gray",
  green: "ml-green",
  blue: "platform-blue",
  yellow: "composition-yellow",
  orange: "reconcile-orange",
  purple: "request-purple",
  pink: "external-pink",
  cyan: "locality-cyan",
};

type ClusterProps = {
  id: string;
  label: string;
  serving: readonly string[];
  replica: readonly string[];
  edge: readonly string[];
  withCache?: boolean;
  withObservedStatus?: boolean;
  withLocalityNote?: boolean;
};

function TextLines({ values }: { values: readonly string[] }) {
  return <>{values.map((value) => <Text key={value}>{value}</Text>)}</>;
}

function Cluster({
  id,
  label,
  serving,
  replica,
  edge,
  withCache,
  withObservedStatus,
  withLocalityNote,
}: ClusterProps) {
  return (
    <Scope
      id={id}
      label={label}
      role="serving-cluster"
      layout={{ kind: "column", gap: "medium" }}
      style={{ fill: "near-white", stroke: colors.gray }}
    >
      <Grid id="serving-grid" columns={2} gap="medium">
        <Node id="serving-stack" role="serving-stack" style={{ stroke: colors.blue }}>
          <TextLines values={serving} />
          <Port id="replica" side="right" />
        </Node>

        <Node id="model-replica" role="model-replica" style={{ stroke: colors.orange }}>
          <TextLines values={replica} />
          <Port id="stack" side="left" />
          <Port id="placement" side="top" />
          <Port id="edge" side="bottom" />
        </Node>

        {withCache ? (
          <Node id="model-cache" role="model-cache" style={{ stroke: colors.green }}>
            <Text>ModelCache</Text>
            <Text>Hugging Face →</Text>
            <Text>RWX PVC</Text>
            <Text>job + claim</Text>
            <Port id="replica" side="right" />
          </Node>
        ) : withObservedStatus ? (
          <Node id="observed-status" role="status" style={{ stroke: colors.gray }}>
            <Text>Observed status</Text>
            <Text>gpuPools / labels</Text>
            <Text>coarse capacity</Text>
          </Node>
        ) : null}

        <Node id="cluster-edge" role="cluster-edge" style={{ stroke: colors.purple }}>
          <TextLines values={edge} />
          <Port id="replica" side="top" />
          <Port id="request" side="right" />
        </Node>
      </Grid>

      {withLocalityNote ? (
        <Note id="locality" role="locality" style={{ stroke: colors.cyan }}>
          KV locality: keep prefill/decode inside one cluster
        </Note>
      ) : null}

      <Line
        id="stack-to-replica"
        from="serving-stack.replica"
        to="model-replica.stack"
        style={{ stroke: colors.orange }}
      />
      {withCache ? (
        <Line
          id="cache-to-replica"
          from="model-cache.replica"
          to="model-replica.stack"
          style={{ stroke: colors.green }}
        />
      ) : null}
      <Line
        id="replica-to-edge"
        from="model-replica.edge"
        to="cluster-edge.replica"
        style={{ stroke: colors.purple }}
      />
      {withLocalityNote ? (
        <Line
          id="edge-to-locality"
          from="cluster-edge"
          to="locality"
          style={{ stroke: colors.cyan }}
        />
      ) : null}
    </Scope>
  );
}

function ControlPlane() {
  return (
    <Scope
      id="control-plane"
      label="Modelplane control plane (Crossplane v2)"
      role="control-plane"
      layout={{ kind: "column", gap: "medium" }}
      style={{ fill: "near-white", stroke: colors.gray }}
    >
      <Row id="control-flow" align="center" gap="large">
        <Node id="ml-apis" role="ml-api" style={{ stroke: colors.green }}>
          <Text>ML APIs</Text>
          <Text>ModelDeployment</Text>
          <Text>ModelService</Text>
          <Port id="intent" side="top" />
          <Port id="platform" side="right" />
        </Node>
        <Node id="platform-apis" role="platform-api" style={{ stroke: colors.blue }}>
          <Text>Platform APIs</Text>
          <Text>InferenceGateway</Text>
          <Text>InferenceClass</Text>
          <Text>InferenceCluster</Text>
          <Text>ModelCache</Text>
          <Port id="team" side="top" />
          <Port id="ml" side="left" />
          <Port id="composition" side="right" />
        </Node>
        <Node id="composition" role="composition" style={{ stroke: colors.yellow }}>
          <Text>Composition functions</Text>
          <Text>expand XRs</Text>
          <Text>render cluster resources</Text>
          <Text>observe remote status</Text>
          <Port id="platform" side="left" />
          <Port id="scheduler" side="right" />
          <Port id="outputs" side="bottom" />
        </Node>
        <Node id="scheduler" role="fleet-scheduler" style={{ stroke: colors.orange }}>
          <Text>Fleet scheduler</Text>
          <Text>label selectors</Text>
          <Text>coarse node-capacity gate</Text>
          <Text>spread by replica count</Text>
          <Text>pin ModelReplica</Text>
          <Port id="composition" side="left" />
          <Port id="gateway" side="right" />
          <Port id="placement" side="bottom" cardinality="many" />
        </Node>
        <Node id="gateway" role="inference-gateway" style={{ stroke: colors.purple }}>
          <Text>InferenceGateway</Text>
          <Text>Traefik today</Text>
          <Text>ModelService URLs</Text>
          <Text>OpenAI-compatible</Text>
          <Text>edge</Text>
          <Port id="scheduler" side="left" />
          <Port id="client" side="top" />
          <Port id="requests" side="bottom" cardinality="many" />
        </Node>
      </Row>

      <Node id="reconcile-outputs" role="reconcile-output" style={{ stroke: colors.yellow }}>
        <Text>Reconcile outputs</Text>
        <Text>ModelDeployment → pinned ModelReplica + optional ModelEndpoint</Text>
        <Text>ModelService → equal-weight HTTPRoute fanout</Text>
        <Port id="composition" side="top" />
      </Node>

      <Line from="ml-apis.platform" to="platform-apis.ml" style={{ stroke: colors.orange }} />
      <Line from="platform-apis.composition" to="composition.platform" style={{ stroke: colors.orange }} />
      <Line from="composition.scheduler" to="scheduler.composition" style={{ stroke: colors.orange }} />
      <Line from="scheduler.gateway" to="gateway.scheduler" style={{ stroke: colors.orange }} />
      <Line from="composition.outputs" to="reconcile-outputs.composition" style={{ stroke: colors.orange }} />
    </Scope>
  );
}

export default (
  <Diagram id="modelplane-fleet-inference" theme="excalidraw-handdrawn">
    <Title>Modelplane fleet inference architecture</Title>
    <Subtitle>
      Orange shows control-plane reconciliation; purple shows runtime inference routing.
    </Subtitle>

    <Legend id="legend" anchor="diagram" placement="inside-top-right" layout="column">
      <LegendItem style={{ stroke: colors.orange }}>orange = reconcile / placement</LegendItem>
      <LegendItem style={{ stroke: colors.purple }}>purple = request path</LegendItem>
      <LegendItem style={{ stroke: colors.gray, dash: "dashed" }}>
        dashed = design / stub / status
      </LegendItem>
    </Legend>

    <Row id="actors" distribute="space-between" align="end">
      <Row id="teams" gap="large">
        <Node id="ml-team" role="external-actor" style={{ stroke: colors.green }}>
          <Text>ML team</Text>
          <Text>model + serving intent</Text>
          <Port id="control" side="bottom" />
        </Node>
        <Node id="platform-team" role="external-actor" style={{ stroke: colors.blue }}>
          <Text>Platform team</Text>
          <Text>cluster classes, gateways,</Text>
          <Text>cache</Text>
          <Port id="control" side="bottom" />
        </Node>
      </Row>
      <Node id="client" role="client" style={{ stroke: colors.purple }}>
        <Text>Client</Text>
        <Text>OpenAI-compatible</Text>
        <Text>API</Text>
        <Port id="request" side="bottom" />
      </Node>
    </Row>

    <ControlPlane />

    <Scope
      id="fleet"
      label="Inference fleet: per-cluster serving stacks and endpoint targets"
      role="inference-fleet"
      layout={{ kind: "row", align: "start", gap: "large" }}
      style={{ fill: "near-white", stroke: colors.gray }}
    >
      <Cluster
        id="cluster-a"
        label="Cluster A / region 1"
        serving={["ServingStack", "Envoy/GAIE", "Prometheus, NFD,", "DRA"]}
        replica={["ModelReplica", "Deployment or", "LeaderWorkerSet", "engine container + flags"]}
        edge={["Cluster edge routing", "HTTPRoute → Service", "P/D: InferencePool + EPP"]}
        withCache
        withLocalityNote
      />
      <Cluster
        id="cluster-b"
        label="Cluster B / region 2"
        serving={["ServingStack", "Envoy/GAIE", "DRA + LWS"]}
        replica={["ModelReplica", "placed copy", "GPU claim"]}
        edge={["Cluster edge routing", "Gateway API resources", "service endpoint"]}
        withObservedStatus
      />

      <Column id="external-targets" gap="xlarge">
        <Node id="external-endpoint" role="external-endpoint" style={{ stroke: colors.pink }}>
          <Text>External ModelEndpoint</Text>
          <Text>manual endpoint target</Text>
          <Text>still routed via gateway</Text>
          <Port id="request" side="top" />
        </Node>
        <Note id="stubs" role="stub" style={{ stroke: colors.orange, dash: "dashed" }}>
          Stubs exist for Dynamo / Grove / planner / router / workers; they may replace or encapsulate ServingStack + edge routing.
        </Note>
      </Column>
    </Scope>

    {/* the whitespace between the two bands carries both buses as ordered
        corridors; declaration order stacks placement above request */}
    <Corridor id="placement-bus" in={gap("control-plane", "fleet")} pressure={0.9} />
    <Corridor id="request-bus" in={gap("control-plane", "fleet")} pressure={0.9} />

    {[
      ["cluster-a", "fleet/cluster-a/model-replica.placement"],
      ["cluster-b", "fleet/cluster-b/model-replica.placement"],
    ].map(([id, target]) => (
      <Line
        key={id}
        id={`place-${id}`}
        from="control-plane/scheduler.placement"
        to={target}
        style={{ stroke: colors.orange }}
        share={{ group: "placement", mode: "merge" }}
      >
        <Segment
          through="placement-bus"
          label={id === "cluster-a" ? "placement / reconcile" : undefined}
        />
      </Line>
    ))}

    {[
      ["cluster-a", "fleet/cluster-a/cluster-edge.request"],
      ["cluster-b", "fleet/cluster-b/cluster-edge.request"],
      ["external", "fleet/external-endpoint.request"],
    ].map(([id, target]) => (
      <Line
        key={id}
        id={`request-${id}`}
        from="control-plane/gateway.requests"
        to={target}
        style={{ stroke: colors.purple }}
        share={{ group: "requests", mode: "merge" }}
      >
        <Segment
          through="request-bus"
          label={id === "cluster-b" ? "request routing" : undefined}
        />
      </Line>
    ))}

    <Line from="ml-team.control" to="control-plane/ml-apis.intent" style={{ stroke: colors.orange }} />
    <Line from="platform-team.control" to="control-plane/platform-apis.team" style={{ stroke: colors.orange }} />
    <Line from="client.request" to="control-plane/gateway.client" style={{ stroke: colors.purple }} />

    <Note id="footer" role="implementation-status" style={{ stroke: colors.gray }}>
      v0.1 implemented: GKE/EKS/BYO; Traefik control gateway; Envoy/GAIE workload gateways; Deployment/LWS; DRA; HF → RWX ModelCache. Early limits: equal-weight routing; no capacity scoring, anti-affinity policy, or transient failover. Design/stub: DynamoBackend, Grove / ModelExpress / DGD; one Modelplane API, no user-facing orchestrator switch.
    </Note>
  </Diagram>
);
