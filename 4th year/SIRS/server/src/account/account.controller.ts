import { AccountService } from "./account.service";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { Account } from "./schemas/account.schema";
import { CreateAccountMovementDto } from "./dtos/createMovement.dto";
import { SecureDataInterceptor } from "src/interceptors/securedata.interceptor";
import { Client } from "src/decorators/client.decorator";

@Controller("accounts")
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // Accounts

  @Get()
  async findAll(): Promise<Account[]> {
    return this.accountService.findAll();
  }

  @Get(":accountId")
  @UseInterceptors(SecureDataInterceptor)
  async findAccount(
    @Client() clientId: string,
    @Param("accountId") accountId: string
  ): Promise<Account> {
    return await this.accountService.findAccount(clientId, accountId);
  }

  // Movements

  @Get(":accountId/movements")
  @UseInterceptors(SecureDataInterceptor)
  async findAllMovements(
    @Client() clientId: string,
    @Param("accountId") accountId: string
  ): Promise<Account["movements"]> {
    return this.accountService.findAllMovements(clientId, accountId);
  }

  // Expenses

  @Get(":accountId/expenses")
  @UseInterceptors(SecureDataInterceptor)
  async findExpenses(
    @Client() clientId: string,
    @Param("accountId") accountId: string
  ) {
    return this.accountService.findExpenses(clientId, accountId);
  }
}
