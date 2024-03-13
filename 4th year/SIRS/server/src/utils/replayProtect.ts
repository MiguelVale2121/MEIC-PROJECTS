import { BadRequestException } from "@nestjs/common";
import { Cache } from "cache-manager";

export async function checkNonce(cache: Cache, nonce: string) {
  if (await cache.get(nonce)) {
    throw new BadRequestException("Repeated nonce: Possible Replay Attack!");
  } else {
    await cache.set(nonce, true);
  }
}
