import { z } from "zod";

export const tagSchema = z.object({
  name: z.string().min(1, "Name required"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .optional(),
});

