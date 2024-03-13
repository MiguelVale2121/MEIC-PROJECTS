import { KeyObject, createPublicKey, createSecretKey } from "crypto";
import {
  ProtectedData,
  generateAsymmetricKeys,
  generateMac,
  protect,
  protectAsymmetricClient,
  secureHash,
  signData,
  unprotect,
  unprotectAsymmetric,
} from "./index";
import { readFileSync } from "fs";
import prompts, { Choice } from "prompts";
import axios, { AxiosError, AxiosInstance } from "axios";
import { DisplayData, DisplayExpenses, DisplayMovements } from "./display";
import { DateTime } from "luxon";

// Auxiliary functions

function encodeLoginData(data: any) {
  const serverPublicKey = createPublicKey({
    key: readFileSync(
      "/media/sf_Keys/server_public.pem"
    ),
    format: "pem",
    type: "spki",
  });

  const encryptedLoginData = protectAsymmetricClient(data, serverPublicKey);

  return encryptedLoginData;
}

function handleRequestError(err: any) {
  const error = err as AxiosError;

  if (error.response) {
    const responseData: any = error.response.data;

    console.error("Error:", responseData["message"] ?? "Unknown error");
  } else {
    console.error(err);
  }
}

interface LoginData {
  clientId: string;
  password: string;
}

interface ClientKeys {
  publicKey: KeyObject;
  privateKey: KeyObject;
}

interface Session {
  id: string;
  key: KeyObject;
}

class BlingBankClient {
  private clientInstance: AxiosInstance;
  private clientKeys: ClientKeys;
  private session?: Session;
  private currentAccountId?: string;

  constructor(address: string) {
    this.clientKeys = generateAsymmetricKeys();

    this.clientInstance = axios.create({
      baseURL: address,
    });
  }

  get publicKeyBase64() {
    return Buffer.from(
      this.clientKeys.publicKey.export({ type: "spki", format: "pem" })
    ).toString("base64");
  }

  private createLoginPayload(loginData: LoginData) {
    let loginPayload = {
      ...encodeLoginData(loginData),
      publicKey: this.publicKeyBase64,
    };

    // Recompute MIC to account public key
    return {
      ...loginPayload,
      mic: secureHash({
        nonce: loginPayload.nonce,
        data: loginData,
        publicKey: loginPayload.publicKey,
      }),
    };
  }

  private createPayload(data?: any) {
    if (!this.session)
      throw new Error("Fatal: Unable to create payload: Mising session key");

    let protectedPayload;
    if (data) {
      protectedPayload = protect(data, this.session.key);
    } else {
      protectedPayload = protect("", this.session.key);

      // Use mac instead of mic (relatorio)
      protectedPayload = {
        ...protectedPayload,
        mic: generateMac(
          {
            nonce: protectedPayload.nonce,
          },
          this.session.key
        ),
      };
    }

    return {
      headers: {
        mic: protectedPayload.mic,
        nonce: protectedPayload.nonce,
        "session-id": this.session.id,
      },
      body: protectedPayload.data,
    };
  }

  private decodeServerPayload(data: ProtectedData) {
    if (!this.session)
      throw new Error("Fatal: Unable to decode payload: Mising session key");

    return unprotect(data, this.session.key);
  }

  public async getAccounts(): Promise<string[] | undefined> {
    const payloadData = this.createPayload();

    try {
      const response = await this.clientInstance.get("client/accounts", {
        headers: payloadData.headers,
      });

      var plainData = this.decodeServerPayload(response.data);

      return plainData;
    } catch (err) {
      console.log("ERROR");
      handleRequestError(err);
    }
  }

  public async setAccount(accountId: string) {
    const payloadData = this.createPayload();

    try {
      const response = await this.clientInstance.get("accounts/" + accountId, {
        headers: payloadData.headers,
      });

      var plainData = this.decodeServerPayload(response.data);
      this.currentAccountId = accountId;

      return plainData;
    } catch (err) {
      handleRequestError(err);
      return undefined;
    }
  }

  public async getMovements() {
    const payloadData = this.createPayload();

    try {
      const response = await this.clientInstance.get(
        `accounts/${this.currentAccountId}/movements`,
        {
          headers: payloadData.headers,
        }
      );

      var plainData = this.decodeServerPayload(response.data);
      return plainData;
    } catch (err) {
      //console.error(err);
      handleRequestError(err);
      return [];
    }
  }

  public async getExpenses() {
    const payloadData = this.createPayload();

    try {
      const response = await this.clientInstance.get(
        `accounts/${this.currentAccountId}/expenses`,
        {
          headers: payloadData.headers,
        }
      );

      var plainData = this.decodeServerPayload(response.data);
      return plainData;
    } catch (err) {
      handleRequestError(err);
      return [];
    }
  }

