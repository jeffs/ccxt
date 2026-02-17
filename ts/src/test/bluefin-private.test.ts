// NO_AUTO_TRANSPILE
//
// Standalone unit tests for Bluefin private API primitives.
// Run: npx tsx ts/src/test/bluefin-private.test.ts

import assert from 'assert';
import { ed25519 } from '../static_dependencies/noble-curves/ed25519.js';
import { blake2b } from '../static_dependencies/noble-hashes/blake2b.js';
import { concatBytes, utf8ToBytes } from '../static_dependencies/noble-hashes/utils.js';
import bluefin from '../bluefin.js';

// ---------------------------------------------------------------------------
// Helper: create a bluefin instance with a known test keypair
// (never hits the network — we only call synchronous methods)
// ---------------------------------------------------------------------------

const TEST_PRIVATE_KEY = '0x3427d19dcf5781f0874c36c78aec22c03acda435d69efcbf249e8821793567a1';
const TEST_KEY_BYTES = Uint8Array.from (Buffer.from (TEST_PRIVATE_KEY.replace ('0x', ''), 'hex'));
const TEST_PUBLIC_KEY = ed25519.getPublicKey (TEST_KEY_BYTES);

function makeBluefin (): bluefin {
    return new bluefin ({
        'walletAddress': '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        'privateKey': TEST_PRIVATE_KEY,
    });
}

// =========================================================================
// Layer 1: BCS ULEB128 serialization
// =========================================================================

function testBcsSerializeBytes () {
    const bf = makeBluefin ();

    // Empty input → length 0 prefix only
    const empty = bf.bcsSerializeBytes (new Uint8Array ([]));
    assert.strictEqual (empty.length, 1);
    assert.strictEqual (empty[0], 0);

    // Small input (< 128 bytes) → single-byte length prefix
    const small = new Uint8Array ([ 0x41, 0x42, 0x43 ]); // "ABC"
    const encoded = bf.bcsSerializeBytes (small);
    assert.strictEqual (encoded.length, 4); // 1 byte prefix + 3 bytes
    assert.strictEqual (encoded[0], 3);
    assert.deepStrictEqual (Array.from (encoded.slice (1)), [ 0x41, 0x42, 0x43 ]);

    // Exactly 128 bytes → two-byte ULEB128 prefix (0x80, 0x01)
    const medium = new Uint8Array (128).fill (0xff);
    const encodedMedium = bf.bcsSerializeBytes (medium);
    assert.strictEqual (encodedMedium.length, 130); // 2 byte prefix + 128 bytes
    assert.strictEqual (encodedMedium[0], 0x80);
    assert.strictEqual (encodedMedium[1], 0x01);

    // 300 bytes → ULEB128 of 300 = [0xAC, 0x02]
    const large = new Uint8Array (300).fill (0xaa);
    const encodedLarge = bf.bcsSerializeBytes (large);
    assert.strictEqual (encodedLarge.length, 302); // 2 byte prefix + 300 bytes
    assert.strictEqual (encodedLarge[0], 0xac); // 300 & 0x7f | 0x80 = 0xac
    assert.strictEqual (encodedLarge[1], 0x02); // 300 >> 7 = 2

    console.log ('  ✓ BCS ULEB128 serialization');
}

// =========================================================================
// Layer 2: suiSignPersonalMessage
// =========================================================================

function testSuiSignPersonalMessage () {
    const bf = makeBluefin ();
    const message = utf8ToBytes ('hello world');

    const sig = bf.suiSignPersonalMessage (message, TEST_PRIVATE_KEY);

    // Decode from base64
    const envelope = Uint8Array.from (Buffer.from (sig, 'base64'));

    // Envelope must be exactly 97 bytes: 1 (flag) + 64 (sig) + 32 (pubkey)
    assert.strictEqual (envelope.length, 97, `envelope length is ${envelope.length}, expected 97`);

    // First byte is Ed25519 flag = 0x00
    assert.strictEqual (envelope[0], 0x00, 'first byte should be Ed25519 flag 0x00');

    // Last 32 bytes should be the public key
    const pubkeyFromEnvelope = envelope.slice (65);
    assert.deepStrictEqual (pubkeyFromEnvelope, TEST_PUBLIC_KEY, 'pubkey in envelope must match');

    // Verify the signature: reconstruct the digest
    const bcsMsg = bf.bcsSerializeBytes (message);
    const intentMsg = concatBytes (new Uint8Array ([ 3, 0, 0 ]), bcsMsg);
    const digest = blake2b (intentMsg, { dkLen: 32 });
    const rawSig = envelope.slice (1, 65);
    assert (ed25519.verify (rawSig, digest, TEST_PUBLIC_KEY), 'ed25519.verify must succeed');

    // Deterministic: same input → same output
    const sig2 = bf.suiSignPersonalMessage (message, TEST_PRIVATE_KEY);
    assert.strictEqual (sig, sig2, 'signing must be deterministic');

    // Different message → different signature
    const sig3 = bf.suiSignPersonalMessage (utf8ToBytes ('goodbye'), TEST_PRIVATE_KEY);
    assert.notStrictEqual (sig, sig3, 'different messages must produce different signatures');

    console.log ('  ✓ suiSignPersonalMessage (envelope, verify, determinism)');
}

