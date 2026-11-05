const BASE_PATH = "/examples";

export const EXAMPLE = {
  GET_LIST: `${BASE_PATH}`,
  GET_DETAIL: `${BASE_PATH}/{id}`,
  CREATE: `${BASE_PATH}`,
  UPDATE: `${BASE_PATH}/{id}/update`,
  DELETE: `${BASE_PATH}/{id}/delete`,
} as const;
