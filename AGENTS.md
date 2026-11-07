# AGENTS.md

## 1. Interaction & Workflow Invariants

1. **Clarify First — Never Jump to Unsolicited Implementation**:
   - When the user asks a question, provides feedback, or discusses architecture/rules, **EXPLAIN AND STOP**.
   - Do NOT edit files or run modifying commands unless the user explicitly commands you to implement or gives explicit approval.
   - Clarify trade-offs and confirm the exact requirements first.

2. **Long Responses & Documentation**:
   - Write extensive architectural guides, migration steps, or long documentation directly to a `.md` file in `docs/` instead of massive text blocks in chat. Provide a concise summary and link in chat.

---

## 2. Non-Negotiable Engineering Integrity Rules (Global Scope)

1. **Global Deployment-Level Production Readiness (No Fake/Superficial Logic)**:
   - **Applies to ALL features** (3D WebGL scenes, backend endpoints, i18n, themes, forms, assets).
   - `console.log` or `console.info` is NEVER a complete backend. Never claim any feature is "working" if data is only logged to terminal stdout or discarded.
   - Every feature must be built for real production deployment: real persistence, real delivery, real asset loaders, and genuine error boundaries (500/502/422).
   - If external environment variables or credentials are required in production, declare them in `.env.example` and handle failure cases gracefully.

2. **Design System & Token Fidelity**:
   - Never generate generic, AI-looking UI components.
   - Inspect sibling components (`NavModelSwitcher.vue`, `TechCard.vue`) and match exact height (`28px`), border radii, typography (`font-tech`, `font-sans`), and color tokens (`var(--color-primary-700)`).

3. **Holistic Implementation Over Shallow Diffs**:
   - When implementing features (i18n, themes, modes), wire all sections and data sources end-to-end. Never patch one file superficially while leaving the rest hardcoded or broken.

4. **No Unsolicited Build or Typecheck Commands**:
   - Do NOT run `npx nuxi typecheck`, `npm run build`, or repetitive compiler commands in the background unless the user explicitly commands you to run them.
   - Rely on clean code, proper typing, and direct file edits.

## 3 Strict Execution & Anti-Drift Rules

- **Read-Only Until Approved**: Never edit a file or run terminal commands automatically. First show the user a bullet list of the exact files and lines intended to change, and wait for confirmation before calling any write or bash tools.
- **Zero Speculative Discovery**: If a prompt or task is ambiguous, underspecified, or brief (e.g. "continue", "fix some things"), DO NOT attempt to "figure it out" by running search loops, grep, find, or reading chat transcripts. Stop and ask for clarification immediately.
- **Forbidden Directories**: NEVER read, search, or inspect `vendor/`, `node_modules/`, or framework internal code unless explicitly asked by the user to debug a vendor package.
- **Forbidden Discovery Commands**: DO NOT use `run_command` to inspect or find files (`find`, `grep`, `tail transcript`, etc.). Only use `view_file` on paths explicitly provided by the user.
- **Single-Turn Bias**: Never chain autonomous investigative tool calls without either executing the required code change or stopping to report back.
- **Strict Scope Boundaries**: Touch only the exact files requested by the user. Do not explore, refactor, or edit untouched files.
- **Implementation Plan Artifacts**: Whenever proposing an implementation plan, design, or multi-step changes, always write an Antigravity implementation plan artifact (`write_to_file` in the artifact directory with `RequestFeedback: true`) instead of writing out plans or proposals in conversational response text.
- **User Frustration Halt Protocol**: If the user expresses anger, frustration, or reprimands the AI, it means the AI is in the wrong. The AI is strictly forbidden from running tools or making changes. It must acknowledge the error without making excuses, confirm understanding, and ask an open question to let the user direct the next step.
- **Agent Driven Development is Mandatory**: If you're Gemini Argon, Claude Sonnet, Claude Opus, do not write code by yourself, but delegate your task to subagents which is cheaper model. Always pass Model: 'flash' when calling invoke_subagent (overriding the tool's 'inherit' default), and never kill a running subagent without explicit user instruction. Read `subagent-driven-development` skills for full detail.
- **Halted Process & Context Recovery**: Whenever the user says "continue" or "continue the halted process", immediately read the tail of `<appDataDir>/brain/<conversation-id>/.system_generated/logs/transcript.jsonl` (and the most recent halted subagent's `transcript.jsonl` if a subagent was interrupted) using `read_file` to recover the exact prior state and findings before resuming or delegating to a subagent.

## 4. MUST READ RULES DURING ANALYZING
- Read these rules before responding:
1. NO SYCOPHANCY: Do not apologize, do not praise me, do not say "Great catch" or "Certainly!". Start directly with the technical diagnosis.
2. SCOPE LOCK: You are ONLY allowed to modify `[INSERT EXACT FILE NAME & FUNCTION NAME]`. Do not touch any other functions, imports, or files.
3. NO PLACEHOLDERS: Never write `// ... existing code` or stub out logic. Show the exact before-and-after diff for the target function only.
4. NO OVERCLAIMING: Do not claim the bug is "completely solved across the system." State ONLY what lines changed and what edge case remains.
