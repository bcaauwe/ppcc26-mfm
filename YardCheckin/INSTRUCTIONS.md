# Get started with Yard Checkin

This guide helps someone new to **Power Apps Code Apps** run and publish their
own copy of Yard Checkin. It uses this repository's existing React app, not a
blank starter template. Commands use **PowerShell on Windows**.

> **Learning and demo use only. Do not deploy these assets in production.**
> Use a dedicated non-production environment, synthetic customer data and test
> images. **Local testing writes real records to the connected environment**:
> photos are saved during capture, before final confirmation.
>
> Guidance was checked against Microsoft's official Code Apps documentation on
> October 28, 2026. See the [official references](#official-documentation) for
> current requirements.

## What you will set up

Yard Checkin needs:

- A Power Platform environment with Code Apps enabled and Dataverse.
- Dynamics 365 Field Service and the repository's base data model solution.
- Six Dataverse tables, Office 365 Users and MSN Weather.
- Two solution-aware Power Automate flows for image analysis.
- A new local app configuration, generated services and a published Code App.

**This is not a Copilot Managed Runtime app.** Use the Power Apps CLI, `pa`,
not Fleet Command's `ms` commands. Code Apps publish compiled local assets with
`pa app push`; there is no Managed Runtime `play --mode preview` step.

## 1. Install the tools

Install:

- [Visual Studio Code](https://code.visualstudio.com/), or another code editor.
- [Node.js LTS](https://nodejs.org/). Node 24 LTS is a suitable choice for this
  app's Vite 7 toolchain; npm is included.
- [Git for Windows](https://git-scm.com/).
- The current Power Apps CLI:

  ```powershell
  npm install --global @microsoft/power-apps-cli
  ```

Reopen PowerShell after installation, then check:

```powershell
node --version
npm --version
git --version
pa --version
```

The commands below use the **current globally installed `pa` CLI** documented
by Microsoft. The repository also pins a project-local CLI dependency; older
versions can expose different commands. Do not mix in legacy flat
`power-apps` commands, `pac` commands or `ms` commands.

Do not run bare `npx pa`: it can resolve an unrelated npm package if the
intended executable is missing. Install the Microsoft CLI above and use `pa`.
The app's SDK and Vite plugin are already declared in its dependency manifest;
you do not need to scaffold over the existing code.

## 2. Prepare your account and environment

Ask your administrator to confirm:

- You can create and publish apps in a **non-production** environment.
- Dynamics 365 Field Service is installed in that environment.
- Your account can import solutions and configure connections and flows, or
  an administrator can perform those steps.
- Your account has the Dataverse privileges needed by the app.
- Your licensing covers running Code Apps and the analysis flows/prompts.
  Microsoft's current Code Apps overview lists Power Apps Premium,
  pay-as-you-go, an App Pass or auto-claim as end-user licensing options.
  Flow and AI capacity requirements must also be checked separately.
- Organization policies allow the required connectors.

### Enable Code Apps

An administrator should open the
[Power Platform admin center](https://admin.powerplatform.microsoft.com):

1. Select **Manage > Environments** and your intended environment.
2. Select **Settings > Product > Features**.
3. Turn on **Enable code apps** under **Power Apps code apps**.
4. Save the setting.

Record your **Environment ID** and **Dataverse organization URL** from the
environment details. The ID is a GUID; the organization URL is its web address.
Use your own values, not the original demonstration's configuration.

## 3. Download the source and import the base solution

In PowerShell, move to a development folder you own:

```powershell
git clone https://github.com/bcaauwe/ppcc26-mfm.git
```

If you already downloaded the repository for Fleet Command, use that download
instead of cloning again.

In [Power Apps](https://make.powerapps.com), select the environment from step 2:

1. Open **Solutions > Import solution**.
2. Upload [PPCCMFMCore_1_0_0_0.zip](../Solutions/PPCCMFMCore_1_0_0_0.zip)
   without extracting it.
3. Review dependencies, supply target-environment connections when prompted,
   and resolve missing dependencies before proceeding.
4. Wait for a successful import and inspect the solution's components.

The **base solution includes both required image-analysis flows**:

- **Equipment Reimagined: Analyze Image**
- **Equipment Reimagined: Analyze Consolidated Image Results**

The separate orchestration solution is not required for this app's check-in
workflow. See the [repository overview](../README.md#1-base-data-model) for
additional solution guidance.

### Prepare the imported flows

Open each of the two flows in the solution:

1. Resolve its connection references using connections in your environment.
2. Review its **Run a prompt** actions and confirm the referenced prompts are
   available, permitted and covered by the necessary capacity/licensing.
3. Save, enable and test the flow with synthetic inputs.
4. Confirm the maker adding it to the app can access the flow and its underlying
   connections.

Code Apps support **solution-aware instant flows with a Power Apps trigger**.
These packaged flows use **Power Apps (V2)**. Do not replace them with a
scheduled flow, an automated flow or an arbitrary HTTP endpoint.

### Prepare test records

The solution supplies components; do not assume it also supplies a populated
demo fleet. Arrange:

- A customer Account and suitable Contacts.
- An Asset with a manufacturer serial number.
- A Rental Agreement linked to that customer and asset, with contracted hours
  and an overage rate if you want to test charges.
- A Pending or Confirmed Return Booking linked to the agreement, with a
  requested return slot in the future.

The return queue excludes past bookings and bookings without a requested slot,
even when **All** is selected. Use dates that fall within your test window.

**Checkpoint:** The schema, prompts, flows and linked synthetic records exist
in the intended environment.

## 4. Make a separate working copy

The repository contains more than one app. Copy **only YardCheckin**, not the
repository root. From the parent of the fresh download:

```powershell
$source = Resolve-Path .\ppcc26-mfm\YardCheckin
$destination = Join-Path (Get-Location) 'YardCheckin-Lab'
New-Item -ItemType Directory -Path $destination -ErrorAction Stop

Get-ChildItem -LiteralPath $source -Force |
    Copy-Item -Destination $destination -Recurse -ErrorAction Stop

Set-Location $destination
npm ci
```

Use a new folder name if `YardCheckin-Lab` already exists. Copy from a **fresh
clone**, not an initialized local folder containing generated services or app
bindings. `-Force` includes `.gitignore`; it does not override Git's ignore
rules. The source download stays unchanged.

The app's [`.gitignore`](.gitignore) excludes `power.config.json`,
`src/generated`, `.power`, dependencies, logs and build output. Their absence
from a fresh clone is intentional. The CLI will recreate the configuration and
services for your app.

Run the remaining commands in **YardCheckin-Lab**. Do not run them in
FleetCommand or at the repository root.

## 5. Sign in and initialize your own Code App

```powershell
pa auth login
pa auth status
```

Complete browser sign-in with the intended work or school account. If the
wrong account is active, use `pa auth switch` before continuing.

Enter your target values:

```powershell
$environmentId = Read-Host 'Paste your non-production Environment ID'
$orgUrl = Read-Host 'Paste your Dataverse organization URL'
```

Initialize the existing source:

```powershell
pa app init `
    --display-name "Yard Checkin Lab" `
    --environment-id $environmentId `
    --app-type CodeApp `
    --file-entry-point index.html `
    --app-url http://localhost:3000
```

The default build output is `dist`, matching this app. Initialization creates
local `power.config.json`; it does not import the solution, seed records or
create the analysis flows.

Open the generated configuration in your editor and confirm its app name,
environment and local URL. Do not paste the demonstration's app, connection or
workflow IDs into it.

## 6. Add the six Dataverse tables

Add **native Dataverse** data sources, using logical table names:

| Table | Logical name | Access used by the app |
| --- | --- | --- |
| Return Bookings | `msftmfm_returnbooking` | Read and update bookings, findings, return details and signature |
| Rental Agreements | `msftmfm_rentalagreement` | Read agreement, customer and asset context |
| Accounts | `account` | Read customer information |
| Assets | `msftmfm_asset` | Read equipment identity and serial number |
| Contacts | `contact` | Read and select the returning contact |
| Condition Photos | `msftmfm_conditionphoto` | Create, read, update and delete booking-linked inspection photos |

Use the imported schema, including its image columns, Photo ID autonumber,
relationships and choice values. A newly created table with the same display
name is not a substitute.

Run one command per table:

```powershell
$tables = @(
    'msftmfm_returnbooking', 'msftmfm_rentalagreement', 'account',
    'msftmfm_asset', 'contact', 'msftmfm_conditionphoto'
)

foreach ($table in $tables) {
    pa app add data-source `
        --connector dataverse `
        --table $table `
        --org-url $orgUrl
    if ($LASTEXITCODE -ne 0) {
        throw "Data-source setup failed for $table. Resolve the error before continuing."
    }
}
```

Native Dataverse uses your signed-in identity and organization URL. It does
**not** require a connector connection ID, dataset or a separate generic
Dataverse connector binding for this app's table services.

If a command fails, check which sources succeeded and resume only the missing
tables. Confirm `$orgUrl` belongs to the environment selected during init.

Grant users the required table privileges, including **Append/Append To** for
lookup associations as appropriate, and any relevant column-level access.
Sharing the app alone does not grant these privileges.

## 7. Add Office 365 Users and MSN Weather

These are connector-backed services, unlike native Dataverse.

List your available connections:

```powershell
pa connection list
```

If a suitable connection does not exist, create it:

```powershell
pa connection create --connector shared_office365users
pa connection create --connector shared_msnweather
```

Complete any connection-specific prompts. Record each returned connection ID,
or run `pa connection list` again. Use the **connection ID**, not a connection
reference's logical name or a connector's ID.

Bind the connections:

```powershell
$usersConnectionId = Read-Host 'Paste your Office 365 Users connection ID'
$weatherConnectionId = Read-Host 'Paste your MSN Weather connection ID'

pa app add data-source `
    --connector shared_office365users `
    --connection-id $usersConnectionId

pa app add data-source `
    --connector shared_msnweather `
    --connection-id $weatherConnectionId
```

Office 365 Users supplies the current profile and, where supported, its photo.
MSN Weather supplies weather for a user-entered location. No location means
weather has not yet been requested.

## 8. Bind the two imported flows

Discover them in your initialized app's environment:

```powershell
pa app list-flows --search "Equipment Reimagined"
```

Match the full display names from step 3. Copy the **Flow ID** returned for
each flow in your environment:

```powershell
$imageFlowId = Read-Host 'Paste the Flow ID for Equipment Reimagined: Analyze Image'
$consolidationFlowId = Read-Host 'Paste the Flow ID for Equipment Reimagined: Analyze Consolidated Image Results'

pa app add flow --flow-id $imageFlowId
pa app add flow --flow-id $consolidationFlowId
```

The CLI downloads the flow definitions, generates typed services and registers
their connection references. Do not manually insert workflow IDs into
generated TypeScript.

### Keep the request and response contracts

The handwritten code in [`CheckInPage.tsx`](src/pages/CheckInPage.tsx) expects:

| Flow | Inputs | Outputs consumed by the app |
| --- | --- | --- |
| Analyze Image | `file` containing `name` and base64 `contentBytes`; `text` set to `Asset`, `Meter` or `Receipt` | `result` and `description` |
| Analyze Consolidated Image Results | `text` containing individual analysis results joined with blank lines | `consolidatedresult` and `consolidatedsummary` |

For asset images, `description` must contain **`angle;summary`**. The angle must
match a supported Condition Photo angle choice. Meter analysis returns a meter
reading; receipt analysis returns an amount. Test these cases separately.

The visible trigger input titles can differ from their generated parameter
names. For example, the packaged image flow labels its text input `imageType`,
but the app sends the schema property `text`.

If a flow is missing from the list, check the selected environment, solution
membership, Power Apps trigger and your access to it and its connections.
After changing a flow definition, rerun `pa app add flow` with the same Flow ID
to regenerate its service.

## 9. Check generated services and validate

```powershell
Get-ChildItem .\src\generated\services
npm run lint
npm run build
```

The app expects these generated service files:

- `Msftmfm_returnbookingsService.ts`
- `Msftmfm_rentalagreementsService.ts`
- `AccountsService.ts`
- `Msftmfm_assetsService.ts`
- `ContactsService.ts`
- `Msftmfm_conditionphotosService.ts`
- `Office365UsersService.ts`
- `MSNWeatherService.ts`
- `EquipmentReimagined_AnalyzeImageService.ts`
- `EquipmentReimagined_AnalyzeConsolidatedImageResultsService.ts`

Models must also exist for the Dataverse tables and choices. Missing imports
usually indicate an incomplete binding or a generated name/path mismatch.
Inspect the CLI's actual output. If a changed flow name or generator version
produces a different service name/location, update the **handwritten imports**
to the generated exports after confirming their contracts. Do not rename or
patch generated services to substitute old IDs.

After a table schema changes, refresh the affected data source:

```powershell
$sourceName = Read-Host 'Enter the registered data-source name to refresh'
pa app refresh data-source --name $sourceName
```

Use its registered data-source name from local configuration, which may differ
from the table display name. Then rebuild. This project has lint and build
scripts; it does not define an `npm test` script.

**Checkpoint:** Lint and the TypeScript/Vite build succeed with your generated
services. `dist` contains the compiled app.

## 10. Run locally through Power Apps

Start the Power Apps local host:

```powershell
pa app run
```

Open the **Local Play URL printed by the CLI**, using the browser profile signed
into your Power Platform tenant. Complete connector consent and sign-in prompts.
Keep the terminal running.

Bare localhost and `npm run preview` are not substitutes for the authenticated
Power Apps host. If Edge or Chrome requests local-network access, follow your
organization's policy to permit the local development connection.

### If the frontend and local host use different ports

Stop the existing local run with **Ctrl+C**. You can explicitly run the two
parts in separate terminals, both in `YardCheckin-Lab`.

**Terminal 1 - Vite:**

```powershell
npm run dev -- --port 3000 --strictPort
```

**Terminal 2 - Power Apps host only:**

```powershell
pa app run --config-only --local-app-url http://localhost:3000
```

Open Terminal 2's **Local Play** link. If port 3000 is occupied, choose a free
port and use that same port in both commands. Stop both terminals when finished.

## 11. Test a complete synthetic return

Local Play uses real connections: it is **not a dry run**.

1. Confirm a future Pending/Confirmed booking appears in the queue.
2. Open it and verify the customer, agreement and equipment.
3. Scan or manually enter the expected manufacturer's serial number.
4. Select the returning contact.
5. Capture asset photos. Verify individual analysis completes and related
   Condition Photo records, images and Photo IDs are saved.
6. Select **Analyze Photos** and verify consolidated findings are saved.
7. Capture an hour-meter image and verify its reading and image are saved.
8. Optionally test a fuel receipt, video and editable condition notes.
9. Review the findings and any overage calculation. Obtain a test signature.
10. Confirm online. Verify the Return Booking is **Arrived**, the intended
    return fields were saved, and related Condition Photos are **Submitted**.
11. Check the records in Dataverse, not just the success screen.

Test camera/microphone permissions and scanning on the intended tablet or phone.
Browser support varies; manual serial-number entry and editable transcript
entry are available. Power Apps for Windows is not a supported Code Apps client.

Important limitations:

- Photos and findings are written **before** final confirmation. Cancelling
  does not roll back every record; final confirmation is not one atomic write.
- Confirmation requires an online connection. There is no offline recovery of
  unsaved in-memory work.
- Video and selected audio are session-only; the reviewed transcript is saved,
  not those recordings.
- **Send confirmation** is a UI demonstration, not an actual SMS/email sender.
- AI findings need human review.

## 12. Publish and share

Publishing uploads your locally compiled app. Check local `power.config.json`
again to confirm the intended app and non-production environment.

Build the latest source, then publish deliberately:

```powershell
npm run build
pa app push
```

Open the **Power Apps URL returned by the command**, or find the app under
**Apps** in [Power Apps](https://make.powerapps.com) with the correct environment
selected. Test the published app's connections and synthetic check-in workflow.

`pa app push` creates or updates the published app. There is no separate hosted
preview/live promotion sequence like Fleet Command's Managed Runtime workflow.
Use a separate non-production app/environment for testing changes before
updating an app others rely on.

To share with a specific intended viewer:

```powershell
$viewer = Read-Host 'Enter the intended viewer work email'
pa app share --principal $viewer --access play
```

You can also use the maker portal's sharing experience. Sharing the app does
not grant Dataverse roles, flow run permissions, licenses or connection access.
Configure the flows' run-only access and connection settings as appropriate.
Microsoft's flow guidance calls for sufficient Dataverse privileges to invoke
flows, such as the App Opener role or an equivalent role; that alone does not
grant the app's business-table write privileges.

Test as an intended end user, not only the owner. Review policies for inspection
images, customer contacts, signatures and transcripts before granting access.

## 13. Keep source in Git, not local artifacts

Code Apps initialization does not provision a platform-managed Git repository.
You can keep your standalone source in your own repository:

```powershell
git init
git add .
git diff --cached --stat
git status
```

Review the staged files, then commit with your normal Git identity and workflow.
Keep [`.gitignore`](.gitignore) in place. Do not force-add `power.config.json`,
`src/generated`, `.power`, `node_modules`, `dist` or logs.

Never put credentials, tokens, private records or captured customer images in
source. Microsoft notes that published compiled assets are publicly hosted;
retrieve protected business data through authenticated data sources instead.

On another machine, clone your source, run `npm ci`, and restore the app's
target-specific configuration and data bindings through the CLI/your approved
ALM process. A Git clone alone cannot restore the ignored local configuration.
Do not initialize a new app and assume it updates an existing published app;
verify its binding before pushing.

For subsequent changes: edit, validate, test locally, build and run
`pa app push` again. A Git commit or push alone does not publish a Code App.
Use Microsoft's [ALM guidance](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/alm)
for solution packaging and controlled movement between environments.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `pa` is missing or options are unknown | Install/update the official global Microsoft CLI. Check `pa --version` and the command's `--help`; do not mix it with an older local binary. |
| PowerShell blocks a `.ps1` launcher | Follow organization policy. If permitted, use the installed `.cmd` launcher, such as `pa.cmd`; do not disable organization policy. |
| Initialization or publishing is denied | Confirm account, environment ID, maker permissions and the Code Apps feature setting. |
| A Dataverse table is missing | Check Field Service, successful base-solution import, logical name, organization URL and permissions. |
| Flow cannot be found or added | Check solution membership, Power Apps trigger, environment and access to underlying connections. |
| Flow runs but analysis is empty or invalid | Check prompt availability/capacity, flow run history and the exact input/output contracts from step 8. |
| Generated imports or choice types are missing | Add/refresh the affected sources; check generated paths and schema. Do not hand-edit generated files. |
| Queue is empty | Check requested return time, Pending/Confirmed status, active records, agreement links and selected date range. |
| Photos, signatures or final confirmation fail | Check image columns, autonumber, choice values, lookup privileges, record/column permissions and online status. Inspect the displayed error and persisted records before retrying. |
| Local app cannot use connectors | Use Local Play, the correct browser profile and consent. Check frontend/host ports and local-network permission. |
| Camera, video or dictation is unavailable | Check secure context, browser/client support and permissions on the actual device. Video alone does not satisfy asset photo analysis. |
| Published app seems out of date | Rebuild before `pa app push`; verify the returned app URL and binding. A Git push alone does not publish. |
| User can open the app but not complete a return | Check table/column privileges, flow run-only permissions, connection consent, licenses and policies separately. |

## Official documentation

- [Power Apps Code Apps documentation](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/)
- [Overview, environment enablement and licensing](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview)
- [Create, run and publish a Code App](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/create-an-app-from-scratch)
- [Connect to data](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-data)
- [Connect to Dataverse](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse)
- [Add Power Automate flows](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/add-flows)
- [CLI command reference](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/cli)
- [System configuration and public asset hosting](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/system-limits-configuration)

This guide documents setup; it does not require changing or deploying the
original demonstration app.
