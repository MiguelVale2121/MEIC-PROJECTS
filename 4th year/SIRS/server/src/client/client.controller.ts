import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { ClientService } from "./client.service";
import { RawLoginDto } from "./dtos/login.dto";
import { SecureDataInterceptor } from "src/interceptors/securedata.interceptor";

import { Client as ClientObject } from "./schemas/client.schema";
import { Client } from "src/decorators/client.decorator";

@Controller("client")
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get("all")
  findAll() {
    return this.clientService.findAll();
  }

  @Get()
  @UseInterceptors(SecureDataInterceptor)
  async findOne(@Client() clientId: string) {
    return await this.clientService.findOne(clientId);
  }

  @Get("accounts")
  @UseInterceptors(SecureDataInterceptor)
  async findAccounts(@Client() clientId: string) {
    return await this.clientService.findAccounts(clientId);
  }

  @Post("login")
  async login(
    @Headers("mic") mic: string,
    @Headers("nonce") nonce: string,
    @Body(ValidationPipe) rawLoginDto: RawLoginDto
  ) {
    return await this.clientService.login({
      mic: mic,
      nonce: nonce,
      ...rawLoginDto,
    });
  }
}
