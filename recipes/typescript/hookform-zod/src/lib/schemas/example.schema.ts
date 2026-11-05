import { z } from "zod";

/**
 * Example schema for React Hook Form + Zod.
 *
 * @example
 * import { zodResolver } from "@hookform/resolvers/zod";
 * import { useForm } from "react-hook-form";
 * import { exampleSchema, type ExampleFormValues } from "@/lib/schemas";
 *
 * const form = useForm<ExampleFormValues>({
 *   resolver: zodResolver(exampleSchema),
 *   defaultValues: { name: "", email: "" },
 * });
 */
export const exampleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email"),
});

export type ExampleFormValues = {
  name: string;
  email: string;
};
