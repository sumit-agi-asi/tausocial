# TauSocial Azure infrastructure (Bicep)

This directory defines a resource-group-scoped Azure deployment for TauSocial using Bicep. It provisions shared observability, identity, secrets, data, storage, container hosting, and edge routing for the API (`apps/server`, port `4000`) and web (`apps/web`, port `8080`) workloads.

## Architecture

`main.bicep` orchestrates these modules:

- **observability**: Log Analytics workspace + workspace-based Application Insights.
- **identity-and-secrets**: user-assigned managed identity, Key Vault with RBAC, purge protection, and secrets.
- **data**: Azure Database for PostgreSQL Flexible Server + `tausocial` database + optional Entra admin + firewall rules.
- **storage**: Storage account with a private `media` blob container, TLS 1.2, and public blob access disabled.
- **registry**: Azure Container Registry for app images.
- **container-apps**: Container Apps environment plus:
  - `api` on port `4000` with `/health/live` and `/health/ready` probes
  - `web` on port `8080`
- **deployer-identity**: creates the GitHub OIDC deployer UAMI and its `staging` and `production` environment federated credentials.
- **role-assignments**: grants the runtime managed identity `Key Vault Secrets User`, `Storage Blob Data Contributor`, and `AcrPull`, and grants the deployer UAMI `Contributor` on the resource group and `AcrPush` on the registry.
- **front-door**: Azure Front Door Standard/Premium profile, endpoint, API and web origin groups, `/api/*` route to the API app, and `/*` route to the web app, with optional custom domain.

Runtime secret flow:

1. Secure values enter via secure Bicep parameters sourced from environment variables.
2. Key Vault stores `postgres-admin-password`, `database-url`, and `jwt-secret`.
3. The shared user-assigned managed identity reads Key Vault secrets at runtime.
4. The API container app maps Key Vault secrets to `DATABASE_URL` and `JWT_SECRET`.

## Files

- `main.bicep`
- `bicepconfig.json`
- `modules/observability.bicep`
- `modules/identity-and-secrets.bicep`
- `modules/data.bicep`
- `modules/storage.bicep`
- `modules/registry.bicep`
- `modules/container-apps.bicep`
- `modules/role-assignments.bicep`
- `modules/front-door.bicep`
- `parameters/staging.bicepparam`
- `parameters/production.bicepparam`

## Placeholder catalog

All placeholders are intentionally invalid until replaced. For `.bicepparam` files, each value is wired through `readEnvironmentVariable(...)` so CI/CD can inject real values without editing committed files.

