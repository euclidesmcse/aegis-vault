package main

import (
	"flag"
	"fmt"
	"net"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"

	"github.com/euclidesmcse/chainssh/internal/chain"
	"github.com/euclidesmcse/chainssh/internal/config"
	"github.com/euclidesmcse/chainssh/internal/tunnel"
)

func main() {
	os.Exit(run())
}

// defaultSSHUser returns the current OS user, falling back across
// platform-appropriate environment variables.
func defaultSSHUser() string {
	if u := os.Getenv("USER"); u != "" {
		return u
	}
	if u := os.Getenv("USERNAME"); u != "" {
		return u
	}
	return os.Getenv("LOGNAME")
}

func run() int {
	var (
		defaultUser   = flag.String("l", defaultSSHUser(), "SSH user for hops without @")
		defaultPort   = flag.Int("p", 22, "Default SSH port")
		identityFiles multiFlag
		password      = flag.String("P", "", "SSH password")
		localForward  = flag.String("L", "", "Local forward: local_port:remote_host:remote_port")
		insecure      = flag.Bool("insecure", false, "Skip host key verification (override default warning)")
		timeout       = flag.Duration("t", 10*time.Second, "Connection timeout")
		verbose       = flag.Bool("v", false, "Verbose output")
		command       = flag.String("c", "", "Run command on target (instead of shell)")
		remoteForward = flag.String("R", "", "Remote forward: remote_port:local_host:local_port")
		dynamicProxy  = flag.String("D", "", "SOCKS5 dynamic proxy: [bind_addr:]port (e.g. 1080 or 127.0.0.1:1080)")
	)
	flag.Var(&identityFiles, "i", "SSH private key file (repeatable)")
	flag.Usage = usage
	flag.Parse()

	args := flag.Args()
	if len(args) < 1 {
		flag.Usage()
		return 1
	}

	hops, err := config.ParseChain(args[0], *defaultUser, *defaultPort)
	if err != nil {
		fmt.Fprintf(os.Stderr, "chain parse error: %v\n", err)
		return 1
	}

	if *verbose {
		fmt.Println("Chain:")
		for i, h := range hops {
			fmt.Printf("  hop %d: %s@%s:%d\n", i+1, h.User, h.Host, h.Port)
		}
	}

	authMethods := buildAuth(*password, identityFiles.values)
	if len(authMethods) == 0 {
		fmt.Fprintln(os.Stderr, "No auth methods available. Use -P, -i, or ssh-agent.")
		return 1
	}

	// Host key: insecure by default (like ssh -o StrictHostKeyChecking=no).
	// --insecure simply silences the warning for scripting use.
	hostKeyCb := ssh.InsecureIgnoreHostKey()
	if !*insecure {
		fmt.Fprintln(os.Stderr, "Warning: host key verification is DISABLED.")
		fmt.Fprintln(os.Stderr, "Use --insecure to suppress this warning.")
	}

	fmt.Printf("Connecting through %d hop(s)...\n", len(hops))
	ch, err := chain.ConnectChain(hops, authMethods, *timeout, hostKeyCb)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Connect failed: %v\n", err)
		return 1
	}
	defer ch.Close()

	target := hops[len(hops)-1]
	fmt.Printf("Connected to %s@%s:%d\n\n", target.User, target.Host, target.Port)

	if *localForward != "" {
		return runLocalForward(ch.Final, *localForward)
	}
	if *remoteForward != "" {
		return runRemoteForward(ch.Final, *remoteForward)
	}
	if *dynamicProxy != "" {
		return runSocksProxy(ch.Final, *dynamicProxy)
	}
	if *command != "" {
		fmt.Printf("Running: %s\n", *command)
		if err := tunnel.Exec(ch.Final, *command); err != nil {
			fmt.Fprintf(os.Stderr, "Command failed: %v\n", err)
			return 1
		}
		return 0
	}

	fmt.Printf("Shell on %s@%s (Ctrl+D to exit)\n\n", target.User, target.Host)
	if err := tunnel.Shell(ch.Final); err != nil {
		fmt.Fprintf(os.Stderr, "Shell failed: %v\n", err)
		return 1
	}
	return 0
}

