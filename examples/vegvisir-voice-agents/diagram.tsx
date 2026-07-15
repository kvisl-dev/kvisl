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
  Image,
  Node,
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
  muted: "muted-gray",
  blue: "voice-blue",
  orange: "decision-orange",
  green: "road-green",
  purple: "agent-purple",
};

function Driver() {
  return (
    <Column id="driver-column" order="source" align="center" gap="large">
      <Node
        id="driver"
        shape="ellipse"
        label="Driver"
        role="actor"
        style={{ fill: "pale-yellow", stroke: colors.orange }}
      >
        <Dock id="voice" side="right" axis="horizontal" />
      </Node>
      <Text role="caption">speaks · listens</Text>
      <Image
        id="app-icon"
        source="asset://vegvisir-app-icon"
        alt="Vegvísir app icon"
        aspectRatio={1}
      />
      <Text role="app-name">Vegvísir</Text>
    </Column>
  );
}

function Phone() {
  return (
    <Scope
      id="phone"
      label="Vegvísir on iPhone"
      role="device"
      layout={{ kind: "column", order: "source", gap: "large" }}
      style={{ fill: "near-white", stroke: colors.muted }}
    >
      <Channel
        id="vertical-control"
        axis="vertical"
        pressure={0.7}
        spacing={{ min: "small", preferred: "medium" }}
      />

      <Node
        id="voice-agent"
        role="realtime-agent"
        style={{ fill: "pale-blue", stroke: colors.blue }}
      >
        <Text role="heading">Realtime Voice Agent</Text>
        <Text role="heading">GPT-Realtime-2 → GPT-Live</Text>
        <Text role="heading">listens · speaks · delegates</Text>
        <Text role="caption">
          Fast conversational loop — never blocked by long-running work
        </Text>
        <Dock id="driver" side="left" axis="horizontal" />
        <Dock id="tasks" side="bottom" axis="vertical" />
        <Dock id="speech" side="bottom" axis="vertical" />
        <Dock id="progress" side="bottom" axis="vertical" />
      </Node>

      <Node
        id="speak-now"
        shape="diamond"
        label="Speak\nnow?"
        role="decision"
        style={{ fill: "pale-yellow", stroke: colors.orange }}
      >
        <Dock id="from-harness" side="bottom" axis="vertical" />
        <Dock id="to-voice" side="top" axis="vertical" />
      </Node>

      <Node
        id="road-agent"
        role="agent-harness"
        style={{ fill: "pale-green", stroke: colors.green }}
      >
        <Text role="heading">Road Agent Harness</Text>
        <Text role="heading">
          Drive context · async Road Tasks · ranking
        </Text>
        <Text role="heading">
          POI search · map state · navigation handoff
        </Text>
        <Dock id="tasks" side="top" axis="vertical" />
        <Dock id="speech" side="top" axis="vertical" />
        <Dock id="progress" side="top" axis="vertical" />
        <Dock id="remote" side="right" axis="horizontal">
          <DockGroup
            id="delegation"
            join="prefer"
            sharing="merge"
            branch="late"
          />
        </Dock>
        <Dock id="local-context" side="bottom" axis="vertical" />
        <Dock id="road-knowledge" side="bottom" axis="vertical" />
      </Node>

      <Row id="knowledge" order="source" gap="large" align="stretch">
        <Node
          id="local-context"
          role="knowledge-source"
          style={{ fill: "near-white", stroke: colors.muted }}
        >
          <Text>Local Markdown context</Text>
          <Text>Soul · Preferences · Today</Text>
          <Text>· Memory</Text>
          <Dock id="harness" side="top" axis="vertical" />
        </Node>
        <Node
          id="road-knowledge"
          role="knowledge-source"
          style={{ fill: "near-white", stroke: colors.muted }}
        >
          <Text>Live road knowledge</Text>
          <Text>MapKit · Overpass ·</Text>
          <Text>Wikipedia</Text>
          <Dock id="harness" side="top" axis="vertical" />
        </Node>
      </Row>

      <Link
        id="accept-road-task"
        from="voice-agent.tasks"
        to="road-agent.tasks"
        label="accept + refine\nRoad Task"
        style={{ stroke: colors.blue }}
        layoutEffect="reserve"
        route={[use("vertical-control", { axis: "vertical" })]}
      />
      <Link
        id="ask-to-speak"
        from="road-agent.speech"
        to="speak-now.from-harness"
        style={{ stroke: colors.orange }}
        layoutEffect="reserve"
      />
      <Link
        id="speak"
        from="speak-now.to-voice"
        to="voice-agent.speech"
        style={{ stroke: colors.orange }}
        layoutEffect="reserve"
      />
      <Link
        id="progress"
        from="road-agent.progress"
        to="voice-agent.progress"
        label="progress +\nstructured result"
        style={{ stroke: colors.green }}
        layoutEffect="reserve"
        route={[use("vertical-control", { axis: "vertical" })]}
      />
      <Link
        id="local-memory"
        from="road-agent.local-context"
        to="local-context.harness"
        direction="bidirectional"
        style={{ stroke: colors.muted }}
      />
      <Link
        id="live-knowledge"
        from="road-agent.road-knowledge"
        to="road-knowledge.harness"
        direction="bidirectional"
        style={{ stroke: colors.muted }}
      />

      <Constraint kind="center" item="speak-now" within="phone" strength="required" />
      <Constraint kind="between" item="speak-now" first="voice-agent" second="road-agent" />
    </Scope>
  );
}

