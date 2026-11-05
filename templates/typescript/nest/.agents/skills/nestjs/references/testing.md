# Testing

## Do

- Unit: `Test.createTestingModule` — mock **ports**, not Nest internals
- E2E: Supertest against a real (or test) app module; assert HTTP contracts
- Replace infrastructure adapters with fakes at the module boundary
- Cover auth failures, validation errors, and happy path per use case

## Don't

- Hit real DBs/queues in unit tests
- Assert on private Nest wiring details
- Share mutable module state across tests without reset
