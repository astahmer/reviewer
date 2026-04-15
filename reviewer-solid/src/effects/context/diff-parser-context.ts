import { Context } from "effect";
import { DiffParser } from "~/adapters/diff-parser/types";

export class DiffParserContext extends Context.Tag("DiffParserContext")<
  DiffParserContext,
  DiffParser
>() {}
