targetScope = 'resourceGroup'

param location string
param namePrefix string
param tags object
param managedIdentityResourceId string
param containerRegistryLoginServer string
param logAnalyticsWorkspaceCustomerId string
@secure()
param logAnalyticsWorkspaceSharedKey string
param applicationInsightsConnectionString string
param storageAccountName string
param storageContainerName string
param keyVaultSecretUris object
param apiImage string
param webImage string
param logLevel string
param corsOrigins string
param apiMinReplicas int
param apiMaxReplicas int
param webMinReplicas int
param webMaxReplicas int
param containerAppsWorkloadProfileName string

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-cae'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspaceCustomerId
        sharedKey: logAnalyticsWorkspaceSharedKey
      }
    }
    workloadProfiles: [
      {
        name: containerAppsWorkloadProfileName
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-api'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        allowInsecure: false
        external: true
        targetPort: 4000
        transport: 'auto'
      }
      registries: [
        {
          identity: managedIdentityResourceId
          server: containerRegistryLoginServer
        }
      ]
      secrets: [
        {
          name: 'database-url'
          identity: managedIdentityResourceId
          keyVaultUrl: keyVaultSecretUris.databaseUrl
        }
        {
          name: 'jwt-secret'
          identity: managedIdentityResourceId
          keyVaultUrl: keyVaultSecretUris.jwtSecret
        }
      ]
    }
    template: {
      scale: {
        minReplicas: apiMinReplicas
        maxReplicas: apiMaxReplicas
      }
      containers: [
        {
          name: 'api'
          image: apiImage
          resources: {
            cpu: 1
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '4000'
            }
            {
              name: 'LOG_LEVEL'
              value: logLevel
            }
            {
              name: 'CORS_ORIGINS'
              value: corsOrigins
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: applicationInsightsConnectionString
            }
            {
              name: 'AZURE_STORAGE_ACCOUNT_NAME'
              value: storageAccountName
            }
            {
              name: 'AZURE_STORAGE_CONTAINER'
              value: storageContainerName
            }
            {
              name: 'DATABASE_SSL'
              value: 'true'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health/live'
                port: 4000
              }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health/ready'
                port: 4000
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
    }
  }
}

resource webApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-web'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        allowInsecure: false
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          identity: managedIdentityResourceId
          server: containerRegistryLoginServer
        }
      ]
    }
    template: {
      scale: {
        minReplicas: webMinReplicas
        maxReplicas: webMaxReplicas
      }
      containers: [
        {
          name: 'web'
          image: webImage
          resources: {
            cpu: 1
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'LOG_LEVEL'
              value: logLevel
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: applicationInsightsConnectionString
            }
            {
              name: 'AZURE_STORAGE_ACCOUNT_NAME'
              value: storageAccountName
            }
            {
              name: 'AZURE_STORAGE_CONTAINER'
              value: storageContainerName
            }
            {
              name: 'DATABASE_SSL'
              value: 'true'
            }
          ]
        }
      ]
    }
  }
}

output apiContainerAppName string = apiApp.name
output apiIngressFqdn string = apiApp.properties.configuration.ingress.fqdn
output webContainerAppName string = webApp.name
output webIngressFqdn string = webApp.properties.configuration.ingress.fqdn
output containerAppsEnvironmentResourceId string = environment.id
