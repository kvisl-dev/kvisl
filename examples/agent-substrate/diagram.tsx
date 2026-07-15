// Pre-implementation grammar fixture. This file specifies the intended
// authoring model and is not expected to compile until the core API exists.

import {
  Column,
  Diagram,
  Grid,
  Line,
  Node,
  Note,
  Port,
  Scope,
  Segment,
  Subtitle,
  Text,
  Title,
  gap,
  padding,
} from "@excalmermaid/core";

const colors = {
  ink: "ink",
  gray: "status-gray",
  green: "request-green",
  blue: "kubernetes-blue",
  orange: "runtime-orange",
  yellow: "resource-yellow",
  purple: "snapshot-purple",
  red: "sandbox-red",
};

function Ingress() {
  return (
    <Scope
      id="ingress"
      label="Ingress / request path"
      role="request-path"
      layout={{ kind: "row", align: "center", gap: "large" }}
      style={{ fill: "pale-green", stroke: colors.green }}
    >
      <Node id="client" role="client" style={{ stroke: colors.green }}>
        <Text>Client /</Text>
        <Text>framework</Text>
        <Port id="out" side="right" />
      </Node>
      <Node id="host" role="virtual-host" style={{ stroke: colors.green }}>
        <Text>Host:</Text>
        <Text>{"<actor>.actors.resources.substrate.ate.dev"}</Text>
        <Port id="in" side="left" />
        <Port id="out" side="right" />
      </Node>
      <Node id="router" role="ingress-router" style={{ stroke: colors.green }}>
        <Text>atenet / Envoy router</Text>
        <Text>ext_proc handler</Text>
        <Port id="in" side="left" />
        <Port id="out" side="right" />
        <Port id="control" side="bottom" />
      </Node>
      <Node id="worker-forward" role="worker-forward" style={{ stroke: colors.green }}>
        <Text>Forward to worker Pod</Text>
        <Text>IP:80</Text>
        <Port id="in" side="left" />
        <Port id="worker" side="right" />
      </Node>

      <Line from="client.out" to="host.in" style={{ stroke: colors.green }} />
      <Line from="host.out" to="router.in" style={{ stroke: colors.green }} />
      <Line from="router.out" to="worker-forward.in" style={{ stroke: colors.green }} />
    </Scope>
  );
}

function KubernetesApiLayer() {
  return (
    <Scope
      id="kubernetes-api"
      label="Kubernetes API layer"
      role="api-layer"
      layout={{ kind: "column", gap: "large" }}
      style={{ stroke: colors.blue }}
    >
      <Node id="worker-pool" role="custom-resource" style={{ fill: "pale-yellow", stroke: colors.yellow }}>
        <Text>WorkerPool CRD</Text>
        <Text>replicas + ateom image</Text>
        <Port id="controller" side="top" />
      </Node>
      <Node id="actor-template" role="custom-resource" style={{ fill: "pale-yellow", stroke: colors.yellow }}>
        <Text>ActorTemplate CRD</Text>
        <Text>containers + workerPoolRef</Text>
        <Text>snapshot + runsc config</Text>
        <Port id="api" side="right" />
      </Node>
    </Scope>
  );
}

