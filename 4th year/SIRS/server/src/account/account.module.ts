import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Account, AccountSchema } from "./schemas/account.schema";
import { AccountService } from "./account.service";
import { AccountController } from "./account.controller";
import {
  AccountMovement,
  AccountMovementSchema,
} from "./schemas/movement.schema";
import {
  Client,
  ClientSchema,
  Session,
  SessionSchema,
} from "../client/schemas/client.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: AccountMovement.name, schema: AccountMovementSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
