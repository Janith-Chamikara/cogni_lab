import { z } from "zod";

export const createLabStep1Schema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  category: z.string().min(1, "Category is required"),
  labName: z.string().min(1, "Lab name is required"),
  createdAt: z.string().optional(),
  instructorName: z.string().optional(),
  contactNo: z.string().optional(),
  description: z.string().optional(),
  moduleId: z.string().min(1, "Module is required"),
});

export type CreateLabStep1Values = z.infer<typeof createLabStep1Schema>;

export const thresholdSchema = z.object({
  toleranceMin: z.number().optional(),
  toleranceMax: z.number().optional(),
  toleranceUnit: z.string().optional(),
});

export type ThresholdValues = z.infer<typeof thresholdSchema>;
