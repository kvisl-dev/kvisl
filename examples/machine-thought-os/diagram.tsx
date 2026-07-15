// Pre-implementation grammar fixture. This file specifies the intended
// authoring model and is not expected to compile until the core API exists.

import {
  Link,
  Boundary,
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
  gray: "kernel-gray",
  blue: "state-blue",
  orange: "scheduler-orange",
  green: "running-green",
  purple: "join-purple",
  yellow: "deferred-yellow",
};

function Child({ id, label }: { id: string; label: string }) {
  return (
    <Node id={id} role="running-child" style={{ fill: "pale-green", stroke: colors.green }}>
      <Text>{label}</Text>
      <Text>running</Text>
      <Dock id="schedule" side="left" axis="horizontal" />
      <Dock id="state" side="left" axis="horizontal" />
      <Dock id="join" side="right" axis="horizontal">
        <DockGroup id="completion" join="require" sharing="merge" branch="late" />
      </Dock>
    </Node>
  );
}

export default (
  <Diagram id="machine-thought-os" theme="excalidraw-handdrawn">
    <Title>An operating system for machine thought</Title>
    <Subtitle>
      The thinking model requests parallelism. The inference engine decides when it runs.
    </Subtitle>

    <Channel id="system-call-route" axis="vertical" pressure={0.8} />
    <Channel id="completion-route" axis="vertical" pressure={0.8} />

    <Scope
      id="user-mode"
      label="THINKING MODEL · USER MODE"
      role="user-mode"
      layout={{ kind: "row", order: "source", distribute: "space-between", align: "center" }}
      style={{ fill: "pale-blue", stroke: "light-blue" }}
    >
      <Node id="parent" role="parent-completion" style={{ fill: "light-blue", stroke: colors.blue }}>
        <Text>Parent completion</Text>
        <Text>shared history</Text>
        <Dock id="fork" side="right" axis="horizontal" />
      </Node>
      <Node id="fork" role="system-call" style={{ fill: "pale-yellow", stroke: colors.orange }}>
        <Text>{"<Parallel>"}</Text>
        <Text>system call: fork</Text>
        <Dock id="parent" side="left" axis="horizontal" />
        <Dock id="kernel" side="bottom" axis="vertical" />
      </Node>
      <Node id="resume" role="parent-resume" style={{ fill: "pale-green", stroke: colors.green }}>
        <Text>Parent resumes</Text>
        <Text>{"<Conclusion>"}</Text>
        <Dock id="join" side="bottom" axis="vertical" />
      </Node>

      <Link from="parent.fork" to="fork.parent" style={{ stroke: colors.blue }} />
    </Scope>

    <Boundary
      id="system-call-boundary"
      orientation="horizontal"
      label="SYSTEM-CALL BOUNDARY"
      style={{ stroke: colors.orange, dash: "dashed" }}
    />

    <Scope
      id="kernel"
      label="SGLANG · INFERENCE ENGINE / KERNEL"
      role="kernel"
      layout={{ kind: "column", order: "source", gap: "large" }}
      style={{ fill: "near-white", stroke: colors.gray }}
    >
      <Channel id="schedule-bus" axis="horizontal" pressure={0.95} />
      <Channel id="state-bus" axis="horizontal" pressure={0.95} />
      <Channel id="join-bus" axis="vertical" pressure={0.95} />

      <Grid id="execution" columns={4} order="source" align="center" gap="large">
        <Node id="interpreter" role="interpreter" style={{ fill: "light-blue", stroke: colors.blue }}>
          <Text>Interpreter</Text>
          <Text>creates child</Text>
          <Text>requests</Text>
          <Dock id="system-call" side="top" axis="vertical" />
          <Dock id="scheduler" side="right" axis="horizontal" />
        </Node>

        <Node id="scheduler" role="scheduler" style={{ fill: "pale-orange", stroke: colors.orange }}>
          <Text>TAPER scheduler</Text>
          <Text>admit per forward</Text>
          <Text>pass</Text>
          <Dock id="interpreter" side="left" axis="horizontal" />
          <Dock id="children" side="right" axis="horizontal">
            <DockGroup id="fanout" join="require" sharing="merge" branch="late" />
          </Dock>
        </Node>

        <Column id="work" order="source" gap="medium">
          <Text role="annotation">continuous batching · radix KV cache</Text>
          <Scope
            id="next-pass"
            label="NEXT GPU FORWARD PASS"
            role="gpu-pass"
            layout={{ kind: "column", order: "source", gap: "medium" }}
            style={{ stroke: colors.green, dash: "dashed" }}
          >
            <Child id="child-a" label="Child A" />
            <Child id="child-b" label="Child B" />
          </Scope>
          <Node
            id="child-c"
            role="deferred-child"
            style={{ fill: "pale-yellow", stroke: colors.orange, dash: "dashed" }}
          >
            <Text>Child C</Text>
            <Text>ready, deferred this</Text>
            <Text>pass</Text>
            <Dock id="schedule" side="left" axis="horizontal" />
            <Dock id="state" side="left" axis="horizontal" />
            <Dock id="join" side="right" axis="horizontal" />
          </Node>
        </Column>

        <Node id="wait" role="join" style={{ fill: "light-purple", stroke: colors.purple }}>
          <Text>wait()</Text>
          <Text>join KV views</Text>
          <Dock id="children" side="left" axis="horizontal">
            <DockGroup id="fanin" join="require" sharing="merge" branch="late" />
          </Dock>
          <Dock id="parent" side="top" axis="vertical" />
        </Node>

        <Node id="shared-state" role="shared-kv" style={{ fill: "light-blue", stroke: colors.blue }}>
          <Text>Shared prefix KV blocks</Text>
          <Text>+ small branch-local state</Text>
          <Dock id="children" side="right" axis="horizontal">
            <DockGroup id="state-feed" join="prefer" sharing="bundle" branch="late" />
          </Dock>
        </Node>
      </Grid>

      <Link from="interpreter.scheduler" to="scheduler.interpreter" style={{ stroke: colors.ink }} />

      {[
        ["a", "next-pass/child-a.schedule", false],
        ["b", "next-pass/child-b.schedule", false],
        ["c", "child-c.schedule", true],
      ].map(([id, target, dashed]) => (
        <Link
          key={String(id)}
          id={`schedule-child-${id}`}
          from="scheduler.children.fanout"
          to={String(target)}
          style={{ stroke: colors.green, dash: dashed ? "dashed" : undefined }}
          layoutEffect="reserve"
          route={[use("schedule-bus", { axis: "horizontal" })]}
          join={{ group: "scheduler-fanout", policy: "require", sharing: "merge" }}
          branch={{ within: "schedule-bus", preference: "late" }}
        />
      ))}

      {[
        ["a", "next-pass/child-a.state", colors.blue],
        ["b", "next-pass/child-b.state", colors.blue],
        ["c", "child-c.state", colors.orange],
      ].map(([id, target, stroke]) => (
        <Link
          key={String(id)}
          id={`state-child-${id}`}
          from="shared-state.children.state-feed"
          to={String(target)}
          style={{ stroke: String(stroke), dash: "dashed" }}
          layoutEffect="reserve"
          route={[use("state-bus", { axis: "horizontal" })]}
          join={{ group: "state-feed", policy: "prefer", sharing: "bundle" }}
          branch={{ within: "state-bus", preference: "late" }}
        />
      ))}

      {[
        ["a", "next-pass/child-a.join", false],
        ["b", "next-pass/child-b.join", false],
        ["c", "child-c.join", true],
      ].map(([id, source, dashed]) => (
        <Link
          key={String(id)}
          id={`join-child-${id}`}
          from={String(source)}
          to="wait.children.fanin"
          style={{ stroke: colors.purple, dash: dashed ? "dashed" : undefined }}
          layoutEffect="reserve"
          route={[use("join-bus", { axis: "vertical" })]}
          join={{ group: "child-completions", policy: "require", sharing: "merge" }}
          branch={{ within: "join-bus", preference: "late" }}
        />
      ))}

      <Note id="principle" role="principle">
        Model chooses the work graph. Engine chooses the schedule.
      </Note>
      <Constraint kind="below" item="shared-state" reference="interpreter" />
      <Constraint kind="below" item="child-c" reference="next-pass" strength="required" />
    </Scope>

    <Link
      id="fork-system-call"
      from="user-mode/fork.kernel"
      to="kernel/interpreter.system-call"
      style={{ stroke: colors.orange }}
      layoutEffect="reserve"
      route={[
        leave({ axis: "vertical" }),
        use("system-call-route", { axis: "vertical" }),
        arrive({ axis: "vertical" }),
      ]}
    />
    <Link
      id="resume-parent"
      from="kernel/wait.parent"
      to="user-mode/resume.join"
      style={{ stroke: colors.purple }}
      layoutEffect="reserve"
      route={[
        leave({ axis: "vertical" }),
        use("completion-route", { axis: "vertical" }),
        arrive({ axis: "vertical" }),
      ]}
    />

    <Constraint kind="between" item="system-call-boundary" first="user-mode" second="kernel" strength="required" />
  </Diagram>
);
