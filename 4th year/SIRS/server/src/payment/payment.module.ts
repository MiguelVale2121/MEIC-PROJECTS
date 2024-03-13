import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";
import { Payment, PaymentSchema } from "./schemas/payment.schema";
import { Account, AccountSchema } from "src/account/schemas/account.schema";
import {
  AccountMovement,
  AccountMovementSchema,
} from "src/account/schemas/movement.schema";
import {
  Client,
  ClientSchema,
  Session,
  SessionSchema,
} from "src/client/schemas/client.schema";
import { AccountModule } from "src/account/account.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: AccountMovement.name, schema: AccountMovementSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    AccountModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
