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
			let budget = 48e3;
			for (let i = derived.length - 1; i >= 0 && picked.length < 40 && budget > 0; i -= 1) {
				const message = derived[i];
				if (message === void 0) continue;
				const text = this.renderMessageText(message);
				if (text === "") continue;
				const clipped = text.slice(0, Math.min(6e3, budget));
				budget -= clipped.length;
				const role = message.role === "assistant" ? "assistant" : message.role === "tool" ? "tool" : "user";
				picked.push({
					role,
					text: clipped
				});
			}
			out.messages = picked.reverse();
		} catch {}
		return out;
	}
	/**
	* Flatten one durable message into the text the side-chat prompt shows:
	* visible text plus a compact account of tool calls (and, for tool-role
	* messages, the result). Reasoning blocks are omitted — the side chat does
	* its own reasoning and does not need the main agent's private trace.
	*/
	renderMessageText(message) {
		const parts = [];
		for (const block of message.content) {
			if (block === null || block === void 0) continue;
			if (block.type === "text") {
				const text = String(block.text ?? "").trim();
				if (text !== "") parts.push(text);
			} else if (block.type === "tool-call") {
				const args = String(block.arguments ?? "").trim();
				parts.push(`[调用工具 ${block.name}${args === "" ? "" : ` ${args.slice(0, 500)}`}]`);
			}
		}
		const body = parts.join("\n").trim();
		if (body === "") return "";
		if (message.role !== "tool") return body;
		return `[工具结果${message.isError === true ? "（失败）" : ""}] ${body.slice(0, 1200)}`;
	}
	/**
	* Read workspace instruction files (AGENTS.md / CLAUDE.md and their local
	* overlays) from the session working directory, mirroring what the main
	* agent receives as durable instruction context. Best-effort: a missing fs
	* service or file only removes this section.
	*/
	async readProjectInstructions(root) {
		if (root === null) return null;
		const fs = this.ctx.get("fs");
		if (fs === void 0) return null;
		const chunks = [];
		for (const name of [
			"AGENTS.md",
			"CLAUDE.md",
			"AGENTS.local.md",
			"CLAUDE.local.md"
		]) try {
			const target = await fs.resolve(name, { cwd: root });
			const text = (await fs.readText(target)).trim();
			if (text !== "") chunks.push(`### ${name}\n${text}`);
		} catch {}
		if (chunks.length === 0) return null;
		return chunks.join("\n\n").slice(0, 16e3);
	}
	buildSystemPrompt(context, instructions, provider, model, reasoningEffort) {
		const lines = [
			`You are a coding agent powered by the ${model} model.`,
			"You are answering inside the DeepSeek Harness side-chat panel, which runs alongside the main conversation.",
			`You are currently running as model "${model}" from provider "${provider}"` + (reasoningEffort !== void 0 ? ` with reasoning effort "${reasoningEffort}"` : "") + ".",
			"When the user asks which model you are, answer with exactly this model id.",
			"",
			"This panel has no tools: you cannot read files, run commands, or change the workspace. Use the project facts and main conversation below as your evidence. When an answer would require inspecting files or running something, state precisely what the main conversation should check instead of guessing.",
			"",
			"Answer with the same judgment, depth, and rigor as the main assistant. Think through the problem carefully before answering; do not answer superficially or over-briefly. Prefer concrete facts from the conversation over generic advice."
		];
		lines.push("", "## Project");
		if (context.root !== null) lines.push(`- Working directory: ${context.root}`);
		if (context.branch !== null) lines.push(`- Git branch: ${context.branch}`);
		if (context.conversation.title !== null) lines.push(`- Session title: ${context.conversation.title}`);
		if (instructions !== null) lines.push("", "## Workspace instructions", "The workspace instruction files below apply to your answers:", "", instructions);
		if (context.conversation.messages.length > 0) {
			lines.push("", "## Main conversation context", "The main conversation in progress (oldest first, most recent last). Tool calls and their results are included so the answer stays grounded in what actually happened:", "");
			for (const message of context.conversation.messages) lines.push(`[${message.role}]`, message.text, "");
		}
		lines.push("## Answering rules", "- Answer in the same language the user writes in.", "- Tools are unavailable in this panel: never emit tool-call markup (such as <|DSML|…> or XML invoke blocks) and never attempt to call a tool. Write normal prose.", "- If the user message contains a marked quote (lines starting with \">\"), that excerpt is the focus: base the answer on it and say what the basis is.", "- Ground claims in the conversation and project facts above; say clearly when you are not sure or when the evidence is missing.", "- Reply with well-structured Markdown when it helps: short paragraphs, lists, and code blocks.");
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
		const usesMainRoute = provider === selection.provider && model === selection.model;
		const reasoningEffort = customEffort ?? (usesMainRoute ? selection.reasoningEffort : void 0);
		const history = this.buildHistory(raw, provider, model);
		if (history.length === 0) throw new Error("side chat: no messages to send");
		const context = await this.readProjectContext(sessionId);
		const instructions = await this.readProjectInstructions(context.root);
		const options = {
			provider,
			model,
			messages: history,
			system: this.buildSystemPrompt(context, instructions, provider, model, reasoningEffort),
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
		const retryOptions = {
			...options,
			system: `${options.system ?? ""}\n\n## Hard constraint\nTools are unavailable in this panel. Never emit tool-call markup (such as <|DSML|…>), XML invoke blocks, or attempts to call tools. Write a normal prose answer from the conversation and project context provided. If a file must be inspected, say which file the main conversation should open instead.`
		};
		(async () => {
			try {
				for (let attempt = 1; attempt <= 2; attempt += 1) {
					let rawText = "";
					let rawReasoning = "";
					let sawToolMarkup = false;
					for await (const chunk of llm.stream(attempt === 1 ? options : retryOptions)) {
						if (this.jobs.get(id) !== job) return;
						if (chunk.type === "text-delta") {
							rawText += chunk.text;
							if (this.looksLikeToolMarkup(rawText)) sawToolMarkup = true;
							job.text = this.sanitizeText(rawText);
						} else if (chunk.type === "reasoning-delta") {
							rawReasoning += chunk.text;
							job.reasoning = this.sanitizeText(rawReasoning);
						} else if (chunk.type === "finish" && chunk.reason.kind === "error") {
							const failure = chunk.reason.failure;
							job.error = failure !== null && typeof failure === "object" && "message" in failure ? String(failure.message) : String(failure);
						}
					}
					const answer = this.sanitizeText(rawText).trim();
					await this.debugLog({
						id,
						attempt,
						sawToolMarkup,
						answerLength: answer.length,
						rawText: rawText.slice(0, 2e3),
						rawReasoning: rawReasoning.slice(0, 1e3),
						error: job.error
					});
					if (job.error !== null) break;
					if (answer !== "") {
						job.text = answer;
						break;
					}
					if (attempt === 1) continue;
					job.text = "（这次没有生成可显示的正文。若问题需要读取文件或执行命令，请回到主对话继续；也可以把相关代码或输出贴进这里再问。）";
					break;
				}
			} catch (error) {
				if (this.jobs.get(id) === job) job.error = error instanceof Error ? error.message : String(error);
			} finally {
				if (this.jobs.get(id) === job) job.done = true;
			}
		})();
		return { jobId: id };
	}
	/** Append one diagnostic record when `DSH_SIDECHAT_DEBUG=1` (local debugging only). */
	async debugLog(entry) {
		if ((globalThis.process?.env)?.DSH_SIDECHAT_DEBUG !== "1") return;
		try {
			const { appendFile } = await import("node:fs/promises");
			const { tmpdir } = await import("node:os");
			const { join } = await import("node:path");
			await appendFile(join(tmpdir(), "dsh-sidechat-debug.jsonl"), `${JSON.stringify({
				time: (/* @__PURE__ */ new Date()).toISOString(),
				...entry
			})}\n`);
		} catch {}
	}
	/** Remove DeepSeek tool-call markup from streamed model text. */
	sanitizeText(raw) {
		let text = raw;
		text = text.replace(/<\s*\/?\s*(?:\|\s*)*DSML\s*(?:\|\s*)*[^>]*calls[^>]*>[\s\S]*?<\s*\/\s*(?:\|\s*)*DSML\s*(?:\|\s*)*[^>]*calls[^>]*>/gi, "");
		text = text.replace(/<\s*\/?\s*(?:\|\s*)*DSML\s*(?:\|\s*)*[^>]*>/gi, "");
		text = text.replace(/<(?:\s*\|)+\s*DSML[\s\S]*$/i, "");
		text = text.replace(/<\|[^>]*\|>/g, "");
		return text;
	}
	/** Whether the text carries any tool-call markup the model should not have emitted. */
	looksLikeToolMarkup(raw) {
		return /DSML|<\/?\s*\|?\s*function_calls|<\s*\|?\s*invoke\s+name\s*=/i.test(raw);
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
