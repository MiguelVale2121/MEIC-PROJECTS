import { Module } from "@nestjs/common";
import { ClientService } from "./client.service";
import { ClientController } from "./client.controller";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Client,
  ClientSchema,
  Session,
  SessionSchema,
} from "./schemas/client.schema";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
