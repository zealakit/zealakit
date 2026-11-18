export {};

declare global {
  type ViewType = "mobile" | "desktop";

  type BaseModel = {
    createdAt: string;
    updatedAt: string;
    deletedAt: string;
    createdBy: string | object;
    updatedBy: string | object;
    deletedBy: string | object;
    searchValue: string;
  };

  type ApiGeneralListQuery<T> = T & {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
    search?: string;
  };

  type ApiGeneralResponse<T> = {
    data: T;
    message: string | null;
    duration: string;
  };

  type ApiGeneralListPaginationResponse = {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  type ApiGeneralListResponse<T> = {
    data: {
      results: T[];
      pagination: ApiGeneralListPaginationResponse;
    };
    message: string | null;
    duration: string;
  };

  type ApiGeneralErrorResponse = {
    message: string;
    errorCode: string;
    detail?: unknown;
  };

  type ApiGeneralDeleteResponse = ApiGeneralResponse<{
    message: string;
  }>;
}
