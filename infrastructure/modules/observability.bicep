targetScope = 'resourceGroup'

param location string
param namePrefix string
param tags object
param logAnalyticsSku string
param appInsightsApplicationType string

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-law'
  location: location
  tags: tags
  properties: {
    sku: {
      name: logAnalyticsSku
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appi'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: appInsightsApplicationType
    WorkspaceResourceId: workspace.id
    IngestionMode: 'LogAnalytics'
    DisableIpMasking: false
  }
}

output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString
output logAnalyticsWorkspaceCustomerId string = workspace.properties.customerId
output logAnalyticsWorkspaceSharedKey string = workspace.listKeys().primarySharedKey
output logAnalyticsWorkspaceName string = workspace.name
output logAnalyticsWorkspaceResourceId string = workspace.id
