import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { KeyObject, createSecretKey, randomBytes, scryptSync } from "crypto";
import { InjectModel } from "@nestjs/mongoose";
import { Account } from "./schemas/account.schema";
import { Model, Types, Document } from "mongoose";
import { CreateAccountMovementDto } from "./dtos/createMovement.dto";
import { groupBy } from "lodash";
import { DateTime } from "luxon";
import { seedAccounts, seedClients } from "./data/seed";
import { Client } from "../client/schemas/client.schema";
import { AccountMovement } from "./schemas/movement.schema";

@Injectable()
export class AccountService implements OnModuleInit {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectModel(Client.name) private readonly clientModel: Model<Client>,
    @InjectModel(Account.name) private readonly accountModel: Model<Account>,
    @InjectModel(AccountMovement.name)
    private readonly accountMovementModel: Model<AccountMovement>
  ) {}

  async onModuleInit() {
    // Populate db

    // Create clients
    const createdUsersIndex = new Map<string, number>();

    this.logger.warn(`[DB Populate]: Deleting previous data`);
    await this.accountModel.deleteMany().exec();
    await this.clientModel.deleteMany().exec();
    await this.accountMovementModel.deleteMany().exec();

    let index = 0;
    let clients = seedClients.map((clientDto) => {
      const client = new this.clientModel(clientDto);
      this.logger.log(`[DB Populate]: Creating client ${client._id}`);

      createdUsersIndex.set(client.name, index);
      index++;
      return client;
    });

    let movements: (Document<unknown, {}, AccountMovement> &
      AccountMovement & {
        _id: Types.ObjectId;
      })[] = [];

    let accounts = seedAccounts.map((accountsDto) => {
      const account = new this.accountModel({
        currency: accountsDto.currency,
      });

      this.logger.log(`[DB Populate]: Creating account ${account._id}`);

      accountsDto.accountHolders.forEach((holder) => {
        const client = clients[createdUsersIndex.get(holder)];
        client.accounts.push(account);
        account.holders.push(client);
      });

      accountsDto.movements.forEach((movement) => {
        const movementDto = new CreateAccountMovementDto();

        movementDto.date = movement.date;
        movementDto.amount = movement.amount;
        movementDto.description = movement.description;

        movements.push(this.createMovement(account, movementDto));
      });

      return account;
    });

    await Promise.all([
      clients.map((m) => m.save()),
      accounts.map((m) => m.save()),
      movements.map((m) => m.save()),
    ]);
    this.logger.log(`[DB Populate]: Saved documents`);
  }

  // Account

  async findAll(): Promise<Account[]> {
    const result = await this.accountModel.find().exec();
    this.logger.verbose(`Accounts found:\n ${result}`);
    return result;
  }

  async findAccount(clientId: string, accountId: string) {
    const account = await this.accountModel.findById(accountId).exec();

    if (!account) throw new NotFoundException("Account not found");

    const clientIds = account.holders.map((holder) => holder.toString());

    if (!clientIds.includes(clientId))
      throw new ForbiddenException(
        "The account cannot be accessed by the current client"
      );
    this.logger.verbose(`Account found:\n ${account}`);
    return account;
  }

  // Movements feature

  async findAllMovements(
    clientId: string,
    accountId: string
  ): Promise<Account["movements"]> {
    const account = await this.findAccount(clientId, accountId);

    const accountWithMovements = await account.populate("movements");
    this.logger.verbose(`Movements found:\n ${accountWithMovements.movements}`);
    return accountWithMovements.movements;
  }

  createMovement(
    account: Document<unknown, {}, Account> &
      Account & {
        _id: Types.ObjectId;
      },
    createAccountMovementDto: CreateAccountMovementDto
  ) {
    const movement = new this.accountMovementModel(createAccountMovementDto);

    account.movements.push(movement);
    account.balance += createAccountMovementDto.amount;
    this.logger.verbose(`Movement successfully created:\n ${movement}`);
    return movement;
  }

  // Expenses feature

  async findExpenses(
    clientId: string,
    accountId: string
  ): Promise<AccountMovement[]> {
    const movements = await this.findAllMovements(clientId, accountId);

    const expensesMovements = movements.filter(
      (movement) => movement.amount < 0
    );

    expensesMovements.sort((a, b) => {
      return (
        DateTime.fromISO(a.date).toMillis() -
        DateTime.fromISO(b.date).toMillis()
      );
    });

    const result = groupBy(expensesMovements, ({ description }) => description);
    this.logger.verbose(`Expenses found:\n ${result}`);
    return result;
  }
}
