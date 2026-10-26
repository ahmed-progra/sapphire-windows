using System.ComponentModel;
using System.Management;
using System.Runtime.InteropServices;
using System.Text.Json;
using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;
using Windows.Security.Credentials.UI;

namespace Sapphire.Native;

internal sealed class SystemServices : IDisposable
{
    private readonly System.Threading.Timer foregroundTimer;
    private readonly int parentPid;
    private readonly Action? foregroundChanged;
    private IntPtr lastForeground;
    private sealed record ForegroundTarget(IntPtr Window, uint ProcessId);
    private ForegroundTarget? previousTarget;

    public SystemServices(int parentPid, Action? foregroundChanged = null)
    {
        this.parentPid = parentPid;
        this.foregroundChanged = foregroundChanged;
        foregroundTimer = new System.Threading.Timer(_ => RememberForeground(), null, 0, 100);
    }

    private void RememberForeground()
    {
        var hwnd = NativeMethods.GetForegroundWindow();
        var changed = Interlocked.Exchange(ref lastForeground, hwnd) != hwnd;
        if (hwnd == IntPtr.Zero || !NativeMethods.IsWindowVisible(hwnd)) return;
        NativeMethods.GetWindowThreadProcessId(hwnd, out var pid);
        if (pid == Environment.ProcessId || pid == parentPid || pid == 0) return;
        Interlocked.Exchange(ref previousTarget, new ForegroundTarget(hwnd, pid));
        // Reuse the snap observer; notify only on activation changes, never steal focus.
        if (changed) foregroundChanged?.Invoke();
    }

    public async Task<object> Capabilities(MediaServices media)
    {
        var map = new Dictionary<string, object>();
        async Task Probe(string name, Func<Task> test)
        {
            try { await test(); map[name] = new { available = true }; }
            catch (Exception ex) { map[name] = new { available = false, reason = ex.Message }; }
        }
        await Probe("media", async () => { await media.Available(); });
        await Probe("audio", () => { _ = AudioServices.Get(); return Task.CompletedTask; });
        map["snap"] = parentPid > 0 ? new { available = true, reason = (string?)null } : new { available = false, reason = (string?)"Launch the helper with --parent-pid=<Sapphire process id>." };
        await Probe("brightness", () => { _ = GetBrightness(); return Task.CompletedTask; });
        var battery = GetBattery();
        map["battery"] = new { available = battery.available, reason = battery.available ? null : "This computer does not report a battery." };
        await Probe("bluetooth", async () => { _ = await Bluetooth(); });
        try
        {
            var hello = await HelloAvailability();
            map["hello"] = new { available = hello.available, reason = hello.reason };
        }
        catch (Exception ex) { map["hello"] = new { available = false, reason = ex.Message }; }
        map["notifications"] = NotificationServices.Capability();
        return map;
    }

    public object Snap(JsonElement p)
    {
        var layout = Parameters.Text(p, "layout", 20);
        _ = Layout(layout, new NativeMethods.Rect { Right = 100, Bottom = 100 });
        if (parentPid <= 0) throw new NativeError("unavailable", "Sapphire's process identity was not supplied to the helper.");
        var target = Volatile.Read(ref previousTarget);
        var hwnd = target?.Window ?? IntPtr.Zero;
        if (hwnd == IntPtr.Zero || !NativeMethods.IsWindow(hwnd)) throw new NativeError("not_found", "Activate a window before opening Snap Zones.");
        NativeMethods.GetWindowThreadProcessId(hwnd, out var pid);
        if (pid != target!.ProcessId) throw new NativeError("not_found", "The selected window has closed. Activate a window again.");
        if (pid == Environment.ProcessId || pid == parentPid) throw new NativeError("rejected", "Sapphire cannot snap its own notch.");
        return PositionWindow(hwnd, layout);
    }

