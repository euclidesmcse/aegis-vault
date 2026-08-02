terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "azurerm" {
    # Configure remote state via:
    #   terraform init -backend-config=backend.tfvars
    #
    # resource_group_name  = "aegis-vault-tfstate"
    # storage_account_name = "aegistfstate"
    # container_name       = "tfstate"
    # key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}

  # Subscription: az account set --subscription "your-sub-id"
  # environment     = "public"   # public | usgovernment | german | china
  # subscription_id = var.subscription_id
}
