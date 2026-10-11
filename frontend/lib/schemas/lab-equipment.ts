import { z } from "zod";

const fileSchema = typeof File === "undefined" ? z.any() : z.instanceof(File);

export const labEquipmentSchema = z.object({
  equipmentType: z
    .string()
    .min(1, "Equipment type is required")
    .max(120, "Equipment type is too long"),
  equipmentName: z
    .string()
    .min(1, "Equipment name is required")
    .max(120, "Equipment name is too long"),
  description: z.string().optional(),
  // Only used by the older components/create-lab-equipment-dialog.tsx; the
  // equipment dialog now sends a component definition instead.
  supportsConfiguration: z.boolean().optional(),
  defaultConfigJson: z
    .string()
    .optional()
    .refine(
      (value) => {
        if (!value) {
          return true;
        }
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: "Default config must be valid JSON",
      },
    ),
  image: fileSchema.optional().nullable(),
});

export type LabEquipmentFormValues = z.infer<typeof labEquipmentSchema>;
