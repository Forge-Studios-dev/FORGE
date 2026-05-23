terraform {
  required_version = ">= 1.5.0"
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 3.0"
    }
  }
}

variable "stack_slug" {
  type        = string
  description = "Grafana Cloud stack slug"
  default     = "forgesupport"
}

variable "connections_api_url" {
  type        = string
  description = "Grafana Connections API base URL for your region/stack"
}

variable "connections_api_access_token" {
  type        = string
  sensitive   = true
  description = "Grafana Cloud access policy token (Connections API)"
}

variable "metrics_scrape_token" {
  type        = string
  sensitive   = true
  description = "METRICS_SCRAPE_TOKEN value from Fly API (Bearer credential)"
}

variable "scrape_url" {
  type    = string
  default = "https://api.forgestudios.net/metrics"
}

variable "scrape_job_name" {
  type    = string
  default = "forge-api"
}

provider "grafana" {
  connections_api_url          = var.connections_api_url
  connections_api_access_token = var.connections_api_access_token
}

data "grafana_cloud_stack" "forge" {
  slug = var.stack_slug
}

resource "grafana_connections_metrics_endpoint_scrape_job" "forge_api" {
  stack_id                      = data.grafana_cloud_stack.forge.id
  name                          = var.scrape_job_name
  enabled                       = true
  url                           = var.scrape_url
  scrape_interval_seconds       = 60
  authentication_method         = "bearer"
  authentication_bearer_token = var.metrics_scrape_token
}

output "scrape_job_id" {
  value       = grafana_connections_metrics_endpoint_scrape_job.forge_api.id
  description = "Terraform resource id (stack_id:job_name)"
}
