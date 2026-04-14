import { Context } from "effect";
import { VCSAdapter } from "~/adapters/vcs/vcs.interface";

export class VCSContext extends Context.Tag("VCSContext")<VCSContext, VCSAdapter>() {}
