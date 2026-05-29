import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../db/db';
import { users } from '../db/schema';

export type User = typeof users.$inferSelect;

@Injectable()
export class UsersService {
  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const [user] = await db.insert(users).values({ email, passwordHash }).returning();
    return user;
  }
}
