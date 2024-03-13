import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  NotFoundException,
  Inject,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ProtectedData, protect, unprotect, verifyMac } from "@securelib";
import { isBase64, isMongoId, validateSync } from "class-validator";
import { plainToInstance } from "class-transformer";
import { SecureData } from "./secure.dto";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Session } from "src/client/schemas/client.schema";
import { createSecretKey } from "crypto";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { checkNonce } from "src/utils/replayProtect";

@Injectable()
export class SecureDataInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private nonceCache: Cache,
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>
  ) {}

  private readonly logger = new Logger(SecureDataInterceptor.name);

  async intercept(
    context: ExecutionContext,
    handler: CallHandler
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    this.logger.verbose("Received secure data request");
    // Initial headers check
    this.logger.verbose(`Checking security headers...\n`);
    if (
      !req.headers["mic"] ||
      !req.headers["nonce"] ||
      !req.headers["session-id"]
    )
      throw new BadRequestException("Missing security headers");

    if (!isMongoId(req.headers["session-id"]))
      throw new BadRequestException("Invalid session header");

    if (!isBase64(req.headers["mic"]))
      throw new BadRequestException("Invalid integrity code");

    if (!isBase64(req.headers["nonce"]))
      throw new BadRequestException("Invalid nonce");

    this.logger.verbose(`Verifing nonce: ${req.headers["nonce"]}`);
    // Replay attack check
    await checkNonce(this.nonceCache, req.headers["nonce"]);

    // Analyze the risk of not verify the integrity of the "session-id -> report
    this.logger.verbose(`Checking session...\n`);
    const session = await this.sessionModel
      .findById(req.headers["session-id"])
      .exec();

    if (!session) {
      throw new NotFoundException("Invalid session");
    }

    this.logger.verbose(`Found session: ${session._id}`);

    const sessionKey = createSecretKey(
      Buffer.from(session.sessionKey, "base64")
    );

    req.sessionClientId = session.client[0].toString();

    if (Object.keys(req.body).length > 0) {
      let reqDto = plainToInstance(SecureData, req.body);
      const errors = validateSync(reqDto);

      if (errors.length > 0) {
        throw new BadRequestException(errors);
      }

      const protectedPacket: ProtectedData = {
        mic: req.headers["mic"],
        nonce: req.headers["nonce"],
        data: reqDto.data,
      };

      // Decrypt request
      this.logger.verbose("Decrypting data with session key...");
      try {
        req.body = unprotect(protectedPacket, sessionKey);
      } catch (e) {
        throw new BadRequestException("Data decryption fault");
      }
    } else {
      if (
        !verifyMac(
          {
            nonce: req.headers["nonce"],
          },
          sessionKey,
          req.headers["mic"]
        )
      )
        throw new BadRequestException("Integrity protection fault");
    }
    return handler.handle().pipe(
      map((data) => {
        this.logger.verbose("Response data:", data);

        this.logger.verbose("Encrypting data with session key...");

        const encodedPacket = protect(data, sessionKey);

        this.logger.verbose(encodedPacket);

        return encodedPacket;
      })
    );
  }
}
