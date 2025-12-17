import { z } from "zod";

export const loginSchema = z.object({
  // TODO : keep identifier as optional either email or username login
  // identifier: z.string().min(1, "Email or username is required"),
  email: z.email("Invalid email format").min(1, "Email is required"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password is too long"),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be less than 50 characters")
      .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
    email: z.email("Invalid email format").min(1, "Email is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password is too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one lowercase letter, one uppercase letter, and one number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// export const changePasswordSchema = z.object({
//   currentPassword: z.string().min(1, 'Current password is required'),
//   newPassword: z.string()
//     .min(8, 'New password must be at least 8 characters')
//     .max(100, 'Password too long')
//     .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
//   confirmNewPassword: z.string()
// }).refine((data) => data.newPassword === data.confirmNewPassword, {
//   message: "New passwords don't match",
//   path: ["confirmNewPassword"],
// })
// export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
