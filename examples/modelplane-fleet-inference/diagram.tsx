// Pre-implementation grammar fixture. This file specifies the intended
// authoring model and is not expected to compile until the core API exists.

import {
  Link,
  Channel,
  Column,
  Constraint,
  Diagram,
  Dock,
  DockGroup,
  Grid,
  Legend,
  LegendItem,
  Node,
  Note,
  Row,
  Scope,
  Subtitle,
  Text,
  Title,
  arrive,
  leave,
  use,
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

function Lines({ values }: { values: readonly string[] }) {
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
      layout={{ kind: "column", order: "source", gap: "medium" }}
      style={{ fill: "near-white", stroke: colors.gray }}
    >
      <Grid id="serving-grid" columns={2} order="source" gap="medium">
        <Node id="serving-stack" role="serving-stack" style={{ stroke: colors.blue }}>
          <Lines values={serving} />
          <Dock id="replica" side="right" axis="horizontal" />
        </Node>

        <Node id="model-replica" role="model-replica" style={{ stroke: colors.orange }}>
          <Lines values={replica} />
          <Dock id="stack" side="left" axis="horizontal" />
          <Dock id="placement" side="top" axis="vertical" />
          <Dock id="edge" side="bottom" axis="vertical" />
        </Node>

        {withCache ? (
          <Node id="model-cache" role="model-cache" style={{ stroke: colors.green }}>
            <Text>ModelCache</Text>
            <Text>Hugging Face →</Text>
            <Text>RWX PVC</Text>
            <Text>job + claim</Text>
            <Dock id="replica" side="right" axis="horizontal" />
          </Node>
        ) : withObservedStatus ? (
          <Node id="observed-status" role="status" style={{ stroke: colors.gray }}>
            <Text>Observed status</Text>
            <Text>gpuPools / labels</Text>
            <Text>coarse capacity</Text>
          </Node>
        ) : null}

        <Node id="cluster-edge" role="cluster-edge" style={{ stroke: colors.purple }}>
          <Lines values={edge} />
          <Dock id="replica" side="top" axis="vertical" />
          <Dock id="request" side="right" axis="horizontal">
            <DockGroup id="routing" join="prefer" sharing="merge" branch="late" />
          </Dock>
        </Node>
      </Grid>

      {withLocalityNote ? (
        <Note id="locality" role="locality" style={{ stroke: colors.cyan }}>
          KV locality: keep prefill/decode inside one cluster
        </Note>
      ) : null}

      <Link
        id="stack-to-replica"
        from="serving-stack.replica"
        to="model-replica.stack"
        style={{ stroke: colors.orange }}
      />
      {withCache ? (
        <Link
          id="cache-to-replica"
          from="model-cache.replica"
          to="model-replica.stack"
          style={{ stroke: colors.green }}
        />
      ) : null}
      <Link
        id="replica-to-edge"
        from="model-replica.edge"
        to="cluster-edge.replica"
        style={{ stroke: colors.purple }}
      />
      {withLocalityNote ? (
        <Link
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
      layout={{ kind: "column", order: "source", gap: "medium" }}
      style={{ fill: "near-white", stroke: colors.gray }}
    >
      <Row id="control-flow" order="source" align="center" gap="large">
        <Node id="ml-apis" role="ml-api" style={{ stroke: colors.green }}>
          <Text>ML APIs</Text>
          <Text>ModelDeployment</Text>
          <Text>ModelService</Text>
          <Dock id="intent" side="top" axis="vertical" />
          <Dock id="platform" side="right" axis="horizontal" />
        </Node>
        <Node id="platform-apis" role="platform-api" style={{ stroke: colors.blue }}>
          <Text>Platform APIs</Text>
          <Text>InferenceGateway</Text>
          <Text>InferenceClass</Text>
          <Text>InferenceCluster</Text>
          <Text>ModelCache</Text>
          <Dock id="team" side="top" axis="vertical" />
          <Dock id="ml" side="left" axis="horizontal" />
          <Dock id="composition" side="right" axis="horizontal" />
        </Node>
        <Node id="composition" role="composition" style={{ stroke: colors.yellow }}>
          <Text>Composition functions</Text>
          <Text>expand XRs</Text>
          <Text>render cluster resources</Text>
          <Text>observe remote status</Text>
          <Dock id="platform" side="left" axis="horizontal" />
          <Dock id="scheduler" side="right" axis="horizontal" />
          <Dock id="outputs" side="bottom" axis="vertical" />
        </Node>
        <Node id="scheduler" role="fleet-scheduler" style={{ stroke: colors.orange }}>
          <Text>Fleet scheduler</Text>
          <Text>label selectors</Text>
          <Text>coarse node-capacity gate</Text>
          <Text>spread by replica count</Text>
          <Text>pin ModelReplica</Text>
          <Dock id="composition" side="left" axis="horizontal" />
          <Dock id="gateway" side="right" axis="horizontal" />
          <Dock id="placement" side="bottom" axis="vertical">
            <DockGroup id="clusters" join="require" sharing="merge" branch="late" />
          </Dock>
        </Node>
        <Node id="gateway" role="inference-gateway" style={{ stroke: colors.purple }}>
          <Text>InferenceGateway</Text>
          <Text>Traefik today</Text>
          <Text>ModelService URLs</Text>
          <Text>OpenAI-compatible</Text>
          <Text>edge</Text>
          <Dock id="scheduler" side="left" axis="horizontal" />
          <Dock id="client" side="top" axis="vertical" />
          <Dock id="requests" side="bottom" axis="vertical">
            <DockGroup id="targets" join="require" sharing="merge" branch="late" />
          </Dock>
        </Node>
      </Row>

      <Node id="reconcile-outputs" role="reconcile-output" style={{ stroke: colors.yellow }}>
        <Text>Reconcile outputs</Text>
        <Text>ModelDeployment → pinned ModelReplica + optional ModelEndpoint</Text>
        <Text>ModelService → equal-weight HTTPRoute fanout</Text>
        <Dock id="composition" side="top" axis="vertical" />
      </Node>

      <Link from="ml-apis.platform" to="platform-apis.ml" style={{ stroke: colors.orange }} />
      <Link from="platform-apis.composition" to="composition.platform" style={{ stroke: colors.orange }} />
      <Link from="composition.scheduler" to="scheduler.composition" style={{ stroke: colors.orange }} />
      <Link from="scheduler.gateway" to="gateway.scheduler" style={{ stroke: colors.orange }} />
      <Link from="composition.outputs" to="reconcile-outputs.composition" style={{ stroke: colors.orange }} />
    </Scope>
  );
}

export default (
  <Diagram id="modelplane-fleet-inference" theme="excalidraw-handdrawn">
    <Title>Modelplane fleet inference architecture</Title>
    <Subtitle>
      Orange shows control-plane reconciliation; purple shows runtime inference routing.
    </Subtitle>

    <Legend id="legend" layout="column">
      <LegendItem style={{ stroke: colors.orange }}>orange = reconcile / placement</LegendItem>
      <LegendItem style={{ stroke: colors.purple }}>purple = request path</LegendItem>
      <LegendItem style={{ stroke: colors.gray, dash: "dashed" }}>
        dashed = design / stub / status
      </LegendItem>
    </Legend>

    <Grid id="actors" columns={3} order="source" align="end">
      <Node id="ml-team" role="external-actor" style={{ stroke: colors.green }}>
        <Text>ML team</Text>
        <Text>model + serving intent</Text>
        <Dock id="control" side="bottom" axis="vertical" />
      </Node>
      <Node id="platform-team" role="external-actor" style={{ stroke: colors.blue }}>
        <Text>Platform team</Text>
        <Text>cluster classes, gateways,</Text>
        <Text>cache</Text>
        <Dock id="control" side="bottom" axis="vertical" />
      </Node>
      <Node id="client" role="client" style={{ stroke: colors.purple }}>
        <Text>Client</Text>
        <Text>OpenAI-compatible</Text>
        <Text>API</Text>
        <Dock id="request" side="bottom" axis="vertical" />
      </Node>
    </Grid>

    <ControlPlane />

    <Scope
      id="fleet"
      label="Inference fleet: per-cluster serving stacks and endpoint targets"
      role="inference-fleet"
      layout={{ kind: "row", order: "source", align: "start", gap: "large" }}
      style={{ fill: "near-white", stroke: colors.gray }}
    >
      <Channel id="placement-bus" axis="horizontal" pressure={0.9} />
      <Channel id="request-bus" axis="horizontal" pressure={0.9} />

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

      <Column id="external-targets" order="source" gap="xlarge">
        <Node id="external-endpoint" role="external-endpoint" style={{ stroke: colors.pink }}>
          <Text>External ModelEndpoint</Text>
          <Text>manual endpoint target</Text>
          <Text>still routed via gateway</Text>
          <Dock id="request" side="top" axis="vertical" />
        </Node>
        <Note id="stubs" role="stub" style={{ stroke: colors.orange, dash: "dashed" }}>
          Stubs exist for Dynamo / Grove / planner / router / workers; they may replace or encapsulate ServingStack + edge routing.
        </Note>
      </Column>

      {[
        ["cluster-a", "cluster-a/model-replica.placement"],
        ["cluster-b", "cluster-b/model-replica.placement"],
      ].map(([id, target]) => (
        <Link
          key={id}
          id={`place-${id}`}
          from="../control-plane/scheduler.placement.clusters"
          to={target}
          label={id === "cluster-a" ? "placement / reconcile" : undefined}
          style={{ stroke: colors.orange }}
          layoutEffect="reserve"
          route={[
            leave({ axis: "vertical" }),
            use("placement-bus", { axis: "horizontal" }),
            arrive({ axis: "vertical" }),
          ]}
          join={{ group: "placement", policy: "require", sharing: "merge" }}
          branch={{ within: "placement-bus", preference: "late" }}
        />
      ))}

      {[
        ["cluster-a", "cluster-a/cluster-edge.request.routing"],
        ["cluster-b", "cluster-b/cluster-edge.request.routing"],
        ["external", "external-endpoint.request"],
      ].map(([id, target]) => (
        <Link
          key={id}
          id={`request-${id}`}
          from="../control-plane/gateway.requests.targets"
          to={target}
          label={id === "cluster-b" ? "request routing" : undefined}
          style={{ stroke: colors.purple }}
          layoutEffect="reserve"
          route={[
            leave({ axis: "vertical" }),
            use("request-bus", { axis: "horizontal" }),
            arrive({ axis: "vertical" }),
          ]}
          join={{ group: "requests", policy: "require", sharing: "merge" }}
          branch={{ within: "request-bus", preference: "late" }}
        />
      ))}
    </Scope>

    <Link from="ml-team.control" to="control-plane/ml-apis.intent" style={{ stroke: colors.orange }} />
    <Link from="platform-team.control" to="control-plane/platform-apis.team" style={{ stroke: colors.orange }} />
    <Link from="client.request" to="control-plane/gateway.client" style={{ stroke: colors.purple }} />

    <Constraint kind="below" item="control-plane" reference="actors" strength="required" />
    <Constraint kind="below" item="fleet" reference="control-plane" strength="required" />

    <Note id="footer" role="implementation-status" style={{ stroke: colors.gray }}>
      v0.1 implemented: GKE/EKS/BYO; Traefik control gateway; Envoy/GAIE workload gateways; Deployment/LWS; DRA; HF → RWX ModelCache. Early limits: equal-weight routing; no capacity scoring, anti-affinity policy, or transient failover. Design/stub: DynamoBackend, Grove / ModelExpress / DGD; one Modelplane API, no user-facing orchestrator switch.
    </Note>
  </Diagram>
);
