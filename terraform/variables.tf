variable "tenant_id" {
  description = "Azure AD Tenant ID"
  type        = string
}

variable "subscription_id" {
  description = "Azure Subscription ID"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "rg-domain-portal"
}

variable "location" {
  description = "Azure region for most resources"
  type        = string
  default     = "eastus2"
}

variable "swa_location" {
  description = "Azure region for Static Web App (limited availability: eastus2, centralus, westus2, westeurope, eastasia)"
  type        = string
  default     = "eastus2"
}

variable "storage_account_name" {
  description = "Storage account name (3-24 chars, lowercase alphanumeric only)"
  type        = string
  # Example: "stdomainportalXXXX" - must be globally unique
}

variable "static_web_app_name" {
  description = "Name of the Azure Static Web App"
  type        = string
  default     = "swa-domain-portal"
}

variable "custom_domain" {
  description = "Optional custom domain for the SWA (e.g. portal.yourcompany.com). Leave empty to skip."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to all resources"
  type        = map(string)
  default = {
    Environment = "Production"
    Project     = "DomainPortal"
    ManagedBy   = "Terraform"
  }
}