function UserOwnedAgents() {
  return (
    <Scope
      id="user-owned"
      label="User-owned agents"
      role="remote-agents"
      layout={{ kind: "column", order: "source", gap: "large" }}
      style={{ fill: "pale-purple", stroke: colors.purple }}
    >
      <Text role="caption">private travel memory,</Text>
      <Text role="caption">wiki, bookings &amp; research</Text>

      <Channel
        id="agent-bus"
        axis="vertical"
        pressure={0.9}
        spacing={{ min: "small", preferred: "small" }}
        allowedSharing={["merge", "bundle"]}
      />

      <Node
        id="travel-agent"
        role="named-agent"
        style={{ fill: "light-purple", stroke: colors.purple }}
      >
        <Text role="heading">Named travel agent</Text>
        <Text role="heading">situated delegation</Text>
        <Dock id="request" side="left" axis="horizontal" />
        <Dock id="tools" side="bottom" axis="vertical">
          <DockGroup id="fanout" join="require" sharing="merge" branch="late" />
        </Dock>
      </Node>

      <Node id="openclaw" role="agent-tool" style={{ stroke: colors.purple }}>
        <Text>OpenClaw</Text>
        <Text>Gateway</Text>
        <Text>/v1/responses</Text>
        <Dock id="request" side="left" axis="horizontal" />
      </Node>
      <Node id="hermes-webui" role="agent-tool" style={{ stroke: colors.purple }}>
        <Text>Hermes WebUI</Text>
        <Text>background task API</Text>
        <Dock id="request" side="left" axis="horizontal" />
      </Node>
      <Node id="hermes-api" role="agent-tool" style={{ stroke: colors.purple }}>
        <Text>Hermes Agent API</Text>
        <Text>stateful runs /</Text>
        <Text>responses</Text>
        <Dock id="request" side="left" axis="horizontal" />
      </Node>

      {[
        ["openclaw", "openclaw.request"],
        ["hermes-webui", "hermes-webui.request"],
        ["hermes-api", "hermes-api.request"],
      ].map(([id, target]) => (
        <Link
          key={id}
          id={`to-${id}`}
          from="travel-agent.tools.fanout"
          to={target}
          style={{ stroke: colors.purple }}
          layoutEffect="reserve"
          route={[use("agent-bus", { axis: "vertical" })]}
          join={{ group: "travel-tools", policy: "require", sharing: "merge" }}
          branch={{ within: "agent-bus", preference: "late" }}
        />
      ))}
    </Scope>
  );
}

export default (
  <Diagram id="vegvisir-voice-agents" theme="excalidraw-handdrawn">
    <Title>Vegvísir — one voice, multiple agents</Title>
    <Subtitle>
      A voice-first road companion that stays responsive while deeper work happens in the background
    </Subtitle>

    <Channel
      id="delegation-backbone"
      axis="horizontal"
      pressure={0.85}
      spacing={{ min: "small", preferred: "medium" }}
    />

    <Row id="system" order="source" align="center" gap="xlarge">
      <Driver />
      <Phone />
      <UserOwnedAgents />
    </Row>

    <Link
      id="driver-conversation"
      from="driver.voice"
      to="phone/voice-agent.driver"
      direction="bidirectional"
      style={{ stroke: colors.blue }}
      layoutEffect="reserve"
    />
    <Link
      id="remote-delegation"
      from="phone/road-agent.remote.delegation"
      to="user-owned/travel-agent.request"
      label="drive context + exact request"
      style={{ stroke: colors.purple }}
      layoutEffect="reserve"
      route={[
        leave({ axis: "horizontal" }),
        use("delegation-backbone", { axis: "horizontal" }),
        arrive({ axis: "horizontal" }),
      ]}
    />
  </Diagram>
);
