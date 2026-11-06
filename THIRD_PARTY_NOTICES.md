# Third-Party Notices and Acknowledgements

This project, **Milestone**, incorporates open-source software and evaluation components subject to their respective licenses. This document acknowledges and lists the principal third-party libraries and components used in the project.

---

## 1. Commercial & Evaluation Licenses

### Bryntum Gantt Pro
- **Package:** `@bryntum/gantt` (Version 6.2.5 trial)
- **Vendor:** Bryntum AB (https://www.bryntum.com)
- **License:** Bryntum Evaluation and Commercial License.
- **Notice:** Bryntum Gantt is a commercial product. The evaluation/trial npm package is used here solely for demonstration and evaluation purposes under the hackathon evaluation terms. No proprietary Bryntum source code or license files are committed to this repository. Cloneable installs fetch the public trial package directly from the npm registry per Bryntum evaluation guidelines.

---

## 2. Open Source Dependencies

The following open-source packages are used in Milestone under permissive open-source licenses:

### MIT License
The following components are licensed under the MIT License:
- **Fastify** (`fastify`, `@fastify/cors`, `@fastify/cookie`, `@fastify/static`, `fastify-plugin`, `fastify-type-provider-zod`) — Copyright (c) Fastify contributors
- **React & React DOM** (`react`, `react-dom`) — Copyright (c) Meta Platforms, Inc.
- **Zod** (`zod`) — Copyright (c) Colin McDonnell
- **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`) — Copyright (c) Drizzle Team
- **Tailwind CSS** (`tailwindcss`, `postcss`, `autoprefixer`) — Copyright (c) Tailwind Labs, Inc.
- **Vite** (`vite`, `@vitejs/plugin-react`) — Copyright (c) Yuxi (Evan) You and Vite contributors
- **Pino** (`pino`, `pino-pretty`) — Copyright (c) Matteo Collina and Pino contributors
- **jose** (`jose`) — Copyright (c) Filip Skokan
- **pg** (`pg`, `@types/pg`) — Copyright (c) Brian Carlson
- **Vitest** (`vitest`) — Copyright (c) Vitest contributors
- **TypeScript** (`typescript`) — Copyright (c) Microsoft Corporation
- **ESLint & Prettier** (`eslint`, `prettier`) — Copyright (c) ESLint and Prettier contributors

### Apache License 2.0
The following components are licensed under the Apache License 2.0:
- **PGlite** (`@electric-sql/pglite`) — Copyright (c) Electric SQL
- **Playwright** (`@playwright/test`) — Copyright (c) Microsoft Corporation

### ISC License
The following components are licensed under the ISC License:
- **Lucide Icons** (`lucide-react`) — Copyright (c) Lucide Contributors
- **Canvas Confetti** (`canvas-confetti`) — Copyright (c) Kiril Vatev

### Mozilla Public License 2.0 (MPL-2.0)
The following accessibility test component is licensed under MPL-2.0:
- **Axe Core Playwright** (`@axe-core/playwright`) — Copyright (c) Deque Systems, Inc.

---

## 3. PayPal Sandbox APIs
PayPal API specifications, SDKs, and REST endpoints are used under the PayPal Developer Agreement for sandbox integration testing only:
- **Endpoints:** `https://api-m.sandbox.paypal.com`
- **APIs Used:** Orders v2 Checkout API, Payouts v1 API, Webhooks v1 Notification API, Identity OAuth2 API.

