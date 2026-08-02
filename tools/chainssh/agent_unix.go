//go:build !windows

package main

import (
	"net"
	"os"
)

// dialSSHAgent connects to the local SSH agent via Unix socket
// (SSH_AUTH_SOCK). Returns (nil, nil) if no agent is available.
func dialSSHAgent() (net.Conn, error) {
	sock := os.Getenv("SSH_AUTH_SOCK")
	if sock == "" {
		return nil, nil
	}
	return net.Dial("unix", sock)
}
