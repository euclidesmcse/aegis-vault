package main

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/Microsoft/go-winio"
)

var (
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	user32   = syscall.NewLazyDLL("user32.dll")

	procFindWindowW      = user32.NewProc("FindWindowW")
	procSendMessageW     = user32.NewProc("SendMessageW")
	procOpenFileMappingW = kernel32.NewProc("OpenFileMappingW")
	procMapViewOfFile    = kernel32.NewProc("MapViewOfFile")
	procUnmapViewOfFile  = kernel32.NewProc("UnmapViewOfFile")
	procCloseHandle      = kernel32.NewProc("CloseHandle")
)

const (
	WM_COPYDATA        = 0x004A
	AGENT_COPYDATA_ID  = 0x804e50ba
	FILE_MAP_ALL_ACCESS = 0x000F001F

	AGENT_MAX_MSGLEN = 8192
	pageantTimeout   = 5 * time.Second
	pollInterval     = 10 * time.Millisecond
)

type COPYDATASTRUCT struct {
	dwData uintptr
	cbData uint32
	lpData uintptr
}

// dialSSHAgent connects to the best available SSH agent on Windows.
// Tries: 1. OpenSSH (named pipe)  2. Pageant (shared memory)
// Returns (nil, nil) if no agent found so callers fall back to -i/-P.
func dialSSHAgent() (net.Conn, error) {
	if conn := tryOpenSSHAgent(); conn != nil {
		return conn, nil
	}
	if conn := tryPageant(); conn != nil {
		return conn, nil
	}
	return nil, nil
}

func tryOpenSSHAgent() net.Conn {
	const pipePath = `\.\pipe\openssh-ssh-agent`
	timeout := 1 * time.Second
	conn, err := winio.DialPipe(pipePath, &timeout)
	if err != nil {
		return nil
	}
	return conn
}

// ── Pageant ─────────────────────────────────────────────────────────────

func tryPageant() net.Conn {
	hwnd := findPageantWindow()
	if hwnd == 0 {
		return nil
	}
	mapName, err := requestMapName(hwnd)
	if err != nil {
		return nil
	}
	p, err := openPageantMapping(mapName)
	if err != nil {
		return nil
	}
	clientConn, serverConn := net.Pipe()
	go bridgePageant(serverConn, p)
	return clientConn
}

func findPageantWindow() syscall.Handle {
	className, _ := syscall.UTF16PtrFromString("Pageant")
	windowName, _ := syscall.UTF16PtrFromString("Pageant")
	hwnd, _, _ := procFindWindowW.Call(
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(windowName)),
	)
	return syscall.Handle(hwnd)
}

func requestMapName(hwnd syscall.Handle) (string, error) {
	const bufSize = 256
	mapNameBuf := make([]uint16, bufSize)

	var cds COPYDATASTRUCT
	cds.dwData = AGENT_COPYDATA_ID
	cds.cbData = bufSize * 2
	cds.lpData = uintptr(unsafe.Pointer(&mapNameBuf[0]))

	ret, _, _ := procSendMessageW.Call(
		uintptr(hwnd),
		WM_COPYDATA,
		0,
		uintptr(unsafe.Pointer(&cds)),
	)
	if ret == 0 {
		return "", errors.New("pageant: WM_COPYDATA failed (is Pageant running?)")
	}
	name := syscall.UTF16ToString(mapNameBuf)
	if name == "" {
		return "", errors.New("pageant: empty map name returned")
	}
	return name, nil
}

type pageantMapping struct {
	view unsafe.Pointer
	hMap syscall.Handle
}

func openPageantMapping(name string) (*pageantMapping, error) {
	namePtr, err := syscall.UTF16PtrFromString(name)
	if err != nil {
		return nil, err
	}
	hMap, _, err := procOpenFileMappingW.Call(
		FILE_MAP_ALL_ACCESS,
		0,
		uintptr(unsafe.Pointer(namePtr)),
	)
	if hMap == 0 {
		return nil, fmt.Errorf("pageant: OpenFileMapping failed: %v", err)
	}
	view, _, err := procMapViewOfFile.Call(
		hMap,
		FILE_MAP_ALL_ACCESS,
		0, 0,
		AGENT_MAX_MSGLEN+4,
	)
	if view == 0 {
		syscall.CloseHandle(syscall.Handle(hMap))
		return nil, fmt.Errorf("pageant: MapViewOfFile failed: %v", err)
	}
	return &pageantMapping{
		view: unsafe.Pointer(view),
		hMap:  syscall.Handle(hMap),
	}, nil
}

func (p *pageantMapping) close() {
	if p.view != nil {
		procUnmapViewOfFile.Call(uintptr(p.view))
		p.view = nil
	}
	if p.hMap != 0 {
		syscall.CloseHandle(p.hMap)
		p.hMap = 0
	}
}

// ── Pipe bridge ─────────────────────────────────────────────────────────

// bridgePageant translates between the Pageant shared memory protocol
// (4-byte LE length prefix at offset 0, data at offset 4) and the
// standard SSH agent wire protocol (4-byte BE length prefix + data)
// over a net.Pipe.
//
// Uses a WaitGroup to ensure the inner goroutine stops accessing
// the shared memory before it is unmapped.
func bridgePageant(pipe net.Conn, p *pageantMapping) {
	var wg sync.WaitGroup
	wg.Add(1)

	var mu sync.Mutex

	go func() {
		defer wg.Done()
		for {
			var lenBuf [4]byte
			if _, err := io.ReadFull(pipe, lenBuf[:]); err != nil {
				return
			}
			msgLen := binary.BigEndian.Uint32(lenBuf[:])
			if msgLen > AGENT_MAX_MSGLEN {
				return
			}
			msg := make([]byte, msgLen)
			if _, err := io.ReadFull(pipe, msg); err != nil {
				return
			}

			// Write request to Pageant shared memory
			mu.Lock()
			viewPtr := (*[AGENT_MAX_MSGLEN + 4]byte)(p.view)
			binary.LittleEndian.PutUint32(viewPtr[0:4], msgLen)
			copy(viewPtr[4:4+msgLen], msg)
			mu.Unlock()

			// Poll for Pageant response
			deadline := time.Now().Add(pageantTimeout)
			for time.Now().Before(deadline) {
				mu.Lock()
				respLen := binary.LittleEndian.Uint32(viewPtr[0:4])
				if respLen > 0 {
					var respHeader [4]byte
					binary.BigEndian.PutUint32(respHeader[:], respLen)
					if _, err := pipe.Write(respHeader[:]); err != nil {
						mu.Unlock()
						return
					}
					if _, err := pipe.Write(viewPtr[4 : 4+respLen]); err != nil {
						mu.Unlock()
						return
					}
					binary.LittleEndian.PutUint32(viewPtr[0:4], 0)
					mu.Unlock()
					break
				}
				mu.Unlock()
				time.Sleep(pollInterval)
			}
		}
	}()

	// Block until the other end of the pipe is closed
	buf := make([]byte, 1)
	pipe.Read(buf)

	// Close the pipe to unblock the goroutine's io.ReadFull
	pipe.Close()

	// Wait for goroutine to stop accessing shared memory
	wg.Wait()

	// Now safe to unmap
	p.close()
}