  public async login(): Promise<boolean> {
    const loginCredentials = await prompts([
      {
        type: "text",
        name: "clientId",
        message: "Client ID:",
      },
      {
        type: "password",
        name: "password",
        message: "Client password:",
      },
    ]);

    const loginPayload = this.createLoginPayload(loginCredentials);

    try {
      const response = await this.clientInstance.post(
        "client/login",
        {
          data: loginPayload.data,
          publicKey: loginPayload.publicKey,
        },
        {
          headers: {
            mic: loginPayload.mic,
            nonce: loginPayload.nonce,
          },
        }
      );

      const decryptLoginData = unprotectAsymmetric(
        response.data,
        this.clientKeys.privateKey
      );

      this.session = {
        id: decryptLoginData.sessionId,
        key: createSecretKey(
          Buffer.from(decryptLoginData.sessionKey, "base64")
        ),
      };
    } catch (err) {
      handleRequestError(err);
      return false;
    }

    return true;
  }

  public async createPaymentOrder() {
    console.log("Create Payment Order:");
    const paymentOrder = await prompts([
      {
        type: "text",
        name: "entity",
        message: `entity:`,
      },
      {
        type: "number",
        name: "amount",
        message: `amount:`,
        validate: (value) =>
          value < 0 ? `Negative amounts are not allowed` : true,
      },
      {
        type: "text",
        name: "description",
        message: `description:`,
      },
    ]);

    const payloadData = this.createPayload({
      date: DateTime.now().toISODate(),
      entity: paymentOrder.entity,
      amount: Math.abs(paymentOrder.amount) * -1,
      description: paymentOrder.description,
      accountId: this.currentAccountId,
    });

    try {
      const response = await this.clientInstance.post(
        `payments`,
        {
          data: payloadData.body,
        },
        {
          headers: payloadData.headers,
        }
      );

      var plainData = this.decodeServerPayload(response.data);

      await this.authorizePayment(plainData._id);
    } catch (err) {
      handleRequestError(err);
    }
  }

  public async pendingPayments() {
    while (true) {
      const payloadData = this.createPayload();
      let pending;
      try {
        const response = await this.clientInstance.get(
          `payments/pending/${this.currentAccountId}`,
          {
            headers: payloadData.headers,
          }
        );

        pending = this.decodeServerPayload(response.data);
      } catch (err) {
        handleRequestError(err);
        return [];
      }

      const paymentSelection = await prompts({
        type: "select",
        name: "paymentId",
        message: "Choose a payment to authorize: ",
        choices: [
          ...pending.map((payment: any) => ({
            title: `${payment._id} (${payment.description})`,
            value: payment._id,
          })),
          { title: "Back", value: CLIOption.Exit },
        ],
      });

      console.clear();

      if (paymentSelection.paymentId === CLIOption.Exit) return;

      await this.authorizePayment(paymentSelection.paymentId);
    }
  }

  public async authorizePayment(paymentId: string) {
    console.clear();

    let payloadData = this.createPayload();
    let client;
    try {
      const response = await this.clientInstance.get(`client`, {
        headers: payloadData.headers,
      });

      client = this.decodeServerPayload(response.data);
    } catch (err) {
      handleRequestError(err);
      return;
    }

    let payment;
    payloadData = this.createPayload();
    try {
      const response = await this.clientInstance.get(`payments/${paymentId}`, {
        headers: payloadData.headers,
      });

      payment = this.decodeServerPayload(response.data);
    } catch (err) {
      handleRequestError(err);
      return;
    }

    console.log("Authorize Payment:\n");
    console.log(`Id: ${paymentId}`);
    console.log(`Date: ${DateTime.fromISO(payment.date).toLocaleString()}`);
    console.log(`Entity: ${payment.entity}`);
    console.log(`Amount: ${payment.amount}`);
    console.log(`Description: ${payment.description}\n`);

    // Check if payment is already signed by us

    const holdersIds = payment.holdersSignatures.map(
      (signature: any) => signature.clientId
    );

    if (holdersIds.includes(client._id)) {
      await prompts({
        type: "select",
        name: "back",
        message:
          "You already approved this payment, waiting for the other holders to approve",
        choices: [{ title: "Back", value: CLIOption.Exit }],
      });
      console.clear();
      return;
    }

    const confirm = await prompts({
      type: "confirm",
      name: "proceed",
      message: `Are you sure you want to proceed with the payment?`,
    });

    if (!confirm.proceed) {
      console.clear();
      return;
    }

    //get clientId

    const signedData = signData(
      {
        clientId: client._id,
        paymentId: paymentId,
      },
      this.clientKeys.privateKey
    );

    payloadData = this.createPayload({
      paymentId: paymentId,
      signature: signedData,
    });

    try {
      const response = await this.clientInstance.post(
        `payments/authorize`,
        {
          data: payloadData.body,
        },
        {
          headers: payloadData.headers,
        }
      );

      var plainData = this.decodeServerPayload(response.data);

      console.clear();
      console.log("Payment Authorized");
    } catch (err) {
      handleRequestError(err);
    }
  }
}

enum CLIOption {
  Movements,
  Expenses,
  Payments,
  Exit,
}

