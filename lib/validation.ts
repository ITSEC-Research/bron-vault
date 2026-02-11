import { z } from "zod"

// Common validation patterns
export const emailSchema = z.string().email("Invalid email address")
export const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")

export const deviceIdSchema = z.string()
  .min(1, "Device ID is required")
  .max(255, "Device ID too long")

export const searchQuerySchema = z.string()
  .min(1, "Search query is required")
  .max(500, "Search query too long")
  .refine(
    (val) => val.trim().length > 0,
    "Search query cannot be empty or only whitespace"
  )

// Auth schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required")
})

export const registerSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  email: emailSchema,
  password: passwordSchema
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  }
)

// Search schemas
export const searchSchema = z.object({
  query: searchQuerySchema,
  type: z.enum(["email", "username", "url", "domain", "password", "auto"])
    .default("auto"),
  limit: z.number()
    .min(1, "Limit must be at least 1")
    .max(1000, "Limit cannot exceed 1000")
    .default(50),
  offset: z.number()
    .min(0, "Offset cannot be negative")
    .default(0)
})

// Device schemas
export const deviceCredentialsSchema = z.object({
  deviceId: deviceIdSchema
})

export const deviceDetailsSchema = z.object({
  deviceId: deviceIdSchema
})

// File schemas
export const fileContentSchema = z.object({
  deviceId: deviceIdSchema,
  filePath: z.string()
    .min(1, "File path is required")
    .max(1000, "File path too long"),
  fileName: z.string()
    .min(1, "File name is required")
    .max(255, "File name too long")
})

// Upload schemas
export const uploadFileSchema = z.object({
  file: typeof File !== 'undefined'
    ? z.instanceof(File)
        .refine((file) => file.size > 0, "File cannot be empty")
        .refine((file) => file.size <= 100 * 1024 * 1024, "File size cannot exceed 100MB")
        .refine(
          (file) => file.name.toLowerCase().endsWith('.zip'),
          "Only ZIP files are allowed"
        )
    : z.any() // Fallback for server-side environments
})

// Stats schemas
export const statsQuerySchema = z.object({
  refresh: z.boolean().optional().default(false)
})

// Utility function to validate and parse data
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true
  data: T
} | {
  success: false
  errors: z.ZodError
} {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error }
    }
    throw error
  }
}

// Utility function to create validation error response
export function createValidationErrorResponse(errors: z.ZodError) {
  const formattedErrors = errors.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }))

  return {
    error: "Validation failed",
    details: formattedErrors,
    message: "Please check your input and try again"
  }
}

// Sanitization functions
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000) // Limit length
}

export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[<>'"]/g, '') // Remove potential injection characters
    .slice(0, 500) // Limit length
}

// Type exports for use in components
export type LoginData = z.infer<typeof loginSchema>
export type RegisterData = z.infer<typeof registerSchema>
export type ChangePasswordData = z.infer<typeof changePasswordSchema>
export type SearchData = z.infer<typeof searchSchema>
export type DeviceCredentialsData = z.infer<typeof deviceCredentialsSchema>
export type FileContentData = z.infer<typeof fileContentSchema>
