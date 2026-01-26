import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format");

export const tagSchema = z.object({
  name: z.string().min(1, "Name required"),
  color: hexColorSchema.optional(),
});

export const tagUpdateSchema = z
  .object({
    name: z.string().min(1, "Name required").optional(),
    color: hexColorSchema.optional(),
  })
  .refine((v) => Boolean(v.name) || Boolean(v.color), {
    message: "name or color required",
  });

