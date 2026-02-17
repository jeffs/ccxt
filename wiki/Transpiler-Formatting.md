# Transpiler Formatting

The CCXT transpiler (`build/transpile.ts`, `build/transpileWS.ts`) converts TypeScript exchange files into JavaScript, Python, PHP, C#, and Go. It is **not** an AST-based tool — it uses regex-based parsing with strict formatting assumptions. Exchange `.ts` files that don't follow these rules will crash the transpiler.

## How the transpiler parses methods

The class body is split into individual methods using double-newline as the delimiter:

```ts
const methods = classBody.trim().split(/\n\s*\n/)
```

Then the **first line** of each chunk is taken as the method signature:

```ts
let signature = lines[0].trim()
```

And matched against this regex:

```ts
/(async |)(\S+)\s\(([^)]*)\)\s*(?::\s+(\S+))?\s*{/
```

These mechanics impose the following constraints.

## Rule 1: No blank lines inside method bodies

A blank line within a method body splits it into multiple "chunks", each of which the transpiler tries to parse as a separate method. The second chunk won't have a valid signature and the transpiler crashes.

**Bad:**
```ts
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'myexchange',

            'has': {
                'fetchTicker': true,
            },
        });
    }
```

**Good:**
```ts
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'myexchange',
            'has': {
                'fetchTicker': true,
            },
        });
    }
```

## Rule 2: Method signatures must be on a single line

The transpiler only looks at `lines[0]` for the signature. Multi-line signatures cause the regex to fail.

**Bad:**
```ts
    async fetchTickers (
        symbols: Strings = undefined,
        params = {},
    ): Promise<Tickers> {
```

**Good:**
```ts
    async fetchTickers (symbols: Strings = undefined, params = {}): Promise<Tickers> {
```

## Rule 3: Space before `(` in method signatures

The regex `(\S+)\s\(` requires whitespace between the method name and the opening paren. Standard TS style `describe()` does not match.

**Bad:**
```ts
    describe() {
    async fetchMarkets(params = {}) {
```

**Good:**
```ts
    describe () {
    async fetchMarkets (params = {}) {
```

## Rule 4: No standalone comment blocks between methods

Since the transpiler splits on blank lines, a comment block surrounded by blank lines becomes its own "method" chunk with no valid signature. Either remove it or move the comment inside the next method body (not on the first line — the first line must be the signature).

**Bad:**
```ts
    }

    // ========================================
    //  Section header
    // ========================================

    async fetchMarkets (params = {}) {
```

**Good** (comment inside method body):
```ts
    }

    async fetchMarkets (params = {}) {
        // Section: public market data
```

**Also good** (no comment at all):
```ts
    }

    async fetchMarkets (params = {}) {
```

## Rule 5: Indentation — 4 spaces

All exchange files use 4-space indentation (not 2-space, no tabs). The transpiled Python/PHP output preserves indentation as-is.

## Reference

- Transpiler source: `build/transpile.ts`
- Working example: `ts/src/phemex.ts`