// =========================================================================
// Layer 3: E9 roundtrips
// =========================================================================

function testE9Roundtrips () {
    const bf = makeBluefin ();

    // Basic roundtrip: parseE9(toE9(x)) === x
    const cases = [ '1', '0.5', '100', '0.000000001', '99999999.999999999', '0' ];
    for (const val of cases) {
        const e9 = bf.toE9 (val);
        const back = bf.parseE9 (e9);
        assert.strictEqual (back, val, `roundtrip failed for ${val}: toE9=${e9}, parseE9=${back}`);
    }

    // Known values
    assert.strictEqual (bf.toE9 ('1'), '1000000000');
    assert.strictEqual (bf.toE9 ('0.5'), '500000000');
    assert.strictEqual (bf.parseE9 ('1000000000'), '1');
    assert.strictEqual (bf.parseE9 ('500000000'), '0.5');

    // Undefined passthrough
    assert.strictEqual (bf.parseE9 (undefined), undefined);
    assert.strictEqual (bf.toE9 (undefined), undefined);

    console.log ('  ✓ E9 roundtrips');
}

// =========================================================================
// Layer 4: UI payload JSON format
// =========================================================================

function testUIPayloadJson () {
    // Verify JSON.stringify matches SDK's 2-space indent format
    const orderPayload = {
        'type': 'Bluefin Pro Order' as const,
        'ids': 'ids-123',
        'account': '0xabc',
        'market': 'BTC_USD',
        'price': '50000000000000',
        'quantity': '1000000000',
        'leverage': '5000000000',
        'side': 'BUY',
        'positionType': 'CROSS' as const,
        'expiration': '1700000000000',
        'salt': '123456',
        'signedAt': '1699999999000',
    };
    const json = JSON.stringify (orderPayload, null, 2);
    // Must have 2-space indentation
    assert (json.includes ('  "type"'), 'JSON must use 2-space indent');
    // Must preserve field order (JS objects maintain insertion order)
    const lines = json.split ('\n');
    assert (lines[1].trim ().startsWith ('"type"'), 'first field must be "type"');
    assert (lines[2].trim ().startsWith ('"ids"'), 'second field must be "ids"');

    // Leverage payload
    const leveragePayload = {
        'type': 'Bluefin Pro Leverage Adjustment' as const,
        'ids': 'ids-123',
        'account': '0xabc',
        'market': 'BTC_USD',
        'leverage': '10000000000',
        'salt': '789',
        'signedAt': '1699999999000',
    };
    const leverageJson = JSON.stringify (leveragePayload, null, 2);
    assert (leverageJson.includes ('"Bluefin Pro Leverage Adjustment"'));

    // Withdraw payload
    const withdrawPayload = {
        'type': 'Bluefin Pro Withdrawal' as const,
        'eds': 'eds-456',
        'assetSymbol': 'USDC',
        'account': '0xabc',
        'amount': '100000000000',
        'salt': '111',
        'signedAt': '1699999999000',
    };
    const withdrawJson = JSON.stringify (withdrawPayload, null, 2);
    assert (withdrawJson.includes ('"Bluefin Pro Withdrawal"'));
    assert (withdrawJson.includes ('"eds"'));

    // Margin payload
    const marginPayload = {
        'type': 'Bluefin Pro Margin Adjustment' as const,
        'ids': 'ids-123',
        'account': '0xabc',
        'market': 'BTC_USD',
        'add': true,
        'amount': '50000000000',
        'salt': '222',
        'signedAt': '1699999999000',
    };
    const marginJson = JSON.stringify (marginPayload, null, 2);
    assert (marginJson.includes ('"Bluefin Pro Margin Adjustment"'));
    assert (marginJson.includes ('"add": true'));

    console.log ('  ✓ UI payload JSON format');
}

