// import { users } from "@/lib/db/schema";
// import { LoginInput, RegisterInput } from "@/lib/validations/auth";
// import { findByEmail } from "./user.service";
// import { ApiError } from "@/lib/types/api";
// import { hashPassword, verifyPassword } from "@/lib/auth/password";
// import { verifyToken as verifyJwtToken } from "@/lib/auth/jwt";
// import { generateTokens } from "@/lib/auth/jwt";
// import { getDb } from "@/lib/db";

// const db = getDb();

// export async function loginUser(data: LoginInput) {
//   try {
//     const user = await findByEmail(data.email);
//     if (!user) {
//       throw new ApiError("Invalid credentials", 401);
//     }
//     const isPasswordValid = await verifyPassword(data.password, user.password);

//     if (!isPasswordValid) {
//       throw new ApiError("Invalid Credentials");
//     }
//     const { accessToken, refreshToken } = generateTokens(user.id, user.email);

//     // TODO : Re-review this code, why i how to remove user id
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     const { password: _, ...userWithoutPassword } = user;
//     return { user: userWithoutPassword, accessToken, refreshToken };
//   } catch (error) {
//     if (error instanceof ApiError) {
//       throw error;
//     }
//     console.error("Login error: ", error);
//     throw new ApiError("Login failed", 500);
//   }
// }

// export async function registerUser(data: RegisterInput) {
//   try {
//     const hashedPassword = await hashPassword(data.password);
//     const [newUser] = await db
//       .insert(users)
//       .values({
//         username: data.name,
//         email: data.email,
//         password: hashedPassword,
//         role: "user",
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       })
//       .returning();

//     const { accessToken, refreshToken } = generateTokens(
//       newUser.id,
//       newUser.email
//     );
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     const { password: _, ...userWithoutPassword } = newUser;
//     return { user: userWithoutPassword, accessToken, refreshToken };
//   } catch (error) {
//     console.error("Registration failed: ", error);
//     throw new ApiError("Registration failed", 500);
//   }
// }

// export async function verifyToken(token: string) {
//   const payload = verifyJwtToken(token);
//   const user = await findByEmail((await payload).email);
//   try {
//     if (!user) {
//       throw new ApiError("User not found", 404);
//     }

//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     const { password: _, ...userWithoutPassword } = user;
//     return userWithoutPassword;
//   } catch (error) {
//     if (error instanceof ApiError) throw error;
//     throw new ApiError("Invalid token", 401);
//   }
// }
