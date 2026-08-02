terraform {
  required_version = ">= 1.6.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "docker" {
  # Linux/Mac: host = "unix:///var/run/docker.sock"
  # Windows:   host = "npipe:////./pipe/docker_engine"
  host = "unix:///var/run/docker.sock"
}
