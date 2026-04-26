variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "app_image" {
  description = "Docker image URI for the Next.js app (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/stellar-spend:latest)"
  type        = string
}

variable "app_port" {
  description = "Container port the Next.js app listens on"
  type        = number
  default     = 3000
}

variable "desired_count" {
  description = "Number of ECS task replicas"
  type        = number
  default     = 2
}

variable "cpu" {
  description = "ECS task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "ECS task memory in MiB"
  type        = number
  default     = 512
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

# ── Secrets (stored in AWS Secrets Manager, injected at runtime) ──────────────

variable "paycrest_api_key" {
  description = "Paycrest API key"
  type        = string
  sensitive   = true
}

variable "paycrest_webhook_secret" {
  description = "Paycrest webhook HMAC signing secret"
  type        = string
  sensitive   = true
}

variable "base_private_key" {
  description = "Private key of the Base payout wallet (hex, 0x…)"
  type        = string
  sensitive   = true
}

variable "base_return_address" {
  description = "Base address for returns / treasury routing"
  type        = string
}

variable "base_rpc_url" {
  description = "Base chain RPC provider URL"
  type        = string
}

variable "stellar_soroban_rpc_url" {
  description = "Soroban RPC endpoint"
  type        = string
  default     = "https://soroban-rpc.mainnet.stellar.gateway.fm"
}

variable "stellar_horizon_url" {
  description = "Horizon endpoint"
  type        = string
  default     = "https://horizon.stellar.org"
}

variable "stellar_usdc_issuer" {
  description = "Stellar USDC issuer account"
  type        = string
}

variable "database_url" {
  description = "PostgreSQL connection string"
  type        = string
  sensitive   = true
}

variable "sentry_dsn" {
  description = "Sentry DSN for error monitoring"
  type        = string
  default     = ""
}
