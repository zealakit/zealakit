import type { Item } from "@/domain/feature-a/aggregates/item.aggregate.js";
import { CreateItemResultDto } from "../dtos/create-item-result.dto.js";

export function toCreateItemResult(item: Item): CreateItemResultDto {
  return new CreateItemResultDto(item.id.toString(), item.getName());
}