function SubstrateControlPlane() {
  return (
    <Scope
      id="substrate-control"
      label="Substrate control plane"
      role="substrate-control-plane"
      layout={{ kind: "column", gap: "medium" }}
      style={{ stroke: colors.blue }}
    >
      <Node id="ateapi" role="grpc-api" style={{ fill: "pale-blue", stroke: colors.blue }}>
        <Text>ateapi</Text>
        <Text>gRPC API</Text>
        <Port id="ingress" side="top" />
        <Port id="templates" side="left" />
        <Port id="workers" side="right" />
        <Port id="state" side="bottom" />
        <Port id="suspend" side="bottom" />
      </Node>

      <Scope
        id="valkey"
        label="Valkey / Redis — actor + worker truth"
        role="state-store"
        layout={{ kind: "row", gap: "small" }}
        style={{ fill: "near-white", stroke: colors.gray }}
      >
        <Node id="actors" role="state-table" style={{ stroke: colors.gray }}>
          <Text>{"actor:<id>"}</Text>
          <Text>status + snapshot refs</Text>
        </Node>
        <Node id="workers" role="state-table" style={{ stroke: colors.gray }}>
          <Text>{"worker:<ns>:<pool>:<pod>"}</Text>
          <Text>free / busy</Text>
        </Node>
        <Port id="api" side="top" />
      </Scope>

      <Line from="ateapi.state" to="valkey.api" style={{ stroke: colors.blue }} />
    </Scope>
  );
}

function SnapshotStorage() {
  return (
    <Scope
      id="snapshot-storage"
      label="Snapshot storage — GCS / S3-style object storage"
      role="object-storage"
      layout={{ kind: "column" }}
      style={{ fill: "pale-purple", stroke: colors.purple }}
    >
      <Node id="checkpoint" role="snapshot-object" style={{ stroke: colors.purple }}>
        <Text>checkpoint.img.zstd</Text>
        <Text>pages.img.zstd + pages_meta.img.zstd</Text>
        <Port id="transfer" side="right" />
      </Node>
    </Scope>
  );
}

function RuntimeLayer() {
  return (
    <Scope
      id="runtime"
      label="Worker node / runtime layer"
      role="runtime-layer"
      layout={{ kind: "column", gap: "large" }}
      style={{ fill: "warm-white", stroke: colors.orange }}
    >
      <Node id="atelet" role="node-supervisor" style={{ stroke: colors.orange }}>
        <Text>atelet DaemonSet</Text>
        <Text>node supervisor</Text>
        <Port id="api" side="left" />
        <Port id="pod" side="bottom" />
      </Node>

      <Scope
        id="worker-pod"
        label="Persistent Worker Pod — label: ate.dev/worker-pool"
        role="worker-pod"
        layout={{ kind: "column", gap: "medium" }}
        style={{ fill: "pale-orange", stroke: colors.orange }}
      >
        <Node id="ateom-visor" role="runtime-helper" style={{ stroke: colors.orange }}>
          <Text>ateom-visor</Text>
          <Text>runtime helper</Text>
          <Port id="supervisor" side="left" />
          <Port id="sandbox" side="bottom" />
        </Node>
        <Scope
          id="sandbox"
          label="gVisor / runsc sandbox — create / start · checkpoint / restore"
          role="sandbox"
          layout={{ kind: "column" }}
          style={{ fill: "pale-yellow", stroke: colors.yellow }}
        >
          <Node id="agent" role="agent-process" style={{ stroke: colors.yellow }}>
            <Text>Agent</Text>
            <Text>process</Text>
            <Port id="request" side="right" />
            <Port id="suspend" side="left" />
          </Node>
          <Port id="visor" side="top" />
          <Port id="snapshot" side="left" />
        </Scope>

        <Line from="ateom-visor.sandbox" to="sandbox.visor" style={{ stroke: colors.red }} />
      </Scope>

      <Node
        id="warm-pods"
        role="capacity-pool"
        style={{ stroke: colors.orange, dash: "dashed" }}
      >
        <Text>Warm free worker Pods</Text>
        <Text>waiting for actor</Text>
        <Text>assignment</Text>
      </Node>

      <Line
        id="supervise-pod"
        from="atelet.pod"
        to="worker-pod/ateom-visor.supervisor"
        style={{ stroke: colors.blue, dash: "dashed" }}
      />
    </Scope>
  );
}

