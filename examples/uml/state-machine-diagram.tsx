// Pre-implementation UML grammar example. A composite state owns its nested
// state machine while transitions may cross that boundary.

import { Diagram, Grid, Title } from "@excalmermaid/core";
import { UmlPseudostate, UmlRelation, UmlState } from "./uml";

export default (
  <Diagram id="uml-state-machine-example" theme="uml">
    <Title>Order lifecycle — state-machine diagram</Title>

    <Grid id="states" columns={3} gap="large" order="prefer-source">
      <UmlPseudostate id="initial" kind="initial" />
      <UmlState id="draft" name="Draft" entry="create basket" />
      <UmlState id="submitted" name="Submitted" entry="freeze prices" />

      <UmlState id="processing" name="Processing" doActivity="coordinate payment and inventory">
        <UmlPseudostate id="history" kind="history" />
        <UmlState id="authorizing" name="Authorizing payment" />
        <UmlState id="reserving" name="Reserving inventory" />
        <UmlPseudostate id="complete" kind="final" />

        <UmlRelation id="history-authorizing" kind="transition" from="history" to="authorizing" />
        <UmlRelation id="authorizing-reserving" kind="transition" from="authorizing" to="reserving" name="authorized" />
        <UmlRelation id="reserving-complete" kind="transition" from="reserving" to="complete" name="reserved" />
      </UmlState>

      <UmlState id="fulfilled" name="Fulfilled" entry="emit OrderFulfilled" />
      <UmlState id="cancelled" name="Cancelled" entry="release reservations" />
      <UmlPseudostate id="final" kind="final" />
    </Grid>

    <UmlRelation id="begin" kind="transition" from="states/initial" to="states/draft" />
    <UmlRelation id="submit" kind="transition" from="states/draft" to="states/submitted" name="submit" guard="basket not empty" />
    <UmlRelation id="process" kind="transition" from="states/submitted" to="states/processing/history" name="paymentRequested" />
    <UmlRelation id="fulfil" kind="transition" from="states/processing/complete" to="states/fulfilled" name="processingComplete" />
    <UmlRelation id="cancel-submitted" kind="transition" from="states/submitted" to="states/cancelled" name="cancel" />
    <UmlRelation id="cancel-processing" kind="transition" from="states/processing" to="states/cancelled" name="cancel" />
    <UmlRelation id="finish-fulfilled" kind="transition" from="states/fulfilled" to="states/final" />
    <UmlRelation id="finish-cancelled" kind="transition" from="states/cancelled" to="states/final" />
  </Diagram>
);
