# Pomi

Pomi is a small, offline-first focus timer for iPhone. It combines a configurable
Pomodoro timer, an open-ended stopwatch, multiple tags per session, and simple
all-time focus metrics.

## Development

Requirements: Node.js 22 or newer and Xcode 16 or newer.

```sh
npm install
npm test
npm run build
```

Run the web development version with `npm run dev`. To rebuild and synchronize
the native project, run `npm run ios:sync`, then open `ios/App/App.xcodeproj` or
run `npm run ios:open`.

## Storage

Settings and the recoverable active timer use Capacitor Preferences. Tags and
session history use SQLite on iOS. The browser development version uses local
storage as a lightweight fallback. Pomi has no accounts, server, analytics, or
network dependency at runtime.

See [PLAN.md](PLAN.md) for behavior, product scope, and release milestones.
