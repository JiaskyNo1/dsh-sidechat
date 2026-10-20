import { z } from "zod";
//#region lib/types/typert.js
/**
* Hand-written host-face Typert manifest for the `sidechat` service
* (DeepSeek Harness 0.2.1-rc.2 contract).
*
* The harness typert generator emits an equivalent artifact
* (`lib/typert.host.js`) inside the monorepo; a single self-contained package
* cannot run the generator (it requires the workspace layout), so this module
* restates the same wire contract. The 0.2.1 shape differs from 0.1 in two
* ways, both checked by `@deepseek-ai/dsh-typert-loader`'s
* `validateTypertManifest()` before the manifest reaches the registry:
*
* - every entry of `schemas` is a `TypertSchemaFactory`
*   `{ name, create: () => ZodType }`, not a `{ name, schema }` pair;
* - every parameter/result codec is `{ mode: 'strict', typeSymbol,
*   create: () => ZodType }` (optionally `decode`/`encode`), not
*   `{ mode, typeSymbol, schema }`.
*
* `@deepseek-ai/dsh-typert-loader` discovers this artifact through the
* package's `./typert` export, validates it, and registers it with
* `ctx.typert.register()`, which publishes each invocation descriptor into
* `ctx.typert.local` for the Gateway's strict dispatch. The Gateway still
* requires the live service instance to carry the matching `typertRemote`
* binding (see `src/index.ts`). The manifest is JSON-only business data:
* only `zod` is imported at runtime.
* @module dsh-sidechat/typert
*/
/**
* Wrap one of this module's zod schemas as a 0.2.1 schema factory.
*
* The registry pins its own exact `zod` dependency, while this package resolves
* `zod` through its own dependency range, so the two declaration copies are not
* nominally interchangeable even when the runtime schema object is. The
* registry only ever calls `create().parse(value)`, so the factory boundary
* erases the cross-copy generic identity instead of forcing a workspace-wide
* zod dedupe.
* @param name - schema export name, paired with `<package>#` by the registry.
* @param schema - this module's zod schema.
* @returns the factory the registry stores and materializes lazily.
*/
const schemaFactory = (name, schema) => ({
	name,
	create: (() => schema)
});
const contextArgsSchema = z.object({ sessionId: z.string() });
const projectContextSchema = z.object({
	root: z.union([z.literal(null), z.string()]),
	branch: z.union([z.literal(null), z.string()]),
	conversation: z.object({
		title: z.union([z.literal(null), z.string()]),
		messages: z.array(z.object({
			role: z.string(),
			text: z.string()
		}))
	})
});
const modelsResultSchema = z.object({
	groups: z.array(z.object({
		id: z.string(),
		name: z.string(),
		models: z.array(z.object({
			id: z.string(),
			name: z.string(),
			reasoning: z.object({
				efforts: z.array(z.object({
					id: z.string(),
					name: z.string()
				})),
				defaultEffort: z.union([z.literal(null), z.string()])
			}).optional()
		}))
	})),
	current: z.union([z.literal(null), z.object({
		provider: z.string(),
		model: z.string()
	})])
});
const startArgsSchema = z.object({
	sessionId: z.string(),
	messages: z.array(z.object({
		role: z.string(),
		content: z.string()
	})),
	provider: z.string().optional(),
	model: z.string().optional(),
	reasoningEffort: z.string().optional()
});
const jobIdResultSchema = z.object({ jobId: z.string() });
const pollArgsSchema = z.object({ jobId: z.string() });
const pollResultSchema = z.object({
	done: z.boolean(),
	text: z.string(),
	reasoning: z.string(),
	error: z.union([z.literal(null), z.string()])
});
const stopArgsSchema = z.object({ jobId: z.string() });
const stopResultSchema = z.object({ stopped: z.boolean() });
/**
* Host-face contribution registered by the typert-loader when the
* `dsh-sidechat` loader entry mounts. Strict descriptors mirror the browser
* contribution in `src/client/remote.ts`; the wire contract must stay in
* lockstep with it. This package's operations are transient (no service
* reflection, no Remote events, no exported objects), so `model` contributes
* empty lists.
*/
const TYPERT = {
	package: "dsh-sidechat",
	face: "host",
	schemas: [
		schemaFactory("SidechatContextArgs", contextArgsSchema),
		schemaFactory("SidechatProjectContext", projectContextSchema),
		schemaFactory("SidechatModelsResult", modelsResultSchema),
		schemaFactory("SidechatStartArgs", startArgsSchema),
		schemaFactory("SidechatJobIdResult", jobIdResultSchema),
		schemaFactory("SidechatPollArgs", pollArgsSchema),
		schemaFactory("SidechatPollResult", pollResultSchema),
		schemaFactory("SidechatStopArgs", stopArgsSchema),
		schemaFactory("SidechatStopResult", stopResultSchema)
	],
	model: {
		services: [],
		events: [],
		objects: []
	},
	invocations: [
		{
			id: "dsh-sidechat#sidechat/getContext",
			service: "sidechat",
			namespace: "sidechat",
			method: "getContext",
			invocation: { kind: "direct" },
			parameters: [{
				name: "args",
				wire: "args",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-sidechat#SidechatContextArgs",
					create: () => contextArgsSchema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-sidechat#SidechatProjectContext",
				create: () => projectContextSchema
			}
		},
		{
			id: "dsh-sidechat#sidechat/models",
			service: "sidechat",
			namespace: "sidechat",
			method: "models",
			invocation: { kind: "direct" },
			parameters: [],
			result: {
				mode: "strict",
				typeSymbol: "dsh-sidechat#SidechatModelsResult",
				create: () => modelsResultSchema
			}
		},
		{
			id: "dsh-sidechat#sidechat/start",
			service: "sidechat",
			namespace: "sidechat",
			method: "start",
			invocation: { kind: "direct" },
			parameters: [{
				name: "args",
				wire: "args",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-sidechat#SidechatStartArgs",
					create: () => startArgsSchema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-sidechat#SidechatJobIdResult",
				create: () => jobIdResultSchema
			}
		},
		{
			id: "dsh-sidechat#sidechat/poll",
			service: "sidechat",
			namespace: "sidechat",
			method: "poll",
			invocation: { kind: "direct" },
			parameters: [{
				name: "args",
				wire: "args",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-sidechat#SidechatPollArgs",
					create: () => pollArgsSchema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-sidechat#SidechatPollResult",
				create: () => pollResultSchema
			}
		},
		{
			id: "dsh-sidechat#sidechat/stop",
			service: "sidechat",
			namespace: "sidechat",
			method: "stop",
			invocation: { kind: "direct" },
			parameters: [{
				name: "args",
				wire: "args",
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: "dsh-sidechat#SidechatStopArgs",
					create: () => stopArgsSchema
				}
			}],
			result: {
				mode: "strict",
				typeSymbol: "dsh-sidechat#SidechatStopResult",
				create: () => stopResultSchema
			}
		}
	]
};
//#endregion
export { TYPERT };
