# Get started with Fleet Command

This guide takes you from this repository to **your own Fleet Command app** in
Microsoft Copilot Managed Runtime. No previous Managed Runtime experience is
required. Commands use **PowerShell on Windows**.

> **Learning and demo use only. Do not deploy these assets in production.**
> Use a dedicated non-production environment and synthetic data.
> Copilot Managed Runtime is in preview; commands, availability and licensing
> can change. This guide follows the Microsoft documentation linked below,
> checked October 28, 2026.

## What you are setting up

Fleet Command is a React app. Managed Runtime supplies its hosting, sign-in,
governed connector access and build/deployment workflow.

| Term | Meaning in this guide |
| --- | --- |
| Source repository | This repository, containing the app code and demo solutions. Cloning it downloads files; it does not create an app or copy any business data. |
| App registration | Your new Managed Runtime app, with its own identity and configuration. |
| Environment | The Power Platform environment containing the app and, for this walkthrough, its Dataverse data. |
| Connector | The Microsoft Dataverse integration used to access business records. |
| Connection | Your authenticated connection to that integration. |
| Data source | An individual table bound to the app through that connection. |
| Generated code | Models and services the CLI creates so the app can call its data sources. |
| Local / preview / live | Run your working files / test a pushed commit on the platform / publish a chosen commit for users. |

You will download the source, prepare Dataverse, register a new app, bind the
tables, run locally, and then preview or publish.

## 1. Install the tools and check access

Install:

