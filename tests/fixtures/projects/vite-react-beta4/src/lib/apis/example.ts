import type {
  CreateExampleInput,
  CreateExampleOutput,
  DeleteExampleInput,
  DeleteExampleOutput,
  GetExampleDetailInput,
  GetExampleDetailOutput,
  GetExampleListInput,
  GetExampleListOutput,
  UpdateExampleInput,
  UpdateExampleOutput,
} from "./models/example.model";

export const getExampleList = async (input: GetExampleListInput): Promise<GetExampleListOutput> => {
  console.log(input);
  // TODO: Implement
  return Promise.resolve({
    data: {
      results: [],
      pagination: {
        limit: 10,
        page: 1,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    },
    message: "Success",
    duration: "0ms",
  });
};

export const getExampleDetail = async (
  input: GetExampleDetailInput,
): Promise<GetExampleDetailOutput> => {
  console.log(input);
  // TODO: Implement
  return Promise.resolve({
    data: {
      id: "1",
      name: "Example",
      description: "Example description",
    },
    message: "Success",
    duration: "0ms",
  });
};

export const createExample = async (input: CreateExampleInput): Promise<CreateExampleOutput> => {
  console.log(input);
  // TODO: Implement
  return Promise.resolve({
    data: {
      id: "1",
      name: "Example",
      description: "Example description",
    },
    message: "Success",
    duration: "0ms",
  });
};

export const updateExample = async (input: UpdateExampleInput): Promise<UpdateExampleOutput> => {
  console.log(input);
  // TODO: Implement
  return Promise.resolve({
    data: {
      id: "1",
      name: "Example",
      description: "Example description",
    },
    message: "Success",
    duration: "0ms",
  });
};

export const deleteExample = async (input: DeleteExampleInput): Promise<DeleteExampleOutput> => {
  console.log(input);
  // TODO: Implement
  return Promise.resolve({
    data: {
      message: "Success",
    },
    message: "Success",
    duration: "0ms",
  });
};