| Placeholder | Meaning | Example | Where used |
| --- | --- | --- | --- |
| `<AZURE_SUBSCRIPTION_ID_PLACEHOLDER>` | Azure subscription ID for tagging/documentation. | `00000000-0000-0000-0000-000000000000` | `subscriptionId` in both `.bicepparam` files -> `main.bicep` tags |
| `<AZURE_TENANT_ID_PLACEHOLDER>` | Microsoft Entra tenant ID. | `11111111-1111-1111-1111-111111111111` | `tenantId` in both `.bicepparam` files -> Key Vault and PostgreSQL Entra settings |
| `<RESOURCE_GROUP_NAME_PLACEHOLDER>` | Target resource group name for `az deployment group ...`. | `rg-tausocial-staging` | `resourceGroupName` in both `.bicepparam` files -> `main.bicep` tags and deployment commands |
| `<AZURE_LOCATION_PLACEHOLDER>` | Azure region for regional resources. | `eastus2` | `location` in both `.bicepparam` files -> all regional modules |
| `<NAME_PREFIX_PLACEHOLDER>` | Prefix used to derive resource names. | `tausoc` | `namePrefix` in both `.bicepparam` files -> all module resource names |
| `<COST_CENTER_PLACEHOLDER>` | Cost allocation tag value. | `eng-platform` | `tags.costCenter` in both `.bicepparam` files -> all tagged resources |
| `<OWNER_PLACEHOLDER>` | Ownership tag value. | `team-tausocial` | `tags.owner` in both `.bicepparam` files -> all tagged resources |
| `<FRONTDOOR_SKU_PLACEHOLDER>` | Front Door SKU. | `Standard_AzureFrontDoor` | `frontDoorSku` in both `.bicepparam` files -> `modules/front-door.bicep` |
| `<CUSTOM_DOMAIN_PLACEHOLDER>` | Optional Front Door custom domain. | `app.example.com` | `customDomain` in both `.bicepparam` files -> `modules/front-door.bicep` when `enableCustomDomain=true` |
| `<API_IMAGE_PLACEHOLDER>` | API container image URI. | `myacr.azurecr.io/tausocial-api:2026.10.11` | `apiImage` in both `.bicepparam` files -> `modules/container-apps.bicep` |
| `<WEB_IMAGE_PLACEHOLDER>` | Web container image URI. | `myacr.azurecr.io/tausocial-web:2026.10.11` | `webImage` in both `.bicepparam` files -> `modules/container-apps.bicep` |
| `<LOG_LEVEL_PLACEHOLDER>` | App log verbosity. | `info` | `logLevel` in both `.bicepparam` files -> both container apps |
| `<CORS_ORIGINS_PLACEHOLDER>` | Allowed API CORS origins. | `https://app.example.com,https://staging.example.com` | `corsOrigins` in both `.bicepparam` files -> API container app env var |
| `<LOG_ANALYTICS_SKU_PLACEHOLDER>` | Log Analytics SKU. | `PerGB2018` | `logAnalyticsSku` in both `.bicepparam` files -> `modules/observability.bicep` |
| `<APPINSIGHTS_APPLICATION_TYPE_PLACEHOLDER>` | Application Insights application type. | `web` | `appInsightsApplicationType` in both `.bicepparam` files -> `modules/observability.bicep` |
| `<KEYVAULT_SKU_PLACEHOLDER>` | Key Vault SKU. | `standard` | `keyVaultSkuName` in both `.bicepparam` files -> `modules/identity-and-secrets.bicep` |
| `<POSTGRES_SKU_PLACEHOLDER>` | PostgreSQL Flexible Server SKU. | `Standard_D2ds_v5` | `postgresSkuName` in both `.bicepparam` files -> `modules/data.bicep` |
| `<POSTGRES_VERSION_PLACEHOLDER>` | PostgreSQL major version. | `16` | `postgresVersion` in both `.bicepparam` files -> `modules/data.bicep` |
| `<POSTGRES_ZONE_PLACEHOLDER>` | Optional availability zone. | `1` | `postgresZone` in both `.bicepparam` files -> `modules/data.bicep` |
| `<POSTGRES_ADMIN_LOGIN_PLACEHOLDER>` | PostgreSQL admin login name. | `tausocial_admin` | `postgresAdminLogin` in both `.bicepparam` files -> `modules/data.bicep` |
| `<POSTGRES_ADMIN_PASSWORD_PLACEHOLDER>` | PostgreSQL admin password (secure). | `Use-A-Secret-From-CI` | `postgresAdminPassword` in both `.bicepparam` files -> PostgreSQL server + Key Vault `postgres-admin-password` secret |
| `<POSTGRES_ENTRA_ADMIN_OBJECT_ID_PLACEHOLDER>` | Entra object ID for optional PostgreSQL Entra admin. | `22222222-2222-2222-2222-222222222222` | `postgresEntraAdminObjectId` in both `.bicepparam` files -> `modules/data.bicep` |
| `<POSTGRES_ENTRA_ADMIN_PRINCIPAL_NAME_PLACEHOLDER>` | Display or sign-in name for the PostgreSQL Entra admin. | `DBA Team` | `postgresEntraAdminPrincipalName` in both `.bicepparam` files -> `modules/data.bicep` |
| `<POSTGRES_FIREWALL_START_IP_PLACEHOLDER>` | Start IP for an additional PostgreSQL firewall rule. | `203.0.113.10` | `postgresFirewallRules[0].startIpAddress` in both `.bicepparam` files -> `modules/data.bicep` |
| `<POSTGRES_FIREWALL_END_IP_PLACEHOLDER>` | End IP for an additional PostgreSQL firewall rule. | `203.0.113.10` | `postgresFirewallRules[0].endIpAddress` in both `.bicepparam` files -> `modules/data.bicep` |
| `<STORAGE_SKU_PLACEHOLDER>` | Storage account SKU. | `Standard_LRS` | `storageSkuName` in both `.bicepparam` files -> `modules/storage.bicep` |
| `<STORAGE_ACCESS_TIER_PLACEHOLDER>` | Storage account access tier. | `Hot` | `storageAccessTier` in both `.bicepparam` files -> `modules/storage.bicep` |
| `<ACR_SKU_PLACEHOLDER>` | Azure Container Registry SKU. | `Basic` | `acrSkuName` in both `.bicepparam` files -> `modules/registry.bicep` |
| `<CONTAINERAPPS_WORKLOAD_PROFILE_PLACEHOLDER>` | Container Apps workload profile name. | `Consumption` | `containerAppsWorkloadProfileName` in both `.bicepparam` files -> `modules/container-apps.bicep` |
| `<DATABASE_URL_SECRET_PLACEHOLDER>` | Full application database URL stored in Key Vault (secure). | `******server.postgres.database.azure.com:5432/tausocial?sslmode=require` | `databaseUrlSecretValue` in both `.bicepparam` files -> Key Vault `database-url` secret -> API `DATABASE_URL` |
| `<JWT_SECRET_PLACEHOLDER>` | JWT signing secret stored in Key Vault (secure). | `super-long-random-secret` | `jwtSecretValue` in both `.bicepparam` files -> Key Vault `jwt-secret` secret -> API `JWT_SECRET` |