    internal static object PositionWindow(IntPtr hwnd, string layout)
    {
        var previousDpi = NativeMethods.SetThreadDpiAwarenessContext(new IntPtr(-4));
        try
        {
            var monitor = NativeMethods.MonitorFromWindow(hwnd, 2);
            var info = new NativeMethods.MonitorInfo { Size = Marshal.SizeOf<NativeMethods.MonitorInfo>() };
            if (!NativeMethods.GetMonitorInfo(monitor, ref info)) throw new Win32Exception(Marshal.GetLastWin32Error());
            var rect = Layout(layout, info.Work);
            if (NativeMethods.IsIconic(hwnd) || NativeMethods.IsZoomed(hwnd)) NativeMethods.ShowWindow(hwnd, 9);
            if (!NativeMethods.SetWindowPos(hwnd, IntPtr.Zero, rect.x, rect.y, rect.width, rect.height, 0x0014))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Windows denied positioning this window. Elevated or protected windows may be unavailable.");
            if (!NativeMethods.GetWindowRect(hwnd, out var observed)) throw new Win32Exception(Marshal.GetLastWin32Error());
            if (Math.Abs(observed.Left - rect.x) > 2 || Math.Abs(observed.Top - rect.y) > 2 || Math.Abs(observed.Right - observed.Left - rect.width) > 2 || Math.Abs(observed.Bottom - observed.Top - rect.height) > 2)
                throw new NativeError("constrained", "The application constrained its window size or position. Choose a larger zone.");
            return new { success = true, layout, windowHandle = hwnd.ToInt64().ToString(), bounds = new { x = observed.Left, y = observed.Top, width = observed.Right - observed.Left, height = observed.Bottom - observed.Top } };
        }
        finally { if (previousDpi != IntPtr.Zero) NativeMethods.SetThreadDpiAwarenessContext(previousDpi); }
    }

    internal static (int x, int y, int width, int height) Layout(string layout, NativeMethods.Rect work)
    {
        var width = work.Right - work.Left;
        var height = work.Bottom - work.Top;
        if (width <= 0 || height <= 0) throw new NativeError("unavailable", "Monitor work area is invalid.");
        return layout switch
        {
            "left" => (work.Left, work.Top, width / 2, height),
            "right" => (work.Left + width / 2, work.Top, width - width / 2, height),
            "maximize" => (work.Left, work.Top, width, height),
            "center" => (work.Left + width / 8, work.Top + height / 8, width * 3 / 4, height * 3 / 4),
            "top-left" => (work.Left, work.Top, width / 2, height / 2),
            "top-right" => (work.Left + width / 2, work.Top, width - width / 2, height / 2),
            "bottom-left" => (work.Left, work.Top + height / 2, width / 2, height - height / 2),
            "bottom-right" => (work.Left + width / 2, work.Top + height / 2, width - width / 2, height - height / 2),
            _ => throw new NativeError("invalid_request", "Unknown snap layout.")
        };
    }

    public static object GetBrightness()
    {
        using var search = new ManagementObjectSearcher("root\\WMI", "SELECT CurrentBrightness FROM WmiMonitorBrightness WHERE Active = TRUE");
        using var results = search.Get();
        foreach (ManagementObject monitor in results)
        {
            using (monitor) return new { available = true, value = Convert.ToInt32(monitor["CurrentBrightness"]) };
        }
        throw new NativeError("unavailable", "This display does not expose Windows monitor brightness controls. External displays may require their own controls.");
    }

    public static object SetBrightness(JsonElement p)
    {
        var value = (byte)Math.Round(Parameters.Number(p, "value", 0, 100));
        using var search = new ManagementObjectSearcher("root\\WMI", "SELECT * FROM WmiMonitorBrightnessMethods WHERE Active = TRUE");
        using var results = search.Get();
        var changed = false;
        foreach (ManagementObject monitor in results)
        {
            using (monitor)
            {
                using var parameters = monitor.GetMethodParameters("WmiSetBrightness");
                parameters["Timeout"] = 1;
                parameters["Brightness"] = value;
                using var result = monitor.InvokeMethod("WmiSetBrightness", parameters, null);
                if (result?["ReturnValue"] is { } status && Convert.ToUInt32(status) != 0) throw new NativeError("rejected", "The display rejected the brightness change.");
                changed = true;
            }
        }
        if (!changed) throw new NativeError("unavailable", "This display does not support Windows brightness control.");
        return GetBrightness();
    }

