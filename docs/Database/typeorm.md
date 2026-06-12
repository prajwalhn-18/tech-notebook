---
sidebar_position: 6
---

## TypeORM

TypeORM is a TypeScript-first ORM that runs on Node.js and supports PostgreSQL, MySQL, SQLite, and more. It maps TypeScript classes to database tables (the **Active Record** or **Data Mapper** pattern) and generates SQL from your object model.

This doc covers everything an intermediate engineer needs: setup, entities, repositories, relations, migrations, transactions, and QueryBuilder.

---

## Setup

```bash
npm install typeorm reflect-metadata
npm install pg           # or mysql2, better-sqlite3, etc.
```

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false
  }
}
```

Import `reflect-metadata` once, at your app entry point (before anything else):

```ts
import 'reflect-metadata';
```

---

## DataSource

`DataSource` is the single connection configuration object. Create it once and reuse it.

```ts
// src/data-source.ts
import { DataSource } from 'typeorm';
import { User } from './entity/User';
import { Order } from './entity/Order';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: 5432,
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? '',
  database: process.env.DB_NAME ?? 'mydb',
  entities: [User, Order],
  migrations: ['src/migration/*.ts'],
  synchronize: false,   // NEVER true in production — use migrations
  logging: ['query', 'error'],
});
```

Initialize at startup:

```ts
// src/index.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';

AppDataSource.initialize()
  .then(() => console.log('DB connected'))
  .catch(err => { console.error(err); process.exit(1); });
```

> **`synchronize: true`** auto-creates/alters tables on startup — convenient for local dev, **dangerous in production** because it can drop columns or data without warning. Use migrations instead.

---

## Entities

An entity is a class decorated with `@Entity()`. Each property maps to a column.

```ts
// src/entity/User.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Common column decorators

| Decorator | Purpose |
|---|---|
| `@PrimaryGeneratedColumn()` | Auto-increment integer PK |
| `@PrimaryGeneratedColumn('uuid')` | UUID PK |
| `@Column()` | Regular column |
| `@Column({ nullable: true })` | Nullable column |
| `@Column({ default: 0 })` | Column with a default |
| `@Column({ select: false })` | Excluded from `SELECT *` (e.g., password hash) |
| `@Index()` | Creates a DB index |
| `@Index({ unique: true })` | Unique index |
| `@CreateDateColumn()` | Auto-set on insert |
| `@UpdateDateColumn()` | Auto-set on update |
| `@DeleteDateColumn()` | Soft-delete timestamp |
| `@VersionColumn()` | Optimistic locking counter |

---

## Repositories

A repository gives you CRUD methods for a specific entity. Get one from your `DataSource`.

```ts
const userRepo = AppDataSource.getRepository(User);
```

### Basic CRUD

```ts
// Create & save
const user = userRepo.create({ name: 'Alice', email: 'alice@example.com' });
await userRepo.save(user);   // INSERT

// Find by PK
const found = await userRepo.findOneBy({ id: 1 });

// Find with conditions
const active = await userRepo.findBy({ isActive: true });

// Update — load, mutate, save
const user = await userRepo.findOneByOrFail({ id: 1 });
user.name = 'Alice Smith';
await userRepo.save(user);   // UPDATE

// Partial update without loading
await userRepo.update({ id: 1 }, { name: 'Alice Smith' });

// Delete
await userRepo.delete({ id: 1 });

// Soft delete (needs @DeleteDateColumn on entity)
await userRepo.softDelete({ id: 1 });
await userRepo.restore({ id: 1 });
```

### find options

```ts
const orders = await orderRepo.find({
  where: { status: 'PAID', user: { id: 1 } },
  relations: { user: true },
  order: { createdAt: 'DESC' },
  skip: 0,
  take: 20,
  select: { id: true, total: true, createdAt: true },
});
```

### findOneOrFail vs findOne

```ts
// Returns null if not found — you must handle null
const user = await userRepo.findOneBy({ id });

// Throws EntityNotFoundError if not found — prefer this in service methods
const user = await userRepo.findOneByOrFail({ id });
```

---

## Relations

### OneToOne

```ts
@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  bio: string;

  @OneToOne(() => User, user => user.profile)
  @JoinColumn()                // FK lives on this table
  user: User;
}

// In User entity:
@OneToOne(() => Profile, profile => profile.user)
profile: Profile;
```

### OneToMany / ManyToOne

