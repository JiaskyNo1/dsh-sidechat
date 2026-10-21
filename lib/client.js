window.__ModuleLoader__.load({
	id: "dsh-sidechat",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let zod = require("zod");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/remote.ts
		/**
		* Hand-written Remote contribution for the `sidechat` namespace, ported to the
		* DSH 0.2.1 Typert protocol.
		*
		* 0.2.1 generated Remote artifacts (`@deepseek-ai/<owner>/remote`) still mount
		* a `TypertRemoteContribution` —`{ package, descriptors: InvocationDescriptor[] }`
		* (dsh-typert-protocol/lib/types/types.d.ts:432-437) —through
		* `ctx.remote.$mount(contribution)` (types.d.ts:519-525). What changed from 0.1
		* is the codec envelope: a strict codec is now
		* `{ mode: 'strict', typeSymbol, create: () => TypertSchema, decode?, encode? }`
		* (types.d.ts:243-250, 255-274), where `TypertSchema` only needs
		* `parse(value)`. The 0.1 `{ mode: 'strict', typeSymbol, schema }` field no
		* longer exists.
		*
		* A self-contained package cannot run the harness Typert generator (it requires
		* the monorepo workspace layout), so this module restates the same wire
		* contract by hand. Wire method names and argument objects are unchanged from
		* 0.1 (getContext/models/start/poll/stop); only the codec envelope moved from
		* `schema` to `create()`. The wire interfaces below are derived from these
		* schemas, so the browser half and the Host `./typert` manifest share one
		* literal contract rather than a drifting copy.
		* @module dsh-sidechat/client/remote
		*/
		/** getContext request. */
		const contextArgsSchema = zod.z.object({ sessionId: zod.z.string() });
		/** Project + conversation snapshot injected into every side-chat system prompt. */
		const projectContextSchema = zod.z.object({
			root: zod.z.union([zod.z.literal(null), zod.z.string()]),
			branch: zod.z.union([zod.z.literal(null), zod.z.string()]),
			conversation: zod.z.object({
				title: zod.z.union([zod.z.literal(null), zod.z.string()]),
				messages: zod.z.array(zod.z.object({
					role: zod.z.string(),
					text: zod.z.string()
				}))
			})
		});
		/** Advisory model catalog plus the currently selected default route. */
		const modelsResultSchema = zod.z.object({
			groups: zod.z.array(zod.z.object({
				id: zod.z.string(),
				name: zod.z.string(),
				models: zod.z.array(zod.z.object({
					id: zod.z.string(),
					name: zod.z.string(),
					reasoning: zod.z.object({
						efforts: zod.z.array(zod.z.object({
							id: zod.z.string(),
							name: zod.z.string()
						})),
						defaultEffort: zod.z.union([zod.z.literal(null), zod.z.string()])
					}).optional()
				}))
			})),
			current: zod.z.union([zod.z.literal(null), zod.z.object({
				provider: zod.z.string(),
				model: zod.z.string()
			})])
		});
		/** start request; provider/model/effort override the default selection when present. */
		const startArgsSchema = zod.z.object({
			sessionId: zod.z.string(),
			messages: zod.z.array(zod.z.object({
				role: zod.z.string(),
				content: zod.z.string()
			})),
			provider: zod.z.string().optional(),
			model: zod.z.string().optional(),
			reasoningEffort: zod.z.string().optional()
		});
		/** One started generation job. */
		const jobIdResultSchema = zod.z.object({ jobId: zod.z.string() });
		/** poll request. */
		const pollArgsSchema = zod.z.object({ jobId: zod.z.string() });
		/** Accumulated text and reasoning of one job; `done` once generation settled. */
		const pollResultSchema = zod.z.object({
			done: zod.z.boolean(),
			text: zod.z.string(),
			reasoning: zod.z.string(),
			error: zod.z.union([zod.z.literal(null), zod.z.string()])
		});
		/** stop request. */
		const stopArgsSchema = zod.z.object({ jobId: zod.z.string() });
		/** Stop acknowledgement. */
		const stopResultSchema = zod.z.object({ stopped: zod.z.boolean() });
		/**
		* One strict codec in the 0.2.1 envelope: `create()` materializes the parser
		* lazily. The Client Remote service itself does not parse arguments —it maps
		* positional values onto `args[wire]` and forwards them (`dsh-api-gateway`
		* client `prepareInvocation`); the Host gateway validates against the owning
		* package's `./typert` manifest. The codec still has to satisfy the protocol
		* type, which is what `create()` replaced `schema` for.
		*/
		function strictCodec(typeSymbol, schema) {
			return {
				mode: "strict",
				typeSymbol,
				create: () => schema
			};
		}
		/**
		* Remote contribution owned by this package: one descriptor per endpoint.
		*
		* `parameter.wire` names the field inside the wire `args` object; the 0.2.1
		* Client Remote service forwards positional values as `args[wire]`, so the
		* 0.1 single-object signatures stay byte-compatible on the wire.
		*/
		const TYPERT_REMOTE = {
			package: "dsh-sidechat",
			descriptors: [
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
						codec: strictCodec("dsh-sidechat#SidechatContextArgs", contextArgsSchema)
					}],
					result: strictCodec("dsh-sidechat#SidechatProjectContext", projectContextSchema)
				},
				{
					id: "dsh-sidechat#sidechat/models",
					service: "sidechat",
					namespace: "sidechat",
					method: "models",
					invocation: { kind: "direct" },
					parameters: [],
					result: strictCodec("dsh-sidechat#SidechatModelsResult", modelsResultSchema)
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
						codec: strictCodec("dsh-sidechat#SidechatStartArgs", startArgsSchema)
					}],
					result: strictCodec("dsh-sidechat#SidechatJobIdResult", jobIdResultSchema)
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
						codec: strictCodec("dsh-sidechat#SidechatPollArgs", pollArgsSchema)
					}],
					result: strictCodec("dsh-sidechat#SidechatPollResult", pollResultSchema)
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
						codec: strictCodec("dsh-sidechat#SidechatStopArgs", stopArgsSchema)
					}],
					result: strictCodec("dsh-sidechat#SidechatStopResult", stopResultSchema)
				}
			]
		};
		//#endregion
		//#region src/client/settings.ts
		/**
		* Browser-half preferences for the side-chat plugin.
		*
		* The 0.1 plugin persisted its master switch through the Host settings
		* document (`ctx.settingsScope` + a `settings.section` registration). DSH 0.2.1
		* changed that whole surface (`ctx.settingsScope` no longer exists and the
		* Settings UI is form-driven), so this port keeps the switch local to the
		* browser half in `localStorage` — no Host settings dependency, no service
		* injection, just a durable value that survives reloads.
		* @module dsh-sidechat/client/settings
		*/
		/** localStorage key owning the browser-side side-chat preferences. */
		const SIDECHAT_SETTINGS_STORAGE_KEY = "dsh-sidechat.settings.v1";
		/** Value applied before the user has ever toggled the switch. */
		const SIDECHAT_SETTINGS_DEFAULT = { enabled: true };
		/** Normalize one untrusted parsed value into complete settings. */
		function normalize(raw) {
			if (raw === null || typeof raw !== "object") return { ...SIDECHAT_SETTINGS_DEFAULT };
			const enabled = raw.enabled;
			return { enabled: typeof enabled === "boolean" ? enabled : SIDECHAT_SETTINGS_DEFAULT.enabled };
		}
		/**
		* Read the persisted preferences.
		* @returns complete settings, falling back to defaults when storage is absent,
		* unreadable, or holds a malformed document.
		*/
		function loadSettings() {
			try {
				const stored = globalThis.localStorage?.getItem(SIDECHAT_SETTINGS_STORAGE_KEY);
				if (stored === null || stored === void 0 || stored === "") return { ...SIDECHAT_SETTINGS_DEFAULT };
				return normalize(JSON.parse(stored));
			} catch {
				return { ...SIDECHAT_SETTINGS_DEFAULT };
			}
		}
		/**
		* Persist one patch of the preferences and return the merged result.
		* @param patch - fields to change.
		* @returns the complete settings after the patch (even when persistence failed).
		*/
		function saveSettings(patch) {
			const next = {
				...loadSettings(),
				...patch
			};
			try {
				globalThis.localStorage?.setItem(SIDECHAT_SETTINGS_STORAGE_KEY, JSON.stringify(next));
			} catch {}
			return next;
		}
		//#endregion
		//#region \0dsh-css:D:\deepseek\dsh-sidechat\src\client\sidechat.module.css.mjs
		const css = ".WybYOq_tab{background:var(--dsw-alias-bg-base);height:100%;min-height:0;color:var(--dsw-alias-label-primary);flex-direction:column;font-size:13px;display:flex;overflow:hidden}.WybYOq_header{border-bottom:1px solid var(--dsw-alias-border-l1);flex-shrink:0;align-items:center;gap:6px;padding:8px 12px;display:flex}.WybYOq_headerTitle{margin-right:auto;font-size:14px;font-weight:600}.WybYOq_iconBtn{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;padding:4px 8px;font-size:12px}.WybYOq_iconBtn:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}.WybYOq_messages{flex-direction:column;flex:1;gap:10px;padding:12px 14px;display:flex;overflow-y:auto}.WybYOq_empty{text-align:center;color:var(--dsw-alias-label-secondary);margin:auto;padding:0 24px;font-size:12px;line-height:1.6}.WybYOq_msg{flex-direction:column;gap:3px;max-width:100%;display:flex}.WybYOq_msgUser{align-self:flex-end;align-items:flex-end;max-width:92%}.WybYOq_msgAssistant{align-self:flex-start;width:100%}.WybYOq_msgRole{color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.04em;font-size:10px}.WybYOq_msgBody{white-space:pre-wrap;word-break:break-word;border-radius:10px;padding:8px 10px;line-height:1.55}.WybYOq_msgAssistant .WybYOq_msgBody{white-space:normal;background:0 0;border:none;padding:2px}.WybYOq_msgUser .WybYOq_msgBody{background:var(--dsw-alias-brand-primary);color:#fff;border-bottom-right-radius:2px;max-width:100%}.WybYOq_msgError{color:var(--dsw-alias-state-error-primary);font-size:11px}.WybYOq_error{color:var(--dsw-alias-state-error-primary);border-bottom:1px solid var(--dsw-alias-border-l1);padding:8px 14px;font-size:12px}.WybYOq_mdP{margin:5px 0}.WybYOq_mdH{margin:10px 0 5px;font-weight:600;line-height:1.3}.WybYOq_mdH1{font-size:1.25em}.WybYOq_mdH2{font-size:1.15em}.WybYOq_mdH3{font-size:1.05em}.WybYOq_mdH4{font-size:1em}.WybYOq_mdH5{font-size:.95em}.WybYOq_mdH6{font-size:.9em}.WybYOq_mdCode{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:0 4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}.WybYOq_mdPre{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;margin:6px 0;padding:8px 10px;overflow-x:auto}.WybYOq_mdCodeblock{white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}.WybYOq_mdList{margin:5px 0;padding-left:20px}.WybYOq_mdQuote{border-left:3px solid var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-secondary);margin:5px 0;padding:2px 10px}.WybYOq_mdHr{border:none;border-top:1px solid var(--dsw-alias-border-l1);margin:8px 0}.WybYOq_mdLink{color:var(--dsw-alias-brand-primary);text-decoration:underline}.WybYOq_composer{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex-shrink:0;margin:10px 14px;overflow:hidden}.WybYOq_composer:focus-within{border-color:var(--dsw-alias-brand-primary)}.WybYOq_composerTools{border-top:1px solid var(--dsw-alias-border-l1);gap:6px;padding:6px 8px;display:flex}.WybYOq_select{min-width:0;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;flex:1;padding:3px 4px;font-size:11px}.WybYOq_select:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.WybYOq_select:focus{outline:none}.WybYOq_inputRow{align-items:flex-end;gap:8px;padding:8px;display:flex}.WybYOq_input{resize:none;color:var(--dsw-alias-label-primary);font:inherit;background:0 0;border:none;flex:1;padding:4px 6px}.WybYOq_input:focus{outline:none}.WybYOq_send{background:var(--dsw-alias-brand-primary);color:#fff;cursor:pointer;border:none;border-radius:8px;padding:8px 14px;font-weight:600}.WybYOq_send:disabled{opacity:.5;cursor:default}.WybYOq_confirm{border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);align-items:center;gap:8px;padding:8px 14px;font-size:12px;display:flex}.WybYOq_confirm span{margin-right:auto}.WybYOq_confirmBtn{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border-radius:6px;padding:3px 10px;font-size:12px}.WybYOq_confirmBtn:hover{background:var(--dsw-alias-bg-layer-1)}.WybYOq_confirmBtnDanger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}.WybYOq_sendsel{z-index:1100;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;border-radius:6px;margin-top:-6px;padding:4px 10px;font-size:12px;position:fixed;transform:translateY(-100%);box-shadow:0 2px 8px #00000026}.WybYOq_sendsel:hover{background:var(--dsw-alias-bg-layer-1)}.WybYOq_reasoning{color:var(--dsw-alias-label-secondary);flex-direction:column;margin:2px 0 6px;font-size:12px;display:flex}.WybYOq_reasoningHeader{width:100%;min-width:0;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;align-items:center;gap:6px;padding:2px 0;display:flex}.WybYOq_reasoningHeader:hover .WybYOq_reasoningTitle{color:var(--dsw-alias-label-primary)}.WybYOq_reasoningIcon{opacity:.75;flex-shrink:0;font-size:12px}.WybYOq_reasoningTitle{flex-shrink:0;font-weight:500}.WybYOq_reasoningPreview{text-overflow:ellipsis;white-space:nowrap;opacity:.85;flex:1;min-width:0;overflow:hidden}.WybYOq_reasoningChevron{opacity:.6;flex-shrink:0;font-size:10px}.WybYOq_reasoningBody{white-space:pre-wrap;opacity:.9;padding:4px 0 6px 18px;line-height:1.55}.WybYOq_mdTable{border-collapse:collapse;width:100%;margin:6px 0;font-size:12px}.WybYOq_mdTable th,.WybYOq_mdTable td{border:1px solid var(--dsw-alias-border-l1);text-align:left;vertical-align:top;padding:4px 8px}.WybYOq_mdTable th{background:var(--dsw-alias-bg-layer-1);font-weight:600}.WybYOq_tip{color:var(--dsw-alias-label-secondary);text-align:center;opacity:.75;flex-shrink:0;padding:4px 14px 10px;font-size:11px}.WybYOq_switch{cursor:pointer;flex-shrink:0;display:inline-flex;position:relative}.WybYOq_switch input{opacity:0;cursor:pointer;width:100%;height:100%;margin:0;position:absolute}.WybYOq_switchTrack{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:11px;width:40px;height:22px;transition:background .15s,border-color .15s;display:block}.WybYOq_switchTrack:after{content:\"\";background:var(--dsw-alias-label-secondary);border-radius:50%;width:16px;height:16px;transition:transform .15s,background .15s;position:absolute;top:3px;left:3px}.WybYOq_switch input:checked+.WybYOq_switchTrack{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.WybYOq_switch input:checked+.WybYOq_switchTrack:after{background:#fff;transform:translate(18px)}.WybYOq_emptyBodyNotice{color:var(--dsw-alias-label-secondary);padding:2px 0;font-size:12px;font-style:italic;display:block}.WybYOq_headerVersion{color:var(--dsw-alias-label-caption);opacity:.8;flex-shrink:0;font-size:10px}";
		const tagId = "dsh-sidechat/sidechat.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-sidechat";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var sidechat_module_css_default = {
			"switchTrack": "WybYOq_switchTrack",
			"mdH6": "WybYOq_mdH6",
			"mdHr": "WybYOq_mdHr",
			"composerTools": "WybYOq_composerTools",
			"mdLink": "WybYOq_mdLink",
			"reasoningHeader": "WybYOq_reasoningHeader",
			"emptyBodyNotice": "WybYOq_emptyBodyNotice",
			"mdH5": "WybYOq_mdH5",
			"header": "WybYOq_header",
			"mdH2": "WybYOq_mdH2",
			"mdH1": "WybYOq_mdH1",
			"msg": "WybYOq_msg",
			"mdH3": "WybYOq_mdH3",
			"reasoningTitle": "WybYOq_reasoningTitle",
			"reasoningPreview": "WybYOq_reasoningPreview",
			"msgBody": "WybYOq_msgBody",
			"msgError": "WybYOq_msgError",
			"reasoningBody": "WybYOq_reasoningBody",
			"mdTable": "WybYOq_mdTable",
			"headerTitle": "WybYOq_headerTitle",
			"composer": "WybYOq_composer",
			"messages": "WybYOq_messages",
			"error": "WybYOq_error",
			"iconBtn": "WybYOq_iconBtn",
			"mdH": "WybYOq_mdH",
			"mdCode": "WybYOq_mdCode",
			"select": "WybYOq_select",
			"msgAssistant": "WybYOq_msgAssistant",
			"msgUser": "WybYOq_msgUser",
			"sendsel": "WybYOq_sendsel",
			"reasoningChevron": "WybYOq_reasoningChevron",
			"headerVersion": "WybYOq_headerVersion",
			"mdList": "WybYOq_mdList",
			"input": "WybYOq_input",
			"mdH4": "WybYOq_mdH4",
			"mdCodeblock": "WybYOq_mdCodeblock",
			"mdQuote": "WybYOq_mdQuote",
			"confirm": "WybYOq_confirm",
			"reasoningIcon": "WybYOq_reasoningIcon",
			"confirmBtnDanger": "WybYOq_confirmBtnDanger",
			"tip": "WybYOq_tip",
			"switch": "WybYOq_switch",
			"confirmBtn": "WybYOq_confirmBtn",
			"mdPre": "WybYOq_mdPre",
			"reasoning": "WybYOq_reasoning",
			"mdP": "WybYOq_mdP",
			"tab": "WybYOq_tab",
			"send": "WybYOq_send",
			"empty": "WybYOq_empty",
			"inputRow": "WybYOq_inputRow",
			"msgRole": "WybYOq_msgRole"
		};
		//#endregion
		//#region src/client/apply.tsx
		/**
		* Side chat plugin, browser half (DSH 0.2.1 port).
		*
		* The chat lives in the product's **right Sidebar** as a docking tab, next to the
		* shipped website / files / CLI tabs:
		*
		* 1. a tab type (`kind: 'sidechat'`) registered through
		*    `ctx.sidebarRightTabs.register`, with a guide entry so the column's add
		*    control and guide page can open it;
		* 2. its body registered into the keyed `sidebar.right.pane.tab` seat — a normal
		*    docked pane that only exists while the user opens the tab (no hover
		*    overlay, no floating panel covering other content);
		* 3. one small `shell.overlay` entry: the floating 「添加到侧边聊天」 button that
		*    appears next to a main-conversation selection. Clicking it opens the tab
		*    (via `ctx.sidebarRight.openTab`) and hands the marked excerpt to the body.
		*
		* The body is a focused project Q&A surface: model/effort selection, streaming
		* replies with collapsible reasoning, table markdown, a confirm-guarded clear,
		* and a marked-excerpt chip. Everything is driven through the Host `sidechat`
		* Remote mounted from `./remote.ts`.
		*
		* The tab body is session-scoped: the slot runtime supplies `sessionId` as a
		* framework standard prop, so every session keeps its own side-chat history.
		* @module dsh-sidechat/client
		*/
		/**
		* Required services: the slot registry, the typed Client Remote mount face, and
		* the right-Sidebar tab registry (the body seat is declared by that package).
		* `remote.sidechat` must NOT be listed: it only appears once this plugin's own
		* `apply` calls `$mount`, so waiting on it would deadlock the fiber.
		*/
		const inject = [
			"slots",
			"remote",
			"sidebarRightTabs"
		];
		/** Tab type discriminator: what `ctx.sidebarRight.openTab` names. */
		const SIDECHAT_CLIENT_VERSION = "0.3.4";
		const SIDECHAT_KIND = "sidechat";
		/** This implementation's identity in the tab system; the body registers under it. */
		const SIDECHAT_TAB_ID = "dsh-sidechat";
		/**
		* Product command that opens the tab. Registered with `ctx.shortcuts`, so the
		* right Sidebar's guide card and the shortcut reference show it exactly like
		* the shipped workspace-files / terminal / browser commands.
		*/
		const SIDECHAT_OPEN_COMMAND = "sidechat.open";
		/** Unwrap one remote result into its value, throwing the wire error. */
		async function callRemote(call) {
			const result = await call();
			if (!result.ok) throw new Error(`${result.error.message} (${result.error.code})`);
			return result.value;
		}
		let sharedState = {
			enabled: loadSettings().enabled,
			pendingExcerpt: null
		};
		const sharedListeners = /* @__PURE__ */ new Set();
		function subscribeShared(listener) {
			sharedListeners.add(listener);
			return () => {
				sharedListeners.delete(listener);
			};
		}
		function getSharedSnapshot() {
			return sharedState;
		}
		function patchShared(patch) {
			let changed = false;
			for (const key of Object.keys(patch)) if (sharedState[key] !== patch[key]) changed = true;
			if (!changed) return;
			sharedState = {
				...sharedState,
				...patch
			};
			for (const listener of [...sharedListeners]) listener();
		}
		/** Subscribe a component to the shared panel state. */
		function useShared() {
			return (0, react.useSyncExternalStore)(subscribeShared, getSharedSnapshot, getSharedSnapshot);
		}
		/** Publish the floating-button switch to the durable browser preference. */
		function setEnabledShared(value) {
			patchShared({ enabled: value });
			saveSettings({ enabled: value });
		}
		function emptySessionChatState() {
			return {
				modelKey: "",
				effort: "",
				messages: [],
				input: "",
				busy: false,
				jobId: null,
				error: null
			};
		}
		/**
		* Per-session chat state, keyed by session id and kept OUTSIDE the panel
		* component. `shell.overlay` is root-scoped, so it no longer remounts on a
		* session switch (the 0.1 `details` slot did); the panel body is instead keyed
		* by the current session id and seeds itself from this map, giving every
		* conversation its own side chat.
		*/
		const sessionStores = /* @__PURE__ */ new Map();
		function getSessionStore(sessionKey) {
			let entry = sessionStores.get(sessionKey);
			if (entry === void 0) {
				entry = emptySessionChatState();
				sessionStores.set(sessionKey, entry);
			}
			return entry;
		}
		/**
		* Turn a marked excerpt into a Markdown quote draft for the composer. The
		* excerpt is only *staged* here: the user can add their own question and presses
		* send when they want the answer — nothing is sent automatically.
		*/
		function buildQuoteDraft(excerpt) {
			return `${excerpt.replace(/\r\n/g, "\n").split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
		}
		const isHr = (line) => /^-{3,}$/.test(line) || /^\*{3,}$/.test(line) || /^_{3,}$/.test(line);
		/** Split one markdown table row into cells, or null when the line is not a row. */
		function splitTableRow(line) {
			const trimmed = line.trim();
			if (!trimmed.includes("|")) return null;
			return trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
		}
		/** Inline markdown spans: code, bold, italic, links. */
		function renderInline(text) {
			const nodes = [];
			const tokenRe = /(`+)([\s\S]*?)\1|(\*\*|__)([\s\S]*?)\3|(\*|_)([\s\S]*?)\5|\[([^\]]+)\]\(([^)\s]+)\)/g;
			let last = 0;
			let key = 0;
			let match;
			while ((match = tokenRe.exec(text)) !== null) {
				if (match.index > last) nodes.push(text.slice(last, match.index));
				if (match[1] !== void 0) nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: match[2] ?? "" }, `md-c-${key++}`));
				else if (match[3] !== void 0) nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: [...renderInline(match[4] ?? "")] }, `md-s-${key++}`));
				else if (match[5] !== void 0) nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: [...renderInline(match[6] ?? "")] }, `md-e-${key++}`));
				else if (match[7] !== void 0 && match[8] !== void 0) nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
					className: sidechat_module_css_default.mdLink,
					href: match[8],
					target: "_blank",
					rel: "noreferrer",
					children: match[7]
				}, `md-a-${key++}`));
				last = tokenRe.lastIndex;
			}
			if (last < text.length) nodes.push(text.slice(last));
			return nodes;
		}
		/** Lightweight markdown → React renderer (text-only output; never raw HTML). */
		function renderMarkdown(text) {
			const lines = String(text).replace(/\r\n/g, "\n").split("\n");
			const nodes = [];
			let i = 0;
			while (i < lines.length) {
				const line = lines[i] ?? "";
				const trimmed = line.trim();
				if (/^```(\w*)\s*$/.exec(trimmed) !== null) {
					const body = [];
					i += 1;
					while (i < lines.length && !/^```\s*$/.test((lines[i] ?? "").trim())) {
						body.push(lines[i] ?? "");
						i += 1;
					}
					i += 1;
					nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: sidechat_module_css_default.mdPre,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: sidechat_module_css_default.mdCodeblock,
							children: body.join("\n")
						})
					}, `md-pre-${nodes.length}`));
					continue;
				}
				const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
				if (heading !== null) {
					const level = heading[1]?.length ?? 1;
					nodes.push(react.createElement(`h${level}`, {
						key: `md-h-${nodes.length}`,
						className: `${sidechat_module_css_default.mdH} ${sidechat_module_css_default[`mdH${level}`]}`
					}, ...renderInline(heading[2] ?? "")));
					i += 1;
					continue;
				}
				const headerCells = splitTableRow(line);
				const nextCells = i + 1 < lines.length ? splitTableRow(lines[i + 1] ?? "") : null;
				if (headerCells !== null && nextCells !== null && nextCells.length >= 2 && nextCells.every((cell) => /^:?-+:?$/.test(cell))) {
					const bodyRows = [];
					i += 2;
					while (i < lines.length) {
						const cells = splitTableRow(lines[i] ?? "");
						if (cells === null || (lines[i] ?? "").trim() === "") break;
						bodyRows.push(cells);
						i += 1;
					}
					nodes.push(react.createElement("table", {
						key: `md-table-${nodes.length}`,
						className: sidechat_module_css_default.mdTable
					}, react.createElement("thead", null, react.createElement("tr", null, headerCells.map((cell, idx) => react.createElement("th", { key: idx }, ...renderInline(cell))))), react.createElement("tbody", null, bodyRows.map((row, ri) => react.createElement("tr", { key: ri }, row.map((cell, ci) => react.createElement("td", { key: ci }, ...renderInline(cell))))))));
					continue;
				}
				if (isHr(trimmed)) {
					nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("hr", { className: sidechat_module_css_default.mdHr }, `md-hr-${nodes.length}`));
					i += 1;
					continue;
				}
				if (/^>\s?/.test(trimmed)) {
					const quote = [];
					while (i < lines.length && /^>\s?/.test((lines[i] ?? "").trim())) {
						quote.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
						i += 1;
					}
					nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("blockquote", {
						className: sidechat_module_css_default.mdQuote,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: [...renderInline(quote.join(" "))] })
					}, `md-q-${nodes.length}`));
					continue;
				}
				const ulMatch = /^(\s*)[-*+]\s+(.*)$/.exec(line);
				const olMatch = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
				if (ulMatch !== null || olMatch !== null) {
					const ordered = olMatch !== null;
					const items = [];
					while (i < lines.length) {
						const m2 = /^(\s*)[-*+]\s+(.*)$/.exec(lines[i] ?? "");
						const m3 = /^(\s*)\d+[.)]\s+(.*)$/.exec(lines[i] ?? "");
						if (ordered ? m3 !== null : m2 !== null) {
							items.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: [...renderInline((ordered ? m3[2] : m2[2]) ?? "")] }, `md-li-${items.length}`));
							i += 1;
						} else if (/^\s+/.test(lines[i] ?? "") && (lines[i] ?? "").trim() !== "") i += 1;
						else break;
					}
					nodes.push(react.createElement(ordered ? "ol" : "ul", {
						key: `md-ul-${nodes.length}`,
						className: sidechat_module_css_default.mdList
					}, items));
					continue;
				}
				if (trimmed === "") {
					i += 1;
					continue;
				}
				const paragraph = [line];
				i += 1;
				while (i < lines.length) {
					const t = (lines[i] ?? "").trim();
					if (t === "") break;
					if (/^```/.test(t) || /^#{1,6}\s/.test(t) || /^>\s?/.test(t) || isHr(t) || /^[-*+]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) break;
					paragraph.push(lines[i] ?? "");
					i += 1;
				}
				nodes.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: sidechat_module_css_default.mdP,
					children: [...renderInline(paragraph.join(" "))]
				}, `md-p-${nodes.length}`));
			}
			return nodes;
		}
		/**
		* Selection-triggered button: hands the main-chat selection to the side-chat
		* tab. The button itself is a small overlay entry; clicking it opens the
		* right-Sidebar tab through `ctx.sidebarRight.openTab`, which expands the
		* column, and publishes the excerpt for the tab body to consume.
		*/
		function SelectionSendButton(props) {
			const { ctx } = props;
			const shared = useShared();
			const [position, setPosition] = (0, react.useState)(null);
			const [selectedText, setSelectedText] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				const onSelectionChange = () => {
					try {
						const selection = window.getSelection();
						const value = selection?.toString().trim() ?? "";
						if (value === "") {
							setPosition(null);
							setSelectedText("");
							return;
						}
						const node = selection?.anchorNode;
						const el = node !== null && node !== void 0 && node.nodeType === 1 ? node : node !== null && node !== void 0 ? node.parentElement : null;
						if (el instanceof Element && el.closest(".sidechatPanel") !== null) {
							setPosition(null);
							setSelectedText("");
							return;
						}
						const range = selection?.getRangeAt(0);
						if (range === void 0) {
							setPosition(null);
							return;
						}
						const rect = range.getBoundingClientRect();
						if (rect.width === 0 && rect.height === 0) {
							setPosition(null);
							return;
						}
						setSelectedText(value.slice(0, 2e3));
						setPosition({
							x: Math.max(0, rect.left),
							y: Math.max(0, rect.top)
						});
					} catch {
						setPosition(null);
					}
				};
				window.document.addEventListener("selectionchange", onSelectionChange);
				window.document.addEventListener("mouseup", onSelectionChange);
				return () => {
					window.document.removeEventListener("selectionchange", onSelectionChange);
					window.document.removeEventListener("mouseup", onSelectionChange);
				};
			}, []);
			if (position === null || selectedText === "" || !shared.enabled) return null;
			return react.createElement("button", {
				className: sidechat_module_css_default.sendsel,
				type: "button",
				"data-sidechat-send": "true",
				title: "添加到侧边聊天",
				style: {
					left: `${position.x}px`,
					top: `${position.y}px`
				},
				onMouseDown: (event) => event.preventDefault(),
				onClick: () => {
					patchShared({ pendingExcerpt: selectedText });
					setPosition(null);
					setSelectedText("");
					const nav = ctx.get("sidebarRight");
					try {
						nav?.openTab(SIDECHAT_KIND);
					} catch {}
				}
			}, "添加到侧边聊天");
		}
		/**
		* The side-chat tab body. The right Sidebar renders one body per session and
		* passes the Session identity as a framework standard prop; the per-session
		* map above keeps each conversation's chat alive across tab switches.
		*/
		function SidechatTabBody(props) {
			const { sidechat, sessionId } = props;
			const sessionKey = typeof sessionId === "string" ? sessionId : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: `${sidechat_module_css_default.tab} sidechatPanel`,
				"data-sidechat-tab": "true",
				"aria-label": "侧边聊天",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PanelBody, {
					sidechat,
					sessionKey
				}, sessionKey)
			});
		}
		/** Strip tool-call markup if an older host or a provider leak ever delivers it. */
		function stripToolMarkup(text) {
			return text.replace(/<\s*\/?\s*(?:\|\s*)*DSML\s*(?:\|\s*)*[^>]*calls[^>]*>[\s\S]*?<\s*\/\s*(?:\|\s*)*DSML\s*(?:\|\s*)*[^>]*calls[^>]*>/gi, "").replace(/<\s*\/?\s*(?:\|\s*)*DSML\s*(?:\|\s*)*[^>]*>/gi, "").replace(/<\|[^>]*\|>/g, "").trim();
		}
		/**
		* Collapsible reasoning row, presented like the main conversation's disclosure:
		* one quiet line showing "思考" while streaming / "已思考" when settled, with the
		* first completed paragraph as the collapsed preview. Expanding shows the full
		* reasoning in secondary typography. Nothing auto-expands.
		*/
		function ReasoningRow(props) {
			const { text, running } = props;
			const [expanded, setExpanded] = (0, react.useState)(false);
			const firstLine = (() => {
				for (const line of text.split("\n")) {
					const trimmed = line.trim();
					if (trimmed !== "") return trimmed.replaceAll("**", "");
				}
				return "";
			})();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidechat_module_css_default.reasoning,
				"data-expanded": expanded ? "true" : void 0,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: sidechat_module_css_default.reasoningHeader,
					"aria-expanded": expanded,
					onClick: () => setExpanded((value) => !value),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidechat_module_css_default.reasoningIcon,
							"aria-hidden": "true",
							children: "✳"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidechat_module_css_default.reasoningTitle,
							children: running ? "思考" : "已思考"
						}),
						!expanded && firstLine !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidechat_module_css_default.reasoningPreview,
							children: firstLine
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidechat_module_css_default.reasoningChevron,
							"aria-hidden": "true",
							children: expanded ? "▾" : "▸"
						})
					]
				}), expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidechat_module_css_default.reasoningBody,
					children: text
				}) : null]
			});
		}
		/** One session's chat surface: header, messages, streaming, model selectors, composer. */
		function PanelBody(props) {
			const { sidechat, sessionKey } = props;
			const shared = useShared();
			const chat = getSessionStore(sessionKey);
			const [modelCatalog, setModelCatalog] = (0, react.useState)(null);
			const [modelKey, setModelKey] = (0, react.useState)(chat.modelKey);
			const [effort, setEffort] = (0, react.useState)(chat.effort);
			const [messages, setMessages] = (0, react.useState)(chat.messages);
			const [input, setInput] = (0, react.useState)(chat.input);
			const [busy, setBusy] = (0, react.useState)(chat.busy);
			const [jobId, setJobId] = (0, react.useState)(chat.jobId);
			const [error, setError] = (0, react.useState)(chat.error);
			const [confirmClear, setConfirmClear] = (0, react.useState)(false);
			const inputRef = (0, react.useRef)(null);
			chat.modelKey = modelKey;
			chat.effort = effort;
			chat.messages = messages;
			chat.input = input;
			chat.busy = busy;
			chat.jobId = jobId;
			chat.error = error;
			const findModel = (key) => {
				if (key === "") return null;
				const parts = key.split("/");
				if (parts.length !== 2) return null;
				for (const group of modelCatalog?.groups ?? []) {
					if (group.id !== parts[0]) continue;
					for (const model of group.models) if (model.id === parts[1]) return model;
				}
				return null;
			};
			(0, react.useEffect)(() => {
				let cancelled = false;
				callRemote(() => sidechat.models()).then((value) => {
					if (!cancelled) setModelCatalog(value);
				}, () => {});
				return () => {
					cancelled = true;
				};
			}, [sidechat]);
			(0, react.useEffect)(() => {
				if (modelKey !== "" || modelCatalog?.current == null) return;
				const { provider, model } = modelCatalog.current;
				if (provider === "" || model === "") return;
				if (findModel(`${provider}/${model}`) !== null) setModelKey(`${provider}/${model}`);
			}, [modelCatalog]);
			(0, react.useEffect)(() => {
				if (modelKey === "") {
					setEffort("");
					return;
				}
				const def = findModel(modelKey)?.reasoning?.defaultEffort;
				setEffort(typeof def === "string" && def.length > 0 ? def : "");
			}, [modelKey]);
			(0, react.useEffect)(() => {
				if (jobId === null) return;
				const timer = window.setInterval(() => {
					callRemote(() => sidechat.poll({ jobId })).then((value) => {
						setMessages((prev) => prev.map((message) => message.id === jobId ? {
							...message,
							content: value.text,
							reasoning: value.reasoning,
							error: value.error
						} : message));
						if (value.done) {
							setJobId(null);
							setBusy(false);
							if (value.error !== null) setError(value.error);
						}
					}, (reason) => {
						setError(reason instanceof Error ? reason.message : String(reason));
						setJobId(null);
						setBusy(false);
					});
				}, 200);
				return () => {
					window.clearInterval(timer);
				};
			}, [sidechat, jobId]);
			const send = (externalText) => {
				const text = (externalText !== void 0 && externalText !== null ? externalText : input).trim();
				if (text === "" || busy) return;
				const userMessage = {
					id: `user-${Date.now()}`,
					role: "user",
					content: text,
					reasoning: "",
					error: null
				};
				const history = messages.concat([userMessage]).filter((message) => message.content !== "").map((message) => ({
					role: message.role,
					content: message.content
				}));
				setMessages((prev) => prev.concat([userMessage]));
				setInput("");
				setBusy(true);
				setError(null);
				const args = {
					sessionId: sessionKey,
					messages: history
				};
				if (modelKey !== "") {
					const parts = modelKey.split("/");
					const provider = parts[0];
					const model = parts[1];
					if (provider !== void 0 && model !== void 0) {
						args.provider = provider;
						args.model = model;
						if (effort !== "") args.reasoningEffort = effort;
					}
				}
				callRemote(() => sidechat.start(args)).then((value) => {
					setJobId(value.jobId);
					setMessages((prev) => prev.concat([{
						id: value.jobId,
						role: "assistant",
						content: "",
						reasoning: "",
						error: null
					}]));
				}, (reason) => {
					setError(reason instanceof Error ? reason.message : String(reason));
					setBusy(false);
				});
			};
			(0, react.useEffect)(() => {
				const pending = shared.pendingExcerpt;
				if (pending === null || pending === "") return;
				patchShared({ pendingExcerpt: null });
				setInput((prev) => prev.trim() === "" ? buildQuoteDraft(pending) : `${buildQuoteDraft(pending)}${prev}`);
				window.setTimeout(() => {
					const element = inputRef.current;
					if (element !== null) {
						element.focus();
						element.setSelectionRange(element.value.length, element.value.length);
					}
				}, 0);
			}, [shared.pendingExcerpt]);
			const stop = () => {
				if (jobId !== null) {
					sidechat.stop({ jobId }).then(() => {}, () => {});
					setJobId(null);
					setBusy(false);
				}
			};
			const clear = () => {
				stop();
				setMessages([]);
				setError(null);
				setConfirmClear(false);
			};
			const modelOptions = [];
			for (const group of modelCatalog?.groups ?? []) {
				const options = group.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: `${group.id}/${model.id}`,
					children: model.name
				}, `${group.id}/${model.id}`));
				modelOptions.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
					label: group.name,
					children: options
				}, `g-${group.id}`));
			}
			const efforts = findModel(modelKey)?.reasoning?.efforts ?? [];
			const effortSelect = efforts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
				className: sidechat_module_css_default.select,
				value: effort,
				title: "推理等级",
				onChange: (event) => setEffort(event.target.value),
				children: efforts.map((effortOption) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: effortOption.id,
					children: effortOption.name
				}, effortOption.id))
			}) : null;
			const messageNodes = messages.map((message) => {
				const isUser = message.role === "user";
				const cleanContent = stripToolMarkup(message.content);
				const cleanReasoning = stripToolMarkup(message.reasoning);
				const body = isUser ? cleanContent : cleanContent === "" && busy ? "…" : !isUser && !busy && cleanContent === "" && cleanReasoning !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: sidechat_module_css_default.emptyBodyNotice,
					children: "（这条回答没有正文：原输出可能是已被过滤的工具调用。请重新提问，或到主对话中继续。）"
				}) : renderMarkdown(cleanContent);
				const reasoningBlock = !isUser && cleanReasoning !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReasoningRow, {
					text: cleanReasoning,
					running: busy && message.id === jobId
				}) : null;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: isUser ? `${sidechat_module_css_default.msg} ${sidechat_module_css_default.msgUser}` : `${sidechat_module_css_default.msg} ${sidechat_module_css_default.msgAssistant}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidechat_module_css_default.msgRole,
							children: isUser ? "你" : "助手"
						}),
						reasoningBlock,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidechat_module_css_default.msgBody,
							children: body
						}),
						message.error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidechat_module_css_default.msgError,
							children: message.error
						}) : null
					]
				}, message.id);
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidechat_module_css_default.header,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidechat_module_css_default.headerTitle,
							children: "侧边聊天"
						}),
						"`n        ",
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: sidechat_module_css_default.headerVersion,
							title: "侧边聊天插件版本",
							children: ["v", SIDECHAT_CLIENT_VERSION]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: sidechat_module_css_default.switch,
							title: "划选文字时显示「添加到侧边聊天」按钮",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: shared.enabled,
								"aria-label": "划选时提示",
								onChange: (event) => setEnabledShared(event.target.checked)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidechat_module_css_default.switchTrack,
								"aria-hidden": "true"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: sidechat_module_css_default.iconBtn,
							type: "button",
							title: "清空对话，开始新的侧边聊天",
							onClick: () => setConfirmClear(true),
							children: "清空"
						})
					]
				}),
				confirmClear ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidechat_module_css_default.confirm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "清空后内容不可恢复，确认清空？" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: `${sidechat_module_css_default.confirmBtn} ${sidechat_module_css_default.confirmBtnDanger}`,
							type: "button",
							onClick: clear,
							children: "确认清空"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: sidechat_module_css_default.confirmBtn,
							type: "button",
							onClick: () => setConfirmClear(false),
							children: "取消"
						})
					]
				}) : null,
				error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidechat_module_css_default.error,
					children: error
				}) : null,
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidechat_module_css_default.messages,
					children: messageNodes.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidechat_module_css_default.empty,
						children: "可以问项目或旁边对话相关的问题。"
					}) : messageNodes
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidechat_module_css_default.composer,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidechat_module_css_default.inputRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							ref: inputRef,
							className: sidechat_module_css_default.input,
							value: input,
							placeholder: "输入问题…（划选主对话文字可插入引用，Enter 发送，Shift+Enter 换行）",
							rows: 2,
							disabled: busy,
							onChange: (event) => setInput(event.target.value),
							onKeyDown: (event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									send();
								}
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: sidechat_module_css_default.send,
							type: "button",
							disabled: !busy && input.trim() === "",
							onClick: busy ? stop : () => send(),
							children: busy ? "停止" : "发送"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidechat_module_css_default.composerTools,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: sidechat_module_css_default.select,
							value: modelKey,
							title: "侧边聊天的回复模型",
							onChange: (event) => setModelKey(event.target.value),
							children: modelOptions
						}), effortSelect]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidechat_module_css_default.tip,
					children: "侧边聊天只是临时聊天"
				})
			] });
		}
		/**
		* Browser plugin body: mount the Host Remote contribution, register the
		* side-chat tab type in the right Sidebar, and contribute the one floating
		* selection button.
		* @param ctx - client root context.
		* @returns async disposer that unmounts the Remote and every registration.
		*/
		async function apply(ctx) {
			const remote = ctx.get("remote");
			if (remote === void 0) throw new Error("side chat: remote service is unavailable");
			const disposeMount = await remote.$mount(TYPERT_REMOTE);
			const sidechat = ctx.get("remote.sidechat");
			if (sidechat === void 0) throw new Error("side chat: remote.sidechat not mounted");
			const definition = {
				id: SIDECHAT_TAB_ID,
				kind: SIDECHAT_KIND,
				title: () => "侧边聊天",
				priority: "extension",
				keepMounted: true,
				guide: [{
					id: "sidechat",
					order: 40,
					commandId: SIDECHAT_OPEN_COMMAND,
					title: () => "侧边聊天",
					description: () => "与主对话并行的临时问答；划选主对话文字可一键带入"
				}]
			};
			const disposeType = ctx.sidebarRightTabs.register(definition);
			ctx.inject(["shortcuts"], (shortcutCtx) => {
				shortcutCtx.effect(() => shortcutCtx.shortcuts.register({
					id: SIDECHAT_OPEN_COMMAND,
					label: () => "打开侧边聊天",
					aliases: [
						"side chat",
						"sidechat",
						"侧边聊天"
					],
					defaults: {
						"desktop:macos": {
							code: "KeyJ",
							modifiers: ["primary"]
						},
						"desktop:windows": {
							code: "KeyJ",
							modifiers: ["primary"]
						},
						"desktop:linux": {
							code: "KeyJ",
							modifiers: ["primary"]
						},
						"web:macos": {
							code: "KeyJ",
							modifiers: ["primary", "alt"]
						},
						"web:windows": {
							code: "KeyJ",
							modifiers: ["primary", "alt"]
						}
					},
					regions: [
						"page",
						"editable",
						"terminal"
					],
					modals: [],
					resolve: () => ({
						status: "handled",
						run: () => {
							const nav = ctx.get("sidebarRight");
							try {
								nav?.openTab(SIDECHAT_KIND);
							} catch {}
						}
					})
				}), "sidechat: open shortcut");
			});
			const disposers = [disposeType];
			disposers.push(ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: SIDECHAT_TAB_ID
			}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SidechatTabBody, {
				...props,
				sidechat
			}))));
			disposers.push(ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "sidechat-sendsel",
				order: 6
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectionSendButton, { ctx }))));
			return async () => {
				for (const dispose of disposers.reverse()) dispose();
				await disposeMount();
			};
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map