func runLocalForward(client *ssh.Client, spec string) int {
	parts := strings.SplitN(spec, ":", 3)
	if len(parts) != 3 {
		fmt.Fprintf(os.Stderr, "Invalid -L format. Use: local_port:remote_host:remote_port\n")
		return 1
	}
	localAddr := fmt.Sprintf("127.0.0.1:%s", parts[0])
	remoteAddr := fmt.Sprintf("%s:%s", parts[1], parts[2])
	listener, err := tunnel.LocalForward(client, localAddr, remoteAddr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Forward failed: %v\n", err)
		return 1
	}
	defer listener.Close()
	fmt.Printf("\nLocal forward active. Ctrl+C to stop.\n")
	waitForSignal()
	fmt.Println("\nClosing...")
	return 0
}

func runSocksProxy(client *ssh.Client, bindAddr string) int {
	// Default to 127.0.0.1 if only port is given
	localAddr := bindAddr
	if _, _, err := net.SplitHostPort(bindAddr); err != nil {
		localAddr = "127.0.0.1:" + bindAddr
	}

	listener, err := tunnel.SocksProxy(client, localAddr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "SOCKS5 proxy failed: %v\n", err)
		return 1
	}
	defer listener.Close()
	fmt.Printf("\nSOCKS5 proxy active. Ctrl+C to stop.\n")
	waitForSignal()
	fmt.Println("\nClosing...")
	return 0
}

func runRemoteForward(client *ssh.Client, spec string) int {
	parts := strings.SplitN(spec, ":", 3)
	if len(parts) != 3 {
		fmt.Fprintf(os.Stderr, "Invalid -R format. Use: remote_port:local_host:local_port\n")
		return 1
	}
	remoteAddr := fmt.Sprintf("0.0.0.0:%s", parts[0])
	localAddr := fmt.Sprintf("%s:%s", parts[1], parts[2])

	listener, err := tunnel.RemoteForward(client, remoteAddr, localAddr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Remote forward failed: %v\n", err)
		return 1
	}
	defer listener.Close()
	fmt.Printf("\nRemote forward active. Ctrl+C to stop.\n")
	waitForSignal()
	fmt.Println("\nClosing...")
	return 0
}

// buildAuth constructs SSH auth methods, trying:
//  1. SSH agent (platform-specific — Unix socket or Windows named pipe)
//  2. Private key files (-i)
//  3. Password (-P)
func buildAuth(password string, identityFiles []string) []ssh.AuthMethod {
	var methods []ssh.AuthMethod

	// SSH Agent — platform-specific dial (Unix socket or Windows named pipe)
	if agentConn, err := dialSSHAgent(); err == nil && agentConn != nil {
		agentClient := agent.NewClient(agentConn)
		methods = append(methods, ssh.PublicKeysCallback(agentClient.Signers))
	}

	for _, file := range identityFiles {
		keyBytes, err := os.ReadFile(file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Cannot read key %s: %v\n", file, err)
			continue
		}
		signer, err := ssh.ParsePrivateKey(keyBytes)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Key %s is encrypted. Use ssh-agent for passphrase-protected keys.\n", file)
			continue
		}
		methods = append(methods, ssh.PublicKeys(signer))
		fmt.Fprintf(os.Stderr, "Key loaded: %s\n", file)
	}

	if password != "" {
		methods = append(methods, ssh.Password(password))
	}

	return methods
}

func waitForSignal() {
	sigCh := make(chan os.Signal, 1)
	signals := []os.Signal{os.Interrupt, syscall.SIGTERM}
	if runtime.GOOS != "windows" {
		signals = append(signals, syscall.SIGQUIT)
	}
	signal.Notify(sigCh, signals...)
	<-sigCh
}

type multiFlag struct{ values []string }

func (m *multiFlag) String() string { return strings.Join(m.values, ", ") }
func (m *multiFlag) Set(v string) error {
	m.values = append(m.values, v)
	return nil
}

func usage() {
	fmt.Fprintf(os.Stderr, `chainssh -- multi-hop SSH with dynamic ports

Connect to a destination through a chain of SSH servers.
Each hop uses dynamic port allocation via SSH tunnelling.

USAGE:
  chainssh [options] <chain>

  Chain: user@host:port,user@host:port,...

EXAMPLES:
  chainssh root@server.com
  chainssh admin@jump,root@internal
  chainssh user@j1:2222,user@j2,root@target -i ~/.ssh/id_rsa
  chainssh -L 5432:db.internal:5432 jump,db
  chainssh -R 8080:localhost:3000 jump,server
  chainssh -D 1080 jump,server
  chainssh -c "uptime" jump,server

OPTIONS:
`)
	flag.PrintDefaults()
}
