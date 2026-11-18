import { CONSTANTS } from "../constants";
import type { GetDefaultLocaleOutput } from "./models/locale.model";

export const getDefault = async (): Promise<GetDefaultLocaleOutput> => {
  console.log(CONSTANTS.APIS.LOCALE.GET_DEFAULT);
  // TODO: Implement
  return Promise.resolve({
    data: {
      id: CONSTANTS.LOCALES.CODES.EN,
    },
    message: "Success",
    duration: "0ms",
  });
};
