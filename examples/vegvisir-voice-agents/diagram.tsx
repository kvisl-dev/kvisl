// Pre-implementation grammar fixture. This file specifies the intended
// authoring model and is not expected to compile until the core API exists.

import {
  Column,
  Diagram,
  Image,
  Line,
  Node,
  Port,
  PortGroup,
  Row,
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
  muted: "muted-gray",
  blue: "voice-blue",
  orange: "decision-orange",
  green: "road-green",
  purple: "agent-purple",
};

function Driver() {
  return (
    <Column id="driver-column" align="center" gap="large">
      <Node
        id="driver"
        shape="ellipse"
        label="Driver"
        role="actor"
        style={{ fill: "pale-yellow", stroke: colors.orange }}
      >
        <Port id="voice" side="right" />
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
      layout={{ kind: "column", gap: "large" }}
      style={{ fill: "near-white", stroke: colors.muted }}
    >
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
        <Port id="driver" side="left" />
        {/* fixed order keeps the three corridor tracks side by side */}
        <PortGroup id="loop" order="fixed">
          <Port id="tasks" side="bottom" />
          <Port id="speech" side="bottom" />
          <Port id="progress" side="bottom" />
        </PortGroup>
      </Node>

      <Node
        id="speak-now"
        shape="diamond"
        label={"Speak\nnow?"}
        role="decision"
        style={{ fill: "pale-yellow", stroke: colors.orange }}
      />

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
        <PortGroup id="loop" order="fixed">
          <Port id="tasks" side="top" />
          <Port id="speech" side="top" />
          <Port id="progress" side="top" />
        </PortGroup>
        <Port id="remote" side="right" />
        <Port id="local-context" side="bottom" />
        <Port id="road-knowledge" side="bottom" />
      </Node>

      <Row id="knowledge" gap="large" align="stretch">
        <Node
          id="local-context"
          role="knowledge-source"
          style={{ fill: "near-white", stroke: colors.muted }}
        >
          <Text>Local Markdown context</Text>
          <Text>Soul · Preferences · Today</Text>
          <Text>· Memory</Text>
          <Port id="harness" side="top" />
        </Node>
        <Node
          id="road-knowledge"
          role="knowledge-source"
          style={{ fill: "near-white", stroke: colors.muted }}
        >
          <Text>Live road knowledge</Text>
          <Text>MapKit · Overpass ·</Text>
          <Text>Wikipedia</Text>
          <Port id="harness" side="top" />
        </Node>
      </Row>

      {/* the conversational loop runs in the implicit corridor around the
          decision diamond; no channel declarations needed */}
      <Line
        id="accept-road-task"
        from="voice-agent.tasks"
        to="road-agent.tasks"
        label={"accept + refine\nRoad Task"}
        style={{ stroke: colors.blue }}
      />
      <Line
        id="speak"
        from="road-agent.speech"
        to="voice-agent.speech"
        style={{ stroke: colors.orange }}
      >
        <Segment via="speak-now" />
      </Line>
      <Line
        id="progress"
        from="road-agent.progress"
        to="voice-agent.progress"
        label={"progress +\nstructured result"}
        style={{ stroke: colors.green }}
      />
      <Line
        id="local-memory"
        from="road-agent.local-context"
        to="local-context.harness"
        heads="both"
        style={{ stroke: colors.muted }}
      />
      <Line
        id="live-knowledge"
        from="road-agent.road-knowledge"
        to="road-knowledge.harness"
        heads="both"
        style={{ stroke: colors.muted }}
      />
    </Scope>
  );
}

function UserOwnedAgents() {
  return (
    <Scope
      id="user-owned"
      label="User-owned agents"
      role="remote-agents"
      layout={{ kind: "column", gap: "large" }}
      style={{ fill: "pale-purple", stroke: colors.purple }}
    >
      <Text role="caption">private travel memory,</Text>
      <Text role="caption">wiki, bookings &amp; research</Text>

      <Node
        id="travel-agent"
        role="named-agent"
        style={{ fill: "light-purple", stroke: colors.purple }}
      >
        <Text role="heading">Named travel agent</Text>
        <Text role="heading">situated delegation</Text>
        <Port id="request" side="left" />
        <Port id="tools" side="bottom" cardinality="many" />
      </Node>

      <Node id="openclaw" role="agent-tool" style={{ stroke: colors.purple }}>
        <Text>OpenClaw</Text>
        <Text>Gateway</Text>
        <Text>/v1/responses</Text>
        <Port id="request" side="left" />
      </Node>
      <Node id="hermes-webui" role="agent-tool" style={{ stroke: colors.purple }}>
        <Text>Hermes WebUI</Text>
        <Text>background task API</Text>
        <Port id="request" side="left" />
      </Node>
      <Node id="hermes-api" role="agent-tool" style={{ stroke: colors.purple }}>
        <Text>Hermes Agent API</Text>
        <Text>stateful runs /</Text>
        <Text>responses</Text>
        <Port id="request" side="left" />
      </Node>

      {/* fan-out shares one trunk in the container's left padding band
          and branches as late as possible (the group default) */}
      {[
        ["openclaw", "openclaw.request"],
        ["hermes-webui", "hermes-webui.request"],
        ["hermes-api", "hermes-api.request"],
      ].map(([id, target]) => (
        <Line
          key={id}
          id={`to-${id}`}
          from="travel-agent.tools"
          to={target}
          style={{ stroke: colors.purple }}
          share={{ group: "travel-tools", mode: "merge" }}
        >
          <Segment through={padding("user-owned", "left")} />
        </Line>
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

    <Row id="system" align="center" gap="xlarge">
      <Driver />
      <Phone />
      <UserOwnedAgents />
    </Row>

    <Line
      id="driver-conversation"
      from="driver.voice"
      to="phone/voice-agent.driver"
      heads="both"
      style={{ stroke: colors.blue }}
    />

    {/* climbs out of the phone, runs through the whitespace between the
        containers, and carries its label along that run */}
    <Line
      id="remote-delegation"
      from="phone/road-agent.remote"
      to="user-owned/travel-agent.request"
      style={{ stroke: colors.purple }}
    >
      <Segment
        through={gap("phone", "user-owned")}
        label="drive context + exact request"
        labelOrientation="along"
      />
    </Line>
  </Diagram>
);
