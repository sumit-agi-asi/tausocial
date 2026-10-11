targetScope = 'resourceGroup'

param location string
param namePrefix string
param tags object
param postgresSkuName string
param postgresVersion string
param postgresStorageSizeGb int
param postgresBackupRetentionDays int
param postgresZone string
param postgresAdminLogin string
@secure()
param postgresAdminPassword string
param enablePostgresPasswordAuth bool
param enablePostgresEntraAuth bool
param tenantId string
param postgresEntraAdminObjectId string
param postgresEntraAdminPrincipalName string
param postgresEntraAdminPrincipalType string
param allowAzureServicesToPostgres bool
param postgresFirewallRules array
param postgresDatabaseName string

var useZone = !empty(postgresZone)
var createPostgresEntraAdmin = enablePostgresEntraAuth && !empty(postgresEntraAdminObjectId) && !empty(postgresEntraAdminPrincipalName)

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${namePrefix}-psql'
  location: location
  tags: tags
  sku: {
    name: postgresSkuName
    tier: contains(toLower(postgresSkuName), 'b_') ? 'Burstable' : contains(toLower(postgresSkuName), 'd_') ? 'GeneralPurpose' : 'MemoryOptimized'
  }
  properties: {
    version: postgresVersion
    availabilityZone: useZone ? postgresZone : null
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    backup: {
      backupRetentionDays: postgresBackupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    storage: {
      storageSizeGB: postgresStorageSizeGb
      autoGrow: 'Enabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    authConfig: {
      activeDirectoryAuth: enablePostgresEntraAuth ? 'Enabled' : 'Disabled'
      passwordAuth: enablePostgresPasswordAuth ? 'Enabled' : 'Disabled'
      tenantId: enablePostgresEntraAuth ? tenantId : null
    }
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  name: postgresDatabaseName
  parent: postgresServer
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource allowAzureServicesRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = if (allowAzureServicesToPostgres) {
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  parent: postgresServer
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource postgresFirewallRuleResources 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = [for rule in postgresFirewallRules: {
  name: rule.name
  parent: postgresServer
  properties: {
    startIpAddress: rule.startIpAddress
    endIpAddress: rule.endIpAddress
  }
}]

resource postgresEntraAdministrator 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2023-06-01-preview' = if (createPostgresEntraAdmin) {
  name: postgresEntraAdminObjectId
  parent: postgresServer
  properties: {
    principalName: postgresEntraAdminPrincipalName
    principalType: postgresEntraAdminPrincipalType
    tenantId: tenantId
  }
}

output postgresDatabaseName string = postgresDatabase.name
output postgresFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresServerName string = postgresServer.name
output postgresServerResourceId string = postgresServer.id
