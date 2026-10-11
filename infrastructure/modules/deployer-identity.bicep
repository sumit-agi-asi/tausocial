targetScope = 'resourceGroup'

param location string
param namePrefix string
param tags object
param githubOrganization string
param githubRepository string

resource deployerIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-deployer-uami'
  location: location
  tags: tags
}

resource stagingFederatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployerIdentity
  name: 'github-staging'
  properties: {
    audiences: [
      'api://AzureADTokenExchange'
    ]
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubOrganization}/${githubRepository}:environment:staging'
  }
}

resource productionFederatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployerIdentity
  name: 'github-production'
  properties: {
    audiences: [
      'api://AzureADTokenExchange'
    ]
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubOrganization}/${githubRepository}:environment:production'
  }
}

output deployerIdentityClientId string = deployerIdentity.properties.clientId
output deployerIdentityName string = deployerIdentity.name
