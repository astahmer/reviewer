import { Schema } from 'effect'

/**
 * Error for VCS (git) operations
 */
export class VCSError extends Schema.TaggedError<VCSError>()('VCSError', {
  message: Schema.String,
  command: Schema.optional(Schema.String),
}) {}

/**
 * Error for diff parsing operations
 */
export class DiffParseError extends Schema.TaggedError<DiffParseError>()('DiffParseError', {
  message: Schema.String,
  rawDiff: Schema.optional(Schema.String),
}) {}

/**
 * Error for storage operations
 */
export class StorageError extends Schema.TaggedError<StorageError>()('StorageError', {
  message: Schema.String,
  key: Schema.optional(Schema.String),
}) {}

/**
 * Union of all application errors
 */
export type AppError = VCSError | DiffParseError | StorageError
