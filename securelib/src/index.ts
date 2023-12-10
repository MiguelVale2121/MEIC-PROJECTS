import * as crypto from "crypto";

interface CipherResult {
  data: string;
  nonce: string;
}
export interface ProtectedData {
  mic: string;
  nonce: string;
  data: string;
}

export interface AsymmetricKeys {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
}

// Auxiliary functions

export function secureHash(data: any): string {
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify(data));
  return hash.digest("base64");
}

function createMIC(cipheredData: CipherResult): string {
  return secureHash(JSON.stringify(cipheredData));
}

function micMatch(mic: string, cipheredData: CipherResult): boolean {
  return createMIC(cipheredData) === mic;
}

function cipherData(data: any, secret: crypto.KeyObject): CipherResult {
  const nonce = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", secret, nonce);
  const encrypted = cipher.update(JSON.stringify(data));

  return {
    data: Buffer.concat([encrypted, cipher.final()]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
}

export function decipherData(
  cipheredData: ProtectedData,
  secret: crypto.KeyObject
): any {
  const nonce = Buffer.from(cipheredData.nonce, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", secret, nonce);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipheredData.data, "base64")),
    decipher.final(),
  ]).toString();

  return JSON.parse(decrypted);
}

export function encryptAsymmetricData(
  data: any,
  publicKey: crypto.KeyObject
): string {
  const encryptedBuffer = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(JSON.stringify(data))
  );

  return encryptedBuffer.toString("base64");
}

export function decryptAsymmetricData(
  cipheredData: ProtectedData,
  privateKey: crypto.KeyObject
): any {
  const decryptedBuffer = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(cipheredData.data, "base64")
  );

  return JSON.parse(decryptedBuffer.toString());
}

// Exported functions
export function generateSymmetricKey() {
  const symmetricKey = crypto.createSecretKey(crypto.randomBytes(32));

  return symmetricKey;
}

export function generateAsymmetricKeys() {
  var keys = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return {
    publicKey: crypto.createPublicKey({
      key: keys.publicKey,
      format: "pem",
      type: "spki",
    }),
    privateKey: crypto.createPrivateKey({
      key: keys.privateKey,
      format: "pem",
      type: "pkcs8",
    }),
  };
}

export function signData(data: any, privateKey: crypto.KeyObject): string {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(JSON.stringify(data));
  return sign.sign(privateKey, "base64");
}

export function checkSignature(
  data: any,
  signature: string,
  publicKey: crypto.KeyObject
): boolean {
  const signatureChecker = crypto.createVerify("RSA-SHA256");
  signatureChecker.update(JSON.stringify(data));
  return signatureChecker.verify(publicKey, signature, "base64");
}

export function protect(data: any, secret: crypto.KeyObject): ProtectedData {
  const cipheredData = cipherData(data, secret);

  if (!cipheredData) {
    throw new Error("Failed to cipher data.");
  }

  return {
    mic: createMIC(cipheredData),
    nonce: cipheredData.nonce,
    data: cipheredData.data,
  };
}

export function protectAsymmetric(data: any, secret: crypto.KeyObject) {
  const cipheredData = encryptAsymmetricData(data, secret);

  if (!cipheredData) {
    throw new Error("Failed to cipher data.");
  }

  return {
    mic: secureHash(JSON.stringify(cipheredData)),
    data: cipheredData,
  };
}

export function check(data: ProtectedData): boolean {
  return micMatch(data.mic, {
    data: data.data,
    nonce: data.nonce,
  });
}

export function unprotect(
  protectedData: ProtectedData,
  key: crypto.KeyObject
): any {
  if (!check(protectedData)) {
    throw new Error("Failed to decipher: compromised data!");
  }

  return decipherData(protectedData, key);
}

export function unprotectAsymmetric(
  protectedData: ProtectedData,
  key: crypto.KeyObject
): any {
  if (!check(protectedData)) {
    throw new Error("Failed to decipher: compromised data!");
  }

  return decryptAsymmetricData(protectedData, key);
}