export default (
  <Diagram id="agent-substrate" theme="excalidraw-handdrawn">
    <Title>Agent Substrate component design</Title>
    <Subtitle>
      Micro-scheduler above Kubernetes: persistent worker Pods, logical actors, gVisor/runsc checkpoint/restore, Valkey runtime state.
    </Subtitle>

    <Ingress />

    <Scope
      id="cluster"
      label="Kubernetes cluster: capacity, templates, controllers, worker Pods"
      role="kubernetes-cluster"
      layout={{ kind: "column", gap: "large" }}
      style={{ fill: "pale-blue", stroke: colors.blue }}
    >
      <Grid id="layers" columns={3} align="start" gap="large">
        <KubernetesApiLayer />
        <Column id="control-and-storage" gap="large">
          <SubstrateControlPlane />
          <SnapshotStorage />
        </Column>
        <RuntimeLayer />
      </Grid>

      {/* annotations sit anchored, outside the content flow */}
      <Note id="hot-path-note" role="annotation" anchor="kubernetes-api" placement="below">
        No per-actor Kubernetes object on the hot path.
      </Note>
      <Note id="scheduling-note" role="annotation" placement="inside-bottom-left">
        Hot path avoids one Kubernetes object per actor. Kubernetes provisions capacity; Substrate schedules logical actors.
      </Note>
      <Note id="security-note" role="annotation" placement="inside-bottom-right">
        Security-sensitive boundary: privileged worker machinery outside; agent workload inside gVisor/runsc sandbox.
      </Note>

      {/* control paths pin their labeled runs into the whitespace between
          the three columns; all boundary crossings stay implicit */}
      <Line
        id="actor-template-api"
        from="substrate-control/ateapi.templates"
        to="kubernetes-api/actor-template.api"
        style={{ stroke: colors.blue, dash: "dashed" }}
      >
        <Segment through={gap("kubernetes-api", "control-and-storage")} />
      </Line>
      <Line
        id="resume-actor"
        from="substrate-control/ateapi.workers"
        to="runtime/atelet.api"
        heads="both"
        style={{ stroke: colors.blue, dash: "dashed" }}
      >
        <Segment
          through={gap("control-and-storage", "runtime")}
          label="ResumeActor(actorID)"
        />
      </Line>
      <Line
        id="self-suspend"
        from="runtime/worker-pod/sandbox/agent.suspend"
        to="substrate-control/ateapi.suspend"
        style={{ stroke: colors.blue, dash: "dashed" }}
      >
        <Segment
          through={gap("control-and-storage", "runtime")}
          label={"api.ate-system.svc.cluster.local:443\nSuspendActor(actorID) · self-suspend"}
        />
      </Line>
      <Line
        id="checkpoint-transfer"
        from="runtime/worker-pod/sandbox.snapshot"
        to="snapshot-storage/checkpoint.transfer"
        heads="both"
        style={{ stroke: colors.purple, dash: "dashed" }}
      >
        <Segment
          through={gap("control-and-storage", "runtime")}
          label={"restore download\ncheckpoint upload"}
        />
      </Line>
    </Scope>

    {/* the controller path runs along the cluster's top padding band */}
    <Line
      id="worker-pool-controller"
      from="cluster/kubernetes-api/worker-pool.controller"
      to="cluster/runtime/worker-pod"
      style={{ stroke: colors.gray, dash: "dashed" }}
    >
      <Segment
        through={padding("cluster", "top")}
        label="WorkerPool controller maintains warm persistent worker Pods"
      />
    </Line>
    <Line
      id="ingress-control"
      from="ingress/router.control"
      to="cluster/substrate-control/ateapi.ingress"
      style={{ stroke: colors.blue, dash: "dashed" }}
    />
    {/* descends along the cluster's right padding and arrives from the
        right, deep inside the nested sandbox */}
    <Line
      id="request-to-agent"
      from="ingress/worker-forward.worker"
      to="cluster/runtime/worker-pod/sandbox/agent.request"
      style={{ stroke: colors.green }}
    >
      <Segment through={padding("cluster", "right")} />
    </Line>
  </Diagram>
);
