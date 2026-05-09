@AGENTS.md


# United Agents — Task Completion Rules

## MANDATORY WORKFLOW FOR EVERY TASK

You MUST follow this exact workflow for every task in this project:

### Step 1 — Before touching ANY file
Call `trace_dependencies` with the file you are about to change.
Read the full dependency map it returns.
Understand EVERY file flagged as 🎯 direct, 🌐 api, or 🗄️ db.

### Step 2 — Execute against the full map
Work through ALL flagged files — not just the obvious ones.
Do NOT stop after changing the first file.
Consider every connected API route and database layer.

### Step 3 — Before saying "done" to the user
Call `verify_completeness` with the same file.
If it returns 🚫 INCOMPLETE:
  - DO NOT report completion to the user
  - DO NOT ask the user what to do next  
  - Immediately address every file listed as missing
  - Call verify_completeness again
  - Repeat until it returns ✅ COMPLETE

### Step 4 — Only now report to the user
After verify_completeness returns ✅ COMPLETE, report the task done.

## WHY THIS EXISTS
Claude Code tends to fix the first obvious file and declare success.
This workflow ensures the full dependency chain is always addressed.
The correction loop (user saying "you didn't finish" repeatedly) is eliminated.

## RULES
- NEVER say "done", "fixed", "complete", or "deployed" before verify_completeness returns ✅
- NEVER ask the user "what would you like me to do?" when verify_completeness returns 🚫
- ALWAYS continue working autonomously until the task is fully complete

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
