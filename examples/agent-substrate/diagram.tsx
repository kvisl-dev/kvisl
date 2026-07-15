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
      layout={{ kind: "row", order: "source", align: "center", gap: "large" }}
      style={{ fill: "pale-green", stroke: colors.green }}
    >
      <Node id="client" role="client" style={{ stroke: colors.green }}>
        <Text>Client /</Text>
        <Text>framework</Text>
        <Dock id="out" side="right" axis="horizontal" />
      </Node>
      <Node id="host" role="virtual-host" style={{ stroke: colors.green }}>
        <Text>Host:</Text>
        <Text>{"<actor>.actors.resources.substrate.ate.dev"}</Text>
        <Dock id="in" side="left" axis="horizontal" />
        <Dock id="out" side="right" axis="horizontal" />
      </Node>
      <Node id="router" role="ingress-router" style={{ stroke: colors.green }}>
        <Text>atenet / Envoy router</Text>
        <Text>ext_proc handler</Text>
        <Dock id="in" side="left" axis="horizontal" />
        <Dock id="out" side="right" axis="horizontal" />
        <Dock id="control" side="bottom" axis="vertical" />
      </Node>
      <Node id="worker-forward" role="worker-forward" style={{ stroke: colors.green }}>
        <Text>Forward to worker Pod</Text>
        <Text>IP:80</Text>
        <Dock id="in" side="left" axis="horizontal" />
        <Dock id="worker" side="right" axis="horizontal" />
      </Node>

      <Link from="client.out" to="host.in" style={{ stroke: colors.green }} />
      <Link from="host.out" to="router.in" style={{ stroke: colors.green }} />
      <Link from="router.out" to="worker-forward.in" style={{ stroke: colors.green }} />
    </Scope>
  );
}

function KubernetesApiLayer() {
  return (
    <Scope
      id="kubernetes-api"
      label="Kubernetes API layer"
      role="api-layer"
      layout={{ kind: "column", order: "source", gap: "large" }}
      style={{ stroke: colors.blue }}
    >
      <Node id="worker-pool" role="custom-resource" style={{ fill: "pale-yellow", stroke: colors.yellow }}>
        <Text>WorkerPool CRD</Text>
        <Text>replicas + ateom image</Text>
        <Dock id="controller" side="top" axis="vertical" />
      </Node>
      <Node id="actor-template" role="custom-resource" style={{ fill: "pale-yellow", stroke: colors.yellow }}>
        <Text>ActorTemplate CRD</Text>
        <Text>containers + workerPoolRef</Text>
        <Text>snapshot + runsc config</Text>
        <Dock id="api" side="right" axis="horizontal" />
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
      layout={{ kind: "column", order: "source", gap: "medium" }}
      style={{ stroke: colors.blue }}
    >
      <Node id="ateapi" role="grpc-api" style={{ fill: "pale-blue", stroke: colors.blue }}>
        <Text>ateapi</Text>
        <Text>gRPC API</Text>
        <Dock id="ingress" side="top" axis="vertical" />
        <Dock id="templates" side="left" axis="horizontal" />
        <Dock id="workers" side="right" axis="horizontal">
          <DockGroup id="worker-control" join="prefer" sharing="bundle" branch="late" />
        </Dock>
        <Dock id="state" side="bottom" axis="vertical" />
        <Dock id="suspend" side="bottom" axis="vertical" />
      </Node>

      <Scope
        id="valkey"
        label="Valkey / Redis — actor + worker truth"
        role="state-store"
        layout={{ kind: "row", order: "source", gap: "small" }}
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
        <Dock id="api" side="top" axis="vertical" />
      </Scope>

      <Link from="ateapi.state" to="valkey.api" style={{ stroke: colors.blue }} />
    </Scope>
  );
}

