// Money handling.
//
// The original system used Python Decimal and DRF serialized DecimalField
// values as strings (COERCE_DECIMAL_TO_STRING defaults to True), so the
// frontend received prices like "10.50". We keep exact decimal arithmetic
// using Prisma's Decimal and serialize money back to strings to preserve the
// original response contract. Floating point is never used for money.

import { Prisma } from "@prisma/client";

export type DecimalLike = Prisma.Decimal | number | string;

export function toDecimal(value: DecimalLike): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

// Serialize a decimal for API output as a plain string, matching DRF.
export function moneyString(value: DecimalLike): string {
  return toDecimal(value).toFixed(2);
}

export function moneyValue(value: DecimalLike): Prisma.Decimal {
  return toDecimal(value);
}

export function add(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDecimal(a).plus(b);
}

export function subtract(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDecimal(a).minus(b);
}

export function multiply(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return toDecimal(a).times(b);
}

export function isNegative(a: DecimalLike): boolean {
  return toDecimal(a).isNegative();
}

export function ZERO(): Prisma.Decimal {
  return new Prisma.Decimal(0);
}

// Parse a client-supplied money value into a Decimal, throwing on bad input.
export function parseMoney(value: unknown, field: string): Prisma.Decimal {
  const text = typeof value === "string" ? value.trim() : value;
  if (text === "" || text === null || text === undefined) {
    throw new MoneyError(`${field} is required.`);
  }
  try {
    return new Prisma.Decimal(text as string | number);
  } catch {
    throw new MoneyError(`${field} must be a valid number.`);
  }
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}
