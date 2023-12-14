import { secureHash } from "@securelib";
import { DateTime } from "luxon";
import { Types } from "mongoose";

interface ClientDto {
  name: string;
  password: string;
}

export interface MovementDto {
  date: string;
  amount: number;
  description: string;
}

export interface AccountDto {
  accountHolders: string[];
  currency: "EUR" | "USD" | "AED" | "CHF" | "BRL" | "GBP";
  movements: MovementDto[];
}

export const seedClients: ClientDto[] = [
  {
    name: "Alice",
    password: secureHash("alice12345"),
  },
  {
    name: "Bob",
    password: secureHash("bob12345"),
  },
  {
    name: "Eve",
    password: secureHash("eve12345"),
  },
  {
    name: "Carol",
    password: secureHash("carol12345"),
  },
  {
    name: "Walter",
    password: secureHash("walter12345"),
  },
];

export const seedAccounts: AccountDto[] = [
  {
    accountHolders: ["Alice"],
    currency: "EUR",
    movements: [
      {
        date: "2023-10-12",
        amount: 150,
        description: "Casino",
      },
    ],
  },
  {
    accountHolders: ["Bob"],
    currency: "USD",
    movements: [
      {
        date: "2023-10-12",
        amount: -75,
        description: "Water bill",
      },
      {
        date: "2023-10-12",
        amount: -1005,
        description: "Water bill",
      },
      {
        date: "2023-11-26",
        amount: 1500,
        description: "Salary",
      },
    ],
  },
  {
    accountHolders: ["Eve"],
    currency: "EUR",
    movements: [],
  },
  {
    accountHolders: ["Bob", "Eve", "Carol", "Walter"],
    currency: "CHF",
    movements: [
      {
        date: "2023-11-26",
        amount: 800000,
        description: "Salary",
      },
    ],
  },
];
