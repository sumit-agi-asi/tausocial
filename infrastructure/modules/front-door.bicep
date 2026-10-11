targetScope = 'resourceGroup'

param location string
param namePrefix string
param tags object
param frontDoorSku string
param apiOriginHostName string
param webOriginHostName string
param enableCustomDomain bool
param customDomain string

resource profile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: '${namePrefix}-afd'
  location: location
  tags: tags
  sku: {
    name: frontDoorSku
  }
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  name: '${namePrefix}-ep'
  parent: profile
  location: location
  tags: tags
  properties: {
    enabledState: 'Enabled'
  }
}

resource apiOriginGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  name: 'api-og'
  parent: profile
  properties: {
    healthProbeSettings: {
      probePath: '/health/ready'
      probeProtocol: 'Https'
      probeRequestType: 'GET'
      probeIntervalInSeconds: 120
    }
    loadBalancingSettings: {
      additionalLatencyInMilliseconds: 0
      sampleSize: 4
      successfulSamplesRequired: 3
    }
    sessionAffinityState: 'Disabled'
  }
}

resource webOriginGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  name: 'web-og'
  parent: profile
  properties: {
    healthProbeSettings: {
      probePath: '/'
      probeProtocol: 'Https'
      probeRequestType: 'HEAD'
      probeIntervalInSeconds: 120
    }
    loadBalancingSettings: {
      additionalLatencyInMilliseconds: 0
      sampleSize: 4
      successfulSamplesRequired: 3
    }
    sessionAffinityState: 'Disabled'
  }
}

resource apiOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  name: 'api-origin'
  parent: apiOriginGroup
  properties: {
    hostName: apiOriginHostName
    httpsPort: 443
    originHostHeader: apiOriginHostName
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

resource webOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  name: 'web-origin'
  parent: webOriginGroup
  properties: {
    hostName: webOriginHostName
    httpsPort: 443
    originHostHeader: webOriginHostName
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

resource customDomainResource 'Microsoft.Cdn/profiles/customDomains@2024-02-01' = if (enableCustomDomain) {
  name: 'app-domain'
  parent: profile
  properties: {
    hostName: customDomain
    tlsSettings: {
      certificateType: 'ManagedCertificate'
      minimumTlsVersion: 'TLS12'
    }
  }
}

resource apiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  name: 'api-route'
  parent: endpoint
  dependsOn: [
    apiOrigin
  ]
  properties: {
    originGroup: {
      id: apiOriginGroup.id
    }
    supportedProtocols: [
      'Http'
      'Https'
    ]
    patternsToMatch: [
      '/api/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    httpsRedirect: 'Enabled'
    linkToDefaultDomain: 'Enabled'
    enabledState: 'Enabled'
    customDomains: enableCustomDomain ? [
      {
        id: customDomainResource.id
      }
    ] : []
  }
}

resource webRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  name: 'web-route'
  parent: endpoint
  dependsOn: [
    webOrigin
  ]
  properties: {
    originGroup: {
      id: webOriginGroup.id
    }
    supportedProtocols: [
      'Http'
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    httpsRedirect: 'Enabled'
    linkToDefaultDomain: 'Enabled'
    enabledState: 'Enabled'
    customDomains: enableCustomDomain ? [
      {
        id: customDomainResource.id
      }
    ] : []
  }
}

output frontDoorEndpointHostName string = endpoint.properties.hostName
output frontDoorProfileName string = profile.name
