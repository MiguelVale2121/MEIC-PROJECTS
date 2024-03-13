import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Client, Session } from "./schemas/client.schema";
import { Model } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { LoginDto, RawLoginDto } from "./dtos/login.dto";
import { KeyObject, createPrivateKey, createPublicKey } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import {
  decryptAsymmetricData,
  generateAsymmetricKeys,
  generateSymmetricKey,
  secureHash,
  micMatch,
  ProtectedData,
  protectAsymmetricServer,
} from "@securelib";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ConfigService } from "@nestjs/config";
import { Account } from "src/account/schemas/account.schema";
import { DateTime } from "luxon";
import { Cron, CronExpression } from "@nestjs/schedule";
import { checkNonce } from "src/utils/replayProtect";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);
  private privateKey: KeyObject;

  constructor(
    @Inject(CACHE_MANAGER) private nonceCache: Cache,
    @InjectModel(Client.name) private readonly clientModel: Model<Client>,
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
    private configService: ConfigService
  ) {
    this.logger.log("Reading server keypair...");

    const keysPath = this.configService.getOrThrow<string>("KEYS_PATH");

    this.privateKey = createPrivateKey({
      key: readFileSync(`${keysPath}/server_private.pem`),
      type: "pkcs8",
      format: "pem",
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSessions() {
    this.logger.log("[Sessions Management]: Pruning expired sessions...");

    const sessions = await this.sessionModel.find().exec();

    const sessionsToDelete = sessions
      .filter((session) => {
        return DateTime.fromISO(session.expire) < DateTime.now();
      })
      .map((session) => session._id);

    await this.sessionModel.deleteMany({
      _id: {
        $in: sessionsToDelete,
      },
    });
  }

  findAll() {
    return this.clientModel.find().exec();
  }

  async findOne(clientId: string): Promise<Client> {
    return await this.clientModel.findById(clientId).exec();
  }

  async findAccounts(clientId: string): Promise<Account[]> {
    const client = await this.clientModel.findById(clientId).exec();

    if (!client) throw new NotFoundException("Client not found");

    return client.accounts;
  }

  async login(encodedLoginDto: ProtectedData & { publicKey: string }) {
    let loginData = undefined;

    this.logger.verbose("Received login payload:", encodedLoginDto);

    // Replay attack check
    this.logger.verbose(`Verifing nonce: ${encodedLoginDto.nonce}`);
    await checkNonce(this.nonceCache, encodedLoginDto.nonce);

    try {
      this.logger.verbose("Decoding payload data...");
      loginData = decryptAsymmetricData(encodedLoginDto, this.privateKey);
    } catch (err: any) {
      throw new BadRequestException("Data decryption fault");
    }

    const micPayload = {
      nonce: encodedLoginDto.nonce,
      data: loginData,
      publicKey: encodedLoginDto.publicKey,
    };

    this.logger.verbose("Decoded payload:", micPayload);

    this.logger.verbose(
      `Checking payload integrity (MIC:${encodedLoginDto.mic})`
    );

    if (!micMatch(encodedLoginDto.mic, micPayload))
      throw new BadRequestException("Data integrity fault");

    this.logger.verbose(`Performing DTO validations...`);
    let loginDto = plainToInstance(LoginDto, loginData);
    const errors = validateSync(loginDto);

    if (errors.length > 0) {
      throw new BadRequestException(
        errors.map((error) => Object.values(error.constraints).join(", "))
      );
    }

    // Check credentials

    this.logger.verbose(`Checking credentials...`);
    const client = await this.clientModel.findById(loginDto.clientId);

    if (!client) throw new NotFoundException("Client not found");

    this.logger.verbose(`Found client: ${client.name} / ID: ${client._id}`);
    if (client.password !== secureHash(loginDto.password))
      throw new UnauthorizedException("Invalid credentials");

    this.logger.verbose(`Initializing session...`);
    // Initialize session

    const sessionKey = generateSymmetricKey();

    const session = new this.sessionModel({
      sessionKey: sessionKey.export().toString("base64"),
      client: client,
      publicKey: encodedLoginDto.publicKey,
      expire: DateTime.now().plus({ minutes: 10 }).toISO(),
    });

    await session.save();

    const responseData = {
      sessionId: session.id,
      sessionKey: sessionKey.export().toString("base64"),
    };

    this.logger.verbose("Response data:", responseData);

    this.logger.verbose("Encrypting data with client public key");

    const protectedData = protectAsymmetricServer(
      responseData,
      createPublicKey({
        key: Buffer.from(encodedLoginDto.publicKey, "base64"),
        format: "pem",
        type: "spki",
      })
    );

    this.logger.verbose("Response payload:", {
      mic: protectedData.mic,
      data: protectedData.data,
    });

    return {
      mic: protectedData.mic,
      data: protectedData.data,
    };
  }
}
