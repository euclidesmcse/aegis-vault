package tunnel

import (
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"runtime"
	"syscall"

	"golang.org/x/crypto/ssh"
	"golang.org/x/term"
)

// LocalForward binds a local TCP listener and forwards every accepted
// connection through the SSH client to remoteAddr.
func LocalForward(client *ssh.Client, localAddr, remoteAddr string) (net.Listener, error) {
	listener, err := net.Listen("tcp", localAddr)
	if err != nil {
		return nil, fmt.Errorf("listen %s: %w", localAddr, err)
	}

	fmt.Printf("  🔗 %s → %s (through SSH chain)\n", listener.Addr().String(), remoteAddr)

	go func() {
		for {
			localConn, err := listener.Accept()
			if err != nil {
				return
			}
			go func() {
				defer localConn.Close()
				remoteConn, err := client.Dial("tcp", remoteAddr)
				if err != nil {
					fmt.Fprintf(os.Stderr, "forward: dial %s failed: %v\n", remoteAddr, err)
					return
				}
				defer remoteConn.Close()

				go io.Copy(remoteConn, localConn)
				io.Copy(localConn, remoteConn)
			}()
		}
	}()

	return listener, nil
}

// RemoteForward listens on the remote side (via SSH client) and forwards
// every accepted connection to localAddr on the local machine.
func RemoteForward(client *ssh.Client, remoteAddr, localAddr string) (net.Listener, error) {
	listener, err := client.Listen("tcp", remoteAddr)
	if err != nil {
		return nil, fmt.Errorf("remote listen %s: %w", remoteAddr, err)
	}

	fmt.Printf("  🔗 %s → %s (remote forward through SSH chain)\n", remoteAddr, localAddr)

	go func() {
		for {
			remoteConn, err := listener.Accept()
			if err != nil {
				return
			}
			go func() {
				defer remoteConn.Close()
				localConn, err := net.Dial("tcp", localAddr)
				if err != nil {
					fmt.Fprintf(os.Stderr, "reverse forward: dial %s failed: %v\n", localAddr, err)
					return
				}
				defer localConn.Close()

				go io.Copy(localConn, remoteConn)
				io.Copy(remoteConn, localConn)
			}()
		}
	}()

	return listener, nil
}

// ── SOCKS5 Proxy ────────────────────────────────────────────────────────

// socks5 constants
const (
	socks5Version = 0x05
	socks5Connect = 0x01
	socks5NoAuth  = 0x00

	socks5AddrIPv4   = 0x01
	socks5AddrDomain = 0x03
	socks5AddrIPv6   = 0x04

	socks5ReplySuccess = 0x00
	socks5ReplyFailure = 0x01
)

// SocksProxy starts a SOCKS5 proxy on localAddr, tunnelling all
// connections through the SSH client (and its chain).
//
// This is equivalent to OpenSSH's -D flag. Configure your browser
// or tool to use socks5://127.0.0.1:<port> and all traffic will
// be routed through the SSH chain.
func SocksProxy(client *ssh.Client, localAddr string) (net.Listener, error) {
	listener, err := net.Listen("tcp", localAddr)
	if err != nil {
		return nil, fmt.Errorf("socks5 listen %s: %w", localAddr, err)
	}

	fmt.Printf("  🧦 SOCKS5 proxy: %s (through SSH chain)\n", listener.Addr().String())
	fmt.Printf("     Configure browser: socks5://%s\n", listener.Addr().String())

	go func() {
		for {
			clientConn, err := listener.Accept()
			if err != nil {
				return
			}
			go handleSocks5(clientConn, client)
		}
	}()

	return listener, nil
}

