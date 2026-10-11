targetScope = 'resourceGroup'

@description('Azure subscription identifier used for tagging, documentation, and deterministic role assignment scopes.')
param subscriptionId string

@description('Azure tenant identifier for Key Vault, PostgreSQL Entra configuration, and documentation.')
param tenantId string

@description('Resource group name used for deployment documentation and tagging.')
param resourceGroupName string

@description('Short environment name such as staging or production.')
param environmentName string

@description('Azure region for all resources unless the resource type enforces a global location.')
param location string = resourceGroup().location

@minLength(3)
@description('Prefix used to derive resource names.')
param namePrefix string

@description('GitHub organization that owns the repository permitted to deploy.')
param githubOrganization string

@description('GitHub repository permitted to deploy.')
param githubRepository string

@description('Optional tags applied to supported resources.')
param tags object = {}

@description('Azure Front Door SKU.')
param frontDoorSku string = 'Standard_AzureFrontDoor'

@description('Set to true to configure a Front Door custom domain.')
param enableCustomDomain bool = false

@description('Optional Front Door custom domain host name.')
param customDomain string = ''

@description('Container image for the API app, including registry and tag.')
param apiImage string

@description('Container image for the web app, including registry and tag.')
param webImage string

@description('Application log level for both apps.')
param logLevel string = 'info'

@description('CORS origins passed to the API container app.')
param corsOrigins string

@description('Container Apps min replicas for the API app.')
param apiMinReplicas int = 1

@description('Container Apps max replicas for the API app.')
param apiMaxReplicas int = 3

@description('Container Apps min replicas for the web app.')
param webMinReplicas int = 1

@description('Container Apps max replicas for the web app.')
param webMaxReplicas int = 3

@description('Log Analytics SKU.')
param logAnalyticsSku string = 'PerGB2018'

@description('Application Insights application type.')
param appInsightsApplicationType string = 'web'

@description('Key Vault SKU name.')
param keyVaultSkuName string = 'standard'

@description('PostgreSQL Flexible Server SKU name.')
param postgresSkuName string

@description('PostgreSQL major version.')
param postgresVersion string = '16'

@description('PostgreSQL storage size in GiB.')
param postgresStorageSizeGb int = 128

@description('PostgreSQL backup retention in days.')
param postgresBackupRetentionDays int = 7

@description('PostgreSQL availability zone. Leave empty to let Azure choose.')
param postgresZone string = ''

@description('PostgreSQL administrator login when password authentication is enabled.')
param postgresAdminLogin string

@secure()
@description('PostgreSQL administrator password.')
param postgresAdminPassword string

@description('Enable PostgreSQL password authentication.')
param enablePostgresPasswordAuth bool = true

@description('Enable Microsoft Entra authentication for PostgreSQL.')
param enablePostgresEntraAuth bool = true

@description('Optional PostgreSQL Entra administrator object id.')
param postgresEntraAdminObjectId string = ''

@description('Optional PostgreSQL Entra administrator principal name.')
param postgresEntraAdminPrincipalName string = ''

@allowed([
  'User'
  'Group'
  'ServicePrincipal'
])
@description('Principal type for the PostgreSQL Entra administrator.')
param postgresEntraAdminPrincipalType string = 'Group'

@description('Set to true to create the AllowAllAzureServicesAndResourcesWithinAzureIps firewall rule.')
param allowAzureServicesToPostgres bool = true

@description('Additional PostgreSQL firewall rules.')
param postgresFirewallRules array = []

@description('Storage account SKU.')
param storageSkuName string = 'Standard_LRS'

@description('Storage account access tier.')
param storageAccessTier string = 'Hot'

@description('Container Registry SKU.')
param acrSkuName string = 'Basic'

@description('Container Apps workload profile name.')
param containerAppsWorkloadProfileName string = 'Consumption'

@secure()
@description('Key Vault secret value stored as database-url and injected into the API container app as DATABASE_URL.')
param databaseUrlSecretValue string

@secure()
@description('Key Vault secret value stored as jwt-secret and injected into the API container app as JWT_SECRET.')
param jwtSecretValue string

var baseName = toLower('${namePrefix}-${environmentName}')
var blobContainerName = 'media'
var postgresDatabaseName = 'tausocial'
var resourceTags = union(tags, {
  environment: environmentName
  resourceGroupName: resourceGroupName
  subscriptionId: subscriptionId
  managedBy: 'bicep'
  workload: 'tausocial'
})

module observability 'modules/observability.bicep' = {
  name: 'observability-${environmentName}'
  params: {
    location: location
    namePrefix: baseName
    tags: resourceTags
    logAnalyticsSku: logAnalyticsSku
    appInsightsApplicationType: appInsightsApplicationType
  }
}