// =========================================================================
// Layer 5: signTradeRequest
// =========================================================================

function testSignTradeRequest () {
    const bf = makeBluefin ();

    const payload = {
        'type': 'Bluefin Pro Order' as const,
        'ids': 'ids-123',
        'account': '0xabc',
        'market': 'BTC_USD',
        'price': '50000000000000',
        'quantity': '1000000000',
        'leverage': '5000000000',
        'side': 'BUY',
        'positionType': 'CROSS' as const,
        'expiration': '1700000000000',
        'salt': '123456',
        'signedAt': '1699999999000',
    };

    const sig1 = bf.signTradeRequest (payload);
    const sig2 = bf.signTradeRequest (payload);
    assert.strictEqual (sig1, sig2, 'signTradeRequest must be deterministic');

    // Decode and verify envelope structure
    const envelope = Uint8Array.from (Buffer.from (sig1, 'base64'));
    assert.strictEqual (envelope.length, 97);
    assert.strictEqual (envelope[0], 0x00);

    // Different payload → different signature
    const payload2 = { ...payload, 'price': '60000000000000' };
    const sig3 = bf.signTradeRequest (payload2);
    assert.notStrictEqual (sig1, sig3, 'different payloads must produce different signatures');

    // The signature should be verifiable against the JSON
    const json = JSON.stringify (payload, null, 2);
    const bcsMsg = bf.bcsSerializeBytes (utf8ToBytes (json));
    const intentMsg = concatBytes (new Uint8Array ([ 3, 0, 0 ]), bcsMsg);
    const digest = blake2b (intentMsg, { dkLen: 32 });
    const rawSig = envelope.slice (1, 65);
    const pubkey = envelope.slice (65);
    assert (ed25519.verify (rawSig, digest, pubkey), 'signTradeRequest signature must verify');

    console.log ('  ✓ signTradeRequest (determinism, verify)');
}

// =========================================================================
// Layer 6: Token state machine predicates
// =========================================================================

function testTokenStateMachine () {
    const bf = makeBluefin ();

    // No token → expired
    assert.strictEqual (bf.isAccessTokenExpired (), true, 'no token should be expired');
    assert.strictEqual (bf.isRefreshTokenValid (), false, 'no refresh token should be invalid');

    // Set up fresh tokens (token set "now", 300s access, 2592000s refresh)
    const nowSeconds = Date.now () / 1000;
    bf.options['accessToken'] = 'test-token';
    bf.options['refreshToken'] = 'test-refresh';
    bf.options['tokenSetAtSeconds'] = nowSeconds;
    bf.options['accessTokenValidForSeconds'] = 300;
    bf.options['refreshTokenValidForSeconds'] = 2592000;

    // Fresh token → not expired
    assert.strictEqual (bf.isAccessTokenExpired (), false, 'fresh token should not be expired');
    assert.strictEqual (bf.isRefreshTokenValid (), true, 'fresh refresh token should be valid');

    // Simulate token set 5 minutes ago (past 80% of 300s = 240s)
    bf.options['tokenSetAtSeconds'] = nowSeconds - 250;
    assert.strictEqual (bf.isAccessTokenExpired (), true, 'old access token should be expired');
    assert.strictEqual (bf.isRefreshTokenValid (), true, 'refresh token should still be valid');

    // Simulate token set long ago (refresh also expired)
    bf.options['tokenSetAtSeconds'] = nowSeconds - 2592000;
    assert.strictEqual (bf.isAccessTokenExpired (), true, 'ancient access token should be expired');
    assert.strictEqual (bf.isRefreshTokenValid (), false, 'ancient refresh token should be invalid');

    // Edge: at exactly 80% of access lifetime
    bf.options['tokenSetAtSeconds'] = nowSeconds - 240;
    assert.strictEqual (bf.isAccessTokenExpired (), true, 'token at 80% lifetime boundary should be expired');

    console.log ('  ✓ Token state machine predicates');
}

// =========================================================================
// Run all
// =========================================================================

function testBluefinPrivate () {
    console.log ('Bluefin private API unit tests:');
    testBcsSerializeBytes ();
    testSuiSignPersonalMessage ();
    testE9Roundtrips ();
    testUIPayloadJson ();
    testSignTradeRequest ();
    testTokenStateMachine ();
    console.log ('All tests passed.');
}

// Allow running directly: npx tsx ts/src/test/bluefin-private.test.ts
// Also exportable for integration into the CCXT test runner.
testBluefinPrivate ();

export default testBluefinPrivate;