## Deployment

Staging:

```bash
export TAUSOCIAL_STAGING_AZURE_SUBSCRIPTION_ID='...'
export TAUSOCIAL_STAGING_AZURE_TENANT_ID='...'
export TAUSOCIAL_STAGING_RESOURCE_GROUP_NAME='rg-tausocial-staging'
# ...set the remaining TAUSOCIAL_STAGING_* values used by parameters/staging.bicepparam

az account set --subscription "$TAUSOCIAL_STAGING_AZURE_SUBSCRIPTION_ID"
az deployment group what-if \
  --resource-group "$TAUSOCIAL_STAGING_RESOURCE_GROUP_NAME" \
  --parameters infrastructure/parameters/staging.bicepparam

az deployment group create \
  --resource-group "$TAUSOCIAL_STAGING_RESOURCE_GROUP_NAME" \
  --parameters infrastructure/parameters/staging.bicepparam
```

Production:

```bash
export TAUSOCIAL_PRODUCTION_AZURE_SUBSCRIPTION_ID='...'
export TAUSOCIAL_PRODUCTION_AZURE_TENANT_ID='...'
export TAUSOCIAL_PRODUCTION_RESOURCE_GROUP_NAME='rg-tausocial-production'
# ...set the remaining TAUSOCIAL_PRODUCTION_* values used by parameters/production.bicepparam

az account set --subscription "$TAUSOCIAL_PRODUCTION_AZURE_SUBSCRIPTION_ID"
az deployment group what-if \
  --resource-group "$TAUSOCIAL_PRODUCTION_RESOURCE_GROUP_NAME" \
  --parameters infrastructure/parameters/production.bicepparam

az deployment group create \
  --resource-group "$TAUSOCIAL_PRODUCTION_RESOURCE_GROUP_NAME" \
  --parameters infrastructure/parameters/production.bicepparam
```

## Bootstrap the GitHub deployer UAMI

The deployer UAMI is part of this deployment, so a principal with permission to create identities and role assignments must run the first deployment. This prevents a deployment identity from needing to exist before Bicep creates it.

