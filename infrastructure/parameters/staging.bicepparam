using '../main.bicep'

param subscriptionId = readEnvironmentVariable('TAUSOCIAL_STAGING_AZURE_SUBSCRIPTION_ID', '<AZURE_SUBSCRIPTION_ID_PLACEHOLDER>')
param tenantId = readEnvironmentVariable('TAUSOCIAL_STAGING_AZURE_TENANT_ID', '<AZURE_TENANT_ID_PLACEHOLDER>')
param resourceGroupName = readEnvironmentVariable('TAUSOCIAL_STAGING_RESOURCE_GROUP_NAME', '<RESOURCE_GROUP_NAME_PLACEHOLDER>')
param environmentName = 'staging'
param location = readEnvironmentVariable('TAUSOCIAL_STAGING_LOCATION', '<AZURE_LOCATION_PLACEHOLDER>')
param namePrefix = readEnvironmentVariable('TAUSOCIAL_STAGING_NAME_PREFIX', '<NAME_PREFIX_PLACEHOLDER>')
param tags = {
  costCenter: readEnvironmentVariable('TAUSOCIAL_STAGING_COST_CENTER', '<COST_CENTER_PLACEHOLDER>')
  owner: readEnvironmentVariable('TAUSOCIAL_STAGING_OWNER', '<OWNER_PLACEHOLDER>')
}
param frontDoorSku = readEnvironmentVariable('TAUSOCIAL_STAGING_FRONTDOOR_SKU', '<FRONTDOOR_SKU_PLACEHOLDER>')
param enableCustomDomain = false
param customDomain = readEnvironmentVariable('TAUSOCIAL_STAGING_CUSTOM_DOMAIN', '<CUSTOM_DOMAIN_PLACEHOLDER>')
param apiImage = readEnvironmentVariable('TAUSOCIAL_STAGING_API_IMAGE', '<API_IMAGE_PLACEHOLDER>')
param webImage = readEnvironmentVariable('TAUSOCIAL_STAGING_WEB_IMAGE', '<WEB_IMAGE_PLACEHOLDER>')
param logLevel = readEnvironmentVariable('TAUSOCIAL_STAGING_LOG_LEVEL', '<LOG_LEVEL_PLACEHOLDER>')
param corsOrigins = readEnvironmentVariable('TAUSOCIAL_STAGING_CORS_ORIGINS', '<CORS_ORIGINS_PLACEHOLDER>')
param apiMinReplicas = 1
param apiMaxReplicas = 2
param webMinReplicas = 1
param webMaxReplicas = 2
param logAnalyticsSku = readEnvironmentVariable('TAUSOCIAL_STAGING_LOG_ANALYTICS_SKU', '<LOG_ANALYTICS_SKU_PLACEHOLDER>')
param appInsightsApplicationType = readEnvironmentVariable('TAUSOCIAL_STAGING_APPINSIGHTS_TYPE', '<APPINSIGHTS_APPLICATION_TYPE_PLACEHOLDER>')
param keyVaultSkuName = readEnvironmentVariable('TAUSOCIAL_STAGING_KEYVAULT_SKU', '<KEYVAULT_SKU_PLACEHOLDER>')
param postgresSkuName = readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_SKU', '<POSTGRES_SKU_PLACEHOLDER>')
param postgresVersion = readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_VERSION', '<POSTGRES_VERSION_PLACEHOLDER>')
param postgresStorageSizeGb = int(readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_STORAGE_GB', '128'))
param postgresBackupRetentionDays = int(readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_BACKUP_RETENTION_DAYS', '7'))
param postgresZone = readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_ZONE', '<POSTGRES_ZONE_PLACEHOLDER>')
param postgresAdminLogin = readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_ADMIN_LOGIN', '<POSTGRES_ADMIN_LOGIN_PLACEHOLDER>')
param postgresAdminPassword = readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_ADMIN_PASSWORD', '<POSTGRES_ADMIN_PASSWORD_PLACEHOLDER>')
param enablePostgresPasswordAuth = true
param enablePostgresEntraAuth = true
param postgresEntraAdminObjectId = readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_ENTRA_ADMIN_OBJECT_ID', '<POSTGRES_ENTRA_ADMIN_OBJECT_ID_PLACEHOLDER>')
param postgresEntraAdminPrincipalName = readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_ENTRA_ADMIN_PRINCIPAL_NAME', '<POSTGRES_ENTRA_ADMIN_PRINCIPAL_NAME_PLACEHOLDER>')
param postgresEntraAdminPrincipalType = readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_ENTRA_ADMIN_PRINCIPAL_TYPE', 'Group')
param allowAzureServicesToPostgres = true
param postgresFirewallRules = [
  {
    name: 'office-ip'
    startIpAddress: readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_FIREWALL_START_IP', '<POSTGRES_FIREWALL_START_IP_PLACEHOLDER>')
    endIpAddress: readEnvironmentVariable('TAUSOCIAL_STAGING_POSTGRES_FIREWALL_END_IP', '<POSTGRES_FIREWALL_END_IP_PLACEHOLDER>')
  }
]
param storageSkuName = readEnvironmentVariable('TAUSOCIAL_STAGING_STORAGE_SKU', '<STORAGE_SKU_PLACEHOLDER>')
param storageAccessTier = readEnvironmentVariable('TAUSOCIAL_STAGING_STORAGE_ACCESS_TIER', '<STORAGE_ACCESS_TIER_PLACEHOLDER>')
param acrSkuName = readEnvironmentVariable('TAUSOCIAL_STAGING_ACR_SKU', '<ACR_SKU_PLACEHOLDER>')
param containerAppsWorkloadProfileName = readEnvironmentVariable('TAUSOCIAL_STAGING_CONTAINERAPPS_WORKLOAD_PROFILE', '<CONTAINERAPPS_WORKLOAD_PROFILE_PLACEHOLDER>')
param databaseUrlSecretValue = readEnvironmentVariable('TAUSOCIAL_STAGING_DATABASE_URL', '<DATABASE_URL_SECRET_PLACEHOLDER>')
param jwtSecretValue = readEnvironmentVariable('TAUSOCIAL_STAGING_JWT_SECRET', '<JWT_SECRET_PLACEHOLDER>')
