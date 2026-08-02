package config

import (
	"fmt"
	"strconv"
	"strings"
)

// HopConfig represents a single hop in the SSH chain.
type HopConfig struct {
	User string // SSH user for this hop
	Host string // hostname or IP
	Port int    // SSH port (default 22)
}

// Address returns the "host:port" string for Dial.
func (h HopConfig) Address() string {
	return fmt.Sprintf("%s:%d", h.Host, h.Port)
}

// ParseChain parses a comma-separated chain string like:
//
//	"userA@jump1:2222 , userB@jump2 , target"
//
// If a hop omits the user, defaultUser is used (can be "").
// If a hop omits the port, defaultPort is used (typically 22).
func ParseChain(chain string, defaultUser string, defaultPort int) ([]HopConfig, error) {
	parts := strings.Split(chain, ",")
	hops := make([]HopConfig, 0, len(parts))

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		hop := HopConfig{User: defaultUser, Port: defaultPort}

		// Extract user: everything before the LAST "@"
		if idx := strings.LastIndex(part, "@"); idx >= 0 {
			hop.User = part[:idx]
			part = part[idx+1:]
		}

		// Extract port: split host:port (works for IPv4 and hostnames)
		// net.SplitHostPort handles IPv6 [::1]:22 correctly
		if host, portStr, err := splitHostPort(part); err == nil {
			hop.Host = host
			if port, convErr := strconv.Atoi(portStr); convErr == nil {
				hop.Port = port
			}
		} else {
			hop.Host = part
		}

		if hop.Host == "" {
			return nil, fmt.Errorf("empty host in chain at position %d", len(hops)+1)
		}

		hops = append(hops, hop)
	}

	if len(hops) == 0 {
		return nil, fmt.Errorf("chain must contain at least one host")
	}

	return hops, nil
}

// splitHostPort splits host:port, handling the simple cases and IPv6.
// We avoid net.SplitHostPort for simple host:port because it
// doesn't handle bare IPv6 addresses without brackets.
func splitHostPort(s string) (host string, port string, err error) {
	// Check for IPv6 with brackets
	if strings.HasPrefix(s, "[") {
		return splitBracketed(s)
	}

	// Simple case: last colon separates port
	lastColon := strings.LastIndex(s, ":")
	if lastColon < 0 {
		return "", "", fmt.Errorf("no port")
	}

	// If there are multiple colons, it might be IPv6 without brackets
	// Count colons
	colonCount := strings.Count(s, ":")
	if colonCount > 1 {
		// IPv6 without brackets — no port
		return "", "", fmt.Errorf("IPv6 without port")
	}

	host = s[:lastColon]
	port = s[lastColon+1:]
	return host, port, nil
}

func splitBracketed(s string) (host string, port string, err error) {
	closeBracket := strings.Index(s, "]")
	if closeBracket < 0 {
		return "", "", fmt.Errorf("unmatched bracket in IPv6 address")
	}

	host = s[:closeBracket+1] // includes brackets
	rest := s[closeBracket+1:]

	if strings.HasPrefix(rest, ":") {
		port = rest[1:]
	} else {
		return "", "", fmt.Errorf("expected :port after IPv6 bracket")
	}

	return host, port, nil
}