module identityAndSecrets 'modules/identity-and-secrets.bicep' = {
  name: 'identity-secrets-${environmentName}'
  params: {
    location: location
    namePrefix: baseName
    tenantId: tenantId
    tags: resourceTags
    keyVaultSkuName: keyVaultSkuName
    postgresAdminPassword: postgresAdminPassword
    databaseUrlSecretValue: databaseUrlSecretValue
    jwtSecretValue: jwtSecretValue
  }
}

module deployerIdentity 'modules/deployer-identity.bicep' = {
  name: 'deployer-identity-${environmentName}'
  params: {
    location: location
    namePrefix: baseName
    tags: resourceTags
    githubOrganization: githubOrganization
    githubRepository: githubRepository
  }
}

module data 'modules/data.bicep' = {
  name: 'data-${environmentName}'
  params: {
    location: location
    namePrefix: baseName
    tags: resourceTags
    postgresSkuName: postgresSkuName
    postgresVersion: postgresVersion
    postgresStorageSizeGb: postgresStorageSizeGb
    postgresBackupRetentionDays: postgresBackupRetentionDays
    postgresZone: postgresZone
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    enablePostgresPasswordAuth: enablePostgresPasswordAuth
    enablePostgresEntraAuth: enablePostgresEntraAuth
    tenantId: tenantId
    postgresEntraAdminObjectId: postgresEntraAdminObjectId
    postgresEntraAdminPrincipalName: postgresEntraAdminPrincipalName
    postgresEntraAdminPrincipalType: postgresEntraAdminPrincipalType
    allowAzureServicesToPostgres: allowAzureServicesToPostgres
    postgresFirewallRules: postgresFirewallRules
    postgresDatabaseName: postgresDatabaseName
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage-${environmentName}'
  params: {
    location: location
    namePrefix: baseName
    tags: resourceTags
    storageSkuName: storageSkuName
    storageAccessTier: storageAccessTier
    blobContainerName: blobContainerName
  }
}

module registry 'modules/registry.bicep' = {
  name: 'registry-${environmentName}'
  params: {
    location: location
    namePrefix: baseName
    tags: resourceTags
    acrSkuName: acrSkuName
  }
}

module containerApps 'modules/container-apps.bicep' = {
  name: 'container-apps-${environmentName}'
  params: {
    location: location
    namePrefix: baseName
    tags: resourceTags
    managedIdentityResourceId: identityAndSecrets.outputs.managedIdentityResourceId
    containerRegistryLoginServer: registry.outputs.registryLoginServer
    logAnalyticsWorkspaceCustomerId: observability.outputs.logAnalyticsWorkspaceCustomerId
    logAnalyticsWorkspaceSharedKey: observability.outputs.logAnalyticsWorkspaceSharedKey
    applicationInsightsConnectionString: observability.outputs.applicationInsightsConnectionString
    storageAccountName: storage.outputs.storageAccountName
    storageContainerName: blobContainerName
    keyVaultSecretUris: identityAndSecrets.outputs.keyVaultSecretUris
    apiImage: apiImage
    webImage: webImage
    logLevel: logLevel
    corsOrigins: corsOrigins
    apiMinReplicas: apiMinReplicas
    apiMaxReplicas: apiMaxReplicas
    webMinReplicas: webMinReplicas
    webMaxReplicas: webMaxReplicas
    containerAppsWorkloadProfileName: containerAppsWorkloadProfileName
  }
}


module roleAssignments 'modules/role-assignments.bicep' = {
  name: 'role-assignments-${environmentName}'
  params: {
    keyVaultName: identityAndSecrets.outputs.keyVaultName
    storageAccountName: storage.outputs.storageAccountName
    registryName: registry.outputs.registryName
    managedIdentityName: identityAndSecrets.outputs.managedIdentityName
    deployerIdentityName: deployerIdentity.outputs.deployerIdentityName
  }
}

module frontDoor 'modules/front-door.bicep' = {
  name: 'front-door-${environmentName}'
  params: {
    location: 'global'
    namePrefix: baseName
    tags: resourceTags
    frontDoorSku: frontDoorSku
    apiOriginHostName: containerApps.outputs.apiIngressFqdn
    webOriginHostName: containerApps.outputs.webIngressFqdn
    enableCustomDomain: enableCustomDomain
    customDomain: customDomain
  }
}

output applicationInsightsConnectionString string = observability.outputs.applicationInsightsConnectionString
output containerRegistryName string = registry.outputs.registryName
output deployerIdentityClientId string = deployerIdentity.outputs.deployerIdentityClientId
output frontDoorEndpointHostName string = frontDoor.outputs.frontDoorEndpointHostName
output keyVaultName string = identityAndSecrets.outputs.keyVaultName
output managedIdentityName string = identityAndSecrets.outputs.managedIdentityName
output postgresServerName string = data.outputs.postgresServerName
output storageAccountName string = storage.outputs.storageAccountName
