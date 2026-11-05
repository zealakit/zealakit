/**
 * Persistence model for Feature A items.
 * Decorate with the chosen ORM (TypeORM, MikroORM, …) when wiring a database.
 */
export class ItemOrmEntity {
  id!: string;
  name!: string;
  createdAt!: Date;
}
