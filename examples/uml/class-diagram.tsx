// Pre-implementation UML grammar example. No absolute coordinates.

import { Diagram, Grid, Title } from "@excalmermaid/core";
import { UmlClass, UmlPackage, UmlRelation } from "./uml";

export default (
  <Diagram id="uml-class-example" theme="uml">
    <Title>Order domain — class diagram</Title>

    <UmlPackage id="sales" name="sales">
      <Grid id="model" columns={3} gap="large" order="prefer-source">
        <UmlClass
          id="customer"
          name="Customer"
          attributes={[
            { visibility: "-", text: "id: CustomerId" },
            { visibility: "-", text: "email: Email" },
          ]}
          operations={[{ visibility: "+", text: "placeOrder(cart: Cart): Order" }]}
          ports={[
            { id: "orders", side: "right" },
            { id: "payments", side: "bottom" },
          ]}
        />

        <UmlClass
          id="order"
          name="Order"
          attributes={[
            { visibility: "-", text: "number: OrderNumber" },
            { visibility: "-", text: "status: OrderStatus" },
          ]}
          operations={[
            { visibility: "+", text: "add(item: Product, quantity: int)" },
            { visibility: "+", text: "total(): Money" },
          ]}
          ports={[
            { id: "customer", side: "left" },
            { id: "items", side: "bottom" },
            { id: "payment", side: "right" },
          ]}
        />

        <UmlClass
          id="line-item"
          name="LineItem"
          attributes={[
            { visibility: "-", text: "quantity: int" },
            { visibility: "-", text: "unitPrice: Money" },
          ]}
          ports={[{ id: "order", side: "top" }]}
        />

        <UmlClass id="payment-method" name="PaymentMethod" abstract />
        <UmlClass id="credit-card" name="CreditCardPayment" />
        <UmlClass id="payment-authorizer" name="PaymentAuthorizer" stereotype="interface" />
        <UmlClass id="stripe-authorizer" name="StripeAuthorizer" />
        <UmlClass id="order-repository" name="OrderRepository" stereotype="interface" />
      </Grid>

      <UmlRelation
        id="customer-orders"
        kind="association"
        from="model/customer.orders"
        to="model/order.customer"
        fromRole="customer"
        fromMultiplicity="1"
        toRole="orders"
        toMultiplicity="0..*"
      />
      <UmlRelation
        id="order-items"
        kind="composition"
        from="model/order.items"
        to="model/line-item.order"
        fromMultiplicity="1"
        toMultiplicity="1..*"
      />
      <UmlRelation
        id="credit-card-generalization"
        kind="generalization"
        from="model/credit-card"
        to="model/payment-method"
      />
      <UmlRelation
        id="customer-payment-methods"
        kind="aggregation"
        from="model/customer.payments"
        to="model/payment-method"
        fromMultiplicity="1"
        toMultiplicity="0..*"
      />
      <UmlRelation
        id="stripe-realization"
        kind="realization"
        from="model/stripe-authorizer"
        to="model/payment-authorizer"
      />
      <UmlRelation
        id="order-payment"
        kind="directed-association"
        from="model/order.payment"
        to="model/payment-method"
        name="pays with"
        toMultiplicity="1"
      />
      <UmlRelation
        id="repository-dependency"
        kind="dependency"
        from="model/order"
        to="model/order-repository"
        name="persists through"
      />
    </UmlPackage>
  </Diagram>
);
