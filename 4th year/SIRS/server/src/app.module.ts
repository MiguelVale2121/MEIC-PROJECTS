import { Logger, Module } from "@nestjs/common";
import { MongooseModule, MongooseModuleFactoryOptions } from "@nestjs/mongoose";
import { AccountModule } from "./account/account.module";
import { ClientModule } from "./client/client.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PaymentModule } from "./payment/payment.module";
import { ScheduleModule } from "@nestjs/schedule";
import { CacheModule } from "@nestjs/cache-manager";
import { Duration } from "luxon";

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    CacheModule.register({
      isGlobal: true,
      ttl: Duration.fromObject({
        days: 15,
      }).as("milliseconds"),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger("MongooseModule");

        const uri = configService.getOrThrow("DB_CONNECTION");
        let options: MongooseModuleFactoryOptions = {
          uri: uri,
        };

        logger.log(`Connecting to ${uri}...`);

        const useTLS = configService.getOrThrow("DB_USE_TLS") == "true";

        if (useTLS) {
	  options.tls = true;
          options.tlsCertificateKeyFile =
            configService.getOrThrow("TLS_CERT_KEY_PATH");
          options.tlsCAFile = configService.getOrThrow("TLS_CA_PATH");
	  options.tlsInsecure = true;
          logger.warn(`TLS enabled`);
        }

        return options;
      },
      inject: [ConfigService],
    }),
    AccountModule,
    ClientModule,
    PaymentModule,
  ],
})
export class AppModule {}
