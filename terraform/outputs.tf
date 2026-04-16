output "static_web_app_url" {
  description = "The default URL of the Azure Static Web App"
  value       = "https://${azurerm_static_web_app.portal.default_host_name}"
}

output "static_web_app_api_key" {
  description = "Deployment token for GitHub Actions"
  value       = azurerm_static_web_app.portal.api_key
  sensitive   = true
}

output "storage_account_name" {
  value = azurerm_storage_account.main.name
}

output "storage_connection_string" {
  description = "Add to SWA app settings as STORAGE_CONNECTION_STRING"
  value       = azurerm_storage_account.main.primary_connection_string
  sensitive   = true
}

output "storage_table_name" {
  value = azurerm_storage_table.domain_codes.name
}

output "resource_group_name" {
  value = azurerm_resource_group.main.name
}