1. Set `TAUSOCIAL_GITHUB_ORGANIZATION` and `TAUSOCIAL_GITHUB_REPOSITORY` before the initial staging and production deployments.
2. Deploy each resource group once using a bootstrap principal with `Contributor` and `User Access Administrator` on that resource group.
3. Read the `deployerIdentityClientId` deployment output for each environment. Grant that UAMI `User Access Administrator` on its resource group; this is required because subsequent deployments manage the runtime identity's RBAC assignments.
4. Set the matching GitHub environment's `AZURE_UAMI_CLIENT_ID` variable to that client ID. The template creates credentials with issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and subjects `repo:<organization>/<repository>:environment:staging` and `repo:<organization>/<repository>:environment:production`.
5. Remove the obsolete `AZURE_CLIENT_ID` secret after both environments use the UAMI.

## Secrets handling

- No secret values are hardcoded in Bicep or in the committed `.bicepparam` files.
- Secure parameters are sourced with `readEnvironmentVariable(...)` and should come from CI/CD secret storage.
- The template writes secure values into Key Vault as:
  - `postgres-admin-password`
  - `database-url`
  - `jwt-secret`
- The shared user-assigned managed identity receives `Key Vault Secrets User` and is referenced by the API Container App for Key Vault-backed secrets.
- `DATABASE_URL` and `JWT_SECRET` are injected into the API app via Key Vault references, not plain-text container app secrets in source control.

## Validation

Run these before opening a PR or deploying:

```bash
bicep build infrastructure/main.bicep
bicep lint infrastructure/main.bicep
bicep build-params infrastructure/parameters/staging.bicepparam --stdout >/dev/null
bicep build-params infrastructure/parameters/production.bicepparam --stdout >/dev/null
```

The working validation commands used for this implementation were:

```bash
bicep build infrastructure/main.bicep --stdout >/dev/null
bicep build-params infrastructure/parameters/staging.bicepparam --stdout >/dev/null
bicep build-params infrastructure/parameters/production.bicepparam --stdout >/dev/null
bicep lint infrastructure/main.bicep
```


## CI/CD OIDC setup

`deploy.yml` expects GitHub **environment-scoped** configuration for both `staging` and `production`.

### Required GitHub environment secrets

- `TAUSOCIAL_STAGING_POSTGRES_ADMIN_PASSWORD`
- `TAUSOCIAL_STAGING_DATABASE_URL`
- `TAUSOCIAL_STAGING_JWT_SECRET`
- `TAUSOCIAL_PRODUCTION_POSTGRES_ADMIN_PASSWORD`
- `TAUSOCIAL_PRODUCTION_DATABASE_URL`
- `TAUSOCIAL_PRODUCTION_JWT_SECRET`

### Required GitHub environment variables

Shared Azure/auth and registry variables:

- `AZURE_UAMI_CLIENT_ID` (the `deployerIdentityClientId` output for that environment)
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `ACR_NAME`
- `ACR_LOGIN_SERVER`
- `RESOURCE_GROUP_NAME`
- `TAUSOCIAL_GITHUB_ORGANIZATION` (for example, `sumit-agi-asi`)
- `TAUSOCIAL_GITHUB_REPOSITORY` (for example, `tausocial`)

Staging deployment variables:

