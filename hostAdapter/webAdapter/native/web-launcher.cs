// web-launcher.cs - tiny native messaging host shell for FEMO webAdapter.
// Why this exists: modern Chromium/Edge (NativeHostsExecutablesLaunchDirectly,
// Chrome 113+ / Edge equivalent) launches the native messaging host executable
// DIRECTLY on Windows; .cmd/.bat batch shells no longer start there and the
// extension just sees "Error when communicating with the native messaging host".
// So the host manifest points at this real .exe, which:
//   1. locates node.exe (PATH, then common locations, then node.path hint file
//      written by install-native-host.mjs - needed when node is not on the
//      system PATH, e.g. only a bundled node exists),
//   2. spawns web-launcher.mjs (sibling file) with Chrome's std pipes handed
//      down explicitly via CreateProcess + STARTF_USESTDHANDLES,
//   3. waits and exits with the child's exit code.
// Why CreateProcess instead of System.Diagnostics.Process: with redirection
// .NET's encoding wrappers corrupt the 4-byte length-prefix framing (a 3-byte
// UTF-8 BOM was measured landing in the middle of the frame); without
// redirection Process.Start does NOT pass our std handles down at all (no
// STARTF_USESTDHANDLES), so the child sees empty handles and replies with
// nothing. Raw CreateProcess with bInheritHandles=TRUE and our three std
// handles in STARTUPINFO is the only clean passthrough. All real logic lives
// in web-launcher.mjs; this file must stay ASCII-only (csc.exe reads sources
// in the ANSI codepage, UTF-8 Chinese would garble).
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

class WebLauncher {
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern IntPtr GetStdHandle(int nStdHandle);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool CreateProcess(string lpApplicationName, string lpCommandLine,
    IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles,
    uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory,
    ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool CloseHandle(IntPtr hObject);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

  const int STD_INPUT_HANDLE = -10;
  const int STD_OUTPUT_HANDLE = -11;
  const int STD_ERROR_HANDLE = -12;
  const uint STARTF_USESTDHANDLES = 0x00000100;
  const uint CREATE_NO_WINDOW = 0x08000000;
  const uint INFINITE = 0xFFFFFFFF;

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct STARTUPINFO {
    public int cb;
    public string lpReserved;
    public string lpDesktop;
    public string lpTitle;
    public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars;
    public int dwFillAttribute, dwFlags;
    public short wShowWindow, wCbReserved2;
    public IntPtr lpReserved2;
    public IntPtr hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct PROCESS_INFORMATION {
    public IntPtr hProcess, hThread;
    public int dwProcessId, dwThreadId;
  }

  static int Main(string[] args) {
    string exeDir = AppDomain.CurrentDomain.BaseDirectory;
    string script = Path.Combine(exeDir, "web-launcher.mjs");
    string node = FindNode(exeDir);
    if (node == null) {
      return ReplyError("node.exe not found: install Node.js 18+, put 'node' on the system PATH, or re-run install-native-host.mjs to write the node.path hint file.");
    }
    if (!File.Exists(script)) {
      return ReplyError("web-launcher.mjs not found next to web-launcher.exe: " + script);
    }
    string cmdline = "\"" + node + "\" \"" + script + "\"";
    STARTUPINFO si = new STARTUPINFO();
    si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
    si.dwFlags = (int)STARTF_USESTDHANDLES;
    si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
    si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
    PROCESS_INFORMATION pi;
    // cwd = adapter native dir so relative sibling lookups keep working.
    if (!CreateProcess(null, cmdline, IntPtr.Zero, IntPtr.Zero, true, CREATE_NO_WINDOW,
        IntPtr.Zero, exeDir, ref si, out pi)) {
      return ReplyError("CreateProcess failed (win32 error " + Marshal.GetLastWin32Error() + "): " + cmdline);
    }
    int wait = (int)WaitForSingleObject(pi.hProcess, INFINITE);
    uint exitCode = (wait == 0) ? 0u : 1u;
    try { GetExitCodeProcess(pi.hProcess, out exitCode); } catch {}
    try { CloseHandle(pi.hThread); } catch {}
    try { CloseHandle(pi.hProcess); } catch {}
    return (int)exitCode;
  }

  static string FindNode(string exeDir) {
    string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
    foreach (string dir in pathEnv.Split(Path.PathSeparator)) {
      if (string.IsNullOrWhiteSpace(dir)) continue;
      try {
        string candidate = Path.Combine(dir.Trim(), "node.exe");
        if (File.Exists(candidate)) return candidate;
      } catch {}
    }
    string[] common = new string[] {
      Path.Combine(Environment.GetEnvironmentVariable("ProgramFiles") ?? "C:\\Program Files", "nodejs", "node.exe"),
      Path.Combine(Environment.GetEnvironmentVariable("ProgramFiles(x86)") ?? "C:\\Program Files (x86)", "nodejs", "node.exe"),
      Path.Combine(Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? "", "Programs", "nodejs", "node.exe"),
    };
    foreach (string c in common) {
      if (c.Length > 0 && File.Exists(c)) return c;
    }
    // Machine-local hint written by install-native-host.mjs (the node that ran
    // the installer). Needed when node lives only inside a bundled app dir.
    try {
      string hint = Path.Combine(exeDir, "node.path");
      if (File.Exists(hint)) {
        string p = File.ReadAllText(hint, Encoding.UTF8).Trim();
        if (p.Length > 0 && File.Exists(p)) return p;
      }
    } catch {}
    return null;
  }

  // Best-effort error reply in native messaging framing on our stdout
  // (still Chrome's pipe - no wrappers involved).
  static int ReplyError(string msg) {
    string json = "{\"ok\":false,\"error\":\"" + msg.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"}";
    byte[] body = Encoding.UTF8.GetBytes(json);
    byte[] head = BitConverter.GetBytes((uint)body.Length);
    try {
      Stream so = Console.OpenStandardOutput();
      so.Write(head, 0, 4);
      so.Write(body, 0, body.Length);
      so.Flush();
    } catch {}
    return 1;
  }
}
