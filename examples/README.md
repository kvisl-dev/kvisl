# Examples

The examples are design inputs for the language. They do not require a compiler or renderer to exist yet.

## Visual reference fixtures

These directories pair a supplied drawing with the TSX model intended to reproduce it:

- [`vegvisir-voice-agents/`](vegvisir-voice-agents/)
- [`modelplane-fleet-inference/`](modelplane-fleet-inference/)
- [`agent-substrate/`](agent-substrate/)
- [`machine-thought-os/`](machine-thought-os/)

Each visual fixture contains `original.png` and `diagram.tsx`.

## Grammar-coverage examples

[`uml/`](uml/) contains TSX-only examples for the principal UML diagram families. They test whether the core model can host a broad notation as a composable library. They are not tied to a supplied bitmap and therefore do not have `original.png` files.