```ts
// User has many Orders
@Entity('users')
export class User {
  @OneToMany(() => Order, order => order.user)
  orders: Order[];
}

// Order belongs to User
@Entity('orders')
export class Order {
  @ManyToOne(() => User, user => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: number;   // explicit FK column
}
```

> The FK always lives on the `@ManyToOne` side. `@OneToMany` alone creates no column.

### ManyToMany

```ts
@Entity('posts')
export class Post {
  @ManyToMany(() => Tag, tag => tag.posts, { cascade: true })
  @JoinTable()   // creates the join table; put this on the owning side
  tags: Tag[];
}

@Entity('tags')
export class Tag {
  @ManyToMany(() => Post, post => post.tags)
  posts: Post[];
}
```

### Loading relations

```ts
// Eager in query options
const user = await userRepo.findOne({
  where: { id: 1 },
  relations: { orders: true, profile: true },
});

// Eager globally (loads on every find — use sparingly, can cause N+1)
@ManyToOne(() => User, { eager: true })
user: User;
```

---

## QueryBuilder

Use QueryBuilder when `find()` options aren't expressive enough — JOINs, subqueries, aggregations, complex WHERE conditions.

```ts
const repo = AppDataSource.getRepository(Order);

// Select query
const results = await repo
  .createQueryBuilder('order')
  .innerJoinAndSelect('order.user', 'user')
  .where('order.status = :status', { status: 'PAID' })
  .andWhere('user.isActive = :active', { active: true })
  .orderBy('order.createdAt', 'DESC')
  .skip(0)
  .take(20)
  .getMany();

// Count
const count = await repo
  .createQueryBuilder('order')
  .where('order.user_id = :userId', { userId: 5 })
  .getCount();

// Aggregation
const stats = await repo
  .createQueryBuilder('order')
  .select('order.user_id', 'userId')
  .addSelect('SUM(order.total)', 'totalSpend')
  .addSelect('COUNT(*)', 'orderCount')
  .where('order.status = :status', { status: 'PAID' })
  .groupBy('order.user_id')
  .having('SUM(order.total) > :min', { min: 1000 })
  .getRawMany();
```

### Insert / Update / Delete via QueryBuilder

```ts
// Bulk insert
await AppDataSource
  .createQueryBuilder()
  .insert()
  .into(User)
  .values([
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob',   email: 'bob@example.com' },
  ])
  .execute();

// Bulk update
await AppDataSource
  .createQueryBuilder()
  .update(User)
  .set({ isActive: false })
  .where('createdAt < :cutoff', { cutoff: new Date('2023-01-01') })
  .execute();

// Delete
await AppDataSource
  .createQueryBuilder()
  .delete()
  .from(Order)
  .where('status = :s', { s: 'CANCELLED' })
  .execute();
```

> Always pass values through named parameters (`:name`) — never interpolate user input into query strings. TypeORM parameterizes them automatically, preventing SQL injection.

---

## Transactions

Use transactions whenever you have multiple writes that must succeed or fail together.

### Simple transaction

```ts
await AppDataSource.transaction(async manager => {
  const user = manager.create(User, { name: 'Alice', email: 'alice@example.com' });
  await manager.save(user);

  const order = manager.create(Order, { user, total: 99.99, status: 'PAID' });
  await manager.save(order);
  // If anything throws, the whole transaction rolls back automatically
});
```

### Explicit QueryRunner (more control)

```ts
const queryRunner = AppDataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  await queryRunner.manager.save(User, { name: 'Alice', email: 'a@example.com' });
  await queryRunner.manager.save(Order, { userId: 1, total: 50 });

  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  await queryRunner.release();   // always release the connection
}
```

Use the explicit `QueryRunner` approach when you need to:
- Run raw SQL alongside ORM operations
- Do partial rollbacks with savepoints
- Span multiple service calls in one transaction

---

## Migrations

Migrations are the production-safe way to evolve your schema. Never use `synchronize: true` in production.

### Generate a migration (from entity diff)

```bash
npx typeorm migration:generate src/migration/AddOrderStatus -d src/data-source.ts
```

This compares your entities to the current DB schema and generates the SQL diff automatically.

### Write a migration manually

```ts
// src/migration/1715000000000-AddOrderStatus.ts
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOrderStatus1715000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('orders', new TableColumn({
      name: 'status',
      type: 'varchar',
      length: '50',
      default: "'PENDING'",
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'status');
  }
}
```