function SnapshotStorage() {
  return (
    <Scope
      id="snapshot-storage"
      label="Snapshot storage — GCS / S3-style object storage"
      role="object-storage"
      layout={{ kind: "column", order: "source" }}
      style={{ fill: "pale-purple", stroke: colors.purple }}
    >
      <Node id="checkpoint" role="snapshot-object" style={{ stroke: colors.purple }}>
        <Text>checkpoint.img.zstd</Text>
        <Text>pages.img.zstd + pages_meta.img.zstd</Text>
        <Dock id="transfer" side="right" axis="horizontal">
          <DockGroup id="restore" join="prefer" sharing="bundle" branch="late" />
        </Dock>
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
      layout={{ kind: "column", order: "source", gap: "large" }}
      style={{ fill: "warm-white", stroke: colors.orange }}
    >
      <Node id="atelet" role="node-supervisor" style={{ stroke: colors.orange }}>
        <Text>atelet DaemonSet</Text>
        <Text>node supervisor</Text>
        <Dock id="api" side="left" axis="horizontal" />
        <Dock id="pod" side="bottom" axis="vertical" />
        <Dock id="snapshot" side="bottom" axis="vertical" />
      </Node>

      <Scope
        id="worker-pod"
        label="Persistent Worker Pod — label: ate.dev/worker-pool"
        role="worker-pod"
        layout={{ kind: "column", order: "source", gap: "medium" }}
        style={{ fill: "pale-orange", stroke: colors.orange }}
      >
        <Node id="ateom-visor" role="runtime-helper" style={{ stroke: colors.orange }}>
          <Text>ateom-visor</Text>
          <Text>runtime helper</Text>
          <Dock id="supervisor" side="left" axis="horizontal" />
          <Dock id="sandbox" side="bottom" axis="vertical" />
        </Node>
        <Scope
          id="sandbox"
          label="gVisor / runsc sandbox — create / start · checkpoint / restore"
          role="sandbox"
          layout={{ kind: "column", order: "source" }}
          style={{ fill: "pale-yellow", stroke: colors.yellow }}
        >
          <Node id="agent" role="agent-process" style={{ stroke: colors.yellow }}>
            <Text>Agent</Text>
            <Text>process</Text>
            <Dock id="request" side="right" axis="horizontal" />
            <Dock id="suspend" side="left" axis="horizontal" />
            <Dock id="supervisor" side="top" axis="vertical" />
          </Node>
          <Dock id="visor" side="top" axis="vertical" />
          <Dock id="snapshot" side="left" axis="horizontal" />
        </Scope>

        <Link from="ateom-visor.sandbox" to="sandbox.visor" style={{ stroke: colors.red }} />
      </Scope>

      <Node
        id="warm-pods"
        role="capacity-pool"
        style={{ stroke: colors.orange, dash: "dashed" }}
      >
        <Text>Warm free worker Pods</Text>
        <Text>waiting for actor</Text>
        <Text>assignment</Text>
        <Dock id="controller" side="top" axis="vertical" />
      </Node>

      <Link
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

    <Channel id="request-descent" axis="vertical" pressure={0.8} />
    <Ingress />

    <Scope
      id="cluster"
      label="Kubernetes cluster: capacity, templates, controllers, worker Pods"
      role="kubernetes-cluster"
      layout={{ kind: "column", order: "source", gap: "large" }}
      style={{ fill: "pale-blue", stroke: colors.blue }}
    >
      <Channel id="controller-backbone" axis="horizontal" pressure={0.8} />
      <Channel id="grpc-backbone" axis="horizontal" pressure={0.9} />
      <Channel id="suspend-backbone" axis="horizontal" pressure={0.9} />
      <Channel id="snapshot-backbone" axis="horizontal" pressure={0.9} />

      <Grid id="layers" columns={3} order="source" align="start" gap="large">
        <KubernetesApiLayer />
        <Column id="control-and-storage" order="source" gap="large">
          <SubstrateControlPlane />
          <SnapshotStorage />
        </Column>
        <RuntimeLayer />
      </Grid>

      <Note id="hot-path-note" role="annotation">
        No per-actor Kubernetes object on the hot path.
      </Note>
      <Note id="scheduling-note" role="annotation">
        Hot path avoids one Kubernetes object per actor. Kubernetes provisions capacity; Substrate schedules logical actors.
      </Note>
      <Note id="security-note" role="annotation">
        Security-sensitive boundary: privileged worker machinery outside; agent workload inside gVisor/runsc sandbox.
      </Note>

      <Link
        id="worker-pool-controller"
        from="kubernetes-api/worker-pool.controller"
        to="runtime/worker-pod"
        label="WorkerPool controller maintains warm persistent worker Pods"
        style={{ stroke: colors.gray, dash: "dashed" }}
        layoutEffect="reserve"
        route={[use("controller-backbone", { axis: "horizontal" })]}
      />
      <Link
        id="actor-template-api"
        from="substrate-control/ateapi.templates"
        to="kubernetes-api/actor-template.api"
        style={{ stroke: colors.blue, dash: "dashed" }}
        layoutEffect="reserve"
        route={[use("grpc-backbone", { axis: "horizontal" })]}
      />
      <Link
        id="resume-actor"
        from="substrate-control/ateapi.workers.worker-control"
        to="runtime/atelet.api"
        direction="bidirectional"
        label="ResumeActor(actorID)"
        style={{ stroke: colors.blue, dash: "dashed" }}
        layoutEffect="reserve"
        route={[use("grpc-backbone", { axis: "horizontal" })]}
      />
      <Link
        id="self-suspend"
        from="runtime/worker-pod/sandbox/agent.suspend"
        to="substrate-control/ateapi.suspend"
        label="api.ate-system.svc.cluster.local:443\nSuspendActor(actorID) · self-suspend"
        style={{ stroke: colors.blue, dash: "dashed" }}
        layoutEffect="reserve"
        route={[
          leave({ axis: "horizontal" }),
          use("suspend-backbone", { axis: "horizontal" }),
          arrive({ axis: "vertical" }),
        ]}
      />
      <Link
        id="checkpoint-transfer"
        from="runtime/worker-pod/sandbox.snapshot"
        to="snapshot-storage/checkpoint.transfer.restore"
        direction="bidirectional"
        label="restore download\ncheckpoint upload"
        style={{ stroke: colors.purple, dash: "dashed" }}
        layoutEffect="reserve"
        route={[
          leave({ axis: "vertical" }),
          use("snapshot-backbone", { axis: "horizontal" }),
          arrive({ axis: "horizontal" }),
        ]}
      />
    </Scope>

    <Link
      id="ingress-control"
      from="ingress/router.control"
      to="cluster/substrate-control/ateapi.ingress"
      style={{ stroke: colors.blue, dash: "dashed" }}
      layoutEffect="reserve"
      route={[
        leave({ axis: "vertical" }),
        use("request-descent", { axis: "vertical" }),
        arrive({ axis: "vertical" }),
      ]}
    />
    <Link
      id="request-to-agent"
      from="ingress/worker-forward.worker"
      to="cluster/runtime/worker-pod/sandbox/agent.request"
      style={{ stroke: colors.green }}
      layoutEffect="reserve"
      route={[
        leave({ axis: "horizontal" }),
        use("request-descent", { axis: "vertical" }),
        arrive({ axis: "horizontal" }),
      ]}
    />

    <Constraint kind="below" item="cluster" reference="ingress" strength="required" />
  </Diagram>
);
