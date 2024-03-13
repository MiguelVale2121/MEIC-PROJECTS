import * as crypto from "crypto";

interface CipherResult {
  data?: string;
  nonce: string;
}

export interface ProtectedData {
  mic: string;
  nonce: string;
  data: string;
}

export interface ResponseProtectedData {
  mic: string;
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

export function micMatch(mic: string, cipheredData: any): boolean {
  return secureHash(cipheredData) === mic;
}

export function generateMac(data: any, privateKey: crypto.KeyObject) {
  const hmac = crypto.createHmac("sha256", privateKey);
  hmac.update(JSON.stringify(data));
  return hmac.digest("base64");
}

export function verifyMac(
  data: any,
  privateKey: crypto.KeyObject,
  hmacToCompare: string
) {
  return hmacToCompare === generateMac(data, privateKey);
}

export function cipherData(data: any, secret: crypto.KeyObject): CipherResult {
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

  let dataObject;

  try {
    dataObject = JSON.parse(decrypted);
  } catch (e) {
    dataObject = {};
  }

  return dataObject;
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
  cipheredData: ProtectedData | ResponseProtectedData,
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
    mic: secureHash({
      nonce: cipheredData.nonce,
      data: data,
    }),
    nonce: cipheredData.nonce,
    data: cipheredData.data!,
  };
}

export function protectAsymmetricClient(
  data: any,
  publicKey: crypto.KeyObject
) {
  const cipheredData: CipherResult = {
    data: encryptAsymmetricData(data, publicKey),
    nonce: crypto.randomBytes(16).toString("base64"),
  };

  if (!cipheredData) {
    throw new Error("Failed to cipher data.");
  }

  return {
    mic: secureHash({
      nonce: cipheredData.nonce,
      data: data,
    }),
    nonce: cipheredData.nonce,
    data: cipheredData.data!,
  };
}

export function protectAsymmetricServer(
  data: any,
  publicKey: crypto.KeyObject
) {
  const cipheredData = encryptAsymmetricData(data, publicKey);

  if (!cipheredData) {
    throw new Error("Failed to cipher data.");
  }

  return {
    mic: secureHash(data),
    data: cipheredData,
  };
}

export function check(data: ProtectedData): boolean {
  return micMatch(data.mic, {
    nonce: data.nonce,
    data: data.data,
  });
}

export function unprotect(
  protectedData: ProtectedData,
  key: crypto.KeyObject
): any {
  let decipheredData = decipherData(protectedData, key);

  if (
    !check({
      ...protectedData,
      data: decipheredData,
    })
  ) {
    throw new Error("Failed to decipher: compromised data!");
  }

  return decipheredData;
}

export function unprotectAsymmetric(
  protectedData: ResponseProtectedData,
  key: crypto.KeyObject
): any {
  let decryptedData = decryptAsymmetricData(protectedData, key);

  if (!micMatch(protectedData.mic, decryptedData)) {
    throw new Error("Failed to decipher: compromised data!");
  }

  return decryptedData;
}
