import { z } from "zod";

/**
 * Example schema for VeeValidate + Zod.
 *
 * @example
 * import { toTypedSchema } from "@vee-validate/zod";
 * import { useForm } from "vee-validate";
 * import { exampleSchema, type ExampleFormValues } from "@/lib/schemas";
 *
 * const { handleSubmit } = useForm<ExampleFormValues>({
 *   validationSchema: toTypedSchema(exampleSchema),
 *   initialValues: { name: "", email: "" },
 * });
 */
export const exampleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

export type ExampleFormValues = {
  name: string;
  email: string;
};
