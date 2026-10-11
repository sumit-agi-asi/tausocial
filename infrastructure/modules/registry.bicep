targetScope = 'resourceGroup'

param location string
param namePrefix string
param tags object
param acrSkuName string

var registryBaseName = replace('${namePrefix}acr', '-', '')

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: length(registryBaseName) >= 5 ? take(registryBaseName, 50) : 'tausocialacrfallback01'
  location: location
  tags: tags
  sku: {
    name: acrSkuName
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
  }
}

output registryName string = registry.name
output registryResourceId string = registry.id
output registryLoginServer string = registry.properties.loginServer
