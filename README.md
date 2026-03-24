# @hasna/cli

Unified management CLI for all @hasna/* open-source packages

[![npm](https://img.shields.io/npm/v/@hasna/cli)](https://www.npmjs.com/package/@hasna/cli)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

## Install

```bash
npm install -g @hasna/cli
```

## CLI Usage

```bash
hasna --help
```

## Cloud Sync

This package supports cloud sync via `@hasna/cloud`:

```bash
cloud setup
cloud sync push --service cli
cloud sync pull --service cli
```

## Data Directory

Data is stored in `~/.hasna/cli/`.

## License

Apache-2.0
