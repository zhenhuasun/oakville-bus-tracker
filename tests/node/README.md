(File layout described here is the target state; files arrive in Commits 2/4/5.)

# tests/node/ — offline Node regression gates

Each file is standalone: node tests/node/<file>.mjs. They run the
real public/index.html inline script in Node with a stub DOM (vm)
plus stub localStorage/fetch, and read served data from
../../public. They use a bespoke check(name, cond) helper that
counts failures and exits non-zero — they are NOT node:test format,
so package.json runs them with explicit paths
(node --test tests/node/test_*.mjs), not a bare directory argument.

Default suite (npm test) excludes node/live/ (live feeds) and
archive/tests/ (historical verifications).
