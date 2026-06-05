/**
 * Unit tests for the env validation schema.
 *
 * These run without a real NestJS app — they test the Joi schema directly.
 * Purpose: catch misconfigured deployments at startup rather than at runtime.
 */

import { describe, expect, it } from 'vitest';
import { envValidationSchema } from './env.validation';

interface ValidatedConfig {
  NODE_ENV: string;
  PORT: number;
  JWT_EXPIRES_IN: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
}

const valid = {
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/taskdb',
  JWT_SECRET: 'a-secret-that-is-long-enough',
};

function validatedValue(input: object): ValidatedConfig {
  return envValidationSchema.validate(input).value as ValidatedConfig;
}

describe('env validation schema', () => {
  it('accepts a valid environment', () => {
    const { error } = envValidationSchema.validate(valid);
    expect(error).toBeUndefined();
  });

  it('defaults NODE_ENV to "development" when not set', () => {
    expect(validatedValue(valid).NODE_ENV).toBe('development');
  });

  it('defaults PORT to 3000 when not set', () => {
    expect(validatedValue(valid).PORT).toBe(3000);
  });

  it('defaults JWT_EXPIRES_IN to "7d" when not set', () => {
    expect(validatedValue(valid).JWT_EXPIRES_IN).toBe('7d');
  });

  it('rejects when DATABASE_URL is missing', () => {
    const { error } = envValidationSchema.validate({
      JWT_SECRET: valid.JWT_SECRET,
    });
    expect(error).toBeDefined();
    expect(error!.message).toMatch(/DATABASE_URL/);
  });

  it('rejects when JWT_SECRET is missing', () => {
    const { error } = envValidationSchema.validate({
      DATABASE_URL: valid.DATABASE_URL,
    });
    expect(error).toBeDefined();
    expect(error!.message).toMatch(/JWT_SECRET/);
  });

  it('rejects when JWT_SECRET is shorter than 16 characters', () => {
    const { error } = envValidationSchema.validate({
      ...valid,
      JWT_SECRET: 'tooshort',
    });
    expect(error).toBeDefined();
    expect(error!.message).toMatch(/JWT_SECRET/);
  });

  it('rejects an invalid NODE_ENV value', () => {
    const { error } = envValidationSchema.validate({
      ...valid,
      NODE_ENV: 'banana',
    });
    expect(error).toBeDefined();
    expect(error!.message).toMatch(/NODE_ENV/);
  });
});
