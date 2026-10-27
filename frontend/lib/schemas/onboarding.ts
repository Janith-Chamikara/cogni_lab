import { z } from "zod";

export const onboardingSchema = z.object({
  role: z.enum(["STUDENT", "INSTRUCTOR"], {
    error: "Please select a role",
  }),
  institution: z
    .string()
    .min(2, "Institution name must be at least 2 characters")
    .max(100, "Institution name must be less than 100 characters"),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
