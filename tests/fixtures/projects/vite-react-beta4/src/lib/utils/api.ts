export const assignParamsToUrl = ({
  url,
  params,
}: {
  url: string;
  params: { key: string; value: string }[];
}): string => {
  if (typeof url !== "string") {
    return "";
  }

  if (!Array.isArray(params) || params.length === 0) {
    return url;
  }

  let urlTemp = url;

  params.forEach((param) => {
    const keyWithBraces = `{${param.key}}`;

    if (param.value === "") {
      const searchPath = `/${keyWithBraces}`;

      urlTemp = urlTemp.replace(new RegExp(searchPath), "");
    } else {
      urlTemp = urlTemp.replace(keyWithBraces, param.value);
    }
  });

  urlTemp = urlTemp.replace(/\/\/+/g, "/");

  if (urlTemp.length > 0 && urlTemp[0] !== "/") {
    urlTemp = `/${urlTemp}`;
  }

  if (urlTemp.length > 1 && urlTemp.endsWith("/")) {
    urlTemp = urlTemp.slice(0, -1);
  }

  return urlTemp;
};

export const modifyInputQuery = (input: Record<string, unknown> | null) => {
  if (typeof input === "undefined") {
    return undefined;
  }
  if (!input) {
    return undefined;
  }
  const valueList = Object.values(input);
  const keyList = Object.keys(input);
  const newInput: unknown = {};
  valueList.forEach((item: unknown, itemIdx: number) => {
    if (Array.isArray(item)) {
      (newInput as Record<string, unknown>)[`${keyList[itemIdx] ?? ""}[]`] = item;
    } else {
      (newInput as Record<string, unknown>)[keyList[itemIdx] ?? ""] = item;
    }
  });
  return newInput;
};