### Run / revert migrations

```bash
npx typeorm migration:run -d src/data-source.ts
npx typeorm migration:revert -d src/data-source.ts   # reverts the last migration
npx typeorm migration:show -d src/data-source.ts     # shows pending migrations
```

TypeORM tracks applied migrations in the `migrations` table automatically.

---

## Custom Repository Pattern

For complex query logic, extend the base repository instead of scattering queries across your service layer.

```ts
// src/repository/UserRepository.ts
import { AppDataSource } from '../data-source';
import { User } from '../entity/User';

export const UserRepository = AppDataSource.getRepository(User).extend({
  findActiveWithOrders(userId: number) {
    return this.createQueryBuilder('user')
      .leftJoinAndSelect('user.orders', 'order')
      .where('user.id = :userId', { userId })
      .andWhere('user.isActive = true')
      .getOne();
  },

  async findByEmailOrFail(email: string): Promise<User> {
    const user = await this.findOneBy({ email });
    if (!user) throw new Error(`User not found: ${email}`);
    return user;
  },
});
```

Usage:

```ts
import { UserRepository } from './repository/UserRepository';

const user = await UserRepository.findActiveWithOrders(1);
```

---

## N+1 Problem

The most common TypeORM performance bug. It happens when you load a list and then access a relation for each row — triggering one query per row.

```ts
// BAD — N+1 queries
const users = await userRepo.find();
for (const user of users) {
  const orders = await orderRepo.findBy({ user: { id: user.id } });
  // Each iteration fires a separate SELECT
}

// GOOD — single JOIN query
const users = await userRepo.find({
  relations: { orders: true },
});

// ALSO GOOD — QueryBuilder with JOIN
const users = await userRepo
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.orders', 'order')
  .getMany();
```

---

## Soft Deletes

Add `@DeleteDateColumn()` to an entity and TypeORM will set the timestamp on delete rather than removing the row. All `find` queries automatically filter out soft-deleted rows.

```ts
@Entity('users')
export class User {
  @DeleteDateColumn()
  deletedAt: Date | null;
}

await userRepo.softDelete({ id: 1 });   // sets deletedAt
await userRepo.restore({ id: 1 });      // clears deletedAt

// Include soft-deleted in query
const all = await userRepo.find({ withDeleted: true });
```

---

## Common Gotchas

| Gotcha | Fix |
|---|---|
| `synchronize: true` in production | Always `false`; use migrations |
| Forgetting `reflect-metadata` import | Import it once at the top of your entry file |
| Relation not loaded (returns `undefined`) | Explicitly pass `relations` in `find` or use QueryBuilder JOIN |
| `save()` on a detached entity creates a duplicate | Load the entity first, then mutate and save |
| N+1 queries | Use `relations` option or JOIN in QueryBuilder |
| Raw SQL injection | Never interpolate strings — always use named params (`:name`) |
| Leaking QueryRunner connections | Always call `queryRunner.release()` in a `finally` block |
| Missing `@JoinColumn` on owning side | OneToOne and ManyToOne require it on the FK side |
| `update()` doesn't trigger `@UpdateDateColumn` | It does — but `@BeforeUpdate` hooks are skipped; use `save()` if you need hooks |

---

## Quick Reference

```ts
// Get a repository
const repo = AppDataSource.getRepository(Entity);

// CRUD
repo.create(data)                 // instantiate (no DB call)
repo.save(entity)                 // INSERT or UPDATE
repo.findOneBy({ id })            // SELECT, returns null
repo.findOneByOrFail({ id })      // SELECT, throws if not found
repo.findBy({ field: value })     // SELECT multiple
repo.find({ where, relations, order, skip, take })
repo.update({ id }, partialData)  // UPDATE without loading
repo.delete({ id })               // DELETE
repo.softDelete({ id })           // soft delete
repo.restore({ id })              // undo soft delete
repo.count({ where })             // COUNT

// QueryBuilder
repo.createQueryBuilder('alias')
  .where('alias.field = :val', { val })
  .innerJoinAndSelect('alias.relation', 'rel')
  .orderBy('alias.field', 'DESC')
  .skip(0).take(10)
  .getMany()     // returns Entity[]
  .getOne()      // returns Entity | null
  .getRawMany()  // returns plain objects (for aggregations)
  .getCount()

// Transaction
AppDataSource.transaction(async manager => { ... })
```