    public static (int? percent, bool charging, bool available) BatteryStatus()
    {
        if (!NativeMethods.GetSystemPowerStatus(out var status)) throw new Win32Exception(Marshal.GetLastWin32Error());
        var available = status.BatteryFlag != 255 && (status.BatteryFlag & 128) == 0 && status.BatteryLifePercent <= 100;
        return (available ? status.BatteryLifePercent : null, available && (status.BatteryFlag & 8) != 0, available);
    }

    public static Battery GetBattery()
    {
        var status = BatteryStatus();
        return new Battery(status.percent, status.charging, status.available);
    }

    internal sealed record Battery(int? percent, bool charging, bool available);

    public static async Task<object> Bluetooth()
    {
        var adapter = await BluetoothAdapter.GetDefaultAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(8));
        if (adapter == null) throw new NativeError("unavailable", "No Bluetooth adapter is available.");
        var properties = new[] { "System.Devices.Aep.IsConnected", "System.Devices.Aep.IsPaired" };
        var selector = BluetoothDevice.GetDeviceSelectorFromPairingState(true);
        var classic = await DeviceInformation.FindAllAsync(selector, properties).AsTask().WaitAsync(TimeSpan.FromSeconds(8));
        var le = await DeviceInformation.FindAllAsync(BluetoothLEDevice.GetDeviceSelectorFromPairingState(true), properties).AsTask().WaitAsync(TimeSpan.FromSeconds(8));
        return classic.Concat(le).GroupBy(d => d.Id).Select(group => group.First()).Select(device =>
        {
            bool Flag(string name) => device.Properties.TryGetValue(name, out var value) && value is bool b && b;
            // Windows has no documented universal battery property on AssociationEndpoint.
            // A future explicit GATT Battery Service read can provide a value for compatible LE devices.
            return new { id = device.Id, name = device.Name, paired = device.Pairing.IsPaired || Flag("System.Devices.Aep.IsPaired"), connected = Flag("System.Devices.Aep.IsConnected"), battery = (int?)null };
        }).ToArray();
    }

    public static async Task<HelloStatus> HelloAvailability()
    {
        var status = await UserConsentVerifier.CheckAvailabilityAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(8));
        var face = HelloEnrollment.Read();
        return new HelloStatus(status == UserConsentVerifierAvailability.Available, status.ToString(), status == UserConsentVerifierAvailability.Available ? null : "Windows Hello: " + status, face.Enrolled, face.Reason, HelloEnrollment.DisabledByPolicy());
    }

    internal sealed record HelloStatus(bool available, string status, string? reason, bool? faceEnrolled, string? faceReason, bool? biometricsDisabledByPolicy);

    public async Task<object> VerifyHello(JsonElement p)
    {
        var handle = Parameters.Text(p, "windowHandle", 24);
        if (!long.TryParse(handle, out var raw) || raw <= 0 || !NativeMethods.IsWindow(new IntPtr(raw))) throw new NativeError("invalid_request", "A valid Sapphire window handle is required.");
        NativeMethods.GetWindowThreadProcessId(new IntPtr(raw), out var ownerPid);
        if (parentPid <= 0 || ownerPid != parentPid) throw new NativeError("invalid_request", "Verification must be owned by Sapphire's window.");
        var availability = await HelloAvailability();
        if (!availability.available) throw new NativeError("unavailable", availability.reason!);
        var status = await UserConsentVerifierInterop.RequestVerificationForWindowAsync(new IntPtr(raw), "Verify your identity for Sapphire.").AsTask().WaitAsync(TimeSpan.FromMinutes(2));
        return new { verified = status == UserConsentVerificationResult.Verified, status = status.ToString() };
    }

    public void Dispose() => foregroundTimer.Dispose();
}
