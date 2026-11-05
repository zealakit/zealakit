import { Body, Controller, Post } from "@nestjs/common";
import { CreateItemCommand } from "@/application/feature-a/commands/create-item.command.js";
import { CreateItemHandler } from "@/application/feature-a/handlers/create-item.handler.js";
import { CreateItemRequestDto } from "./dto/create-item.request.dto.js";
import { ItemResponseDto } from "./dto/item.response.dto.js";

@Controller({ path: "feature-a/items", version: "1" })
export class FeatureAController {
  constructor(private readonly createItemHandler: CreateItemHandler) {}

  @Post()
  async create(@Body() body: CreateItemRequestDto): Promise<ItemResponseDto> {
    const result = await this.createItemHandler.execute(new CreateItemCommand(body.name));
    return new ItemResponseDto(result.id, result.name);
  }
}