- [Visual Studio Code](https://code.visualstudio.com/), or another code editor.
- [Node.js](https://nodejs.org/) **24.11.0 or later**, using a supported LTS release.
  Node includes the `npm` package manager.
- [Git for Windows](https://git-scm.com/), including Git Credential Manager.
- The Managed Runtime command-line tool:

  ```powershell
  npm install -g @microsoft/managed-apps-cli
  ```

Close and reopen PowerShell after installing tools, then check:

```powershell
node --version
npm --version
git --version
git credential-manager --version
ms --version
```

Git must be **2.27.0 or later**. `ms` is the Managed Runtime CLI, not the Power
Platform `pac` CLI. You do not need to register an Entra application or put
tokens in the source code.

You also need:

- A work or school Microsoft account in an eligible tenant. The current
  documentation describes automatic availability for eligible commercial-cloud
  tenants; ask your administrator about restrictions in your organization.
- Permission to create apps and use the selected non-production environment.
- Permission to import the demo solution, or an administrator who can do it.
- **Dynamics 365 Field Service installed** in that environment.
- Permission to read the Dataverse tables used by Fleet Command.
- Licensing to run the app: the documentation lists **Power Apps Premium** or
  **Managed Application Copilot Credits**. This applies to developers running
  locally as well as end users. Field Service and environment access have their
  own requirements; ask your administrator to confirm them.

**Checkpoint:** Every version command works, and you know which account and
non-production environment you will use.

## 2. Download this repository

In PowerShell, move to a development folder you own. Run:

```powershell
git clone https://github.com/bcaauwe/ppcc26-mfm.git
```

This creates a `ppcc26-mfm` folder. Keep PowerShell in its **parent directory**
for the next step.

You only need the `FleetCommand` source and the base solution for this app.
The Yard Checkin app and orchestration workflow are separate experiences.

## 3. Prepare the Dataverse environment

Before registering the app:

1. Open [Power Apps](https://make.powerapps.com) and select your intended
   **non-production** environment.
2. Confirm Dynamics 365 Field Service is installed.
3. Go to **Solutions > Import solution**.
4. Import the [base data model solution](../Solutions/PPCCMFMCore_1_0_0_0.zip).
   Upload the ZIP without extracting it.
5. Resolve any missing dependencies and wait for a successful import.
6. Confirm the fleet tables appear and that your account has read access.

See the [repository overview](../README.md#1-base-data-model) for the solution
import guidance. The orchestration solution is **not required to run the
read-only Fleet Command app**.

Importing a solution supplies its components; do not assume it also supplies
the demonstration's business records. Arrange suitable synthetic fleet,
customer, rental, return and service data. Empty tables can produce an empty
fleet; missing maintenance or condition evidence prevents a green readiness
assessment.

For the 3D view, accounts need valid recorded latitude and longitude to receive
map pins. The current app expects one uniquely named **Summit Equipment**
account to anchor the HQ campus. Missing or ambiguous locations are reported,
not geocoded automatically.

Find and record the **Environment ID** in the environment details in the
[Power Platform admin center](https://admin.powerplatform.microsoft.com).
Also record its **Dataverse organization URL**. They are different values:
the ID is a GUID; the URL is the environment's web address.

**Checkpoint:** The schema exists, your account can read it, and you have your
own environment ID and organization URL.

## 4. Make a separate working copy of the app

Do **not** initialize an app at the root of this multi-app repository. App
configuration, generated services, installed dependencies and build output are
excluded by this app's [`.gitignore`](.gitignore); a fresh clone contains the
source, not the original demonstration's local app binding.

The recommended beginner path is a **new standalone folder with
platform-managed Git**. This avoids accidentally publishing the other app or
binding your app to this repository owner's deployment.

From the parent directory used in step 2, copy the app from your **fresh clone**:

```powershell
$source = Resolve-Path .\ppcc26-mfm\FleetCommand
$destination = Join-Path (Get-Location) 'FleetCommand-Lab'
New-Item -ItemType Directory -Path $destination -ErrorAction Stop

Get-ChildItem -LiteralPath $source -Force |
    Copy-Item -Destination $destination -Recurse -ErrorAction Stop

Set-Location $destination
npm install
```

Choose a different new folder name if `FleetCommand-Lab` already exists. Keep
this folder outside any existing Git repository. The original download stays
unchanged. Use a fresh clone for this step, not a local app folder where you
have already installed dependencies, generated services or initialized an app.
`-Force` includes the source folder's `.gitignore` in the copy; it does not
override Git's ignore rules.

The CLI will create configuration and generate services locally for **your**
app and data. Until that is done, missing generated-service imports are expected.

From now on, run app commands in **FleetCommand-Lab**, not the original download.

## 5. Sign in and initialize your app

```powershell
ms auth login
ms auth status
```

Complete the browser sign-in with your work or school account. Confirm the CLI
shows the intended account. If necessary, use `ms auth switch`.

Save your environment ID for this PowerShell session:

```powershell
$environmentId = Read-Host 'Paste your non-production Environment ID'
```

Register the existing source as a new app:

```powershell
ms app init `
    --display-name "Fleet Command Lab" `
    --environment-id $environmentId `
    --repo native `
    --build-path ".\dist" `
    --build-command "npm run build" `
    --build-entry-point "index.html"
```

- **`init`** registers existing code; **`create`** scaffolds a new template.
  Use `init` here because you already have Fleet Command.
- **`--repo native`** requests a new platform-managed Git repository.
- The explicit environment ID avoids unintentionally using an automatically
  provisioned developer environment without the required schema.
- The build settings match this app's existing Vite project.

Follow any CLI prompts. Inspect the result:

```powershell
ms app info
git remote -v
git status
```

Confirm the app name and environment are yours, and Git points to your newly
provisioned managed repository, not the source download.

The CLI creates `ms.config.json`. Treat it as CLI-managed app metadata; do not
paste the original demo's app ID, environment ID or connection references into
it. Repository mode is fixed when you register the app.

**Checkpoint:** You have a new app registration and a managed Git remote.

## 6. Add all required Dataverse data sources

Fleet Command loads **all 15 tables below**. Adding only Asset Register is not
enough: any failed source blocks readiness display.

| Table | Logical name to pass to the CLI | Used for |
| --- | --- | --- |
| Asset Register | `msftmfm_asset` | Fleet identity, status, meter and accounting values |
| Rental Agreements | `msftmfm_rentalagreement` | Customer commitments and current rentals |
| Return Bookings | `msftmfm_returnbooking` | Expected returns and arrival evidence |
| Work Orders | `msdyn_workorder` | Field Service work and service blockers |
| PM Schedules | `msftmfm_pmschedule` | Maintenance thresholds and compliance |
| Asset Classes | `msftmfm_assetclass` | Equipment classification |
| Customer Assets | `msdyn_customerasset` | Equipment details and functional-location links |
| Disposal Alerts | `msftmfm_disposalalert` | Disposal-review context |
| SAP Master Data | `msftmfm_sapmasterdata` | Recorded SAP location context |
| Accounts | `account` | Customers, HQ and geographic locations |
| Contacts | `contact` | Rental contact context |
| Condition Logs | `msftmfm_conditionlog` | Latest recorded condition evidence |
| PM Work Orders | `msftmfm_pmworkorder` | Legacy maintenance work evidence |
| Functional Locations | `msdyn_functionallocation` | Recorded equipment locations |
| Currencies | `transactioncurrency` | Currency labels and grouped totals |

These are **logical names**, not display labels or plural entity-set names.
Keep the solution's schema names; renaming tables is not a connection-only
change and would require adapting the app.

### Connect the first table

Discover the connector:

```powershell
ms connector list --search Dataverse
```

Then add Accounts:

```powershell
ms app add data-source `
    --connector shared_commondataserviceforapps `
    --as action `
    --dataverse-environment-id $environmentId `
    --table account
```

Choose or create a **Microsoft Dataverse connection** using your intended
account. Complete any sign-in or consent prompts. Confirm it targets the
environment prepared in step 3.

For this Dataverse-specific binding, `--table` selects the logical table and
`--as action` follows the CLI's Dataverse example. It generates that table's
record-operation service; it does not create a Dataverse table. Do not substitute
a generic SQL/SharePoint dataset example.

### Bind the remaining tables

Run the same command **once per remaining logical name** in the table above,
changing only `--table`. Reuse the same connection when prompted. For example:

```powershell
ms app add data-source `
    --connector shared_commondataserviceforapps `
    --as action `
    --dataverse-environment-id $environmentId `
    --table msftmfm_asset
```

Dataverse currently accepts **one table per invocation**. Do not pass all 15
with repeated `--table` options.

If you prefer a loop after successfully connecting Accounts, use:

```powershell
$tables = @(
    'msftmfm_asset', 'msftmfm_rentalagreement', 'msftmfm_returnbooking',
    'msdyn_workorder', 'msftmfm_pmschedule', 'msftmfm_assetclass',
    'msdyn_customerasset', 'msftmfm_disposalalert', 'msftmfm_sapmasterdata',
    'contact', 'msftmfm_conditionlog', 'msftmfm_pmworkorder',
    'msdyn_functionallocation', 'transactioncurrency'
)

foreach ($table in $tables) {
    ms app add data-source `
        --connector shared_commondataserviceforapps `
        --as action `
        --dataverse-environment-id $environmentId `
        --table $table
    if ($LASTEXITCODE -ne 0) {
        throw "Data-source setup failed for $table. Resolve the error before continuing."
    }
}
```

Use either the individual commands or the loop, not both. If a command fails,
inspect `ms app info` and resume with the missing tables rather than repeatedly
adding sources that succeeded. The loop prompts as needed; it does not bypass
connection selection, consent or policy checks.

### Check the bindings and generated services

```powershell
ms app info
Get-ChildItem .\generated\services
```

You should have services for all 15 tables, including the files imported by
[`fleetRepository.ts`](src/data/fleetRepository.ts). The CLI may also generate
connector-level helper files; these are not additional fleet tables.

The CLI owns both the binding metadata and `generated`. Do not hand-edit
generated services or copy them from another environment. After schema changes,
regenerate the bound sources:

```powershell
ms app refresh data-source
```

Refreshing updates existing bindings; it does not add missing tables or migrate
them to a different environment. Policy-blocked operations require administrator
review, not a workaround.

**Checkpoint:** All 15 sources target your environment and their generated
services exist.

## 7. Point record links at your environment

The app's data connection and its **Open in Dynamics** links are separate.

In your working copy, open [`src/App.tsx`](src/App.tsx), find
`function recordUrl`, and replace **only the organization URL** in its returned
address with your own Dataverse organization URL from step 3. Preserve the
`main.aspx` route, record parameters and `encodeURIComponent` calls.

Use the organization web URL, not a Managed Runtime play URL or the Dataverse
API-domain URL. Do not put credentials or access tokens in it.

This source change is necessary because the supplied function contains a
demo-specific host. Rebinding connectors alone does not update that link.

## 8. Validate and run locally

First check the app:

```powershell
npm test
npm run lint
npm run build
```

Resolve failures before previewing. A missing-service import usually means a
data source has not been generated. A missing-field/type error can indicate
that your schema differs from the demo solution.

Start the managed local development loop:

```powershell
ms app dev
```

Open the **Local Play URL printed by the CLI**, in the browser profile signed
into your tenant. Do not just open bare localhost: the managed host supplies the
connector bridge and sign-in context. Keep the terminal running; press
**Ctrl+C** when you are finished.

If the reported Vite URL and the URL expected by the CLI differ, stop the command
and specify the actual Vite address:

```powershell
ms app dev --local-app-url http://localhost:5173
```

Use the port actually printed by Vite, not necessarily `5173`. If Edge or Chrome
asks for local-network access, allow it for your development session according
to your organization's policy.

### First-run checks

- Finish any connector-consent or sign-in prompts.
- Confirm Fleet overview loads your records, or a legitimate empty fleet if
  there are no asset records.
- Try search, recorded-status filters and the planning window.
- Open an asset and check rental, service, maintenance and financial evidence.
- Follow a record link and confirm it opens **your** Dataverse environment.
- Open **Visualize**, browse customer locations, and select **Summit Equipment**
  to inspect the HQ campus.
- Test missing or conflicting evidence: it should remain visible, not turn
  equipment green automatically.

There is no bundled substitute fleet if a source fails. The app deliberately
withholds readiness until every connected source loads successfully.

## 9. Save your app to its managed repository

Stop local development or use another terminal in `FleetCommand-Lab`.

Keep the supplied [`.gitignore`](.gitignore) rules in place. Commit the app
source and dependency manifests, not local app configuration, generated
services, installed dependencies or build output:

```powershell
git add .
git diff --cached --stat
git status
```

Review the staged files in your editor. They should contain no credentials,
tokens, private data or ignored artifacts. In particular, keep `ms.config.json`,
`generated`, `.ms`, `node_modules`, `dist` and logs out of the repository.
Use the CLI to manage app bindings and recreate generated services locally.

If Git asks for your identity, configure it for this repository:

```powershell
git config user.name "Your Name"
git config user.email "your-approved-git-email"
```

Then commit and push:

```powershell
git commit -m "Initialize Fleet Command for my demo environment"
git push -u origin HEAD
```

Do not force-add ignored files to get them into a commit. If an ignored file was
tracked previously, `.gitignore` alone does not untrack it; remove that specific
path from the Git index with `git rm --cached` (use `-r` for a directory), keeping
the local copy. Review the staged removal before committing.

**A push uploads source; it does not by itself build or publish the app.**

## 10. Preview the hosted app

Preview tests a pushed commit on the platform, rather than your uncommitted
local files. To preview exactly the commit you just pushed:

```powershell
$commit = git rev-parse HEAD
ms app play --mode preview --commit $commit
ms app build-status --commit $commit
```

Opening preview starts a platform build if that commit has not been built.
Wait for success, then reload when the preview announces the new version is
ready. If it fails:

```powershell
ms app build-status --commit $commit --show-log
```

A failed or in-progress build can leave preview showing an older successful
version. Check the build status and commit rather than assuming a page that
opens contains your newest changes.

Repeat the local first-run checks in this hosted preview. Preview is for
developers with the required edit/repository access; it is not the distribution
link for arbitrary end users.

For later iterations on the default `main` branch, you can simply use:

```powershell
ms app play --mode preview
```

## 11. Publish a live version and grant access

Publishing is a separate, deliberate step. Here, **live** means the published
version of your learning app in its **non-production environment**, not
permission to use these demo assets in production.

Confirm the app/environment again and deploy the tested commit:

```powershell
ms app info
ms app deploy --commit $commit
ms app play --mode live
```

`deploy` uses the environment already associated with the app; it does not move
the app to a newly selected environment. For a Git-backed app it builds as
needed, waits for completion and deploys the successful result. Uncommitted
changes are not part of that commit.

To grant a specific colleague runtime access:

```powershell
$viewer = Read-Host 'Enter the intended viewer work email'
ms app share $viewer --access play
ms app share list
```

Share the **live URL returned by your CLI**, not the demo author's app URL.
App sharing does not grant Dataverse security roles or a license. The viewer
also needs suitable data permissions, licensing and connector consent. Test
with an intended viewer, not only the app owner.

Future pushes and previews do not automatically replace live. After changing
the app, validate, commit, push, preview, and explicitly deploy the new tested
commit again.

## Returning later or collaborating

- On the same machine, open `FleetCommand-Lab`, check `ms auth status` and use
  `ms app dev`. Re-run `npm install` when dependencies change.
- In a new PowerShell session, variables such as `$environmentId` and `$commit`
  are gone. Set them again before using commands that reference them.
- On another machine, an editor can use `ms auth login`, then
  `ms app list --permission edit` and `ms app clone --app <your-app-id> <new-folder>`.
  Replace the angle-bracket placeholders; do not type them literally.
- In the cloned app folder, run `npm install` and `ms app refresh data-source`
  to restore dependencies and regenerate ignored services before local development.
- Cloning an existing managed app continues that app. It is different from
  cloning this source repository and initializing a new learning app.

## Optional: use your organization's GitHub repository

The beginner walkthrough uses platform-managed Git; a personal GitHub fork is
**not** an equivalent supported external binding.

Microsoft currently requires an external repository to be owned by an
organization on **GitHub Enterprise Cloud**, with the **Microsoft Managed Apps**
GitHub app installed for that organization/repository. Personal-account
repositories, GitHub Enterprise Server and Azure DevOps are not supported for
this binding.

If your organization meets those requirements, prepare a separate repository
with **only this app at its root**, clone it, and use that root as the working
directory. Copy the clean source as in step 4, then replace the
`--repo native` argument in step 5 with:

```text
--repo https://github.com/YOUR-ORGANIZATION/YOUR-APP-REPOSITORY
```

Follow the CLI's GitHub authentication prompts. Do not bind the multi-app source
repository directly and assume the platform will select its `FleetCommand`
subfolder. Changing repository mode after registration requires a new app.
The `--repo none` bring-your-own-build mode has additional governance
requirements and is outside this beginner guide.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `node`, `git` or `ms` is not recognized | Reopen PowerShell after installation and verify the tool is on PATH. |
| PowerShell blocks an npm/CLI `.ps1` launcher | Follow your organization's execution-policy guidance. If permitted, invoke its installed `.cmd` launcher, such as `ms.cmd`, instead. Do not disable organization policy. |
| Initialization says this directory is already an app | You copied an existing configuration or are in the wrong folder. Return to the fresh-folder steps; do not reinitialize or delete the original app. |
| Wrong environment or account | Check `ms auth status` and `ms app info`. Stop before adding sources or deploying; do not repair a wrong app binding by pasting IDs into JSON. |
| A fleet table cannot be found | Confirm the base solution import, Field Service dependencies, logical table name, environment and read privileges. |
| Data source or operation is blocked | Ask your administrator about DLP/Advanced Connector Policies. Do not bypass policy. |
| Generated service imports are missing | Add the missing table; refresh existing bindings if their generated files are missing or stale. |
| Fleet data could not be verified | Read the displayed error and check every required source, connection consent and Dataverse permissions. A single failed source blocks readiness. |
| Local page is blank or cannot call connectors | Use Local Play in the correct browser profile, keep the CLI running, check actual Vite/config-server ports and local-network permission. |
| Local succeeds but platform build fails | Inspect build logs and confirm source and dependency manifests were committed and pushed. Verify the app's registered data sources with `ms app info`; do not force-add ignored configuration or generated files to work around a build error. Consult the current Managed Runtime build guidance for the reported failure. |
| Preview appears unchanged | Verify the commit/build status, wait for the successful build, and refresh. An older successful preview can remain visible after a failed build. |
| Live appears unchanged | Preview and push do not update live. Deploy the new tested commit explicitly. |
| A colleague cannot open the app or read data | Check app sharing, licensing, connection consent, environment access and Dataverse read roles separately. |
| No customer pins or HQ campus in 3D | Check account coordinates, current rental links and the uniquely named Summit Equipment account. Locations are inferred, not GPS tracking. |

## Official documentation

Use these pages for current product requirements and command details:

- [Managed Runtime developer overview and prerequisites](https://learn.microsoft.com/en-us/microsoft-365/managed-apps/developer/?view=o365-worldwide)
- [CLI quickstart](https://learn.microsoft.com/en-us/microsoft-365/managed-apps/developer/quickstart-managed-apps-cli?view=o365-worldwide)
- [Connect an app to data](https://learn.microsoft.com/en-us/microsoft-365/managed-apps/developer/connect-to-data?view=o365-worldwide)
- [Build, preview and deploy](https://learn.microsoft.com/en-us/microsoft-365/managed-apps/developer/dev-inner-loop?view=o365-worldwide)
- [CLI command reference](https://learn.microsoft.com/en-us/microsoft-365/managed-apps/developer/ms-cli-command-reference?view=o365-worldwide)

Use `ms <command> --help` to check your installed CLI's options. This guide does
not require running any deployment against the original demonstration app.
