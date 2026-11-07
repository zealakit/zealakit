export type ExampleModel = {
  id: string;
  name: string;
  description: string;
};

export type GetExampleListInput = ApiGeneralListQuery<{
  status?: string;
}>;

export type GetExampleListOutput = ApiGeneralListResponse<ExampleModel>;

export type GetExampleDetailInput = {
  id: string;
};

export type GetExampleDetailOutput = ApiGeneralResponse<ExampleModel>;

export type CreateExampleInput = {
  name: string;
  description: string;
};

export type CreateExampleOutput = ApiGeneralResponse<ExampleModel>;

export type UpdateExampleInput = {
  id: string;
  name: string;
  description: string;
};

export type UpdateExampleOutput = ApiGeneralResponse<ExampleModel>;

export type DeleteExampleInput = {
  id: string;
};

export type DeleteExampleOutput = ApiGeneralDeleteResponse;
