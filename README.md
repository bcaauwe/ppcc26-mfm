# Equipment Return Reimagined

Assets for the **Equipment Return Reimagined** session at **Power Platform Community Conference 2026**.

Want to try it yourself? This repository is intended to bring together the solutions and app source code demonstrated in the session so you can explore how they work and make them your own.

> **DO NOT DEPLOY IN PRODUCTION.**
> These assets are for demonstration, learning, and experimentation. Use a dedicated development or demo environment, not a production environment.

## Repository contents

The session assets are organized into three parts:

| Part | Deliverable | What it includes |
| --- | --- | --- |
| 1 | **[Solution - Base Data Model](./Solutions/)** | The unmanaged base data model solution used by the demonstration. Requires an environment with **Dynamics 365 Field Service** installed. |
| 2 | **Source Code - Apps** | Source code for the **[Yard Checkin](./YardCheckin/)** Code App and **[Fleet Command](./FleetCommand/)** in **Copilot Managed Runtime**, so you can explore how they were built and adapt them. |
| 3 | **[Solution - Process Orchestration](./Solutions/PPCCMFMOrchestration_unmanaged.zip)** | The unmanaged process workflow solution for the Copilot Studio orchestration demonstrated in the session, combining **deterministic rules** with **agentic reasoning**. |

### 1. Base data model

The foundation for the equipment return scenario, packaged as an **unmanaged solution** so you can explore and customize its components.

**Download:** [Base solution v1.0.0.0](./Solutions/PPCCMFMCore_1_0_0_0.zip)

**Prerequisite:** Deploy this solution only to a non-production environment with **Dynamics 365 Field Service** installed.

#### Import the base solution

1. Download the solution ZIP linked above. Do not extract it before importing.
2. Open [Power Apps](https://make.powerapps.com) and select your intended **non-production** environment.
3. Go to **Solutions > Import solution** and upload the ZIP.
4. Review the solution details and any dependency requirements, resolve missing dependencies, and complete the import.
5. Confirm the import succeeds and the solution appears in the environment before proceeding with the apps.

Unmanaged solution components become editable customizations in the target environment. Deleting the solution container does **not** remove those components; use a dedicated demo or development environment.

### 2. App source code

Explore the experiences shown in the session:

- **[Yard Checkin](./YardCheckin/)** - the Code App.
  Follow the [beginner setup instructions](./YardCheckin/INSTRUCTIONS.md) to
  initialize your own app, connect its tables and analysis flows, test and publish.
- **[Fleet Command](./FleetCommand/)** - the experience in Copilot Managed Runtime.
  Follow the [beginner setup instructions](./FleetCommand/INSTRUCTIONS.md) to
  initialize your own app, connect its data sources, preview and publish.

The source code will let you inspect the implementation and make it your own.

### 3. Process orchestration solution

Explore the process workflow behind the equipment return scenario with **PPCCMFMOrchestration**, packaged as an **unmanaged solution**. The session demonstrates how a Copilot Studio workflow, agents, and business skills combine deterministic rules with agentic reasoning.

**Download:** [Process orchestration - unmanaged solution](./Solutions/PPCCMFMOrchestration_unmanaged.zip)

**Prerequisites:** Use the same **non-production** environment as the base data model, with **Dynamics 365 Field Service** installed. Import the base solution first.

#### Import the orchestration solution

1. Download the orchestration ZIP linked above. Do not extract it before importing.
2. Open [Power Apps](https://make.powerapps.com) and select the environment where you imported the base solution.
3. Go to **Solutions > Import solution** and upload the orchestration ZIP.
4. Review and resolve any missing dependencies. If prompted, configure connection references and environment variable values for your demo environment.
5. Complete the import and confirm it succeeds before configuring or running the process workflow.
6. Review the imported workflow's connections and configuration, then test it with demo or synthetic data before using it with the apps.

As with the base solution, deleting this unmanaged solution container does **not** remove its components.

## Availability

Available in this repository:

- [Base data model - unmanaged solution v1.0.0.0](./Solutions/PPCCMFMCore_1_0_0_0.zip)
- [Process orchestration - unmanaged solution](./Solutions/PPCCMFMOrchestration_unmanaged.zip)
- [Yard Checkin app directory](./YardCheckin/)
- [Fleet Command app directory](./FleetCommand/)

Both unmanaged solution packages and both app directories are available. Additional workflow-specific configuration instructions will be documented as they are published.

## Before you start

- Use a dedicated **non-production** Power Platform environment.
- Ensure **Dynamics 365 Field Service** is installed in the environment where you plan to deploy the base data model.
- Review the prerequisites and dependencies supplied with each deliverable before deploying it.
- Use demo or synthetic data while experimenting.

## License

See [LICENSE](LICENSE) for the repository's license terms.