enum CLIPaymentOption {
  CreatePayment,
  AuthorizePayment,
}

async function paymentManagementCLI(client: BlingBankClient) {
  console.clear();
  while (true) {
    const paymentManagement = await prompts({
      type: "select",
      name: "paymentOperation",
      message: "Choose an option",
      choices: [
        {
          title: "Create payment order",
          value: CLIPaymentOption.CreatePayment,
        },
        {
          title: "Authorize payment",
          value: CLIPaymentOption.AuthorizePayment,
        },
        { title: "Back", value: CLIOption.Exit },
      ],
    });

    console.clear();

    switch (paymentManagement.paymentOperation) {
      case CLIPaymentOption.CreatePayment:
        await client.createPaymentOrder();
        break;
      case CLIPaymentOption.AuthorizePayment:
        await client.pendingPayments();
        break;
      case CLIOption.Exit:
        return;
    }
  }
}

async function accountManagementCLI(
  client: BlingBankClient,
  accountId: string
) {
  while (true) {
    console.clear();

    const accountData = await client.setAccount(accountId);

    if (!accountData) process.exit();

    console.log("Account", accountData._id);
    console.log(`Balance: ${accountData.balance} ${accountData.currency}`);

    const accountManagement = await prompts({
      type: "select",
      name: "accountOperation",
      message: "Choose an option",
      choices: [
        { title: "Movements", value: CLIOption.Movements },
        { title: "Expenses", value: CLIOption.Expenses },
        { title: "Payments", value: CLIOption.Payments },
        { title: "Back", value: CLIOption.Exit },
      ],
    });

    console.clear();

    switch (accountManagement.accountOperation as CLIOption) {
      case CLIOption.Movements:
        const movements = await client.getMovements();

        await DisplayData.display(
          DisplayMovements,
          movements.map((movement: any) => {
            return {
              ...movement,
              amount: `${movement.amount} ${accountData.currency}`,
            };
          })
        );
        break;
      case CLIOption.Expenses:
        console.log("Expenses:");
        const expenses = await client.getExpenses();
        await DisplayData.display(
          DisplayExpenses,
          Object.keys(expenses).map((expenseKey) => {
            return {
              category: expenseKey,
              content: expenses[expenseKey],
              currency: accountData.currency,
            };
          })
        );
        break;
      case CLIOption.Payments:
        await paymentManagementCLI(client);
        break;
      case CLIOption.Exit:
        return;
    }
  }
}

async function main() {
  const client = new BlingBankClient("http://192.168.1.1:80/");

  console.clear();

  console.log(
    "========================================================================================="
  );
  console.log(
    " _______   __  __                      _______                       __       "
  );
  console.log(
    "|       \\ |  \\|  \\                    |       \\                     |  \\      "
  );
  console.log(
    "| $$$$$$$\\| $$ \\$$ _______    ______  | $$$$$$$\\  ______   _______  | $$   __ "
  );
  console.log(
    "| $$__/ $$| $$|  \\|       \\  /      \\ | $$__/ $$ |      \\ |       \\ | $$  /  \\"
  );
  console.log(
    "| $$    $$| $$| $$| $$$$$$$\\|  $$$$$$\\| $$    $$  \\$$$$$$\\| $$$$$$$\\| $$_/  $$"
  );
  console.log(
    "| $$$$$$$\\| $$| $$| $$  | $$| $$  | $$| $$$$$$$\\ /      $$| $$  | $$| $$   $$ "
  );
  console.log(
    "| $$__/ $$| $$| $$| $$  | $$| $$__| $$| $$__/ $$|  $$$$$$$| $$  | $$| $$$$$$\\ "
  );
  console.log(
    "| $$    $$| $$| $$| $$  | $$ \\$$    $$| $$    $$ \\$$    $$| $$  | $$| $$  \\$$\\"
  );
  console.log(
    " \\$$$$$$$  \\$$ \\$$ \\$$   \\$$  \\$$$$$$$ \\$$$$$$$   \\$$$$$$$ \\$$   \\$$ \\$$   \\$$"
  );
  console.log(
    "                            |  \\__| $$                                        "
  );
  console.log(
    "                             \\$$    $$                                        "
  );
  console.log(
    "                              \\$$$$$$                                         "
  );

  console.log(
    "========================================================================================="
  );

  console.log("Login:\n");
  const isLoggedIn = await client.login();

  if (!isLoggedIn) return;

  console.clear();
  //add person name
  console.log("Welcome back\n");
  const accounts = await client.getAccounts();

  if (!accounts) return;

  while (true) {
    const accountSelection = await prompts({
      type: "select",
      name: "accountId",
      message: "Choose your account",
      choices: [
        ...accounts.map((accountId: string) => ({
          title: `Account ${accountId}`,
          value: accountId,
        })),
        { title: "Exit", value: CLIOption.Exit },
      ],
    });

    if (accountSelection.accountId === CLIOption.Exit) return;

    await accountManagementCLI(client, accountSelection.accountId);

    console.clear();
  }
}

main();
