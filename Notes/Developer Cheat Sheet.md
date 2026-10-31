# macOS & Developer Quick Commands

```bash
# Check listening ports on macOS
lsof -iTCP -sTCP:LISTEN -P -n

# Pull & run local Ollama model
ollama pull llama3.2 && ollama list
```

- [ ] Verify local API endpoints (`11434` / `1234`)
- [ ] Test Quick Look in-app code editor on staged files