import { Item } from "@/domain/feature-a/aggregates/item.aggregate.js";
import { CreateItemCommand } from "../commands/create-item.command.js";
import { CreateItemResultDto } from "../dtos/create-item-result.dto.js";
import { toCreateItemResult } from "../mappers/item.mapper.js";
import type { ItemRepositoryPort } from "../ports/output/item.repository.port.js";

export class CreateItemHandler {
  constructor(private readonly itemRepository: ItemRepositoryPort) {}

  async execute(command: CreateItemCommand): Promise<CreateItemResultDto> {
    const item = Item.create(command.name);
    await this.itemRepository.save(item);
    // Domain events (item.pullDomainEvents()) can be published via a bus port.
    return toCreateItemResult(item);
  }
}
