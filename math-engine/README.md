# Maths engine (Haskell)

Build with `sh math-engine/build.sh` (needs GHC on your PATH). The server build
runs this automatically; the compiled executable in `dist/` is not committed.

The service is a real threaded Haskell HTTP server. It uses the GHC standard
libraries and libc sockets (Linux and macOS) instead of depending on a network-time Hackage
package installation. Its private loopback listener is supervised by the Express
server in both development and production. The public endpoints are defined in
`api/spec/openapi.yaml` under `/api/math/*`.

- `Mathematics.hs`: pure differentiation, vectors, matrix operations and generated
  question families. Public puzzles omit the expected solution.
- `Main.hs`: bounded in-memory puzzle state; repeated creation keys return the
  same puzzle, and repeated attempt IDs return the same result.
- `Http.hs`: HTTP/1.1 with bounded request sizes, explicit UTF-8 byte lengths,
  one request per connection, and connection cleanup.
- `Json.hs`: bounded-input JSON encoding/decoding for the service contract.
- `Test.hs`: pure-operation checks and generated-choice invariants.

Question answers are presented as mathematical choices. This avoids pretending
to support arbitrary symbolic algebra. Scalar validation also accepts equivalent
fractions/numbers and ignores whitespace. No JavaScript fallback generates or
validates the maths.

Puzzle state is intentionally not a permanent score store. Server restarts expire
puzzles, which the browser can reissue through its Retry action. The browser owns
health, distance and high-score persistence.
