terraform {
  required_version = ">= 1.3.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90"
    }
  }
}

provider "azurerm" {
  features {}
  tenant_id       = var.tenant_id
  subscription_id = var.subscription_id
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

resource "azurerm_storage_account" "main" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  tags                     = var.tags
}

resource "azurerm_storage_table" "domain_codes" {
  name                 = "domaincodes"
  storage_account_name = azurerm_storage_account.main.name
}

resource "azurerm_static_web_app" "portal" {
  name                = var.static_web_app_name
  resource_group_name = azurerm_resource_group.main.name
  location            = var.swa_location
  sku_tier            = "Standard"
  sku_size            = "Standard"
  tags                = var.tags
}