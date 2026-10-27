# Equipment Return Reimagined

Assets for the **Equipment Return Reimagined** session at **Power Platform Community Conference 2026**.

Want to try it yourself? This repository is intended to bring together the solutions and app source code demonstrated in the session so you can explore how they work and make them your own.

> **DO NOT DEPLOY IN PRODUCTION.**
> These assets are for demonstration, learning, and experimentation. Use a dedicated development or demo environment, not a production environment.

## What is coming

The planned content is organized into three parts:

| Part | Deliverable | What it includes |
| --- | --- | --- |
| 1 | **Solution - Base Data Model** | The base data model used by the demonstration. Requires an environment with **Dynamics 365 Field Service** installed. |
| 2 | **Source Code - Apps** | Source code for the **[Yard Checkin](./YardCheckin/)** Code App and **[Fleet Command](./FleetCommand/)** in **Copilot Managed Runtime**, so you can explore how they were built and adapt them. |
| 3 | **Solution - Copilot Studio** | The Copilot Studio workflow, agents, and business skills that combine **deterministic rules** with **agentic reasoning**. |

### 1. Base data model

The foundation for the equipment return scenario, packaged as a solution.

**Prerequisite:** Deploy this solution only to a non-production environment with **Dynamics 365 Field Service** installed.

### 2. App source code

Explore the experiences shown in the session:

- **[Yard Checkin](./YardCheckin/)** - the Code App.
- **[Fleet Command](./FleetCommand/)** - the experience in Copilot Managed Runtime.

The source code will let you inspect the implementation and make it your own. App-specific setup and configuration instructions will accompany the source.

### 3. Copilot Studio solution

Explore how the scenario combines a Copilot Studio workflow, agents, and business skills, using deterministic rules alongside agentic reasoning.

Solution-specific setup and configuration instructions will accompany the package.

## Availability

The [Yard Checkin app directory](./YardCheckin/) and [Fleet Command app directory](./FleetCommand/) are available in this repository. Deployment instructions, configuration requirements, and artifact locations will be documented as each deliverable is published.

## Before you start

- Use a dedicated **non-production** Power Platform environment.
- Ensure **Dynamics 365 Field Service** is installed in the environment where you plan to deploy the base data model.
- Review the prerequisites and dependencies supplied with each deliverable before deploying it.
- Use demo or synthetic data while experimenting.

## License

See [LICENSE](LICENSE) for the repository's license terms.
