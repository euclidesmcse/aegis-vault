package chain

import (
	"fmt"
	"net"
	"time"

	"golang.org/x/crypto/ssh"

	"github.com/euclidesmcse/chainssh/internal/config"
)

// Chain holds all SSH clients for a multi-hop connection.
// Clients are stored in order (first hop at index 0).
// The last client is available as .Final for convenience.
type Chain struct {
	clients  []*ssh.Client
	Final    *ssh.Client // last hop — your target
	stopKeep chan struct{}
}

// Close tears down all SSH connections in reverse order.
func (c *Chain) Close() error {
	if c.stopKeep != nil {
		close(c.stopKeep)
	}
	var lastErr error
	for i := len(c.clients) - 1; i >= 0; i-- {
		if err := c.clients[i].Close(); err != nil && lastErr == nil {
			lastErr = err
		}
	}
	return lastErr
}

// ConnectChain establishes a multi-hop SSH tunnel through the given hops.
//
// Each hop after the first is dialed through the previous hop's SSH client
// using ssh.Client.Dial("tcp", ...), then upgraded to a new SSH connection.
// This mirrors OpenSSH ProxyJump behaviour.
//
// Portas dinâmicas: cada hop intermediário usa alocação dinâmica de porta
// via SSH. Nenhuma porta fixa é necessária nos saltos — o túnel SSH gerencia
// isso automaticamente.
//
// Intermediate connections are kept alive with SSH-level keepalive probes
// every 30 seconds, preventing firewall/NAT timeouts.
//
// All intermediate connections stay alive for the tunnel to work.
// Call Chain.Close() to tear everything down in reverse order.
func ConnectChain(
	hops []config.HopConfig,
	authMethods []ssh.AuthMethod,
	timeout time.Duration,
	hostKeyCallback ssh.HostKeyCallback,
) (*Chain, error) {
	if len(hops) == 0 {
		return nil, fmt.Errorf("empty hop chain")
	}

	var currentClient *ssh.Client
	clients := make([]*ssh.Client, 0, len(hops))

	for i, hop := range hops {
		addr := hop.Address()

		var conn net.Conn
		var err error

		if i == 0 {
			// First hop: direct TCP dial with keepalive
			dialer := net.Dialer{
				Timeout:   timeout,
				KeepAlive: 30 * time.Second,
			}
			conn, err = dialer.Dial("tcp", addr)
		} else {
			// Subsequent hops: dial through the previous SSH tunnel
			// SSH aloca porta dinâmica automaticamente aqui
			conn, err = currentClient.Dial("tcp", addr)
		}

		if err != nil {
			cleanupClients(clients)
			return nil, fmt.Errorf("hop %d (%s): tcp dial failed — %w", i+1, addr, err)
		}

		// Upgrade the raw TCP connection to an SSH connection
		sshConfig := &ssh.ClientConfig{
			User:            hop.User,
			Auth:            authMethods,
			HostKeyCallback: hostKeyCallback,
			Timeout:         timeout,
		}

		sshConn, chans, reqs, err := ssh.NewClientConn(conn, addr, sshConfig)
		if err != nil {
			conn.Close()
			cleanupClients(clients)
			return nil, fmt.Errorf("hop %d (%s): ssh handshake failed — %w", i+1, addr, err)
		}

		currentClient = ssh.NewClient(sshConn, chans, reqs)
		clients = append(clients, currentClient)

		fmt.Printf("  ✓ hop %d: %s@%s conectado\n", i+1, hop.User, addr)
	}

	c := &Chain{
		clients:  clients,
		Final:    currentClient,
		stopKeep: make(chan struct{}),
	}

	// SSH-level keepalive for ALL intermediate hops (not the last one,
	// since the final one is used interactively and already has activity)
	for i := 0; i < len(clients)-1; i++ {
		go keepalive(clients[i], c.stopKeep)
	}

	return c, nil
}

// keepalive sends SSH-level keepalive requests every 30 seconds
// to prevent intermediate connections from being killed by firewalls.
func keepalive(client *ssh.Client, stop <-chan struct{}) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			_, _, err := client.SendRequest("keepalive@openssh.com", true, nil)
			if err != nil {
				return // connection dead, goroutine exits naturally
			}
		case <-stop:
			return
		}
	}
}

func cleanupClients(clients []*ssh.Client) {
	for _, c := range clients {
		c.Close()
	}
}
