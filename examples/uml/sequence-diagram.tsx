// Pre-implementation UML grammar example. Message order is logical; shared
// occurrence rows are expressed by constraints rather than Y coordinates.

import { Constraint, Diagram, Row, Scope, Title } from "@excalmermaid/core";
import { UmlLifeline, UmlRelation } from "./uml";

const slots = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"] as const;

export default (
  <Diagram id="uml-sequence-example" theme="uml">
    <Title>Place an order — sequence diagram</Title>

    <Row id="lifelines" gap="large" order="fixed" align="start">
      <UmlLifeline id="customer" name="customer: Customer" events={slots} />
      <UmlLifeline
        id="checkout"
        name="checkout: CheckoutService"
        events={slots}
        activations={[{ id: "activation", from: "m1", to: "m8" }]}
      />
      <UmlLifeline
        id="inventory"
        name="inventory: InventoryService"
        events={slots}
        activations={[{ id: "activation", from: "m2", to: "m3" }]}
      />
      <UmlLifeline
        id="payment"
        name="payment: PaymentProvider"
        events={slots}
        activations={[{ id: "activation", from: "m4", to: "m7" }]}
      />
    </Row>

    {slots.map((slot) => (
      <Constraint
        key={`${slot}-row`}
        id={`${slot}-row`}
        kind="align"
        edge="center-y"
        members={[
          `lifelines/customer/${slot}`,
          `lifelines/checkout/${slot}`,
          `lifelines/inventory/${slot}`,
          `lifelines/payment/${slot}`,
        ]}
        strength="required"
      />
    ))}

    <UmlRelation id="submit" kind="message" sequence="1" from="lifelines/customer/m1.message" to="lifelines/checkout/m1.message" name="submit(order)" />
    <UmlRelation id="reserve" kind="message" sequence="2" from="lifelines/checkout/m2.message" to="lifelines/inventory/m2.message" name="reserve(items)" />
    <UmlRelation id="reserved" kind="reply" sequence="2.1" from="lifelines/inventory/m3.message" to="lifelines/checkout/m3.message" name="reservation" />
    <UmlRelation id="authorize" kind="message" sequence="3" from="lifelines/checkout/m4.message" to="lifelines/payment/m4.message" name="authorize(total)" />

    <Scope id="payment-retry" role="uml-combined-fragment" label="loop [pending and attempts < 3]">
      <UmlRelation id="poll" kind="message" sequence="3.1" from="../lifelines/checkout/m5.message" to="../lifelines/payment/m5.message" name="status()" />
      <UmlRelation id="pending" kind="reply" sequence="3.2" from="../lifelines/payment/m6.message" to="../lifelines/checkout/m6.message" name="pending" />
    </Scope>
    <Constraint
      id="payment-retry-frame"
      kind="inside"
      container="payment-retry"
      members={[
        "lifelines/checkout/m5",
        "lifelines/payment/m5",
        "lifelines/checkout/m6",
        "lifelines/payment/m6",
      ]}
      strength="required"
    />

    <UmlRelation id="authorized" kind="reply" sequence="3.3" from="lifelines/payment/m7.message" to="lifelines/checkout/m7.message" name="authorized" />
    <UmlRelation id="confirmation" kind="reply" sequence="4" from="lifelines/checkout/m8.message" to="lifelines/customer/m8.message" name="confirmation" />
  </Diagram>
);