- `TAUSOCIAL_STAGING_LOCATION`
- `TAUSOCIAL_STAGING_NAME_PREFIX`
- `TAUSOCIAL_STAGING_COST_CENTER`
- `TAUSOCIAL_STAGING_OWNER`
- `TAUSOCIAL_STAGING_FRONTDOOR_SKU`
- `TAUSOCIAL_STAGING_CUSTOM_DOMAIN`
- `TAUSOCIAL_STAGING_LOG_LEVEL`
- `TAUSOCIAL_STAGING_CORS_ORIGINS`
- `TAUSOCIAL_STAGING_LOG_ANALYTICS_SKU`
- `TAUSOCIAL_STAGING_APPINSIGHTS_TYPE`
- `TAUSOCIAL_STAGING_KEYVAULT_SKU`
- `TAUSOCIAL_STAGING_POSTGRES_SKU`
- `TAUSOCIAL_STAGING_POSTGRES_VERSION`
- `TAUSOCIAL_STAGING_POSTGRES_STORAGE_GB`
- `TAUSOCIAL_STAGING_POSTGRES_BACKUP_RETENTION_DAYS`
- `TAUSOCIAL_STAGING_POSTGRES_ZONE`
- `TAUSOCIAL_STAGING_POSTGRES_ADMIN_LOGIN`
- `TAUSOCIAL_STAGING_POSTGRES_ENTRA_ADMIN_OBJECT_ID`
- `TAUSOCIAL_STAGING_POSTGRES_ENTRA_ADMIN_PRINCIPAL_NAME`
- `TAUSOCIAL_STAGING_POSTGRES_ENTRA_ADMIN_PRINCIPAL_TYPE`
- `TAUSOCIAL_STAGING_POSTGRES_FIREWALL_START_IP`
- `TAUSOCIAL_STAGING_POSTGRES_FIREWALL_END_IP`
- `TAUSOCIAL_STAGING_STORAGE_SKU`
- `TAUSOCIAL_STAGING_STORAGE_ACCESS_TIER`
- `TAUSOCIAL_STAGING_ACR_SKU`
- `TAUSOCIAL_STAGING_CONTAINERAPPS_WORKLOAD_PROFILE`
- `STAGING_WEB_URL`
- `STAGING_API_BASE_URL`

Production deployment variables:

- `TAUSOCIAL_PRODUCTION_LOCATION`
- `TAUSOCIAL_PRODUCTION_NAME_PREFIX`
- `TAUSOCIAL_PRODUCTION_COST_CENTER`
- `TAUSOCIAL_PRODUCTION_OWNER`
- `TAUSOCIAL_PRODUCTION_FRONTDOOR_SKU`
- `TAUSOCIAL_PRODUCTION_CUSTOM_DOMAIN`
- `TAUSOCIAL_PRODUCTION_LOG_LEVEL`
- `TAUSOCIAL_PRODUCTION_CORS_ORIGINS`
- `TAUSOCIAL_PRODUCTION_LOG_ANALYTICS_SKU`
- `TAUSOCIAL_PRODUCTION_APPINSIGHTS_TYPE`
- `TAUSOCIAL_PRODUCTION_KEYVAULT_SKU`
- `TAUSOCIAL_PRODUCTION_POSTGRES_SKU`
- `TAUSOCIAL_PRODUCTION_POSTGRES_VERSION`
- `TAUSOCIAL_PRODUCTION_POSTGRES_STORAGE_GB`
- `TAUSOCIAL_PRODUCTION_POSTGRES_BACKUP_RETENTION_DAYS`
- `TAUSOCIAL_PRODUCTION_POSTGRES_ZONE`
- `TAUSOCIAL_PRODUCTION_POSTGRES_ADMIN_LOGIN`
- `TAUSOCIAL_PRODUCTION_POSTGRES_ENTRA_ADMIN_OBJECT_ID`
- `TAUSOCIAL_PRODUCTION_POSTGRES_ENTRA_ADMIN_PRINCIPAL_NAME`
- `TAUSOCIAL_PRODUCTION_POSTGRES_ENTRA_ADMIN_PRINCIPAL_TYPE`
- `TAUSOCIAL_PRODUCTION_POSTGRES_FIREWALL_START_IP`
- `TAUSOCIAL_PRODUCTION_POSTGRES_FIREWALL_END_IP`
- `TAUSOCIAL_PRODUCTION_STORAGE_SKU`
- `TAUSOCIAL_PRODUCTION_STORAGE_ACCESS_TIER`
- `TAUSOCIAL_PRODUCTION_ACR_SKU`
- `TAUSOCIAL_PRODUCTION_CONTAINERAPPS_WORKLOAD_PROFILE`
- `PRODUCTION_WEB_URL`
- `PRODUCTION_API_BASE_URL`
