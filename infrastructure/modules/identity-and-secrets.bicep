targetScope = 'resourceGroup'

param location string
param namePrefix string
param tenantId string
param tags object
param keyVaultSkuName string
@secure()
param postgresAdminPassword string
@secure()
param databaseUrlSecretValue string
@secure()
param jwtSecretValue string

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-uami'
  location: location
  tags: tags
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${namePrefix}-kv'
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    enableRbacAuthorization: true
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    sku: {
      family: 'A'
      name: keyVaultSkuName
    }
    softDeleteRetentionInDays: 90
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource postgresAdminPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'postgres-admin-password'
  parent: keyVault
  properties: {
    value: postgresAdminPassword
  }
}

resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'database-url'
  parent: keyVault
  properties: {
    value: databaseUrlSecretValue
  }
}

resource jwtSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: 'jwt-secret'
  parent: keyVault
  properties: {
    value: jwtSecretValue
  }
}

output keyVaultName string = keyVault.name
output keyVaultResourceId string = keyVault.id
output managedIdentityName string = managedIdentity.name
output managedIdentityPrincipalId string = managedIdentity.properties.principalId
output managedIdentityResourceId string = managedIdentity.id
output keyVaultSecretUris object = {
  postgresAdminPassword: postgresAdminPasswordSecret.properties.secretUri
  databaseUrl: databaseUrlSecret.properties.secretUri
  jwtSecret: jwtSecret.properties.secretUri
}
