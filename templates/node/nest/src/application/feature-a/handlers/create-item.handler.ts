import { Inject, Injectable } from "@nestjs/common";
import { Item } from "@/domain/feature-a/aggregates/item.aggregate.js";
import { CreateItemCommand } from "../commands/create-item.command.js";
import { CreateItemResultDto } from "../dtos/create-item-result.dto.js";
import { toCreateItemResult } from "../mappers/item.mapper.js";
import type { ItemRepositoryPort } from "../ports/output/item.repository.port.js";
import { FEATURE_A_TOKENS } from "../tokens/feature-a.tokens.js";

@Injectable()
export class CreateItemHandler {
  constructor(
    @Inject(FEATURE_A_TOKENS.ITEM_REPOSITORY)
    private readonly itemRepository: ItemRepositoryPort,
  ) {}

  async execute(command: CreateItemCommand): Promise<CreateItemResultDto> {
    const item = Item.create(command.name);
    await this.itemRepository.save(item);
    // Domain events (item.pullDomainEvents()) can be published via a bus port.
    return toCreateItemResult(item);
  }
}
