import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { HomePage } from "~/pages/home-page";

const SearchParamsSchema = Schema.Struct({
  repoPath: Schema.optional(Schema.String),
  fromBranch: Schema.optional(Schema.String),
  toBranch: Schema.optional(Schema.String),
  fromCommit: Schema.optional(Schema.String),
  toCommit: Schema.optional(Schema.String),
});

export type SearchParams = Schema.Schema.Type<typeof SearchParamsSchema>;

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: Schema.standardSchemaV1(SearchParamsSchema),
});
