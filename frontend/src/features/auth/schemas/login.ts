import { z } from "zod";
import { UserRole } from "@/types";

export const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.nativeEnum(UserRole, {
        message: "Please select a role",
    }),
});

export type LoginFormData = z.infer<typeof loginSchema>;
