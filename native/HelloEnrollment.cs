using System.Runtime.InteropServices;
using System.Security.Principal;

namespace Sapphire.Native;

internal static class HelloEnrollment
{
    // WINBIO_IDENTITY's SID union member: type, byte count, SECURITY_MAX_SID_SIZE bytes.
    [StructLayout(LayoutKind.Sequential)]
    internal struct Identity
    {
        public uint Type;
        public uint Size;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 68)] public byte[] Sid;
    }

    [DllImport("winbio.dll")]
    private static extern int WinBioGetEnrolledFactors(ref Identity identity, out uint factors);

    internal static bool HasFace(uint factors) => (factors & 2) != 0;

    internal static bool? DisabledByPolicy()
    {
        try
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Policies\Microsoft\Biometrics");
            return key?.GetValue("Enabled") is int enabled && enabled == 0;
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or System.Security.SecurityException or IOException) { return null; }
    }

    internal static (bool? Enrolled, string? Reason) Read()
    {
        try
        {
            using var account = WindowsIdentity.GetCurrent();
            var sid = account.User ?? throw new InvalidOperationException("The current Windows account is unavailable.");
            var identity = new Identity { Type = 3, Size = (uint)sid.BinaryLength, Sid = new byte[68] };
            if (sid.BinaryLength > identity.Sid.Length) throw new InvalidOperationException("Unsupported Windows account identity.");
            sid.GetBinaryForm(identity.Sid, 0);
            var result = WinBioGetEnrolledFactors(ref identity, out var factors);
            if (result < 0) return (null, $"Windows could not read facial enrollment (0x{result:X8}). Check Sign-in options.");
            return (HasFace(factors), null);
        }
        catch (Exception ex) when (ex is DllNotFoundException or EntryPointNotFoundException or UnauthorizedAccessException or InvalidOperationException)
        {
            return (null, "Facial enrollment could not be checked. Open Windows Sign-in options.");
        }
    }
}
