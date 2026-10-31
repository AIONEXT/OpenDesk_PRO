# OpenDesk Pro v3.1 — 100% Free Local & Free-Tier Cloud AI Integration Guide

**OpenDesk Pro v3.1 Enterprise** includes a built-in **AI Studio Hub** (`ai-chat-completion` & `ai-check-local-models` IPC bridge) configured exclusively for **100% Free Providers** — combining **Zero-Key Offline/Cloud AI**, **Local LLMs**, **OmniRoute**, and **Free-Tier Cloud APIs** with automatic ByteString header sanitization and hybrid fallback.

---

## 1. Zero-Key & Local AI Providers (No API Key Required)

- **⚡ Built-in Smart AI (`builtin`)**: 100% offline workspace engine for instant summarization, `- [ ]` task extraction, code review, grammar polishing, and Markdown table generation.
- **🌐 Free Cloud AI (`freecloud`)**: Zero-key OpenAI-compatible cloud gateway (`openai`, `mistral`, `llama`, `qwen-coder`, `deepseek-r1`) with automatic offline fallback.
- **🧭 OmniRoute (`omniroute`)**: Connects automatically to your local OmniRoute daemon (`http://127.0.0.1:20128/v1` or `http://127.0.0.1:4000/v1`) or hosted OmniRouter (`https://api.omnirouter.ai/v1`) with automatic zero-key hybrid fallback.
- **🏠 Local Ollama (`ollama`)**: Auto-discovers installed local models via `http://127.0.0.1:11434/api/tags`.
- **🏠 Local LM Studio (`lmstudio`)**: Auto-discovers loaded GGUF/MLX models via `http://127.0.0.1:1234/v1/models`.

---

## 2. Free-Tier Cloud Providers & API Key Setup

Open **OpenDesk Pro Preferences (`⚙`) → 100% Free AI Providers & Free-Tier API Key Vault** and paste the free API key for any provider:

| Free Provider | Free Models Included | Key Prefix / Format | Endpoint Used |
|---|---|---|---|
| **🆓 OpenRouter (`:free`)** | `deepseek/deepseek-r1:free`, `deepseek/deepseek-chat-v3-0324:free`, `nvidia/nemotron-3.5-lightning:free`, `cohere/north-mini-code:free`, `thinkingmachines/inkling:free`, `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen-2.5-coder-32b-instruct:free`, `google/gemini-2.0-flash-exp:free`, `openrouter/free` | `sk-or-v1-...` | `openrouter.ai/api/v1/chat/completions` |
| **🟢 Nvidia NIM (Free Tier)** | `meta/llama-3.3-70b-instruct`, `nvidia/nemotron-3.5-lightning-30b-a3b`, `nvidia/nemotron-3.5-lightning:free`, `deepseek-ai/deepseek-r1`, `nvidia/llama-3.1-nemotron-ultra-253b-v1`, `qwen/qwen2.5-coder-32b-instruct` | `nvapi-...` | `integrate.api.nvidia.com/v1/chat/completions` |
| **🧭 OmniRoute (Free Router)** | `omniroute/auto-free`, `auto/best-free`, `deepseek-r1:free`, `llama-3.3-70b-instruct`, `qwen-2.5-coder-32b` | Optional `sk-...` token | `127.0.0.1:20128/v1` / `127.0.0.1:4000/v1` / `api.omnirouter.ai/v1` |
| **⚡ Groq Cloud (Free)** | `llama-3.3-70b-versatile`, `deepseek-r1-distill-llama-70b`, `qwen-qwq-32b`, `gemma2-9b-it` | `gsk_...` | `api.groq.com/openai/v1/chat/completions` |
| **☁️ Google Gemini (Free)** | `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-flash` | `AIza...` | `generativelanguage.googleapis.com/v1beta` |
| **🚀 Cerebras Fast AI (Free)** | `llama-3.3-70b`, `llama3.1-8b`, `deepseek-r1-distill-llama-70b` | `csk-...` | `api.cerebras.ai/v1/chat/completions` |
| **🔥 SambaNova Cloud (Free)** | `Meta-Llama-3.3-70B-Instruct`, `DeepSeek-R1`, `DeepSeek-V3-0324`, `Qwen2.5-Coder-32B-Instruct` | Free API Key | `api.sambanova.ai/v1/chat/completions` |
| **🐙 GitHub Models (Free)** | `gpt-4o-mini`, `DeepSeek-R1`, `Llama-3.3-70B-Instruct`, `Codestral-2501`, `Phi-4` | `ghp_...` / `github_pat_...` | `models.inference.ai.azure.com/chat/completions` |
| **🤗 Hugging Face (Free)** | `Qwen/Qwen2.5-72B-Instruct`, `meta-llama/Llama-3.3-70B-Instruct`, `mistralai/Mistral-Small-24B-Instruct-2501` | `hf_...` | `router.huggingface.co/v1/chat/completions` |
| **🌪️ Mistral / Codestral (Free)** | `mistral-small-latest`, `codestral-latest`, `open-mistral-nemo` | Free La Plateforme Key | `api.mistral.ai/v1/chat/completions` |

All keys are sanitized to strict printable ASCII (`sanitizeApiKey` & `buildSafeAsciiHeaders`) so pasted terminal boxes or Unicode characters (such as `─` U+2500) can never cause `ByteString` errors.
