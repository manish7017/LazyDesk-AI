# Contributing to LazyDesk AI

Thank you for your interest in contributing to **LazyDesk AI**! We welcome contributions from developers of all skill levels, especially during Hacktoberfest 2026.

LazyDesk AI was built for **Hacktoberfest 2026 Open-Source AI Challenge, Week 3: "Slow and Steady"**. Our philosophy: *Spend less time managing files and more time doing meaningful work.*

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free experience for everyone. Please be respectful, constructive, and empathetic in all interactions across issues, pull requests, and discussions.

---

## Development Setup

### Prerequisites

- **Node.js**: v20+ or v22+ (tested through v25)
- **npm**: v9+ (or pnpm/yarn)
- **Ollama** (optional for local LLM inference): [Download Ollama](https://ollama.ai)

### Getting Started

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/your-username/lazydesk-ai.git
   cd lazydesk-ai
   ```

2. **Install all monorepo dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Build shared packages**:
   ```bash
   npm run build
   ```

5. **Start local development servers (Backend + Frontend)**:
   ```bash
   npm run dev
   ```
   - Frontend UI: `http://localhost:5173`
   - Backend API: `http://localhost:3001`

---

## Local AI Setup (Ollama)

To test AI file classification locally with open-weight models:

1. Start the Ollama server:
   ```bash
   ollama serve
   ```

2. Pull the default lightweight model:
   ```bash
   ollama pull llama3.2
   ```
   *Alternative compatible models: `mistral`, `qwen2.5`, `phi4`.*

3. If Ollama is offline or not installed, LazyDesk AI automatically activates its deterministic **rule-based offline engine**, so you can develop and test without running an LLM.

---

## Running Automated Tests

We maintain 100% test pass rates across directory safety, boundary security, hash duplicate detection, operations journals, and REST APIs.

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

---

## Contribution Workflow

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feat/support-epub-extraction
   ```
2. Make clean, atomic commits following conventional commit syntax:
   - `feat: add audio metadata extractor`
   - `fix: prevent trailing dash in sanitized directory names`
   - `docs: update Windows setup instructions`
3. Ensure all tests and builds pass:
   ```bash
   npm test
   npm run build
   ```
4. Push your branch and submit a Pull Request referencing the related issue.

---

## Hacktoberfest Guidelines

- Quality contributions over quantity.
- PRs that improve safety, add content extractors, optimize duplicate detection, or enhance UI accessibility are highly prioritized.
- AI-generated spam or PRs that fail tests will be flagged as invalid.

Thank you for contributing to open-source, privacy-first software!
