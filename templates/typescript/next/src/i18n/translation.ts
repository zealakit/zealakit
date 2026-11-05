import type { Messages } from "./messages";

export type TranslationNamespace = keyof Messages & string;

type NestedMessageKey<Value> = Value extends string
  ? never
  : {
      [Key in keyof Value & string]: Value[Key] extends string
        ? Key
        : `${Key}.${NestedMessageKey<Value[Key]>}`;
    }[keyof Value & string];

export type TranslationKey<Namespaces extends readonly TranslationNamespace[]> = {
  [Namespace in Namespaces[number]]: `${Namespace}:${NestedMessageKey<Messages[Namespace]>}`;
}[Namespaces[number]];

type TranslationValues = Record<string, string | number | Date>;
type BaseTranslation = (key: string, values?: TranslationValues) => string;

export type Translation<Namespaces extends readonly TranslationNamespace[]> = (
  key: TranslationKey<Namespaces>,
  values?: TranslationValues,
) => string;

export function createTranslation<const Namespaces extends readonly TranslationNamespace[]>(
  translate: BaseTranslation,
  namespaces: Namespaces,
): Translation<Namespaces> {
  const allowedNamespaces = new Set<string>(namespaces);

  return (key, values) => {
    const separatorIndex = key.indexOf(":");
    const namespace = key.slice(0, separatorIndex);

    if (separatorIndex < 1 || !allowedNamespaces.has(namespace)) {
      throw new Error(`Translation namespace '${namespace}' was not registered.`);
    }

    const intlKey = `${namespace}.${key.slice(separatorIndex + 1)}`;
    return translate(intlKey, values);
  };
}
