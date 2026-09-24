---
name: Permit assistant AI provider
description: Why the permitting app uses the user's own OpenAI key instead of managed AI setup
---

The user chose to provide their own OpenAI API key after the managed AI integration returned an awaiting-phone-verification state. Do not retry the managed setup unless the user changes direction.

**Why:** The user explicitly selected the own-key path. Repeatedly attempting managed setup would disregard that decision.

**How to apply:** For future permitting-answer work, use the existing secure secret flow for the user's key and never request or display the key in chat. If the user wants to change providers, ask before switching.