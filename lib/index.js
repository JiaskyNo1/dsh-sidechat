//#region lib/types/index.js
/**
* DSH Side Chat — host plugin (DeepSeek Harness 0.2.1-rc.2).
*
* Provides the `sidechat` Typert Remote service backing the browser side-chat
* panel: project/session context gathering, the model catalog, and streaming
* generation through `llm.stream` (job + poll). Every Remote method crosses the
* wire as plain JSON — session identity travels as a string, never as an Agent
* or Session object.
*
* Registration on 0.2.1 (verified against the shipped packages):
* - the class is a plain object registered through `ctx.reflect.provide`, which
*   cordis 4.0.5 still exposes (`ReflectService.provide`, reflect.d.ts L41/L144);
* - it carries the visible `typertRemote` binding (`{service, serviceKey,
*   namespace}`) that `dsh-api-gateway`'s strict dispatch validates before every
*   call (`validateBinding`, lib/index.js L1194/L1698-1709);
* - the strict invocation contract ships as the `./typert` host artifact
*   (`TYPERT: TypertContribution`), which `@deepseek-ai/dsh-typert-loader`
*   discovers from the package `exports["./typert"]` and registers with
*   `ctx.typert.register()`. Its schemas/codecs are `create()` factories — the
*   0.1 `schema:` fields are no longer accepted.
*
* The module imports no `@deepseek-ai/*` value at runtime, so a git install
* (whose profile node_modules holds only this package's own dependencies) can
* load the host half without peer resolution.
* @module dsh-sidechat
*/
/**
* The `sidechat` service: one Remote endpoint per panel capability.
*
* Standard Cordis plugin shape: the module exports a named `apply` function
* (the loader's `unwrapExports` passes the module namespace to
* `registry.plugin`, which invokes `apply(ctx)`). `apply` instantiates the
* service, which registers itself (and its Gateway binding) for the plugin
* fiber. Every optional service is read defensively through `ctx.get`, so a
* composition without `agents`, `sandboxPolicy`, `sessionTitle`, or `fs` keeps
* working.
* @module dsh-sidechat
*/
/** Durable side-chat preferences moved to the browser (localStorage) in 0.2.1. */
function apply(ctx) {
	new SidechatService(ctx);
}
var SidechatService = class {
	ctx;
	jobs = /* @__PURE__ */ new Map();
	seq = 0;
	/** Visible binding consumed by the Gateway's strict dispatch validation. */
	typertRemote;
	constructor(ctx) {
		this.ctx = ctx;
		this.typertRemote = Object.freeze({
			service: this,
			serviceKey: "sidechat",
			namespace: "sidechat"
		});
		ctx.reflect.provide("sidechat", this);
		ctx.effect(() => () => {
			this.jobs.clear();
		}, "sidechat: generation jobs");
	}
	/**
	* The live session for one wire session id, or `undefined` for an empty or
	* unknown id. The store lookup is defensive because Remote dispatch may run
	* outside any agent boundary.
	*/
	liveSession(sessionId) {
		if (sessionId === "") return void 0;
		try {
			return this.ctx.get("sessions")?.get(sessionId);
		} catch {
			return;
		}
	}
	/** The session's own working directory when it has one. */
	sessionCwd(session) {
		try {
			const cwd = session?.header.cwd;
			if (typeof cwd === "string" && cwd.length > 0) return cwd;
		} catch {}
	}
	async readProjectContext(sessionId) {
		const session = this.liveSession(sessionId);
		let root = this.sessionCwd(session);
		if (root === void 0) try {
			const cwd = this.ctx.get("agents")?.currentInitiator()?.session?.header?.cwd;
			if (typeof cwd === "string" && cwd.length > 0) root = cwd;
		} catch {}
		if (root === void 0) try {
			root = this.ctx.get("sandboxPolicy")?.workspaceRoot;
		} catch {}
		const context = {
			root: root ?? null,
			branch: null,
			conversation: this.readConversationContext(session)
		};
		if (context.root === null) return context;
		const fs = this.ctx.get("fs");
		if (fs !== void 0) try {
			const head = await fs.resolve(".git/HEAD", { cwd: context.root });
			const text = await fs.readText(head);
			const match = /ref:\s*refs\/heads\/([^\s]+)/.exec(text);
			if (match !== null) context.branch = match[1] ?? null;
		} catch {}
		return context;
	}
	readConversationContext(session) {
		const out = {
			title: null,
			messages: []
		};
		if (session === void 0) return out;
		try {
			const snapshot = this.ctx.get("sessionTitle")?.get(session);
			if (snapshot !== void 0 && snapshot.title.length > 0) out.title = snapshot.title;
		} catch {}
		try {
			const derived = session.deriveMessages();
			const picked = [];
			for (let i = derived.length - 1; i >= 0 && picked.length < 12; i -= 1) {
				const message = derived[i];
				if (message === void 0) continue;
				if (message.role !== "user" && message.role !== "assistant") continue;
				const text = message.content.filter((block) => block !== null && block !== void 0 && block.type === "text").map((block) => block.text).join("").slice(0, 2e3);
				if (text === "") continue;
				picked.push({
					role: message.role,
					text
				});
			}
			out.messages = picked.reverse();
		} catch {}
		return out;
	}
	buildSystemPrompt(context, provider, model, reasoningEffort) {
		const lines = [
			"You are a coding assistant embedded in the DeepSeek Harness side-chat panel.",
			`You are currently running as model "${model}" from provider "${provider}"` + (reasoningEffort !== void 0 ? ` with reasoning effort "${reasoningEffort}"` : "") + ".",
			"When the user asks which model you are, answer with exactly this model id.",
			"The user is working inside the project below. Use this context to answer their questions."
		];
		if (context.root !== null) lines.push(`- Project root: ${context.root}`);
		if (context.branch !== null) lines.push(`- Git branch: ${context.branch}`);
		if (context.conversation.messages.length > 0) {
			lines.push("");
			lines.push("The main conversation in progress (most recent last) is below; keep your answer consistent with it:");
			for (const message of context.conversation.messages) lines.push(`${message.role}: ${message.text}`);
		}
		lines.push("Answer in the same language the user writes in. Be concise and accurate; say clearly when you are not sure.");
		return lines.join("\n");
	}
	/**
	* Turn the browser's lightweight `{role, content}` history into the
	* `Message[]` the 0.2.1 LLM request accepts. No runtime `@deepseek-ai/dsh-llm`
	* import is needed: the message shapes are plain JSON plus one branded id.
	*/
	buildHistory(raw, provider, model) {
		const now = Date.now();
		return raw.slice(-20).map((message, index) => {
			const text = String(message?.content ?? "");
			const id = `sidechat-${now}-${index}-${Math.random().toString(36).slice(2)}`;
			const content = [{
				type: "text",
				text
			}];
			if (message?.role === "assistant") return {
				id,
				role: "assistant",
				content,
				source: {
					kind: "model",
					provider,
					model
				}
			};
			return {
				id,
				role: "user",
				content,
				source: { kind: "user" }
			};
		});
	}
	/** Project + session context for the panel header and every generation. */
	async getContext(args) {
		return this.readProjectContext(String(args?.sessionId ?? ""));
	}
	/** Advisory provider/model catalog with per-model reasoning efforts. */
	async models() {
		const llm = this.ctx.get("llm");
		let current = null;
		try {
			const selection = this.ctx.get("agentDefaultModel")?.currentSelection();
			if (selection !== void 0) current = {
				provider: selection.provider,
				model: selection.model
			};
		} catch {}
		const groups = [];
		if (llm !== void 0) for (const provider of llm.listProviders()) try {
			const models = await llm.listModels(provider.id);
			const entries = [];
			for (const model of models) {
				const entry = {
					id: model.id,
					name: model.name
				};
				try {
					const resolved = await llm.resolveModelInfo(provider.id, model.id);
					if (resolved.reasoning !== void 0) entry.reasoning = {
						efforts: resolved.reasoning.efforts.map((effort) => ({
							id: effort.id,
							name: effort.name
						})),
						defaultEffort: resolved.reasoning.defaultEffort ?? null
					};
				} catch {}
				entries.push(entry);
			}
			groups.push({
				id: provider.id,
				name: provider.name,
				models: entries
			});
		} catch {}
		return {
			groups,
			current
		};
	}
	/** Start one streaming generation; the browser polls {@link poll} for deltas. */
	async start(args) {
		const raw = Array.isArray(args?.messages) ? args.messages : [];
		const sessionId = String(args?.sessionId ?? "");
		const customProvider = typeof args?.provider === "string" && args.provider.length > 0 ? args.provider : null;
		const customModel = typeof args?.model === "string" && args.model.length > 0 ? args.model : null;
		const customEffort = typeof args?.reasoningEffort === "string" && args.reasoningEffort.length > 0 ? args.reasoningEffort : null;
		const selection = this.ctx.get("agentDefaultModel")?.currentSelection();
		const llm = this.ctx.get("llm");
		if (selection === void 0 || llm === void 0) throw new Error("side chat: no model route is available");
		const provider = customProvider ?? selection.provider;
		const model = customModel ?? selection.model;
		const reasoningEffort = customProvider !== null ? customEffort ?? void 0 : selection.reasoningEffort;
		const history = this.buildHistory(raw, provider, model);
		if (history.length === 0) throw new Error("side chat: no messages to send");
		const context = await this.readProjectContext(sessionId);
		const options = {
			provider,
			model,
			messages: history,
			system: this.buildSystemPrompt(context, provider, model, reasoningEffort),
			temperature: .7,
			maxTokens: 4096,
			...reasoningEffort !== void 0 ? { reasoningEffort } : {}
		};
		const id = `sidechat-${++this.seq}`;
		const job = {
			id,
			text: "",
			reasoning: "",
			done: false,
			error: null
		};
		this.jobs.set(id, job);
		(async () => {
			try {
				for await (const chunk of llm.stream(options)) {
					if (this.jobs.get(id) !== job) return;
					if (chunk.type === "text-delta") job.text += chunk.text;
					else if (chunk.type === "reasoning-delta") job.reasoning += chunk.text;
					else if (chunk.type === "finish" && chunk.reason.kind === "error") {
						const failure = chunk.reason.failure;
						job.error = failure !== null && typeof failure === "object" && "message" in failure ? String(failure.message) : String(failure);
					}
				}
			} catch (error) {
				if (this.jobs.get(id) === job) job.error = error instanceof Error ? error.message : String(error);
			} finally {
				if (this.jobs.get(id) === job) job.done = true;
			}
		})();
		return { jobId: id };
	}
	/** Read the accumulated text and reasoning of one job. */
	poll(args) {
		const job = this.jobs.get(String(args?.jobId ?? ""));
		if (job === void 0) return {
			done: true,
			text: "",
			reasoning: "",
			error: "side chat: job not found"
		};
		return {
			done: job.done,
			text: job.text,
			reasoning: job.reasoning,
			error: job.error
		};
	}
	/** Stop polling a job; the in-flight stream finishes but no longer updates it. */
	stop(args) {
		const id = String(args?.jobId ?? "");
		const job = this.jobs.get(id);
		if (job !== void 0) {
			job.done = true;
			this.jobs.delete(id);
		}
		return { stopped: true };
	}
};
//#endregion
export { SidechatService, apply };
