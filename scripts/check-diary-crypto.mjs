// 일기 암호화 자가 점검. 실행: node scripts/check-diary-crypto.mjs  (Node 22.6+, WebCrypto 내장)
import assert from "node:assert/strict";
import {
	createDiaryEncryption, unlockDiaryKey, encryptText, decryptText, keyMatchesConfig,
	isEncryptedValue, isValidEncryptionConfig, WrongPassphraseError, DIARY_ENC_PREFIX,
} from "../src/lib/diaryCrypto.ts";

const ITER = 100_000; // 점검 속도용 (실사용 기본값 310k)
const { config, key } = await createDiaryEncryption("correct horse battery", ITER);
assert.ok(isValidEncryptionConfig(config));

// 왕복 (한글·이모지 포함)
const text = "오늘은 산책을 했다 🌿 Long day.";
const enc = await encryptText(key, text);
assert.ok(enc.startsWith(DIARY_ENC_PREFIX) && !enc.includes("산책"));
assert.equal(await decryptText(key, enc), text);
// 같은 평문도 매번 다른 암호문 (IV 무작위)
assert.notEqual(await encryptText(key, text), enc);
// 빈 값은 그대로
assert.equal(await encryptText(key, ""), "");
// 암호화 전 평문 데이터는 그대로 통과
assert.equal(await decryptText(key, "plain legacy diary"), "plain legacy diary");
assert.ok(!isEncryptedValue("plain"));

// 같은 비밀번호로 잠금 해제 → 같은 데이터 복호화
const key2 = await unlockDiaryKey("correct horse battery", config);
assert.equal(await decryptText(key2, enc), text);
assert.ok(await keyMatchesConfig(key2, config));

// 틀린 비밀번호 거부
await assert.rejects(unlockDiaryKey("wrong password!", config), WrongPassphraseError);

// 다른 설정(비밀번호 변경 후)의 키는 맞지 않음
const other = await createDiaryEncryption("another passphrase", ITER);
assert.equal(await keyMatchesConfig(other.key, config), false);
await assert.rejects(decryptText(other.key, enc));

// 변조 감지 (암호문 1글자 변경)
const [, , iv, ct] = enc.split(":");
const flipped = ct[5] === "A" ? "B" : "A";
const tampered = `${DIARY_ENC_PREFIX}${iv}:${ct.slice(0, 5)}${flipped}${ct.slice(6)}`;
await assert.rejects(decryptText(key, tampered));
await assert.rejects(decryptText(key, `${DIARY_ENC_PREFIX}broken`));

// 짧은 비밀번호 거부, 잘못된 설정 거부
await assert.rejects(createDiaryEncryption("short"));
assert.ok(!isValidEncryptionConfig({ v: 1, salt: "x", iterations: 1000, verifier: config.verifier }));
assert.ok(!isValidEncryptionConfig(null));

console.log("diary crypto checks: OK");
