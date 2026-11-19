from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.bootstrap.container import Container
from app.domain.feature_a.item import InvalidItemName

router = APIRouter(prefix="/feature-a", tags=["feature-a"])


class CreateItemRequest(BaseModel):
    name: str


class ItemResponse(BaseModel):
    id: str
    name: str


@router.post("/items", status_code=status.HTTP_201_CREATED, response_model=ItemResponse)
def create_item(body: CreateItemRequest, request: Request) -> ItemResponse:
    container: Container = request.app.state.container
    try:
        item = container.create_item.execute(body.name)
    except InvalidItemName as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return ItemResponse(id=item.id, name=item.name)