// handleSocks5 performs the SOCKS5 handshake and then relays data
// between the client connection and the destination (dialled through
// the SSH client).
func handleSocks5(clientConn net.Conn, sshClient *ssh.Client) {
	defer clientConn.Close()

	// ── 1. Greeting: read auth methods ──
	buf := make([]byte, 258) // max: 1(ver) + 1(nmethods) + 255(methods)
	if _, err := io.ReadFull(clientConn, buf[:2]); err != nil {
		return
	}
	if buf[0] != socks5Version {
		return
	}
	nmethods := int(buf[1])
	if nmethods > 0 {
		if _, err := io.ReadFull(clientConn, buf[:nmethods]); err != nil {
			return
		}
	}

	// ── 2. Server choice: no authentication ──
	if _, err := clientConn.Write([]byte{socks5Version, socks5NoAuth}); err != nil {
		return
	}

	// ── 3. Read CONNECT request ──
	// Format: VER(1) CMD(1) RSV(1) ATYP(1) DST ...
	if _, err := io.ReadFull(clientConn, buf[:4]); err != nil {
		return
	}
	if buf[0] != socks5Version || buf[1] != socks5Connect {
		sendSocks5Reply(clientConn, socks5ReplyFailure, nil, 0)
		return
	}

	var dstAddr string
	var dstPort uint16

	switch buf[3] {
	case socks5AddrIPv4:
		if _, err := io.ReadFull(clientConn, buf[:4]); err != nil {
			return
		}
		dstAddr = net.IP(buf[:4]).String()

	case socks5AddrDomain:
		if _, err := io.ReadFull(clientConn, buf[:1]); err != nil {
			return
		}
		domainLen := int(buf[0])
		if _, err := io.ReadFull(clientConn, buf[:domainLen]); err != nil {
			return
		}
		dstAddr = string(buf[:domainLen])

	case socks5AddrIPv6:
		if _, err := io.ReadFull(clientConn, buf[:16]); err != nil {
			return
		}
		dstAddr = net.IP(buf[:16]).String()

	default:
		sendSocks5Reply(clientConn, socks5ReplyFailure, nil, 0)
		return
	}

	// Read port (2 bytes, big-endian)
	if _, err := io.ReadFull(clientConn, buf[:2]); err != nil {
		return
	}
	dstPort = binary.BigEndian.Uint16(buf[:2])
	destination := fmt.Sprintf("%s:%d", dstAddr, dstPort)

	// ── 4. Dial destination through SSH tunnel ──
	remoteConn, err := sshClient.Dial("tcp", destination)
	if err != nil {
		sendSocks5Reply(clientConn, socks5ReplyFailure, nil, 0)
		return
	}
	defer remoteConn.Close()

	// ── 5. Send success reply ──
	// Bind address: 0.0.0.0:0 (IPv4 zero address)
	bindAddr := net.IPv4(0, 0, 0, 0)
	sendSocks5Reply(clientConn, socks5ReplySuccess, bindAddr, 0)

	// ── 6. Bidirectional relay ──
	go io.Copy(remoteConn, clientConn)
	io.Copy(clientConn, remoteConn)
}

// sendSocks5Reply sends a SOCKS5 reply to the client.
func sendSocks5Reply(conn net.Conn, rep byte, bindAddr net.IP, bindPort uint16) {
	reply := []byte{socks5Version, rep, 0x00, socks5AddrIPv4}
	if bindAddr != nil {
		reply = append(reply, bindAddr.To4()...)
	} else {
		reply = append(reply, 0, 0, 0, 0)
	}
	portBytes := make([]byte, 2)
	binary.BigEndian.PutUint16(portBytes, bindPort)
	reply = append(reply, portBytes...)
	conn.Write(reply)
}

// ── Shell ───────────────────────────────────────────────────────────────

func Shell(client *ssh.Client) error {
	session, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	defer session.Close()

	session.Stdin = os.Stdin
	session.Stdout = os.Stdout
	session.Stderr = os.Stderr

	fd := int(os.Stdin.Fd())
	isTerm := term.IsTerminal(fd)

	if isTerm {
		oldState, err := term.MakeRaw(fd)
		if err != nil {
			return fmt.Errorf("make raw terminal: %w", err)
		}
		defer term.Restore(fd, oldState)

		width, height, err := term.GetSize(fd)
		if err != nil {
			width, height = 80, 24
		}

		modes := ssh.TerminalModes{
			ssh.ECHO:          1,
			ssh.TTY_OP_ISPEED: 14400,
			ssh.TTY_OP_OSPEED: 14400,
		}

		if err := session.RequestPty("xterm-256color", height, width, modes); err != nil {
			return fmt.Errorf("request pty: %w", err)
		}

		if runtime.GOOS != "windows" {
			go watchWindowSize(fd, session)
		}
	}

	if err := session.Shell(); err != nil {
		return fmt.Errorf("start shell: %w", err)
	}

	err = session.Wait()
	if err != nil {
		if _, ok := err.(*ssh.ExitError); ok {
			return nil
		}
		return err
	}

	return nil
}

func watchWindowSize(fd int, session *ssh.Session) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGWINCH)
	defer signal.Stop(sigCh)

	for range sigCh {
		width, height, err := term.GetSize(fd)
		if err != nil {
			continue
		}
		_ = session.WindowChange(height, width)
	}
}

func Exec(client *ssh.Client, command string) error {
	session, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	defer session.Close()

	session.Stdin = os.Stdin
	session.Stdout = os.Stdout
	session.Stderr = os.Stderr

	return session.Run(command)
}
