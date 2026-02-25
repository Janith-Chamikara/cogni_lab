import { z } from "zod";

export const moduleSchema = z.object({
  moduleName: z
    .string()
    .min(1, "Module name is required")
    .max(200, "Module name is too long"),
  description: z
    .string()
    .max(1000, "Description is too long")
    .optional(),
  moduleCode: z
    .string()
    .max(50, "Module code is too long")
    .optional(),
});

export type ModuleFormValues = z.infer<typeof moduleSchema>;
